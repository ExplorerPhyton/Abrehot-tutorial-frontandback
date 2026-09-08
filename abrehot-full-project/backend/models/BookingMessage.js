const mongoose = require('mongoose');

const bookingMessageSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

bookingMessageSchema.index({ booking: 1, createdAt: 1 });

module.exports = mongoose.model('BookingMessage', bookingMessageSchema);
