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
