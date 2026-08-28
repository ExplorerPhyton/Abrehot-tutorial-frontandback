const router = require('express').Router();
const Booking = require('../models/Booking');
const TutorProfile = require('../models/TutorProfile');
const Child = require('../models/Child');
const { attachUserIfPresent, requireAuth } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/mailer');
const { notify } = require('../utils/notifications');
const { verifyPaymentReference } = require('../utils/paymentVerifier');

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function getDurationMinutes(durationStr) {
  if (!durationStr) return 60;
  if (durationStr.includes('1.5')) return 90;
  if (durationStr.includes('2 +') || durationStr.includes('2+')) return 150;
  if (durationStr.includes('2')) return 120;
  return 60;
}

function getSessionTimeRange(dateVal, timeStr, durationStr) {
  if (!dateVal || !timeStr) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;

  let hours = 9, minutes = 0;
  if (typeof timeStr === 'string' && timeStr.includes(':')) {
    const parts = timeStr.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  }

  const start = new Date(d);
  start.setHours(hours, minutes, 0, 0);
  const durMins = getDurationMinutes(durationStr);
  const end = new Date(start.getTime() + durMins * 60 * 1000);

  return { start: start.getTime(), end: end.getTime() };
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// POST /api/bookings — matches book.html
router.post('/', attachUserIfPresent, async (req, res) => {
  try {
    const {
      grade, subject, other, topic, goal,
      session, groupMode, groupSize, platform, city, address, language,
      date, time, duration, notes, tutorId, childId,
      paymentMethod, transactionId,
      planType, selectedDays, selectedTimeSlots,
    } = req.body;

    if (!grade) {
      return res.status(400).json({ message: 'Grade is required' });
    }

    if (planType === 'monthly') {
      const daysArr = toArray(selectedDays);
      if (!daysArr.length) {
        return res.status(400).json({ message: 'Please select at least one day for your monthly tutoring plan.' });
      }
    }

    if (!paymentMethod || !['CBE', 'Telebirr'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Please select a valid payment method (CBE or Telebirr).' });
    }
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({ message: 'Transaction ID / Reference is required to complete your payment.' });
    }

    // --- Automated Payment Reference Verification ---
    const paymentCheck = await verifyPaymentReference(paymentMethod, transactionId);
    if (!paymentCheck.success) {
      return res.status(400).json({ message: paymentCheck.message });
    }

    if (!date || !time) {
      return res.status(400).json({ message: 'Preferred Date and Time are required to schedule your session.' });
    }

    // Tutors book out their own time — they don't book sessions with other
    // tutors through this form.
    if (req.user && req.user.role === 'Tutor') {
      return res.status(403).json({ message: 'Tutor accounts cannot book tutoring sessions.' });
    }

    // A booking with no tutor attached has nobody to accept/act on it — it just
    // sits there forever. Students/parents must pick a tutor (on tutors.html)
    // before they can submit the booking form.
    if (!tutorId) {
      return res.status(400).json({ message: 'Please choose a tutor before booking a session.' });
    }
    const chosenTutor = await TutorProfile.findById(tutorId).catch(function () { return null; });
    if (!chosenTutor || chosenTutor.status !== 'approved') {
      return res.status(400).json({ message: 'That tutor is not available for booking.' });
    }

    // --- Timetable Schedule Check ---
    // Prevent double booking: verify the tutor has no existing overlapping session on the same date and time.
    const reqRange = getSessionTimeRange(date, time, duration);
    if (reqRange) {
      const activeBookings = await Booking.find({
        tutor: tutorId,
        status: { $in: ['pending', 'confirmed'] },
      });

      const conflict = activeBookings.find((b) => {
        if (!isSameDay(b.date, date)) return false;
        const existRange = getSessionTimeRange(b.date, b.time, b.duration);
        if (!existRange) return false;
        return Math.max(reqRange.start, existRange.start) < Math.min(reqRange.end, existRange.end);
      });

      if (conflict) {
        return res.status(400).json({
          message: 'This tutor is already booked for another session at this time. Please select a different time or date.',
        });
      }
    }

    // Group sessions: the booker must say how many students are splitting the
    // rate (2-30) and how the group will actually meet the tutor (online picks a
    // platform, in-person picks a location).
    let effectiveMode = session; // for 'online'/'in-person' the venue is the session itself
    if (session === 'group') {
      const size = Number(groupSize);
      if (!Number.isInteger(size) || size < 2 || size > 30) {
        return res.status(400).json({ message: 'Please enter how many students are in the group (2 to 30).' });
      }
      if (groupMode !== 'online' && groupMode !== 'in-person') {
        return res.status(400).json({ message: 'Please choose how the group will meet: online or in-person.' });
      }
      effectiveMode = groupMode;
    }

    // Session-type-specific requirements: an online meeting platform only makes
    // sense for online sessions (including online group sessions), and shouldn't
    // be forced on in-person bookings.
    if (effectiveMode === 'online' && !platform) {
      return res.status(400).json({ message: 'Please choose an online meeting platform.' });
    }

    // If a childId was sent, make sure it actually belongs to whoever is logged in —
    // otherwise a parent could book "for" someone else's child.
    let child = null;
    if (childId) {
      child = await Child.findById(childId);
      if (!child || !req.user || child.parent.toString() !== req.user.id) {
        return res.status(400).json({ message: 'Invalid child selected' });
      }
    }

    // Snapshot the tutor's rate at booking time so the price shown today
    // stays stable even if the tutor changes their profile later.
    const isMonthlyPlan = planType === 'monthly';
    const activeRate = isMonthlyPlan
      ? (chosenTutor.monthlyPrice != null ? Number(chosenTutor.monthlyPrice) : (chosenTutor.price != null ? Number(chosenTutor.price) * 12 : undefined))
      : (chosenTutor.price != null ? Number(chosenTutor.price) : undefined);
    const tutorRate = activeRate;

    // Group sessions are a flat split of the tutor's hourly rate across the
    // attending students — no extra discount, the split IS the saving. Each
    // student pays rate / groupSize, and the whole group collectively pays the
    // full hourly rate (perPersonPrice * groupSize === tutorRate, modulo rounding).
    let perPersonPrice, groupTotalPrice;
    if (session === 'group' && tutorRate != null) {
      const size = Number(groupSize);
      perPersonPrice = Math.round((tutorRate / size) * 100) / 100;
      groupTotalPrice = tutorRate;
    }

    const booking = await Booking.create({
      requestedBy: req.user ? req.user.id : undefined,
      tutor: tutorId || undefined,
      child: child ? child._id : undefined,
      grade,
      subject: toArray(subject),
      otherSubject: other,
      topic,
      goal: toArray(goal),
      session,
      groupMode: session === 'group' ? groupMode : undefined,
      groupSize: session === 'group' ? Number(groupSize) : undefined,
      platform,
      city,
      address,
      language,
      date: date || undefined,
      time,
      duration,
      notes,
      planType: isMonthlyPlan ? 'monthly' : 'hourly',
      selectedDays: isMonthlyPlan ? toArray(selectedDays) : [],
      selectedTimeSlots: isMonthlyPlan ? (selectedTimeSlots || []) : [],
      paymentMethod,
      transactionId: transactionId.trim(),
      paymentStatus: 'Verified',
      status: 'confirmed', // Auto-confirmed: timetable schedule check passed & payment reference verified
      tutorRate,
      perPersonPrice,
      groupTotalPrice,
    });

    res.status(201).json({ message: 'Booking confirmed and scheduled successfully!', booking });

    const groupLine = session === 'group'
      ? `Group session for ${booking.groupSize} students — ${perPersonPrice != null ? perPersonPrice + ' ETB/person' : 'rate split equally'} (${groupMode})\n`
      : '';

    notifyAdmin(
      `New confirmed booking (${grade}) - Paid via ${paymentMethod}`,
      `Subject(s): ${(booking.subject || []).join(', ') || other || '-'}\n` +
        (child ? `For: ${child.name}\n` : '') +
        `Session: ${session || '-'} via ${platform || '-'}\n` +
        groupLine +
        `City: ${city || '-'}\n` +
        `Date/time: ${date || '-'} ${time || ''}\n` +
        `Payment Method: ${paymentMethod}\n` +
        `Transaction ID: ${transactionId.trim()}\n` +
        (notes ? `Notes: ${notes}\n` : '') +
        `\nView it on your admin page.`
    );

    if (tutorId) {
      TutorProfile.findById(tutorId).then((tutor) => {
        if (tutor && tutor.user) {
          const groupNote = session === 'group' ? ` for a group of ${booking.groupSize} students` : '';
          notify(tutor.user, `New confirmed booking scheduled${groupNote} for ${(booking.subject || []).join(', ') || 'a session'} on ${date} ${time}.`, '../dashboards/tutor-dash.html');
        }
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'Could not submit booking', error: err.message });
  }
});

// GET /api/bookings/mine — a logged-in user's own booking requests, as the requester
// (for parent-dash.html and student-dash.html)
router.get('/mine', requireAuth, async (req, res) => {
  const bookings = await Booking.find({ requestedBy: req.user.id })
    .populate('tutor', 'fullname')
    .populate('child', 'name grade')
    .sort({ date: 1, createdAt: -1 });
  res.json(bookings);
});

// GET /api/bookings/for-tutor — bookings assigned to the logged-in user's tutor profile
// (for tutor-dash.html)
router.get('/for-tutor', requireAuth, async (req, res) => {
  const profile = await TutorProfile.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!profile) return res.json([]); // not a tutor / no application yet — just show nothing
  const bookings = await Booking.find({ tutor: profile._id })
    .populate('requestedBy', 'fullname email phone role')
    .populate('child', 'name grade')
    .sort({ date: 1, createdAt: -1 });
  res.json(bookings);
});

// PATCH /api/bookings/:id/cancel — used by the "Cancel"/"Remove" buttons.
// Only the person who requested it, or the assigned tutor, may cancel it.
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const isRequester = booking.requestedBy && booking.requestedBy.toString() === req.user.id;
  let tutorProfile = null;
  let isAssignedTutor = false;
  if (booking.tutor) {
    tutorProfile = await TutorProfile.findOne({ user: req.user.id });
    isAssignedTutor = tutorProfile && booking.tutor.toString() === tutorProfile._id.toString();
  }
  if (!isRequester && !isAssignedTutor) {
    return res.status(403).json({ message: 'Not allowed to cancel this booking' });
  }

  booking.status = 'cancelled';
  await booking.save();

  // Let the other side know — whoever didn't do the cancelling.
  if (isRequester && booking.tutor) {
    TutorProfile.findById(booking.tutor).then((tutor) => {
      if (tutor && tutor.user) {
        notify(tutor.user, 'A booking request was cancelled by the requester.', '../dashboards/tutor-dash.html');
      }
    });
  } else if (isAssignedTutor && booking.requestedBy) {
    notify(booking.requestedBy, 'Your booking request was declined or cancelled by the tutor.', '../dashboards/parent-dash.html');
  }

  res.json(booking);
});

