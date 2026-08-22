const router = require('express').Router();
const TutorProfile = require('../models/TutorProfile');
const { attachUserIfPresent, requireAuth } = require('../middleware/auth');

// Helper: HTML checkboxes with the same `name` submit as a single value when only
// one is checked, and as an array when several are checked. Normalize to an array.
function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

// POST /api/tutors/apply — matches becomeatutor.html
router.post('/apply', attachUserIfPresent, async (req, res) => {
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
      user: req.user ? req.user.id : undefined,
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

// PATCH /api/tutors/me — used by the "Update Subjects / Grades / Teaching Mode" buttons
router.patch('/me', requireAuth, async (req, res) => {
  const profile = await TutorProfile.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!profile) return res.status(404).json({ message: 'No tutor profile found for this account' });

  const editable = ['subjects', 'grades', 'languages', 'mode', 'price', 'bio', 'availability', 'experience', 'education', 'institution', 'city', 'address'];
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

// GET /api/tutors/:id — a single tutor's public profile
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
