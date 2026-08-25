const router = require('express').Router();
const Booking = require('../models/Booking');
const TutorProfile = require('../models/TutorProfile');
const Child = require('../models/Child');
const { attachUserIfPresent, requireAuth } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/mailer');
const { notify } = require('../utils/notifications');

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

// POST /api/bookings — matches book.html
router.post('/', attachUserIfPresent, async (req, res) => {
  try {
    const {
      grade, subject, other, topic, goal,
      session, platform, city, address, language,
      date, time, duration, notes, tutorId, childId,
    } = req.body;

    if (!grade) {
      return res.status(400).json({ message: 'Grade is required' });
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

    // Session-type-specific requirements: an online meeting platform only makes
    // sense for online sessions, and shouldn't be forced on in-person bookings.
    if (session === 'online' && !platform) {
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
      platform,
      city,
      address,
      language,
      date: date || undefined,
      time,
      duration,
      notes,
    });

    res.status(201).json({ message: 'Booking request submitted', booking });

    notifyAdmin(
      `New booking request (${grade})`,
      `Subject(s): ${(booking.subject || []).join(', ') || other || '-'}\n` +
        (child ? `For: ${child.name}\n` : '') +
        `Session: ${session || '-'} via ${platform || '-'}\n` +
        `City: ${city || '-'}\n` +
        `Date/time: ${date || '-'} ${time || ''}\n` +
        (notes ? `Notes: ${notes}\n` : '') +
        `\nView it on your admin page.`
    );

    if (tutorId) {
      TutorProfile.findById(tutorId).then((tutor) => {
        if (tutor && tutor.user) {
          notify(tutor.user, `New booking request for ${(booking.subject || []).join(', ') || 'a session'} (${grade}).`, '../dashboards/tutor-dash.html');
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
