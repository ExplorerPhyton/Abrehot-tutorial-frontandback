const router = require('express').Router();
const Booking = require('../models/Booking');
const TutorProfile = require('../models/TutorProfile');
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
      date, time, duration, notes, tutorId,
    } = req.body;

    if (!grade) {
      return res.status(400).json({ message: 'Grade is required' });
    }

    const booking = await Booking.create({
      requestedBy: req.user ? req.user.id : undefined,
      tutor: tutorId || undefined,
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
    .sort({ date: 1, createdAt: -1 });
  res.json(bookings);
});

// GET /api/bookings/for-tutor — bookings assigned to the logged-in user's tutor profile
// (for tutor-dash.html)
router.get('/for-tutor', requireAuth, async (req, res) => {
  const profile = await TutorProfile.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!profile) return res.json([]); // not a tutor / no application yet — just show nothing
  const bookings = await Booking.find({ tutor: profile._id })
    .populate('requestedBy', 'fullname email phone')
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

module.exports = router;
