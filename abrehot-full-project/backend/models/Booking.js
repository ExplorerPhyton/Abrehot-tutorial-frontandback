const mongoose = require('mongoose');

// Matches every field in book.html
const bookingSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional, if logged in
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorProfile' }, // optional, if booking a specific tutor
    child: { type: mongoose.Schema.Types.ObjectId, ref: 'Child' }, // who the session is actually for, when requestedBy is a Parent

    grade: { type: String, required: true }, // Kindergarten (KG) ... Grade 12
    subject: [String], // mathematics, english, physics, chemistry, biology, iCT, history, geography, other
    otherSubject: String, // free-text "other" subject
    topic: String, // e.g. "Algebra"
    goal: [String], // homework, exam, assignment, revision, weeklytutoring

    // Group sessions are their own session type — the tutor's rate is split
    // equally between the students attending, so each student pays less than
    // they would for a private (in-person or online) session.
    session: { type: String, enum: ['online', 'in-person', 'group'] },
    // Only for group sessions: how the group actually meets the tutor.
    // A group can meet online (picking a platform) or in-person (picking a location).
    groupMode: { type: String, enum: ['online', 'in-person'] },
    // Only for group sessions: how many students are splitting the rate.
    groupSize: { type: Number, min: 2, max: 30 },
    platform: { type: String, enum: ['googleMeet', 'zoom', 'microsoftTeams', 'telegram'] },

    // Plan type: 'hourly' session vs 'monthly' recurring plan
    planType: { type: String, enum: ['hourly', 'monthly'], default: 'hourly' },
    selectedDays: [String], // for monthly plan: e.g. ['Monday', 'Wednesday', 'Friday']
    selectedTimeSlots: [
      {
        day: String,
        startTime: String,
        endTime: String,
      },
    ],

    // Pricing snapshot, captured from the tutor's rate at booking time so later
    // rate changes on the tutor's profile never rewrite past bookings.
    // tutorRate is the hourly rate; for group sessions perPersonPrice is that
    // rate split equally (tutorRate / groupSize) and groupTotalPrice is what the
    // whole group collectively pays (the full hourly rate).
    tutorRate: Number,
    perPersonPrice: Number,
    groupTotalPrice: Number,

    city: String,
    address: String,
    language: { type: String, enum: ['English', 'Amharic', 'Afaan Oromo', 'Tigrinya'] },

    date: Date,
    time: String, // stored as "HH:MM" from the <input type="time">
    duration: { type: String, enum: ['1 Hour', '1.5 Hours', '2 Hours', '2 + Hours'] },
    notes: String,

    // Payment details required before booking completion
    paymentMethod: { type: String, enum: ['CBE', 'Telebirr'] },
    transactionId: { type: String, trim: true },
    paymentStatus: { type: String, enum: ['Pending Verification', 'Verified', 'Rejected'], default: 'Pending Verification' },

    // Sessions are automatically confirmed upon timetable schedule check and payment completion
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'confirmed' },
    // Set only once a session is marked completed by the tutor: true = the
    // student showed up, false = no-show. Null for everything else, which is
    // what lets attendance % only count sessions that actually happened.
    attended: { type: Boolean, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
