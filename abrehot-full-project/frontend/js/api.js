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
  applyProfileAvatar(user);
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

function getDashboardProfileImage() {
  return document.querySelector('.profile-img-section img');
}

var PRESET_AVATARS = [
  { id: 'avatar-sky', label: 'Sky', bg: '#1A5276', accent: '#85C1E9' },
  { id: 'avatar-rose', label: 'Rose', bg: '#9F3A4F', accent: '#F2A6B3' },
  { id: 'avatar-sage', label: 'Sage', bg: '#3E6B53', accent: '#A7D7B8' },
  { id: 'avatar-gold', label: 'Gold', bg: '#9A6418', accent: '#F4C36A' },
  { id: 'avatar-violet', label: 'Violet', bg: '#5B4B8A', accent: '#C4B5FD' },
  { id: 'avatar-teal', label: 'Teal', bg: '#0F766E', accent: '#99F6E4' },
];

function getPresetAvatar(id) {
  return PRESET_AVATARS.find(function (avatar) { return avatar.id === id; });
}

function defaultAvatarIdForRole(role) {
  if (role === 'Tutor') return 'avatar-gold';
  if (role === 'Student') return 'avatar-sage';
  return 'avatar-sky';
}

function getSelectedAvatarId(user) {
  return getPresetAvatar(user && user.avatar) ? user.avatar : defaultAvatarIdForRole(user && user.role);
}

function getInitials(user) {
  var source = (user && (user.fullname || user.email)) || 'A';
  var parts = String(source).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';
  var initials = parts.length === 1 ? parts[0].slice(0, 1) : parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1);
  return initials.toUpperCase();
}

function escapeSvgText(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
  });
}

function avatarDataUrl(avatarId, user) {
  var avatar = getPresetAvatar(avatarId) || PRESET_AVATARS[0];
  var initials = escapeSvgText(getInitials(user));
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<rect width="120" height="120" rx="60" fill="' + avatar.bg + '"/>'
    + '<circle cx="94" cy="24" r="28" fill="' + avatar.accent + '" opacity=".36"/>'
    + '<circle cx="30" cy="34" r="13" fill="#FFFFFF" opacity=".2"/>'
    + '<path d="M0 88 C25 70 48 78 73 60 C92 46 107 43 120 40 L120 120 L0 120 Z" fill="' + avatar.accent + '" opacity=".28"/>'
    + '<text x="60" y="72" text-anchor="middle" font-size="38" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">' + initials + '</text>'
    + '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function applyProfileAvatar(user) {
  var img = getDashboardProfileImage();
  if (!img) return;
  user = user || {};
  var avatarId = getSelectedAvatarId(user);
  img.src = avatarDataUrl(avatarId, user);
  img.dataset.avatar = avatarId;
  img.alt = user.fullname ? user.fullname + ' avatar' : 'Preset avatar';
}

function setAvatarPickerStatus(text) {
  var status = document.getElementById('avatarPickerStatus');
  if (status) status.textContent = text || '';
}

function renderPresetAvatarPicker(user) {
  var picker = document.getElementById('avatarPicker');
  if (!picker) return;

  var selectedId = getSelectedAvatarId(user);
  picker.innerHTML = '';
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Choose a preset avatar');

  PRESET_AVATARS.forEach(function (avatar) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-option' + (avatar.id === selectedId ? ' is-active' : '');
    btn.dataset.avatarId = avatar.id;
    btn.setAttribute('aria-label', avatar.label + ' avatar');
    btn.setAttribute('aria-pressed', avatar.id === selectedId ? 'true' : 'false');
    btn.title = avatar.label + ' avatar';

    var img = document.createElement('img');
    img.src = avatarDataUrl(avatar.id, user);
    img.alt = '';
    btn.appendChild(img);

    btn.addEventListener('click', function () {
      savePresetAvatar(avatar.id);
    });
    picker.appendChild(btn);
  });

  var status = document.createElement('p');
  status.id = 'avatarPickerStatus';
  status.className = 'avatar-picker-status';
  picker.appendChild(status);
}

async function savePresetAvatar(avatarId) {
  var current = getUser() || {};
  var previous = Object.assign({}, current);
  var optimistic = Object.assign({}, current, { avatar: avatarId });

  setUser(optimistic);
  renderPresetAvatarPicker(optimistic);
  setAvatarPickerStatus('Saving...');

  try {
    var updated = await apiRequest('/auth/me', {
      method: 'PATCH',
      auth: true,
      body: { avatar: avatarId },
    });
    setUser(updated);
    renderPresetAvatarPicker(updated);
    setAvatarPickerStatus('Avatar saved.');
  } catch (err) {
    setUser(previous);
    renderPresetAvatarPicker(previous);
    setAvatarPickerStatus('');
    alert('Could not save avatar: ' + err.message);
  }
}