// PATCH /api/bookings/:id/confirm — tutor accepts a pending request
router.patch('/:id/confirm', requireAuth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const tutorProfile = await TutorProfile.findOne({ user: req.user.id });
  const isAssignedTutor = tutorProfile && booking.tutor && booking.tutor.toString() === tutorProfile._id.toString();
  if (!isAssignedTutor) {
    return res.status(403).json({ message: 'Only the assigned tutor can confirm this booking' });
  }
  if (booking.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending requests can be confirmed' });
  }

  booking.status = 'confirmed';
  await booking.save();

  if (booking.requestedBy) {
    notify(booking.requestedBy, 'Your booking request was confirmed by the tutor.', '../dashboards/student-dash.html');
  }

  res.json(booking);
});

// PATCH /api/bookings/:id/complete — tutor marks a confirmed session done.
// body: { attended: true|false } — true if the student showed up, false for
// a no-show. This is also what feeds the student's Attendance stat.
router.patch('/:id/complete', requireAuth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const tutorProfile = await TutorProfile.findOne({ user: req.user.id });
  const isAssignedTutor = tutorProfile && booking.tutor && booking.tutor.toString() === tutorProfile._id.toString();
  if (!isAssignedTutor) {
    return res.status(403).json({ message: 'Only the assigned tutor can complete this booking' });
  }
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ message: 'Only confirmed sessions can be marked completed' });
  }

  booking.status = 'completed';
  booking.attended = req.body.attended !== false; // default to true unless explicitly marked a no-show
  await booking.save();

  if (booking.requestedBy) {
    notify(
      booking.requestedBy,
      booking.attended ? 'Your session was marked as completed.' : 'You were marked as a no-show for a scheduled session.',
      '../dashboards/student-dash.html'
    );
  }

  res.json(booking);
});

module.exports = router;
