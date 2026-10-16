# Paid online-session email setup

When an admin approves a paid online booking, the backend creates the selected
Zoom or Google Meet session and emails its join link to the customer's account
email or guest booking email. The email includes the session date, Addis Ababa
time, and duration.

## Backend environment

Set these in the backend deployment environment (Render's service environment
settings in production), not in frontend code:

- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`: credentials for a
  Zoom Server-to-Server OAuth app authorized to create meetings.
- Google Meet bookings also require `GOOGLE_SERVICE_ACCOUNT_FILE` and
  `GOOGLE_CALENDAR_ID`; configure them if customers can choose Google Meet.
- Email delivery: configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  and `MAIL_FROM`, or use `GMAIL_USER` and `GMAIL_APP_PASSWORD` as the fallback.
- `SITE_URL`: public website origin used to build links in confirmation emails.

For local development, use `.env.example` as a template and keep real values in
the ignored `.env` file. Never put credentials in frontend code or commit them.

## Delivery failures and retries

Payment approval remains successful even if Zoom or email delivery is
temporarily unavailable. The API response reports `zoomDelivery` and
`emailDelivery`. It does not send the confirmation email until the required
meeting link exists. In the admin panel's **Approved** payments list, use
**Retry meeting/email** after fixing the configuration or service issue. A
successful email is recorded on the booking to avoid duplicate confirmations.
