const router = require('express').Router();
const TutorProfile = require('../models/TutorProfile');
const Rating = require('../models/Rating');
const { attachUserIfPresent, requireAuth } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/mailer');

// Helper: HTML checkboxes with the same `name` submit as a single value when only
// one is checked, and as an array when several are checked. Normalize to an array.
function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

// POST /api/tutors/apply — matches becomeatutor.html
// Login is required: approval promotes this account's role to "Tutor", so
// there has to be an account to promote in the first place.
router.post('/apply', requireAuth, async (req, res) => {
  try {
    const {
      fullname, gender, dob, phone, email,
      education, institution, experience, certificateUrl,
      subject, grade, language, mode,
      city, address, price, availability, bio,
    } = req.body;

    if (!fullname || !phone || !email || !city) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const profile = await TutorProfile.create({
      user: req.user.id,
      fullname, gender, dob, phone, email,
      education, institution, experience, certificateUrl,
      subjects: toArray(subject),
      grades: toArray(grade),
      languages: toArray(language),
      mode,
      city, address,
      price: price ? Number(price) : undefined,
      availability, bio,
    });

    notifyAdmin(
      `New tutor application: ${fullname}`,
      `${fullname} (${email}, ${phone}) just applied to become a tutor.\n\n` +
        `Subjects: ${(profile.subjects || []).join(', ') || '-'}\n` +
        `Grades: ${(profile.grades || []).join(', ') || '-'}\n` +
        `City: ${city || '-'}\n\n` +
        `Review and approve it on your admin page.`
    );

    res.status(201).json({
      message: 'Application submitted. It will be reviewed before appearing in search.',
      profile,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit application', error: err.message });
  }
});

// GET /api/tutors/me — the logged-in tutor's own profile (for tutor-dash.html)
// Must come BEFORE /:id or Express will treat "me" as an id.
router.get('/me', requireAuth, async (req, res) => {
  const profile = await TutorProfile.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!profile) {
    return res.status(404).json({ message: 'No tutor application found for this account yet. Submit one via becomeatutor.html.' });
  }
  res.json(profile);
});

// PATCH /api/tutors/me — used by the "Update Profile / Pricing / Availability" buttons
router.patch('/me', requireAuth, async (req, res) => {
  const profile = await TutorProfile.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!profile) return res.status(404).json({ message: 'No tutor profile found for this account' });

  const editable = [
    'subjects', 'grades', 'languages', 'mode', 'price', 'monthlyPrice',
    'bio', 'availability', 'availableDays', 'availableTimeSlots',
    'experience', 'education', 'institution', 'city', 'address', 'profilePhotoUrl',
  ];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) profile[field] = req.body[field];
  });
  await profile.save();
  res.json(profile);
});

// GET /api/tutors — matches the "Find Your Tutor" search on tutors.html
// Supports query params: ?subject=Mathematics&city=Addis%20Ababa&language=Amharic&grade=Grade%209-10&mode=Online
router.get('/', async (req, res) => {
  try {
    const { subject, city, language, grade, mode } = req.query;
    const filter = { status: 'approved' };

    if (subject) filter.subjects = subject;
    if (language) filter.languages = language;
    if (grade) filter.grades = grade;
    if (mode) filter.mode = mode;
    if (city) filter.city = { $regex: city, $options: 'i' };

    const tutors = await TutorProfile.find(filter).sort({ createdAt: -1 });
    res.json(tutors);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch tutors', error: err.message });
  }
});

// GET /api/tutors/recommended — top-rated approved tutors (a simple, honest
// "recommendation": highest average rating first, then most ratings, then
// newest — not personalized, just the best-reviewed tutors on the platform).
// Must come BEFORE /:id or Express will treat "recommended" as an id.
router.get('/recommended', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 4, 10);
  const tutors = await TutorProfile.find({ status: 'approved' })
    .sort({ averageRating: -1, ratingCount: -1, createdAt: -1 })
    .limit(limit);
  res.json(tutors);
});

// --- Rating & review routes MUST come BEFORE /:id so Express doesn't
//     treat "rate" or "reviews" as a tutor id. ---

// POST /api/tutors/:id/rate — rate a tutor (or update your existing rating of them)
router.post('/:id/rate', requireAuth, async (req, res) => {
  try {
    const value = Number(req.body.rating);
    if (!value || value < 1 || value > 5) {
      return res.status(400).json({ message: 'Rating must be a number from 1 to 5' });
    }
    const tutor = await TutorProfile.findById(req.params.id);
    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });

    await Rating.findOneAndUpdate(
      { tutor: tutor._id, user: req.user.id },
      { rating: value, comment: req.body.comment },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const stats = await Rating.aggregate([
      { $match: { tutor: tutor._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const avg = stats.length ? stats[0].avg : 0;
    const count = stats.length ? stats[0].count : 0;

    tutor.averageRating = Math.round(avg * 10) / 10;
    tutor.ratingCount = count;
    await tutor.save();

    res.json({ averageRating: tutor.averageRating, ratingCount: tutor.ratingCount, yourRating: value });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit rating', error: err.message });
  }
});

// GET /api/tutors/:id/rate — the logged-in user's existing rating for this tutor, if any
router.get('/:id/rate', requireAuth, async (req, res) => {
  const existing = await Rating.findOne({ tutor: req.params.id, user: req.user.id });
  res.json({ yourRating: existing ? existing.rating : null });
});

// GET /api/tutors/:id/reviews — most recent ratings/comments for a tutor, with the
// reviewer's name (public — used on the tutor's own dashboard).
router.get('/:id/reviews', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  try {
    const reviews = await Rating.find({ tutor: req.params.id })
      .populate('user', 'fullname')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(reviews.map(function (r) {
      return {
        reviewer: r.user ? r.user.fullname : 'Anonymous',
        rating: r.rating,
        comment: r.comment || '',
        createdAt: r.createdAt,
      };
    }));
  } catch (err) {
    res.status(400).json({ message: 'Invalid tutor id' });
  }
});

// GET /api/tutors/:id — a single tutor's public profile (must come LAST among /:id routes)
router.get('/:id', async (req, res) => {
  try {
    const tutor = await TutorProfile.findById(req.params.id);
    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });
    res.json(tutor);
  } catch (err) {
    res.status(400).json({ message: 'Invalid tutor id' });
  }
});

module.exports = router;
