const ZOOM_API = 'https://api.zoom.us/v2';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ADDIS_ABABA = 'Africa/Addis_Ababa';
let cachedToken;

function getCredentials() {
  const credentials = {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
  };
  if (Object.values(credentials).some((value) => !value)) {
    throw new Error('Zoom is selected for this booking, but Zoom OAuth credentials are not configured on the backend.');
  }
  return credentials;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const { accountId, clientId, clientSecret } = getCredentials();
  const response = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: `Abrehot tutoring${subjects ? `: ${subjects}` : ''}`,
      type: 2,
      start_time: meetingStart(booking),
      duration: meetingDuration(booking),
      timezone: ADDIS_ABABA,
      settings: {
        join_before_host: false,
        waiting_room: true,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.id || !result.join_url) {
    throw new Error(result.message || `Zoom meeting creation failed (HTTP ${response.status}).`);
  }

  return { id: String(result.id), joinUrl: result.join_url };
}

function isZoomBooking(booking) {
  return booking.platform === 'zoom' &&
    (booking.session === 'online' || (booking.session === 'group' && booking.groupMode === 'online'));
}

module.exports = { createZoomMeeting, isZoomBooking };
