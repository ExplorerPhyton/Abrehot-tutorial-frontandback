const nodemailer = require('nodemailer');

let transporter = null;
let warnedOnce = false;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

// Fire-and-forget email to the admin. Never throws — a broken mail setup
// should never break the actual API request (submitting a booking, contact
// message, etc. still has to succeed even if the email fails).
async function notifyAdmin(subject, text) {
  const t = getTransporter();
  if (!t || !process.env.ADMIN_EMAIL) {
    if (!warnedOnce) {
      console.log('[mailer] Email notifications are off — set GMAIL_USER, GMAIL_APP_PASSWORD, and ADMIN_EMAIL in .env to enable them.');
      warnedOnce = true;
    }
    return;
  }
  try {
    await t.sendMail({
      from: `"Abrehot Online Tutorials" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject,
      text,
    });
  } catch (err) {
    console.error('[mailer] Failed to send notification email:', err.message);
  }
}

module.exports = { notifyAdmin };
