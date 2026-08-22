const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, fullname: user.fullname },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register  — matches create-account.html
router.post('/register', async (req, res) => {
  try {
    const { fullname, phone, email, password, confirmPassword, account, city } = req.body;

    if (!fullname || !email || !password || !account) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullname,
      phone,
      email,
      password: hashed,
      role: account, // "Parent" | "Student" | "Tutor"
      city,
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, fullname: user.fullname, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

// POST /api/auth/login — matches login.html (name, role, email, password)
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid email or password' });

    // Optional: catch a mismatched role selection at login
    if (role && role !== user.role) {
      return res.status(400).json({
        message: `This account is registered as ${user.role}, not ${role}. Select the correct role and try again.`,
      });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, fullname: user.fullname, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

// GET /api/auth/me — return the logged-in user (used to autofill pages like contact.html)
const { requireAuth } = require('../middleware/auth');
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// PATCH /api/auth/me — used by the "Edit Profile" buttons on dashboards
router.patch('/me', requireAuth, async (req, res) => {
  const editable = ['fullname', 'phone', 'city'];
  const updates = {};
  editable.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

module.exports = router;
