// Shared helper for talking to the Abrehot backend.
// Include this on any page BEFORE your page-specific script:
//   <script src="js/api.js"></script>   (use "../js/api.js" from inside /dashboards)

const API_BASE = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('abrehot_token');
}
function setToken(token) {
  localStorage.setItem('abrehot_token', token);
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('abrehot_user'));
  } catch (e) {
    return null;
  }
}
function setUser(user) {
  localStorage.setItem('abrehot_user', JSON.stringify(user));
}
function logout() {
  localStorage.removeItem('abrehot_token');
  localStorage.removeItem('abrehot_user');
}

// Central fetch wrapper. Throws an Error with .message from the API on failure.
async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Is the backend running on http://localhost:5000?');
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }
  if (!res.ok) {
    throw new Error((data && data.message) || 'Request failed (' + res.status + ')');
  }
  return data;
}

// Where to send someone right after login/signup, based on their role.
// Call from pages at the project root (login.html, create-account.html).
function dashboardPathForRole(role) {
  const map = {
    Parent: 'dashboards/parent-dash.html',
    Student: 'dashboards/student-dash.html',
    Tutor: 'dashboards/tutor-dash.html',
  };
  return map[role] || 'home.html';
}

// Shows a small success/error message above a form without needing extra HTML.
function showFormMessage(form, text, isError) {
  let el = form.querySelector('.api-message');
  if (!el) {
    el = document.createElement('p');
    el.className = 'api-message';
    form.prepend(el);
  }
  el.textContent = text;
  el.style.color = isError ? '#c0392b' : '#1e8449';
  el.style.fontWeight = 'bold';
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Updates every "Log In" / "Sign Up" link in the nav (desktop menu, mobile menu,
// footer, promo sections — wherever they appear) to reflect that someone is
// actually logged in. Runs automatically on any page that loads this file.
function applyNavAuthState() {
  var user = getUser();
  var token = getToken();
  if (!user || !token) return; // not logged in — leave the nav as-is

  document.querySelectorAll('a[href="login.html"], a[href="../login.html"]').forEach(function (link) {
    link.setAttribute('href', dashboardPathForRole(user.role));
    var textEl = link.querySelector('span, div, button') || link;
    textEl.textContent = 'Dashboard';
  });

  document.querySelectorAll('a[href="create-account.html"], a[href="../create-account.html"]').forEach(function (link) {
    link.setAttribute('href', '#');
    var textEl = link.querySelector('span, div, button') || link;
    textEl.textContent = 'Log Out';
    link.addEventListener('click', function (e) {
      e.preventDefault();
      logout();
      window.location.reload();
    });
  });
}

document.addEventListener('DOMContentLoaded', applyNavAuthState);
