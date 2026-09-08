// Site-wide theme engine (from home2.html).
// Include this script as the FIRST thing inside <head>, before any stylesheet,
// so the theme is applied before first paint (no flash of the wrong theme).
//
// Features applied to every page automatically:
//   1. Dark/light mode with the radial-ripple View Transition
//   2. Palette themes (Terracotta / Emerald / Parchment) with the same ripple
//   3. A floating control cluster (palette select + dark toggle), injected
//      only when the page doesn't already have its own #paletteSelect navbar
//      control (home2.html has one, so it is skipped there).
(function () {
    var THEME_KEY = 'theme';
    var PALETTE_KEY = 'abrehot_palette';
    // Captured synchronously — document.currentScript is null in later callbacks.
    var THEME_SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';

    function store(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }
    function read(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
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
        if (document.body) document.body.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
        store(THEME_KEY, theme);
        syncControls();
    }

    function applyPaletteChange(palette) {
        if (!palette || palette === 'terracotta') {
            document.documentElement.removeAttribute('data-palette');
            if (document.body) document.body.removeAttribute('data-palette');
        } else {
            document.documentElement.setAttribute('data-palette', palette);
            if (document.body) document.body.setAttribute('data-palette', palette);
        }
        store(PALETTE_KEY, palette || 'terracotta');
        syncControls();
    }

    // ---- Radial ripple transition shared by both toggles ----
    function withRipple(event, mutate, reverse) {
        if (!document.startViewTransition) {
            mutate();
            return;
        }
        var x = (event && typeof event.clientX === 'number') ? event.clientX : window.innerWidth / 2;
        var y = (event && typeof event.clientY === 'number') ? event.clientY : window.innerHeight / 2;
        var endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        var transition = document.startViewTransition(mutate);

        transition.ready.then(function () {
            var clipPath = [
                'circle(0px at ' + x + 'px ' + y + 'px)',
                'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'
            ];
            if (reverse) clipPath.reverse();
            document.documentElement.animate(
                { clipPath: clipPath },
                {
                    duration: 550,
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    pseudoElement: reverse
                        ? '::view-transition-old(root)'
                        : '::view-transition-new(root)'
                }
            );
        }).catch(function () { /* transition skipped — fine */ });
    }

    // Exposed globally so inline onclick handlers (home2 navbar) also work.
    window.toggleDarkMode = function (event) {
        var next = isDark() ? 'light' : 'dark';
        withRipple(event, function () { applyTheme(next); }, next === 'light');
    };

    window.setPalette = function (palette, event) {
        withRipple(event, function () { applyPaletteChange(palette); }, false);
    };
    window.applyTheme = applyTheme;
    window.applyPaletteChange = applyPaletteChange;

    // ---- Injected stylesheet (palettes, ripple CSS, controls, logo filter) ----
    var INJECTED_CSS = [
        /* Palette themes — Terracotta is the :root default */
        '[data-palette="emerald"] {',
        '  --sand-50: #F4F7F5; --sand-100: #E6ECE8; --sand-200: #CDD9D2; --sand-300: #A8BCB0;',
        '  --ink-900: #0F241D; --ink-700: #233D34; --ink-500: #526E64;',
        '  --terracotta: #1E5645; --terracotta-hover: #143D31; --sage: #1E5645; --gold-leaf: #B8860B;',
        '  --grad-terracotta: linear-gradient(135deg, #246854 0%, #174537 100%);',
        '  --grad-hero-bg: radial-gradient(120% 80% at 50% 0%, #E6ECE8 0%, #F4F7F5 100%);',
        '  --grad-accent-glow: radial-gradient(600px circle at 80% 20%, rgba(30, 86, 69, 0.1), transparent 80%);',
        '  --grad-card-bg: linear-gradient(180deg, #FFFFFF 0%, #F4F7F5 100%);',
        '  --shadow-glow: 0 12px 28px -6px rgba(30, 86, 69, 0.3);',
        '  --primary: var(--terracotta); --primary-dark: var(--terracotta-hover);',
        '  --secondary: var(--sage); --accent: var(--gold-leaf);',
        '}',
        '[data-palette="parchment"] {',
        '  --sand-50: #F6F1E7; --sand-100: #EDE3D0; --sand-200: #DED0B6; --sand-300: #C7B393;',
        '  --ink-900: #2A2118; --ink-700: #45382B; --ink-500: #786654;',
        '  --terracotta: #9B3B2B; --terracotta-hover: #7E2D20; --sage: #9B3B2B; --gold-leaf: #C47B2B;',
        '  --grad-terracotta: linear-gradient(135deg, #AF4433 0%, #822E21 100%);',
        '  --grad-hero-bg: radial-gradient(120% 80% at 50% 0%, #EDE3D0 0%, #F6F1E7 100%);',
        '  --grad-accent-glow: radial-gradient(600px circle at 80% 20%, rgba(155, 59, 43, 0.1), transparent 80%);',
        '  --grad-card-bg: linear-gradient(180deg, #FDFBFA 0%, #F6F1E7 100%);',
        '  --shadow-glow: 0 12px 28px -6px rgba(155, 59, 43, 0.28);',
        '  --primary: var(--terracotta); --primary-dark: var(--terracotta-hover);',
        '  --secondary: var(--sage); --accent: var(--gold-leaf);',
        '}',
        /* Dark mode wins over any palette (html[...] outranks later [data-palette]) */
        'html[data-theme="dark"] {',
        '  --sand-50: #141210; --sand-100: #1C1815; --sand-200: #2A241F; --sand-300: #3E352E;',
        '  --ink-900: #F3ECE2; --ink-700: #E0D4C5; --ink-500: #B0A292;',
        '  --terracotta: #DF784C; --terracotta-hover: #ED8B60; --sage: #DF784C; --gold-leaf: #E5A138;',
        '  --grad-terracotta: linear-gradient(135deg, #DF784C 0%, #C45F35 100%);',
        '  --grad-hero-bg: radial-gradient(120% 80% at 50% 0%, #1C1815 0%, #141210 100%);',
        '  --grad-accent-glow: radial-gradient(600px circle at 80% 20%, rgba(223, 120, 76, 0.12), transparent 80%);',
        '  --grad-card-bg: linear-gradient(180deg, #221D18 0%, #141210 100%);',
        '  --shadow-paper: 0 4px 12px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.3);',
        '  --shadow-raised: 0 16px 32px -8px rgba(0,0,0,.45), 0 4px 12px rgba(0,0,0,.3);',
        '  --shadow-glow: 0 12px 28px -6px rgba(223, 120, 76, 0.3);',
        '  --background: var(--sand-50); --surface: #1C1815;',
        '  --text: var(--ink-700); --text-secondary: var(--ink-500); --border: var(--sand-300);',
        '}',
        /* View-transition ripple engine */
        '::view-transition-old(root), ::view-transition-new(root) {',
        '  animation: none; mix-blend-mode: normal;',
        '}',
        /* Logo adapts to dark mode */
        'html[data-theme="dark"] img.brand-mark,',
        'html[data-theme="dark"] img.abrehot-logo { filter: brightness(0) invert(0.95); }',
        /* The shared stylesheet (css/abrehot-theme.css) squeezes header images
           into a 38x38 avatar chip (.right-header img ... !important). The
           Abrehot assets are wide wordmark lockups, so render them at lockup
           height with the chip styling stripped. */
        'img.abrehot-logo {',
        '  width: auto !important; height: 48px !important; object-fit: contain !important;',
        '  border: none !important; border-radius: 0 !important; box-shadow: none !important;',
        '}',
        /* Floating control cluster (pages without a navbar #paletteSelect).
           Every property the shared stylesheet sets with !important on plain
           `button` is re-asserted here so the cluster keeps its own look. */
        '.abrehot-theme-cluster {',
        '  position: fixed; bottom: 22px; right: 22px; z-index: 9999;',
        '  display: flex; align-items: center; gap: 8px;',
        '}',
        '.abrehot-theme-cluster .btn-icon-toggle {',
        '  width: 46px; height: 46px; min-height: 0 !important; display: inline-flex; align-items: center; justify-content: center;',
        '  background: var(--sand-100, #F5EFE6) !important; border: 1px solid var(--sand-300, #D8C5B0) !important;',
        '  border-radius: 50% !important; color: var(--ink-900, #191615) !important; cursor: pointer; font-size: 1.25rem !important;',
        '  padding: 0 !important; font-weight: 400 !important;',
        '  box-shadow: 0 8px 20px rgba(0,0,0,.12) !important; transition: transform .2s ease, border-color .2s ease;',
        '}',
        '.abrehot-theme-cluster .btn-icon-toggle:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 20px rgba(0,0,0,.12) !important; }',
        '.abrehot-theme-cluster .theme-select-wrapper {',
        '  display: inline-flex; align-items: center; gap: 6px; height: 46px; padding: 0 14px;',
        '  background: var(--sand-100, #F5EFE6); border: 1px solid var(--sand-300, #D8C5B0);',
        '  border-radius: 23px; color: var(--ink-900, #191615); font-size: .85rem; font-weight: 600;',
        '  box-shadow: 0 8px 20px rgba(0,0,0,.12);',
        '}',
        '.abrehot-theme-cluster .theme-select-wrapper select {',
        '  border: none; background: transparent; color: inherit; font-family: inherit;',
        '  font-size: .85rem; font-weight: 600; cursor: pointer; outline: none;',
        '}',
        /* Language pill (EN / አማ) inside the injected cluster */
        '.abrehot-theme-cluster .ab-lang-btn {',
        '  border: 1px solid var(--sand-300, #D8C5B0) !important; background: transparent !important;',
        '  color: var(--ink-900, #191615) !important; border-radius: 14px !important; padding: 5px 11px !important;',
        '  min-height: 0 !important; font-family: inherit; font-size: .78rem !important; font-weight: 700 !important;',
        '  line-height: 1.1; cursor: pointer; box-shadow: none !important;',
        '  transition: background .15s ease, color .15s ease, border-color .15s ease;',
        '}',
        '.abrehot-theme-cluster .ab-lang-btn:hover { border-color: var(--ink-500, #786654) !important; background: rgba(0,0,0,.05) !important; }',
        '.abrehot-theme-cluster .ab-lang-btn.active {',
        '  background: var(--ink-900, #191615) !important; border-color: var(--ink-900, #191615) !important;',
        '  color: var(--sand-50, #F5EFE6) !important;',
        '}'
    ].join('\n');

    // Amharic logo swap: the active language surfaces as a lang-am/lang-en class
    // on <html> or <body> (see applyLangClasses below), and these rules replace
    // the brand image in place. The URL is resolved against this script's own
    // location (js/ sits at the frontend root) so it also works from subfolders
    // such as dashboards/. On the pages that show a text name beside the logo
    // (h1.head after img.abrehot-logo), the Amharic artwork replaces both —
    // it already contains the name, so the English wordmark is hidden.
    function amharicLogoCss() {
        var amUrl = 'images/abrehot-logo-amharic.png';
        if (THEME_SCRIPT_SRC && /js\/theme\.js[^\/]*$/.test(THEME_SCRIPT_SRC)) {
            amUrl = THEME_SCRIPT_SRC.replace(/js\/theme\.js[^\/]*$/, 'images/abrehot-logo-amharic.png');
        }
        return [
            '.lang-am img.brand-mark, .lang-am img.abrehot-logo { content: url("' + amUrl + '"); }',
            // The Amharic artwork already contains the name, so the English
            // wordmark heading beside it is hidden (sizing handled by the
            // shared img.abrehot-logo lockup rule above).
            '.lang-am img.abrehot-logo ~ .head { display: none; }'
        ].join('\n');
    }

    // ---- Site-wide language class ----
    // Pages with a language toggle (the home pages) add lang-am/lang-en to
    // <body>; every other page must still pick up the saved preference so the
    // brand treatment follows the user across the site. The class is mirrored
    // on <html> while still in <head> (no flash of the wrong logo), and a
    // MutationObserver keeps it in sync when a page toggles <body> directly.
    function desiredLang() {
        if (document.body) {
            if (document.body.classList.contains('lang-am')) return 'am';
            if (document.body.classList.contains('lang-en')) return 'en';
        }
        return read('abrehot_lang') || 'en';
    }

    function applyLangClasses() {
        var am = desiredLang() === 'am';
        document.documentElement.classList.toggle('lang-am', am);
        document.documentElement.classList.toggle('lang-en', !am);
        if (document.body) {
            document.body.classList.toggle('lang-am', am);
            document.body.classList.toggle('lang-en', !am);
        }
        syncLangButtons();
    }

    function observeLangToggles() {
        if (!document.body || document.body.dataset.langObserved) return;
        document.body.dataset.langObserved = '1';
        new MutationObserver(applyLangClasses).observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // ---- Global language switcher ----
    // Pages that ship their own setLanguage (home.html / home2.html) override
    // this global when their inline scripts run; both implementations share the
    // same contract: lang-am/lang-en on <body>, abrehot_lang in localStorage,
    // and [data-en][data-am] content swapped to the active language. Pages
    // without their own toggle get one injected into the floating cluster
    // (see injectControls), and the brand logo/name swap is pure CSS on the
    // lang-am class, so it follows the saved preference on every page.
    function translateDataElements(lang) {
        if (!document.body) return;
        var els = document.querySelectorAll('[data-en][data-am]');
        for (var i = 0; i < els.length; i++) {
            var text = els[i].getAttribute('data-' + lang);
            if (text) els[i].innerHTML = text;
        }
    }

    function syncLangButtons() {
        var am = desiredLang() === 'am';
        var buttons = document.querySelectorAll('.abrehot-theme-cluster .ab-lang-btn');
        for (var i = 0; i < buttons.length; i++) {
            var isAmBtn = buttons[i].getAttribute('data-lang') === 'am';
            buttons[i].classList.toggle('active', isAmBtn === am);
        }
    }

    window.setLanguage = function (lang) {
        var am = lang === 'am';
        if (document.body) {
            document.body.classList.toggle('lang-am', am);
            document.body.classList.toggle('lang-en', !am);
        }
        document.documentElement.classList.toggle('lang-am', am);
        document.documentElement.classList.toggle('lang-en', !am);
        store(LANG_KEY, am ? 'am' : 'en');
        translateDataElements(am ? 'am' : 'en');
        syncLangButtons();
    };

    function injectStylesheet() {
        if (document.getElementById('abrehot-theme-style')) return;
        var style = document.createElement('style');
        style.id = 'abrehot-theme-style';
        style.textContent = INJECTED_CSS + '\n' + amharicLogoCss();
        document.head.appendChild(style);
    }

    function syncControls() {
        if (!document.body) return;
        var select = document.getElementById('paletteSelect');
        if (select) select.value = read(PALETTE_KEY) || 'terracotta';
        var icon = document.getElementById('dark-icon');
        if (icon) icon.className = isDark() ? 'bx bx-sun' : 'bx bx-moon';
    }

    function injectControls() {
        injectStylesheet();
        syncControls();
        if (document.getElementById('paletteSelect')) return; // page has its own navbar controls

        var cluster = document.createElement('div');
        cluster.className = 'abrehot-theme-cluster';

        var wrapper = document.createElement('div');
        wrapper.className = 'theme-select-wrapper';
        wrapper.title = 'Change Palette Theme';
        var paletteIcon = document.createElement('i');
        paletteIcon.className = 'bx bx-palette';
        var select = document.createElement('select');
        select.id = 'paletteSelect';
        [['terracotta', 'Terracotta'], ['emerald', 'Emerald'], ['parchment', 'Parchment']].forEach(function (opt) {
            var o = document.createElement('option');
            o.value = opt[0]; o.textContent = opt[1];
            select.appendChild(o);
        });
        select.addEventListener('change', function (event) {
            window.setPalette(select.value, event);
        });
        wrapper.appendChild(paletteIcon);
        wrapper.appendChild(select);

        // Language pill (EN / አማ) — skipped on pages that ship their own
        // language buttons in the navbar (home.html has #btn-en/#btn-am).
        if (!document.getElementById('btn-en')) {
            var langWrapper = document.createElement('div');
            langWrapper.className = 'theme-select-wrapper';
            langWrapper.title = 'ቋንቋ ይለውጡ / Change Language';
            [['en', 'EN'], ['am', 'አማ']].forEach(function (opt) {
                var langBtn = document.createElement('button');
                langBtn.type = 'button';
                langBtn.className = 'ab-lang-btn';
                langBtn.setAttribute('data-lang', opt[0]);
                langBtn.textContent = opt[1];
                langBtn.addEventListener('click', function () {
                    window.setLanguage(opt[0]);
                });
                langWrapper.appendChild(langBtn);
            });
            cluster.appendChild(langWrapper);
        }

        var darkBtn = document.createElement('button');
        darkBtn.type = 'button';
        darkBtn.className = 'btn-icon-toggle';
        darkBtn.id = 'btn-dark-toggle';
        darkBtn.title = 'Toggle Dark/Light Mode';
        var icon = document.createElement('i');
        icon.className = 'bx bx-moon';
        icon.id = 'dark-icon';
        darkBtn.appendChild(icon);
        darkBtn.addEventListener('click', function (event) {
            window.toggleDarkMode(event);
        });

        cluster.appendChild(wrapper);
        cluster.appendChild(darkBtn);
        document.body.appendChild(cluster);
        syncControls();
        syncLangButtons();
    }

    // Apply immediately — runs synchronously before stylesheets paint.
    // Migrate the old 'abrehot-theme' key from the previous engine if present.
    var legacy = read('abrehot-theme');
    if (legacy && !read(THEME_KEY)) store(THEME_KEY, legacy);
    applyTheme(read(THEME_KEY) || 'light');
    applyPaletteChange(read(PALETTE_KEY) || 'terracotta');

    // Language class on <html> before first paint (body doesn't exist yet).
    var savedLang = read('abrehot_lang') || 'en';
    document.documentElement.classList.toggle('lang-am', savedLang === 'am');
    document.documentElement.classList.toggle('lang-en', savedLang !== 'am');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            applyLangClasses();
            observeLangToggles();
            injectControls();
        });
    } else {
        applyLangClasses();
        observeLangToggles();
        injectControls();
    }
})();