function injectDashboardAvatarStyles() {
  if (document.getElementById('dashboardAvatarStyles')) return;

  var style = document.createElement('style');
  style.id = 'dashboardAvatarStyles';
  style.textContent = [
    '.profile-img-section{flex-wrap:wrap;}',
    '.profile-img-section img{object-fit:cover;background:#fff;}',
    '.avatar-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:230px;}',
    '.avatar-option{width:44px!important;height:44px!important;min-height:44px!important;margin:0!important;padding:2px!important;border-radius:50%!important;border:2px solid transparent!important;background:transparent!important;box-shadow:none!important;display:grid!important;place-items:center!important;cursor:pointer;}',
    '.avatar-option:hover{transform:translateY(-1px);border-color:var(--primary-light,#AED6F1)!important;}',
    '.avatar-option.is-active{border-color:var(--primary,#1A5276)!important;box-shadow:0 0 0 3px rgba(26,82,118,.18)!important;}',
    '.avatar-option img{width:100%!important;height:100%!important;border-radius:50%!important;display:block!important;}',
    '.avatar-picker-status{flex-basis:100%;min-height:18px;margin:2px 0 0!important;font-size:12px;color:var(--text-secondary,#5F6B7A)!important;}',
    '[data-theme="dark"] #profileName,[data-theme="dark"] .profile h2,[data-theme="dark"] .profile p,[data-theme="dark"] .profile span{color:var(--text,#EDE6DC)!important;}',
    '[data-theme="dark"] .profile .info,[data-theme="dark"] #profileTitle,[data-theme="dark"] #profileStatus{color:var(--text-secondary,#B3A696)!important;}',
    '[data-theme="dark"] .avatar-option.is-active{border-color:#E8A33D!important;box-shadow:0 0 0 3px rgba(232,163,61,.22)!important;}',
    '[data-theme="dark"] .section h2,[data-theme="dark"] .card h3{color:var(--text,#EDE6DC)!important;}',
  ].join('\n');
  document.head.appendChild(style);
}

function initPresetAvatarPicker() {
  injectDashboardAvatarStyles();
  var user = getUser();
  applyProfileAvatar(user);
  renderPresetAvatarPicker(user);
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
    link.removeAttribute('data-en'); // some page designs (e.g. home.html's language switcher)
    link.removeAttribute('data-am'); // reset text from these attributes — strip them so our change sticks
    var textEl = link.querySelector('span, div, button') || link;
    textEl.textContent = 'Dashboard';

    // Insert a small "profile pill" (icon + name) right before the Dashboard
    // link, once per occurrence (nav bars often repeat for mobile/desktop).
    if (!link.dataset.badgeAdded) {
      var badge = document.createElement('a');
      badge.href = dashboardPathForRole(user.role);
      badge.className = 'nav-user-badge';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-right:12px;color:inherit;text-decoration:none;font-weight:600;';
      badge.innerHTML = '<i class="bx bxs-user-circle" style="font-size:26px;"></i>'
        + '<span style="display:flex;flex-direction:column;line-height:1.15;">'
        + '<span>' + escapeHtml(user.fullname) + '</span>'
        + '<span style="font-size:11px;font-weight:400;opacity:0.75;text-transform:capitalize;">' + escapeHtml(user.role) + '</span>'
        + '</span>';
      link.parentNode.insertBefore(badge, link);
      link.dataset.badgeAdded = 'true';
    }
  });

  document.querySelectorAll('a[href="create-account.html"], a[href="../create-account.html"]').forEach(function (link) {
    if (link.closest('#createAccountPromo')) return; // handled separately — see below
    link.setAttribute('href', '#');
    link.removeAttribute('data-en');
    link.removeAttribute('data-am');
    var textEl = link.querySelector('span, div, button') || link;
    textEl.textContent = 'Log Out';
    link.addEventListener('click', function (e) {
      e.preventDefault();
      logout();
      window.location.reload();
    });
  });

  // The "Create an Account" promo card (home.html's "How It Works" section)
  // isn't a nav logout control — swap it to something that actually makes
  // sense once someone already has an account.
  var promo = document.getElementById('createAccountPromo');
  if (promo) {
    promo.innerHTML = '<a href="' + dashboardPathForRole(user.role) + '"><button>Go to Dashboard</button></a> '
      + 'to browse tutors, book sessions, and manage everything from your dashboard.';
  }
}

document.addEventListener('DOMContentLoaded', applyNavAuthState);
document.addEventListener('DOMContentLoaded', initPresetAvatarPicker);

// Called by the star-rating widget on tutor cards (home.html and tutors.html).
// containerEl is the .rating <div> that holds the star spans and the .ratingText note.
async function submitRating(tutorId, ratingValue, containerEl) {
  if (!getToken()) {
    alert('Please log in to rate a tutor.');
    var onDashboardsPage = window.location.pathname.indexOf('/dashboards/') !== -1;
    window.location.href = onDashboardsPage ? '../login.html' : 'login.html';
    return;
  }
  try {
    var result = await apiRequest('/tutors/' + tutorId + '/rate', {
      method: 'POST',
      auth: true,
      body: { rating: ratingValue },
    });
    var stars = containerEl.querySelectorAll('.star');
    stars.forEach(function (s, idx) {
      if (idx < ratingValue) s.classList.add('active');
      else s.classList.remove('active');
    });
    var text = containerEl.querySelector('.ratingText');
    if (text) {
      text.textContent = 'You rated this tutor ' + ratingValue + '/5 \u2b50 \u2014 average ' + result.averageRating + ' (' + result.ratingCount + ' rating' + (result.ratingCount === 1 ? '' : 's') + ')';
    }
    var card = containerEl.closest('.tutor-card');
    var summaryEl = card ? card.querySelector('.tutor-rating-summary') : null;
    if (summaryEl) {
      summaryEl.textContent = '\u2b50 ' + result.averageRating + ' (' + result.ratingCount + ' rating' + (result.ratingCount === 1 ? '' : 's') + ')';
    }
  } catch (err) {
    alert('Could not submit rating: ' + err.message);
  }
}

