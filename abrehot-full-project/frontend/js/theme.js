// Site-wide dark mode. Include this script as the FIRST thing inside <head>,
// before any stylesheet <link>, so the theme is applied before first paint
// (no flash of the wrong theme). It also injects its own floating toggle
// button on every page — no per-page header markup changes needed.
(function () {
    var STORAGE_KEY = 'abrehot-theme';

    function getStoredTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null; // localStorage unavailable (privacy mode, etc.) — fall back to light
        }
    }

    function setStoredTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // ignore — theme just won't persist across visits
        }
    }

    function isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // Apply immediately — this runs synchronously as the script loads, before
    // the browser has parsed any <link rel="stylesheet"> that comes after it.
    applyTheme(getStoredTheme());

    function updateButton(btn) {
        var dark = isDark();
        btn.textContent = dark ? '☀️' : '🌙';
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        btn.title = btn.getAttribute('aria-label');
    }

    function injectToggleButton() {
        if (document.getElementById('themeToggleBtn')) return; // already present on the page

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'themeToggleBtn';
        btn.className = 'theme-toggle-fab';
        updateButton(btn);

        btn.addEventListener('click', function () {
            var next = isDark() ? 'light' : 'dark';
            applyTheme(next);
            setStoredTheme(next);
            updateButton(btn);
        });

        document.body.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectToggleButton);
    } else {
        injectToggleButton();
    }
})();
