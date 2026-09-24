const router = require('express').Router();
const TutorProfile = require('../models/TutorProfile');
const Booking = require('../models/Booking');
const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const BookAd = require('../models/BookAd');
const { requireAdmin } = require('../middleware/adminAuth');
const { notify } = require('../utils/notifications');

// Every route below requires the x-admin-secret header to match ADMIN_SECRET
router.use(requireAdmin);

// GET /api/admin/tutors?status=pending  (status optional, defaults to pending)
router.get('/tutors', async (req, res) => {
  const status = req.query.status || 'pending';
  const filter = status === 'all' ? {} : { status };
  const tutors = await TutorProfile.find(filter).select('-price -monthlyPrice').sort({ createdAt: -1 });
  res.json(tutors);
});

// POST /api/admin/tutors/:id/approve
router.post('/tutors/:id/approve', async (req, res) => {
  const tutor = await TutorProfile.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
  if (!tutor) return res.status(404).json({ message: 'Not found' });

  // Tutor accounts already have the "Tutor" role from signup — approval here
  // only controls whether the profile is publicly listed on tutors.html.
  // The role sync below is kept as a safety net for any legacy application
  // whose user account somehow isn't marked "Tutor" yet.
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
  const bookings = await Booking.find()
    .populate('tutor', 'fullname user')
    .populate('requestedBy', 'fullname email')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(bookings);
});

// POST /api/admin/bookings/:id/approve — admin approves a pending request
router.post('/bookings/:id/approve', async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('tutor', 'fullname user');
  if (!booking) return res.status(404).json({ message: 'Not found' });
  if (booking.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending requests can be approved' });
  }

  booking.status = 'confirmed';
  await booking.save();

  if (booking.requestedBy) {
    notify(booking.requestedBy, 'Your booking request was approved by an admin and is now confirmed.', '../dashboards/student-dash.html');
  }
  if (booking.tutor && booking.tutor.user) {
    notify(booking.tutor.user, 'A booking request assigned to you was approved by an admin.', '../dashboards/tutor-dash.html');
  }

  res.json(booking);
});

// POST /api/admin/bookings/:id/reject — admin rejects a pending request
router.post('/bookings/:id/reject', async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('tutor', 'fullname user');
  if (!booking) return res.status(404).json({ message: 'Not found' });
  if (booking.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending requests can be rejected' });
  }

  booking.status = 'rejected';
  await booking.save();

  if (booking.requestedBy) {
    notify(booking.requestedBy, 'Your booking request was not approved by the admin. Contact support if you have questions.', '../contact.html');
  }
  // The tutor is intentionally not notified here — they were never shown this
  // request in the first place (see GET /api/bookings/for-tutor), so there's
  // nothing for them to be told got rejected.

  res.json(booking);
});

// GET /api/admin/contact — quick visibility into contact form submissions
router.get('/contact', async (req, res) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(100);
  res.json(messages);
});

// GET /api/admin/book-ads — every ad, including inactive ones (admin-only view)
router.get('/book-ads', async (req, res) => {
  const ads = await BookAd.find().sort({ createdAt: -1 });
  res.json(ads);
});

// POST /api/admin/book-ads — add a new book advertisement
router.post('/book-ads', async (req, res) => {
  const { title, author, description, price, imageUrl, buyLink } = req.body;
  if (!title || price === undefined || price === '') {
    return res.status(400).json({ message: 'Title and price are required' });
  }
  const ad = await BookAd.create({
    title,
    author,
    description,
    price: Number(price),
    imageUrl,
    buyLink,
  });
  res.status(201).json(ad);
});

// PATCH /api/admin/book-ads/:id — edit a book ad, or flip active/inactive
router.patch('/book-ads/:id', async (req, res) => {
  const editable = ['title', 'author', 'description', 'price', 'imageUrl', 'buyLink', 'active'];
  const updates = {};
  editable.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.price !== undefined) updates.price = Number(updates.price);
  const ad = await BookAd.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!ad) return res.status(404).json({ message: 'Not found' });
  res.json(ad);
});

// DELETE /api/admin/book-ads/:id
router.delete('/book-ads/:id', async (req, res) => {
  const ad = await BookAd.findByIdAndDelete(req.params.id);
  if (!ad) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Removed' });
});

module.exports = router;