// Called by the heart icon on tutor cards (home.html). Persists to the
// logged-in user's account instead of just toggling a CSS class.
async function toggleFavorite(el, tutorId) {
  if (!getToken()) {
    alert('Please log in to save favorite tutors.');
    var onDashboardsPage = window.location.pathname.indexOf('/dashboards/') !== -1;
    window.location.href = onDashboardsPage ? '../login.html' : 'login.html';
    return;
  }
  try {
    var result = await apiRequest('/auth/favorites/' + tutorId + '/toggle', { method: 'POST', auth: true });
    var icon = el.querySelector('i');
    if (result.isFavorite) {
      icon.classList.remove('bx-heart');
      icon.classList.add('bxs-heart');
      icon.style.color = '#2563eb';
    } else {
      icon.classList.remove('bxs-heart');
      icon.classList.add('bx-heart');
      icon.style.color = '';
    }
  } catch (err) {
    alert('Could not update favorites: ' + err.message);
  }
}

// Fills in the notification bell, Favorite Tutors card, Recommended Tutors
// card, and Notifications card on dashboards — wherever these elements
// exist on the page. Runs automatically on every page that loads this file;
// it's a no-op on pages that don't have any of these elements (e.g. home.html).
async function initDashboardWidgets() {
  var token = getToken();
  if (!token) return;

  var countEl = document.getElementById('notificationCount');
  var menuEl = document.getElementById('notificationMenu');
  var notifCardList = document.getElementById('notificationsCardList');

  if (countEl || menuEl || notifCardList) {
    try {
      var notifications = await apiRequest('/notifications', { auth: true });
      var unread = notifications.filter(function (n) { return !n.read; }).length;

      if (countEl) {
        countEl.textContent = unread;
        countEl.style.display = unread > 0 ? '' : 'none';
      }

      if (menuEl) {
        menuEl.querySelectorAll('.notification-item').forEach(function (el) { el.remove(); });
        if (!notifications.length) {
          menuEl.insertAdjacentHTML('beforeend', '<div class="notification-item">No notifications yet.</div>');
        } else {
          notifications.slice(0, 10).forEach(function (n) {
            menuEl.insertAdjacentHTML('beforeend', '<div class="notification-item">' + escapeHtml(n.message) + '</div>');
          });
        }
        var bellBtn = document.getElementById('notificationBtn');
        if (bellBtn && unread > 0) {
          bellBtn.addEventListener('click', function () {
            apiRequest('/notifications/mark-read', { method: 'PATCH', auth: true })
              .then(function () { if (countEl) countEl.style.display = 'none'; })
              .catch(function () {});
          }, { once: true });
        }
      }

      if (notifCardList) {
        if (!notifications.length) {
          notifCardList.innerHTML = '<li>No notifications yet.</li>';
        } else {
          notifCardList.innerHTML = notifications.slice(0, 5).map(function (n) {
            return '<li><i class="bx bx-detail"></i> ' + escapeHtml(n.message) + '</li>';
          }).join('');
        }
      }
    } catch (err) {
      console.error('Could not load notifications', err);
    }
  }

  var favList = document.getElementById('favoriteTutorsList');
  if (favList) {
    try {
      var favorites = await apiRequest('/auth/favorites', { auth: true });
      if (!favorites.length) {
        favList.innerHTML = '<li>No favorites yet \u2014 tap the heart on a tutor card on the home page.</li>';
      } else {
        favList.innerHTML = favorites.map(function (t) {
          return '<li><i class="bx bx-clipboard"></i> ' + escapeHtml(t.fullname) + ' - ' + escapeHtml((t.subjects || []).join(', ') || '-') + '</li>';
        }).join('');
      }
    } catch (err) {
      favList.innerHTML = '<li>Could not load favorites.</li>';
    }
  }

  var recList = document.getElementById('recommendedTutorsList');
  if (recList) {
    try {
      var recommended = await apiRequest('/tutors/recommended?limit=4');
      if (!recommended.length) {
        recList.innerHTML = '<li>No approved tutors yet.</li>';
      } else {
        recList.innerHTML = recommended.map(function (t) {
          return '<li><i class="bx bx-like"></i> ' + escapeHtml(t.fullname) + (t.ratingCount ? ' (\u2b50 ' + t.averageRating + ')' : '') + '</li>';
        }).join('');
      }
    } catch (err) {
      recList.innerHTML = '<li>Could not load recommended tutors.</li>';
    }
  }
}

document.addEventListener('DOMContentLoaded', initDashboardWidgets);
