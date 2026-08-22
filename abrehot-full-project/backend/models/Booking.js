const mongoose = require('mongoose');

// Matches every field in book.html
const bookingSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional, if logged in
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorProfile' }, // optional, if booking a specific tutor

    grade: { type: String, required: true }, // Kindergarten (KG) ... Grade 12
    subject: [String], // mathematics, english, physics, chemistry, biology, iCT, history, geography, other
    otherSubject: String, // free-text "other" subject
    topic: String, // e.g. "Algebra"
    goal: [String], // homework, exam, assignment, revision, weeklytutoring

    session: { type: String, enum: ['online', 'in-person'] },
    platform: { type: String, enum: ['googleMeet', 'zoom', 'microsoftTeams', 'telegram'] },

    city: String,
    address: String,
    language: { type: String, enum: ['English', 'Amharic', 'Afaan Oromo', 'Tigrinya'] },

    date: Date,
    time: String, // stored as "HH:MM" from the <input type="time">
    duration: { type: String, enum: ['1 Hour', '1.5 Hours', '2 Hours', '2 + Hours'] },
    notes: String,

    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
