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
