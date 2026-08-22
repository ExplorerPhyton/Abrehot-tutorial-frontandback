const router = require('express').Router();
const TutorProfile = require('../models/TutorProfile');
const Booking = require('../models/Booking');
const ContactMessage = require('../models/ContactMessage');
const { requireAdmin } = require('../middleware/adminAuth');

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
  res.json(tutor);
});

// POST /api/admin/tutors/:id/reject
router.post('/tutors/:id/reject', async (req, res) => {
  const tutor = await TutorProfile.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
  if (!tutor) return res.status(404).json({ message: 'Not found' });
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
