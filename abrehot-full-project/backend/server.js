require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// --- Middleware ---
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (e.g. opening the HTML file directly, curl, Postman)
      if (!origin || origin === 'null' || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS: ' + origin));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // supports plain HTML form posts too

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tutors', require('./routes/tutors'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Error fallback ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

// --- Start ---
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Abrehot backend running on http://localhost:${PORT}`));
});
