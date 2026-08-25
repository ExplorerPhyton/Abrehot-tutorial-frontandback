const router = require('express').Router();
const TutorProfile = require('../models/TutorProfile');
const Booking = require('../models/Booking');
const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const { requireAdmin } = require('../middleware/adminAuth');
const { notify } = require('../utils/notifications');

// Every route below requires the x-admin-secret header to match ADMIN_SECRET
router.use(requireAdmin);

// GET /api/admin/tutors?status=pending  (status optional, defaults to pending)
router.get('/tutors', async (req, res) => {
  const status = req.query.status || 'pending';
  const filter = status === 'all' ? {} : { status };
  const tutors = await TutorProfile.find(filter).sort({ createdAt: -1 });
  res.json(tutors);
});

// POST /api/admin/tutors/:id/approve
router.post('/tutors/:id/approve', async (req, res) => {
  const tutor = await TutorProfile.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
  if (!tutor) return res.status(404).json({ message: 'Not found' });

  // This is the ONLY place a user's role becomes "Tutor" — approval is what
  // actually grants tutor-dashboard access, not the signup form.
  if (tutor.user) {
    await User.findByIdAndUpdate(tutor.user, { role: 'Tutor' });
  }

  notify(tutor.user, "Great news — your tutor application has been approved! You're now listed on the Find a Tutor page.", '../dashboards/tutor-dash.html');
  res.json(tutor);
});

// POST /api/admin/tutors/:id/reject
router.post('/tutors/:id/reject', async (req, res) => {
  const tutor = await TutorProfile.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
  if (!tutor) return res.status(404).json({ message: 'Not found' });
  notify(tutor.user, 'Your tutor application was not approved this time. Contact support if you have questions.', '../contact.html');
  res.json(tutor);
});

// GET /api/admin/bookings — quick visibility into incoming booking requests
router.get('/bookings', async (req, res) => {
  const bookings = await Booking.find().sort({ createdAt: -1 }).limit(100);
  res.json(bookings);
});

// GET /api/admin/contact — quick visibility into contact form submissions
router.get('/contact', async (req, res) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(100);
  res.json(messages);
});

module.exports = router;
