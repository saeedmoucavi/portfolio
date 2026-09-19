/* ==========================================================================
   MECHANISM — site renderer + mechanical motion engine  (v3)
   --------------------------------------------------------------------------
   Reads content.json and draws the whole website from it, then animates it
   with real mechanical motifs: a meshing gear train driving a slider-crank,
   pneumatic cylinders, rack & pinion, lead screw, cam & follower, pressure
   gauges and dimension lines.
   YOU DO NOT NEED TO EDIT THIS FILE. To change anything you see on the site,
   edit content.json (or use the /admin editor).
   No libraries, no build step — plain JavaScript.
   ========================================================================== */

(() => {
  'use strict';

  const STORE_KEY = 'ps-lang';
  let DATA = null;
  let LANG = 'en';

  const MQ_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MQ_FINE = window.matchMedia('(hover: hover) and (pointer: fine)');
  const motionOn = () => !MQ_REDUCED.matches && document.documentElement.dataset.anim !== 'off';

  /* ---------------------------------------------------------------- utils */

  const t = (v) => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return v[LANG] || v.en || v.fa || '';
  };
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const te = (v) => esc(t(v));
  const on = (item) => item && item.enabled !== false;
  const rtl = () => LANG === 'fa';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TAU = Math.PI * 2;

  // Persian is only ever split by WORD (never by letter) so the letters keep
  // joining correctly.
  const words = (v, base = 0) => t(v).split(/\s+/).filter(Boolean).map((w, i) =>
    `<span class="w"><span class="w__i" style="--i:${base + i}">${esc(w)}</span></span>`).join(' ');

  const letters = (v) => {
    const s = t(v);
    if (rtl() || /[؀-ۿ]/.test(s)) return words(v);
    let n = 0;
    return s.split(' ').map((word) =>
      `<span class="word-nb">${[...word].map((c) =>
        `<span class="ch"><span class="ch__i" style="--i:${n++}">${esc(c)}</span></span>`).join('')}</span>`
    ).join(' ');
  };

  const scrubWords = (v) => t(v).split(/\s+/).filter(Boolean)
    .map((w) => `<span class="sw">${esc(w)}</span>`).join(' ');

  const roll = (label) => `<span class="roll"><span class="roll__a">${label}</span><span class="roll__b" aria-hidden="true">${label}</span></span>`;

  /* ------------------------------------------------- gear / part geometry */

  // One tooth profile, repeated: a trapezoid with a rounded tip. Returns an
  // SVG path string for a gear centred on (cx, cy).
  function gearPath(cx, cy, R, teeth, rootRatio = 0.86, boreRatio = 0) {
    const root = R * rootRatio;
    const step = TAU / teeth;
    const P = (r, a) => `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.20;   // rise
      const a2 = a0 + step * 0.34;   // tip start
      const a3 = a0 + step * 0.52;   // tip end
      const a4 = a0 + step * 0.66;   // fall
      d += (i === 0 ? `M${P(root, a0)}` : `L${P(root, a0)}`);
      d += `L${P(R, a1)}L${P(R, a2)}L${P(R, a3)}L${P(root, a4)}`;
    }
    d += 'Z';
    if (boreRatio > 0) {
      const rb = R * boreRatio;
      d += `M${(cx + rb).toFixed(2)} ${cy.toFixed(2)}`;
      d += `A${rb.toFixed(2)} ${rb.toFixed(2)} 0 1 0 ${(cx - rb).toFixed(2)} ${cy.toFixed(2)}`;
      d += `A${rb.toFixed(2)} ${rb.toFixed(2)} 0 1 0 ${(cx + rb).toFixed(2)} ${cy.toFixed(2)}`;
    }
    return d;
  }

  // Small inline gear used as a decorative part (spins with CSS).
  const gearSvg = (teeth = 12, cls = '') => `
    <svg class="part part--gear ${cls}" viewBox="0 0 48 48" aria-hidden="true">
      <path d="${gearPath(24, 24, 21, teeth, 0.78, 0.3)}"/>
      <circle cx="24" cy="24" r="4.2"/>
    </svg>`;

  const nutSvg = () => `
    <svg class="part part--nut" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z"/>
      <circle cx="16" cy="16" r="6.4"/>
    </svg>`;

  const bearingSvg = () => {
    let balls = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      balls += `<circle cx="${(24 + Math.cos(a) * 13).toFixed(1)}" cy="${(24 + Math.sin(a) * 13).toFixed(1)}" r="3.1"/>`;
    }
    return `<svg class="part part--bearing" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21"/><circle cx="24" cy="24" r="17"/>
      <circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="5"/>
      <g class="part__balls">${balls}</g></svg>`;
  };

  /* ---------------------------------------------------------------- icons */

  const svg = (paths, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

  const ICONS = {
    arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'class="i-arrow"'),
    arrowLeft:  svg('<path d="M19 12H5M11 18l-6-6 6-6"/>', 'class="i-arrow"'),
    arrowUp:    svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    arrowNE:    svg('<path d="M7 17L17 7M8 7h9v9"/>'),
    download:   svg('<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>'),
    close:      svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    caliper:    svg('<path d="M3 7h18M3 5v4M21 5v4M6 7v6a3 3 0 003 3h1M14 12h6v5h-6z"/>'),
    email:      svg('<rect x="2.5" y="4.5" width="19" height="15" rx="1"/><path d="M3 6.5l9 6 9-6"/>'),
    phone:      svg('<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 006.5 6.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.2 2 2 0 016.5 3z"/>'),
    location:   svg('<path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    // skill-category icons, all mechanical
    drafting:   svg('<path d="M4 20L12 4l8 16M7.5 14h9"/><circle cx="12" cy="4" r="1.2"/>'),
    analysis:   svg('<path d="M3 20h18M6 20V9M11 20V5M16 20v-7M21 20v-4"/>'),
    manufacturing: svg('<path d="M3 20h18V9l-5 3.5V9l-5 3.5V9L3 12.5V20z"/><path d="M3 12.5L4 4h3l1 8.5"/>'),
    automation: svg('<rect x="2.5" y="9" width="13" height="6" rx="1"/><path d="M15.5 12h3M18.5 10v4M18.5 12h3"/><circle cx="6" cy="12" r="1.2"/>'),
    cog:        svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>'),
    linkedin:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 11-.01 5 2.5 2.5 0 01.01-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95C20.4 8.75 21 11 21 14.1V21h-4v-6.1c0-1.46-.03-3.34-2.05-3.34-2.05 0-2.37 1.59-2.37 3.23V21H9z"/></svg>',
    whatsapp:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.05L2 22l5.07-1.33A10 10 0 1012 2zm5.3 14.1c-.23.64-1.33 1.22-1.84 1.27-.5.05-.97.23-3.27-.68-2.75-1.08-4.5-3.87-4.63-4.05-.14-.18-1.11-1.48-1.11-2.82s.7-2 .95-2.28c.25-.27.55-.34.73-.34l.52.01c.17 0 .4-.06.62.48l.85 2.07c.07.14.12.31.02.5l-.3.45-.44.48c-.14.14-.29.3-.12.58.16.28.73 1.2 1.56 1.95 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07l.87-1c.2-.23.37-.18.62-.09l2 .95c.25.12.42.18.48.28.06.1.06.57-.17 1.2z"/></svg>',
    telegram:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3L18.6 19.6c-.25 1.1-.9 1.37-1.83.85l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.15 9.37-8.47c.4-.36-.09-.56-.63-.2L5.78 12.9.79 11.34c-1.08-.34-1.1-1.08.23-1.6L20.5 2.9c.9-.33 1.69.2 1.4 1.4z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>',
    grabcad:   svg('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>'),
    website:   svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15 0 18M12 3c-2.5 2.7-2.5 15 0 18"/>')
  };
  const icon = (name) => ICONS[name] || ICONS.cog;
  const fwd = () => (rtl() ? ICONS.arrowLeft : ICONS.arrowRight);

  /* ---------------------------------------------------------------- theme */

  function applyTheme(theme = {}) {
    const map = {
      colorBackground: '--bg', colorSurface: '--surface', colorSurfaceRaised: '--surface-2',
      colorBorder: '--border', colorText: '--text', colorTextMuted: '--muted',
      colorAccent: '--accent', colorAccentInk: '--accent-ink', colorBlueprint: '--blueprint',
      cornerRadius: '--radius'
    };
    const root = document.documentElement;
    for (const [key, cssVar] of Object.entries(map)) {
      if (theme[key]) root.style.setProperty(cssVar, theme[key]);
    }
    const stack = (font, fallback) =>
      font ? `${font.includes(',') ? font : `${font}, ${fallback}`}` : null;
    // Latin fonts are stored in their own variables; --font-display / --font-body
    // are then pointed at either the Latin or the Persian pair by applyFonts(),
    // depending on the language currently shown.
    if (theme.fontDisplay) root.style.setProperty('--font-display-en', stack(theme.fontDisplay, 'system-ui, sans-serif'));
    if (theme.fontBody)    root.style.setProperty('--font-body-en',    stack(theme.fontBody, 'system-ui, sans-serif'));
    if (theme.fontMono)    root.style.setProperty('--font-mono',       stack(theme.fontMono, 'ui-monospace, monospace'));

    // Persian fonts. Left empty, the Latin fonts above are used for Persian too.
    if (theme.fontDisplayFa) root.style.setProperty('--font-display-fa', stack(theme.fontDisplayFa, 'Vazirmatn, system-ui, sans-serif'));
    if (theme.fontBodyFa)    root.style.setProperty('--font-body-fa',    stack(theme.fontBodyFa, 'Vazirmatn, system-ui, sans-serif'));
    loadExtraFont(theme.fontStylesheetUrl);
    applyFonts();

    root.dataset.grid = theme.showBlueprintGrid === false ? 'off' : 'on';
    root.dataset.anim = theme.enableAnimations === false ? 'off' : 'on';
    if (theme.colorBackground) {
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme.colorBackground);
    }
  }
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  // Loads one extra font stylesheet named in content.json → theme →
  // fontStylesheetUrl. Use it for any font that is not already listed in
  // index.html — paste the "embed" link from fonts.google.com, or any other
  // font CDN address. Only https:// addresses are accepted.
  // Points --font-display / --font-body at the Persian or the Latin pair,
  // following the language currently on screen. Called on boot and on every
  // language switch.
  function applyFonts() {
    const root = document.documentElement;
    const get = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    const display = (rtl() && get('--font-display-fa')) || get('--font-display-en');
    const body = (rtl() && get('--font-body-fa')) || get('--font-body-en');
    if (display) root.style.setProperty('--font-display', display);
    if (body) root.style.setProperty('--font-body', body);
  }

  function loadExtraFont(url) {
    const old = $('#extra-font');
    if (!url || typeof url !== 'string') { if (old) old.remove(); return; }
    let href = url.trim();
    // tolerate a pasted <link ...> tag by pulling the href out of it
    const m = href.match(/href=["']([^"']+)["']/i);
    if (m) href = m[1];
    if (!/^https:\/\//i.test(href)) {
      console.warn('theme.fontStylesheetUrl must start with https:// — ignored:', href);
      if (old) old.remove();
      return;
    }
    if (old && old.getAttribute('href') === href) return;
    if (old) old.remove();
    const link = document.createElement('link');
    link.id = 'extra-font';
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  /* ---------------------------------------------- shared part components */

  // A pneumatic cylinder used as a progress bar (skills) — rod extends to
  // the given level.
  const cylinderBar = (lvl, d) => `
    <span class="cyl" style="--lvl:${lvl / 100};--d:${d}" aria-hidden="true">
      <span class="cyl__port cyl__port--a"></span>
      <span class="cyl__body">
        <span class="cyl__rod"><span class="cyl__piston"></span></span>
      </span>
      <span class="cyl__cap"></span>
      <span class="cyl__port cyl__port--b"></span>
    </span>`;

  // Pressure gauge for the stats row.
  function gaugeSvg(pct) {
    const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;          // 270° sweep
    const pol = (r, a) => `${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`;
    let ticks = '';
    for (let i = 0; i <= 20; i++) {
      const a = A0 + (A1 - A0) * (i / 20);
      const big = i % 5 === 0;
      ticks += `<path class="${big ? 'gauge__tick gauge__tick--big' : 'gauge__tick'}" d="M${pol(big ? 33 : 36, a)}L${pol(41, a)}"/>`;
    }
    const arc = (r) => `M${pol(r, A0)}A${r} ${r} 0 1 1 ${pol(r, A1)}`;
    return `<svg class="gauge" viewBox="0 0 100 100" aria-hidden="true" style="--turn:${(clamp(pct, 0, 1) * 270 - 135).toFixed(1)}deg">
      <circle class="gauge__face" cx="50" cy="50" r="45"/>
      <path class="gauge__arc" d="${arc(41)}"/>
      <path class="gauge__fill" d="${arc(41)}" pathLength="100" style="--fill:${(clamp(pct, 0, 1) * 100).toFixed(1)}"/>
      ${ticks}
      <g class="gauge__needle"><path d="M50 50L50 16"/><circle cx="50" cy="50" r="4.5"/></g>
    </svg>`;
  }

  // Horizontal dimension line with arrow heads and a value in the middle.
  const dimLine = (value, cls = '') => `
    <span class="dim ${cls}" aria-hidden="true">
      <span class="dim__ext"></span>
      <span class="dim__line"><i class="dim__arrow dim__arrow--s"></i><i class="dim__arrow dim__arrow--e"></i></span>
      <span class="dim__val">${esc(value)}</span>
      <span class="dim__ext dim__ext--e"></span>
    </span>`;

  /* -------------------------------------------------------------- sections */

  const enabledSections = () => (DATA.sections || []).filter((s) => s.enabled !== false);

  function renderChrome() {
    return `
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="rack" aria-hidden="true">
        <span class="rack__teeth"></span>
        <span class="rack__travel" id="rack-travel"></span>
        <span class="rack__pinion" id="rack-pinion">${gearSvg(14)}</span>
      </div>
      <div class="wipe" id="wipe" aria-hidden="true"><span></span></div>`;
  }

  function renderHeader() {
    const navItems = enabledSections()
      .filter((s) => s.showInNav)
      .map((s, i) => `<a class="nav__link" href="#${esc(s.key)}" data-nav="${esc(s.key)}" style="--i:${i}">
          <span class="nav__num mono">${String(i + 1).padStart(2, '0')}</span>${roll(te(s.navLabel))}</a>`)
      .join('');

    const langToggle = DATA.site.showLanguageToggle === false ? '' : `
      <div class="lang-toggle ${LANG === 'fa' ? 'is-fa' : ''}" role="group" aria-label="Language">
        <span class="lang-toggle__pill" aria-hidden="true"></span>
        <button type="button" data-lang="en" class="${LANG === 'en' ? 'is-active' : ''}">EN</button>
        <button type="button" data-lang="fa" class="${LANG === 'fa' ? 'is-active' : ''}">فا</button>
      </div>`;

    return `
    <header class="site-header" id="site-header">
      <div class="shell site-header__inner">
        <a class="brand" href="#hero" data-magnetic>
          <span class="brand__mark">${gearSvg(16, 'brand__gear')}<span>${esc(DATA.site.brandInitials || 'SM')}</span></span>
          <span class="brand__name">${te(DATA.hero.name)}</span>
        </a>
        <nav class="nav" id="nav" aria-label="Main">${navItems}</nav>
        <div class="header__actions">
          ${langToggle}
          <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav"
                  aria-label="Menu"><span></span><span></span></button>
        </div>
      </div>
    </header>`;
  }

  function renderHero() {
    const h = DATA.hero;
    return `
    <section class="hero" id="hero">
      <div class="shell hero__inner">
        <div class="hero__content" data-hero-fade>
          <p class="hero__eyebrow mono" data-intro="0">${bearingSvg()}<span data-scramble>${te(h.eyebrow)}</span></p>
          <h1 class="hero__name split" data-intro="1">${letters(h.name)}</h1>
          <p class="hero__headline split" data-intro="2">${words(h.headline)}</p>
          <p class="hero__intro fade-up" data-intro="3">${te(h.intro)}</p>
          <div class="hero__actions fade-up" data-intro="4">
            <a class="btn btn--primary" href="${esc(h.primaryButtonLink)}" data-magnetic>
              <span class="btn__fill"></span>${roll(te(h.primaryButtonLabel))} ${fwd()}
            </a>
            <a class="btn btn--ghost" href="${esc(h.secondaryButtonLink)}" download data-magnetic>
              <span class="btn__fill"></span>${ICONS.download} ${roll(te(h.secondaryButtonLabel))}
            </a>
          </div>
        </div>
        <div class="hero__mech" data-intro="2">
          <canvas id="hero-canvas" aria-hidden="true"></canvas>
          <span class="hero__mech-label mono">${gearSvg(12, 'part--spin')}<span>${rtl()
            ? 'شکل ۱ — چرخ‌دنده، لنگ و لغزنده'
            : 'FIG 1 — GEAR TRAIN &amp; SLIDER-CRANK'}</span></span>
        </div>
      </div>
      <a class="hero__scroll mono" href="#main-content" aria-hidden="true" tabindex="-1">
        <span class="hero__scroll-rail"><span class="hero__scroll-nut">${nutSvg()}</span></span>
        <span>${te(h.scrollHint)}</span>
      </a>
    </section>
    <span id="main-content"></span>`;
  }

  // A camshaft with three phased cams; each follower rides its cam profile
  // (positions are computed every frame in loop(), like a valve train).
  function renderCamStrip() {
    const cams = [0, 1, 2].map((i) => {
      const x = 70 + i * 110;
      return `
        <g class="cam" data-cam="${i}" data-x="${x}">
          <path class="cam__guide" d="M${x - 9} 4v34M${x + 9} 4v34"/>
          <g class="cam__follower">
            <path d="M${x} 44V6"/>
            <rect x="${x - 16}" y="0" width="32" height="7" rx="1"/>
            <circle cx="${x}" cy="44" r="6"/>
          </g>
          <g class="cam__lobe">
            <ellipse cx="${x}" cy="84" rx="30" ry="20"/>
            <circle cx="${x}" cy="84" r="5"/>
            <path d="M${x - 3} 79h6"/>
          </g>
        </g>`;
    }).join('');
    return `
    <div class="cam-strip" aria-hidden="true">
      <svg viewBox="0 0 360 120" class="cam-strip__svg">
        <path class="cam-strip__shaft" d="M8 84h344"/>
        ${cams}
      </svg>
      <span class="cam-strip__label mono">${rtl() ? 'میل‌بادامک — سه بادامک با اختلاف فاز ۱۲۰°' : 'CAMSHAFT · 3 LOBES · 120° PHASE'}</span>
    </div>`;
  }

  function renderStats() {
    const s = DATA.stats;
    if (!s || s.enabled === false || !s.items?.length) return '';
    const max = Math.max(...s.items.map((it) => parseFloat(it.value) || 0), 1);
    const cells = s.items.map((it, i) => {
      const v = parseFloat(it.value) || 0;
      return `
      <div class="stat reveal" style="--d:${i}">
        ${gaugeSvg(v / max)}
        <div class="stat__read">
          <div class="stat__value" dir="ltr" data-count="${esc(it.value)}" data-suffix="${esc(it.suffix || '')}">${esc(it.value)}${esc(it.suffix || '')}</div>
          <div class="stat__label">${te(it.label)}</div>
        </div>
      </div>`;
    }).join('');
    return `
    <section class="stats" id="stats"><div class="shell"><div class="stats__grid">${cells}</div></div></section>`;
  }

  function sectionHead(d, extra = '') {
    return `
      <div class="section__head ${extra}">
        <p class="section__eyebrow mono reveal">
          <span class="section__number">${esc(d.sectionNumber || '')}</span>
          <span class="section__line"></span>
          <span>${te(d.sectionTitle)}</span>
        </p>
        <h2 class="section__title split reveal-split">${words(d.heading)}</h2>
        <span class="section__sheetnum mono" data-speed="0.08" aria-hidden="true">SHEET ${esc(d.sectionNumber || '')} / 06</span>
      </div>`;
  }

  function renderAbout() {
    const a = DATA.about;
    const ps = a.paragraphs || [];
    const lead = ps.length ? `<p class="about__lead scrub">${scrubWords(ps[0])}</p>` : '';
    const rest = ps.slice(1).map((p, i) => `<p class="reveal" style="--d:${i}">${te(p)}</p>`).join('');
    const rows = (a.specs || []).map((r, i) => `
      <div class="spec-row" style="--d:${i}">
        <span class="spec-row__key mono">${te(r.label)}</span>
        <span class="spec-row__val">${te(r.value)}</span>
      </div>`).join('');
    return `
    <section class="section" id="about">
      <div class="shell">
        ${sectionHead(a)}
        ${lead}
        <div class="about__grid">
          <div class="about__body">${rest}</div>
          <aside class="about__aside">
            <figure class="sheet about__photo reveal" data-tilt style="margin:0">
              <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--tr"></span>
              <span class="sheet__tick sheet__tick--bl"></span><span class="sheet__tick sheet__tick--br"></span>
              <img src="${esc(DATA.hero.photo)}" alt="${te(DATA.hero.photoAlt)}" width="640" height="800">
              <span class="about__vdim" aria-hidden="true"><i></i><b>800</b></span>
              <figcaption class="mono">${te(DATA.hero.photoCaption)}</figcaption>
            </figure>
            <div class="sheet spec-card reveal" data-tilt style="--d:1">
              <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--br"></span>
              <div class="spec-card__head mono">${gearSvg(12, 'part--spin')}<span>${te(a.specSheetTitle)}</span></div>
              <div class="spec-card__rows stagger">${rows}</div>
            </div>
          </aside>
        </div>
      </div>
    </section>`;
  }

  function renderSkills() {
    const s = DATA.skills;
    const cards = (s.categories || []).filter(on).map((c, ci) => {
      const rows = (c.skills || []).map((sk, i) => {
        const lvl = clamp(Number(sk.level) || 0, 0, 100);
        return `
        <div class="skill-row" style="--d:${i}">
          <div class="skill-row__top">
            <span>${esc(sk.name)}</span>
            <span class="skill-row__level mono" data-count="${lvl}" data-suffix="%">${lvl}%</span>
          </div>
          ${cylinderBar(lvl, i)}
        </div>`;
      }).join('');
      return `
      <article class="sheet skill-card reveal" style="--d:${ci}" data-tilt>
        <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--tr"></span>
        <span class="sheet__tick sheet__tick--bl"></span><span class="sheet__tick sheet__tick--br"></span>
        <div class="skill-card__top">
          <div class="skill-card__icon">${icon(c.icon)}</div>
          <span class="skill-card__idx mono">PT-0${ci + 1}</span>
        </div>
        <h3 class="skill-card__title">${te(c.title)}</h3>
        <p class="skill-card__desc">${te(c.description)}</p>
        <div class="skill-card__rows">${rows}</div>
      </article>`;
    }).join('');
    return `
    <section class="section section--alt" id="skills">
      <div class="shell">${sectionHead(s)}<div class="skills__grid">${cards}</div></div>
    </section>`;
  }

  const visibleProjects = () => (DATA.projects.items || []).filter(on);

  function renderProjects() {
    const p = DATA.projects;
    const items = visibleProjects();

    let filters = '';
    if (p.showFilters !== false) {
      const cats = [...new Set(items.map((i) => t(i.category)).filter(Boolean))];
      filters = `
        <div class="filters reveal" id="filters">
          <span class="filters__pill" aria-hidden="true"></span>
          <button class="filter is-active" data-filter="*">${te(p.allFilterLabel)}<sup>${items.length}</sup></button>
          ${cats.map((c) => `<button class="filter" data-filter="${esc(c)}">${esc(c)}<sup>${items.filter((i) => t(i.category) === c).length}</sup></button>`).join('')}
        </div>`;
    }

    const cards = items.map((it, i) => `
      <button class="sheet project-card reveal" data-project="${i}" data-category="${te(it.category)}"
              type="button" aria-haspopup="dialog" style="--d:${i % 3}">
        <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--tr"></span>
        <span class="sheet__tick sheet__tick--bl"></span><span class="sheet__tick sheet__tick--br"></span>
        <div class="project-card__media">
          <img src="${esc(it.cover)}" alt="${te(it.title)}" loading="lazy" width="640" height="400">
          <span class="project-card__scan" aria-hidden="true"></span>
          <span class="project-card__code mono">${esc(it.code || '')}</span>
          <span class="project-card__open" aria-hidden="true">${gearSvg(12)}</span>
        </div>
        ${dimLine(t(it.year) || '', 'dim--card')}
        <div class="project-card__body">
          <p class="project-card__category mono">${te(it.category)}</p>
          <h3 class="project-card__title">${te(it.title)}</h3>
          <p class="project-card__summary">${te(it.summary)}</p>
          <span class="project-card__more">${roll(te(p.detailLabels.viewMore))} ${fwd()}</span>
        </div>
      </button>`).join('');

    return `
    <section class="section" id="projects">
      <div class="shell">${sectionHead(p)}${filters}<div class="projects__grid" id="projects-grid">${cards}</div></div>
    </section>`;
  }

  function renderExperience() {
    const e = DATA.experience;
    const items = (e.items || []).filter(on).map((it) => {
      const points = (it.points || []).map((pt) => `<li>${te(pt)}</li>`).join('');
      return `
      <article class="tl-item reveal ${it.current ? 'tl-item--current' : ''}">
        <span class="tl-item__node" aria-hidden="true"></span>
        <div class="tl-item__side">
          <p class="tl-item__period mono">${te(it.period)}</p>
          ${it.current ? `<span class="tl-item__now mono">${gearSvg(10, 'part--spin')}${rtl() ? 'اکنون' : 'RUNNING'}</span>` : ''}
        </div>
        <div class="sheet tl-item__card">
          <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--br"></span>
          <h3 class="tl-item__role">${te(it.role)}</h3>
          <p class="tl-item__company"><strong>${te(it.company)}</strong> · ${te(it.location)}</p>
          ${points ? `<ul class="tl-item__points">${points}</ul>` : ''}
        </div>
      </article>`;
    }).join('');
    return `
    <section class="section" id="experience">
      <div class="shell">
        ${sectionHead(e)}
        <div class="timeline" id="timeline">
          <span class="screw" aria-hidden="true">
            <span class="screw__thread"></span>
            <span class="screw__travel" id="screw-travel"></span>
            <span class="screw__nut" id="screw-nut">${nutSvg()}</span>
          </span>
          ${items}
        </div>
      </div>
    </section>`;
  }

  function renderEducation() {
    const e = DATA.education;
    const degrees = (e.degrees || []).filter(on).map((d, i) => `
      <article class="sheet edu-card reveal" style="--d:${i}">
        <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--br"></span>
        <p class="edu-card__period mono">${te(d.period)}</p>
        <h4 class="edu-card__title">${te(d.degree)}</h4>
        <p class="edu-card__sub">${te(d.school)}</p>
        ${t(d.note) ? `<p class="edu-card__note">${te(d.note)}</p>` : ''}
      </article>`).join('');

    const certs = (e.certifications || []).filter(on).map((c, i) => `
      <article class="sheet edu-card edu-card--slim reveal" style="--d:${i}">
        <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--br"></span>
        <p class="edu-card__period mono">${esc(c.year || '')}</p>
        <h4 class="edu-card__title">${te(c.title)}</h4>
        <p class="edu-card__sub">${te(c.issuer)}</p>
        ${c.link ? `<a class="edu-card__link" href="${esc(c.link)}" target="_blank" rel="noopener">Verify ${ICONS.arrowNE}</a>` : ''}
      </article>`).join('');

    return `
    <section class="section section--alt" id="education">
      <div class="shell">
        ${sectionHead(e)}
        <div class="edu__grid">
          <div><h3 class="edu__col-title mono">${ICONS.caliper}${te(e.educationTitle)}</h3>${degrees}</div>
          <div><h3 class="edu__col-title mono">${ICONS.caliper}${te(e.certificationsTitle)}</h3>${certs}</div>
        </div>
      </div>
    </section>`;
  }

  function renderContact() {
    const c = DATA.contact;
    const L = c.formLabels || {};

    const details = (c.details || []).filter(on).map((d, i) => {
      const inner = `
        <span class="contact-row__icon">${icon(d.type)}</span>
        <span class="contact-row__label mono">${te(d.label)}</span>
        <span class="contact-row__value" dir="ltr">${esc(d.value)}</span>
        <span class="contact-row__arrow">${ICONS.arrowNE}</span>`;
      return d.link
        ? `<a class="contact-row reveal" style="--d:${i}" href="${esc(d.link)}">${inner}</a>`
        : `<div class="contact-row reveal" style="--d:${i}">${inner}</div>`;
    }).join('');

    const socials = (c.socials || []).filter(on).map((s) => `
      <a class="social" href="${esc(s.url)}" target="_blank" rel="noopener" data-magnetic
         aria-label="${esc(s.label)}" title="${esc(s.label)}">${icon(s.icon)}</a>`).join('');

    const form = c.showForm === false ? '' : `
      <form class="sheet form reveal" id="contact-form" name="contact" method="POST"
            data-provider="${esc(c.formProvider || 'netlify')}"
            data-endpoint="${esc(c.formspreeEndpoint || '')}" novalidate>
        <input type="hidden" name="form-name" value="contact">
        <p style="display:none"><label>Do not fill<input name="bot-field"></label></p>
        <div class="field"><input id="cf-name" name="name" type="text" required autocomplete="name" placeholder=" "><label for="cf-name">${te(L.name)}</label></div>
        <div class="field"><input id="cf-email" name="email" type="email" required autocomplete="email" placeholder=" "><label for="cf-email">${te(L.email)}</label></div>
        <div class="field"><input id="cf-company" name="company" type="text" autocomplete="organization" placeholder=" "><label for="cf-company">${te(L.company)}</label></div>
        <div class="field"><textarea id="cf-message" name="message" required placeholder=" "></textarea><label for="cf-message">${te(L.message)}</label></div>
        <button class="btn btn--primary btn--block" type="submit" data-magnetic><span class="btn__fill"></span>${roll(te(L.submit))}</button>
        <p class="form__status" id="form-status" role="status"
           data-sending="${te(L.sending)}" data-success="${te(L.success)}" data-error="${te(L.error)}"></p>
      </form>`;

    const email = (c.details || []).find((d) => on(d) && d.type === 'email');

    return `
    ${renderCamStrip()}
    <section class="section contact" id="contact">
      <div class="shell">
        ${sectionHead(c, 'section__head--center')}
        ${email ? `
        <a class="contact__big" href="${esc(email.link || 'mailto:' + email.value)}">
          <span class="contact__big-text" dir="ltr">${esc(email.value)}</span>
          ${dimLine(rtl() ? 'تماس مستقیم' : 'DIRECT LINE', 'dim--big')}
        </a>` : ''}
        <div class="contact__grid ${form ? '' : 'contact__grid--single'}">
          <div>
            <p class="contact__intro reveal">${te(c.intro)}</p>
            <div class="contact__rows">${details}</div>
            <div class="socials reveal">${socials}</div>
          </div>
          ${form}
        </div>
      </div>
    </section>`;
  }

  function renderFooter() {
    const f = DATA.footer;
    const year = new Date().getFullYear();
    // A drawing title block closes the sheet.
    return `
    <footer class="site-footer">
      <div class="shell">
        <div class="titleblock">
          <div class="titleblock__cell titleblock__cell--wide">
            <span class="mono">${rtl() ? 'عنوان' : 'TITLE'}</span>
            <strong>${te(DATA.hero.name)}</strong>
            <em>${te(f.tagline)}</em>
          </div>
          <div class="titleblock__cell">
            <span class="mono">${rtl() ? 'مقیاس' : 'SCALE'}</span><strong>1 : 1</strong>
          </div>
          <div class="titleblock__cell">
            <span class="mono">${rtl() ? 'واحد' : 'UNITS'}</span><strong>mm</strong>
          </div>
          <div class="titleblock__cell">
            <span class="mono">${rtl() ? 'سال' : 'YEAR'}</span><strong dir="ltr">${year}</strong>
          </div>
          <div class="titleblock__cell titleblock__cell--action">
            <a class="to-top" href="#hero" data-magnetic aria-label="${te(f.backToTop)}">${ICONS.arrowUp}<span>${te(f.backToTop)}</span></a>
          </div>
        </div>
        <p class="site-footer__meta mono">© ${year} ${te(f.copyrightName)} — ${te(f.note)}</p>
      </div>
    </footer>`;
  }

  const RENDERERS = {
    hero: renderHero, stats: renderStats, about: renderAbout, skills: renderSkills,
    projects: renderProjects, experience: renderExperience,
    education: renderEducation, contact: renderContact
  };

  /* ------------------------------------------------------------ page build */

  function render() {
    const html = enabledSections()
      .map((s) => (RENDERERS[s.key] ? RENDERERS[s.key]() : ''))
      .join('');

    $('#app').innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      ${renderChrome()}
      ${renderHeader()}
      <main id="main">${html}</main>
      ${renderFooter()}
      <div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true"></div>`;

    $('#app').removeAttribute('aria-busy');
    wireUp();
  }

  function applyLanguage() {
    const html = document.documentElement;
    html.lang = LANG;
    html.dir = rtl() ? 'rtl' : 'ltr';
    document.title = t(DATA.site.pageTitle);
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', t(DATA.site.metaDescription));
    applyFonts();
    try { localStorage.setItem(STORE_KEY, LANG); } catch (e) { /* private mode */ }
  }

  // Language change wipes the sheet across like a plotter pass.
  function setLanguage(lang) {
    if (lang === LANG) return;
    const swap = () => {
      LANG = lang;
      applyLanguage();
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.classList.add('is-ready');
      introHero();
    };
    const wipe = $('#wipe');
    if (!motionOn() || !wipe) { swap(); return; }
    wipe.classList.add('is-in');
    setTimeout(() => {
      swap();
      const w2 = $('#wipe');
      w2.classList.add('is-in', 'no-trans');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        w2.classList.remove('no-trans');
        w2.classList.add('is-out');
      }));
      setTimeout(() => w2.classList.remove('is-in', 'is-out'), 1000);
    }, 650);
  }

  /* -------------------------------------------------------------- behaviour */

  let revealIO = null, spyIO = null, heroIO = null;

  function wireUp() {
    initNav();
    initReveal();
    initProjects();
    initForm();
    initStructuredData();
    initPointerFx();
    initHeroMechanism();
    collectScrollTargets();
  }

  function initNav() {
    const nav = $('#nav');
    const menuBtn = $('#menu-btn');
    const setMenu = (open) => {
      nav.classList.toggle('is-open', open);
      menuBtn.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('no-scroll', open);
      document.getElementById('site-header').classList.toggle('has-menu', open);
    };
    menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('.nav__link')) setMenu(false); });

    $$('[data-lang]').forEach((btn) => btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));

    const links = $$('[data-nav]');
    if (spyIO) spyIO.disconnect();
    if (!links.length) return;
    spyIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((l) => { const sec = document.getElementById(l.dataset.nav); if (sec) spyIO.observe(sec); });
  }

  function animateCount(el, dur = 1600) {
    const raw = el.dataset.count || '';
    const target = parseFloat(raw);
    if (Number.isNaN(target)) return;
    const pad = /^0\d/.test(raw.trim());
    const suffix = el.dataset.suffix || '';
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 4);
      const val = Math.round(target * eased);
      el.textContent = (pad && val < 10 ? '0' + val : String(val)) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Letters "decode" like a plotter finding its glyphs (Latin only).
  function scramble(el) {
    const final = el.textContent;
    if (!motionOn() || /[؀-ۿ]/.test(final)) return;
    const glyphs = '⌀±×∅◇⏥⌭|/-_=+*#0123456789';
    const len = final.length;
    const start = performance.now();
    const dur = 1100;
    const tick = (now) => {
      const k = (now - start) / dur;
      let out = '';
      for (let i = 0; i < len; i++) {
        const reveal = i / len;
        if (k > reveal + 0.15 || final[i] === ' ') out += final[i];
        else if (k > reveal - 0.25) out += glyphs[(Math.random() * glyphs.length) | 0];
        else out += ' ';
      }
      el.textContent = out;
      if (k < 1.2) requestAnimationFrame(tick); else el.textContent = final;
    };
    requestAnimationFrame(tick);
  }

  const introHero = () => { const sc = $('[data-scramble]'); if (sc) scramble(sc); };

  function activate(el) {
    el.classList.add('is-visible');
    if (!motionOn()) return;
    if (el.classList.contains('stat')) {
      const v = $('.stat__value', el);
      if (v) animateCount(v);
    }
    $$('.skill-row__level', el).forEach((v, i) => setTimeout(() => animateCount(v, 1300), 300 + i * 90));
  }

  function initReveal() {
    const els = $$('.reveal, .reveal-split');
    if (revealIO) revealIO.disconnect();
    if (!motionOn()) { els.forEach((el) => el.classList.add('is-visible')); return; }
    revealIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        activate(en.target);
        revealIO.unobserve(en.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => revealIO.observe(el));
  }

  /* --------------------------------------- pointer: cross-hair, tilt, magnet */

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };

  function initPointerFx() {
    if (!MQ_FINE.matches || !motionOn()) return;
    $$('[data-magnetic]').forEach((el) => {
      const strength = el.classList.contains('social') || el.classList.contains('to-top') ? 0.4 : 0.26;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });

    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        el.classList.add('is-tilting');
      });
      el.addEventListener('mouseleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.classList.remove('is-tilting');
      });
    });

    $$('.btn').forEach((el) => {
      el.addEventListener('mouseenter', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  function initGlobalListeners() {
    window.addEventListener('mousemove', (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      pointer.nx = e.clientX / innerWidth - 0.5;
      pointer.ny = e.clientY / innerHeight - 0.5;
    }, { passive: true });
    window.addEventListener('resize', () => { collectScrollTargets(); sizeCanvas(); }, { passive: true });

    document.addEventListener('keydown', (e) => {
      const modal = $('#modal');
      if (!modal || !modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeProject();
      if (e.key === 'ArrowRight') stepGallery(rtl() ? -1 : 1);
      if (e.key === 'ArrowLeft')  stepGallery(rtl() ? 1 : -1);
    });

    requestAnimationFrame(loop);
  }

  /* ------------------------------------------- scroll-driven mechanisms */

  let S = {};
  let lastY = window.scrollY;
  let velocity = 0;
  let headerHidden = false;
  let travel = 0;
  let camAng = 0;          // camshaft angle

  function collectScrollTargets() {
    S = {
      parallax: $$('[data-speed]').map((el) => ({ el, speed: parseFloat(el.dataset.speed) || 0 })),
      scrub: $$('.scrub').map((el) => ({ el, words: $$('.sw', el) })),
      timeline: $('#timeline'),
      screwNut: $('#screw-nut'),
      screwTravel: $('#screw-travel'),
      rackPinion: $('#rack-pinion'),
      rackTravel: $('#rack-travel'),
      heroFade: $('[data-hero-fade]'),
      header: $('#site-header'),
      cams: $$('.cam').map((el) => ({ el, x: +el.dataset.x, i: +el.dataset.cam, lobe: $('.cam__lobe', el), fol: $('.cam__follower', el) }))
    };
  }

  function loop() {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    velocity = lerp(velocity, dy, 0.12);
    travel += dy;
    const vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const prog = max > 0 ? clamp(y / max, 0, 1) : 0;
    const moving = motionOn();
    const dirSign = rtl() ? -1 : 1;

    // rack & pinion at the top of the page: the gear rolls along the rack
    if (S.rackPinion && S.rackTravel) {
      const w = S.rackPinion.parentElement.offsetWidth - 34;
      const x = prog * w * dirSign;
      const rot = (prog * w) / (Math.PI * 17) * 360;   // rolling without slip
      S.rackPinion.style.transform = `translateX(${x}px) rotate(${(rot * dirSign).toFixed(1)}deg)`;
      S.rackTravel.style.transform = `scaleX(${prog})`;
    }

    if (S.header) {
      S.header.classList.toggle('is-stuck', y > 20);
      const menuOpen = $('#nav')?.classList.contains('is-open');
      if (!menuOpen && Math.abs(dy) > 2) {
        const hide = dy > 0 && y > vh * 0.6;
        if (hide !== headerHidden) { headerHidden = hide; S.header.classList.toggle('is-hidden', hide); }
      }
    }

    if (moving) {
      if (S.heroFade && y < vh * 1.2) {
        const k = clamp(y / (vh * 0.9), 0, 1);
        S.heroFade.style.transform = `translate3d(0, ${y * 0.22}px, 0)`;
        S.heroFade.style.opacity = String(1 - k * 1.1);
      }

      for (const p of S.parallax) {
        const r = p.el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const off = (r.top + r.height / 2 - vh / 2) * p.speed;
        p.el.style.setProperty('--py-offset', off.toFixed(1) + 'px');
      }

      for (const s of S.scrub) {
        const r = s.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const k = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
        const lit = Math.floor(k * s.words.length * 1.05);
        s.words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
      }

      // lead screw: the nut travels down the thread and spins as it goes
      if (S.timeline && S.screwNut) {
        const r = S.timeline.getBoundingClientRect();
        const k = clamp((vh * 0.55 - r.top) / (r.height - 60), 0, 1);
        const dist = k * (r.height - 60);
        S.screwNut.style.transform = `translateY(${dist.toFixed(1)}px) rotate(${(dist * 2.2).toFixed(1)}deg)`;
        if (S.screwTravel) S.screwTravel.style.transform = `scaleY(${k})`;
        $$('.tl-item', S.timeline).forEach((it) => {
          const ir = it.getBoundingClientRect();
          it.classList.toggle('is-passed', ir.top < vh * 0.62);
        });
      }

      // camshaft: each follower sits on top of its rotating elliptical cam
      if (S.cams && S.cams.length) {
        camAng += 0.028 + Math.abs(velocity) * 0.004;
        for (const c of S.cams) {
          const th = camAng + c.i * (TAU / 3);
          const rx = 30, ry = 20;
          const top = Math.sqrt((rx * Math.sin(th)) ** 2 + (ry * Math.cos(th)) ** 2);
          const rollerY = 84 - top - 6;               // roller rests on the cam
          c.lobe.setAttribute('transform', `rotate(${(th * 180 / Math.PI).toFixed(1)} ${c.x} 84)`);
          c.fol.setAttribute('transform', `translate(0 ${(rollerY - 44).toFixed(2)})`);
        }
      }

    }

    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------------
     HERO MECHANISM
     A 24-tooth driver gear meshes with a 12-tooth pinion; the pinion carries
     a crank pin, the connecting rod turns that rotation into the straight
     stroke of a piston inside its cylinder — drawn as a technical drawing,
     with centre lines, hatching and a live dimension of the stroke.
     ------------------------------------------------------------------------ */

  const M = { canvas: null, ctx: null, w: 0, h: 0, dpr: 1, visible: true, raf: 0, ang: 0, speed: 1 };

  function sizeCanvas() {
    if (!M.canvas) return;
    const r = M.canvas.getBoundingClientRect();
    M.dpr = Math.min(2, window.devicePixelRatio || 1);
    M.w = r.width; M.h = r.height;
    M.canvas.width = Math.round(r.width * M.dpr);
    M.canvas.height = Math.round(r.height * M.dpr);
  }

  function initHeroMechanism() {
    cancelAnimationFrame(M.raf);
    M.canvas = $('#hero-canvas');
    if (!M.canvas) return;
    M.ctx = M.canvas.getContext('2d');
    sizeCanvas();

    if (heroIO) heroIO.disconnect();
    heroIO = new IntersectionObserver(([en]) => { M.visible = en.isIntersecting; });
    heroIO.observe(M.canvas);

    let last = performance.now();

    const draw = (now) => {
      M.raf = requestAnimationFrame(draw);
      if (!M.visible) return;
      const dt = Math.min(64, now - last); last = now;
      const animate = motionOn();

      // the mechanism speeds up while you scroll and eases back to idle
      const target = 1 + Math.min(4, Math.abs(velocity) * 0.22);
      M.speed = lerp(M.speed, target, 0.06);
      if (animate) M.ang += (dt / 1000) * 0.55 * M.speed;
      else M.ang = 0.6;

      const { ctx, w, h, dpr } = M;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const ink = cssVar('--blueprint', '#1D5E96');
      const accent = cssVar('--accent', '#D4541A');
      const faint = cssVar('--border', '#C8C2B4');
      const mono = `500 ${Math.max(9, Math.min(12, w * 0.008))}px ${cssVar('--font-mono', 'monospace').split(',')[0]}`;

      // The drawing is laid out in units of the driver gear radius (R1) and
      // then scaled to fit the frame: it spans -1.3 R1 … 3.85 R1 across and
      // ±1.85 R1 down.
      const EXT_L = -1.3, EXT_R = 3.85, EXT_V = 1.85;
      const S0 = Math.min((w * 0.94) / (EXT_R - EXT_L), (h * 0.9) / (EXT_V * 2));
      const mid = (EXT_L + EXT_R) / 2;
      const tilt = pointer.ny * 0.05;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tilt);
      if (rtl()) ctx.scale(-1, 1);          // the whole machine mirrors for RTL
      ctx.translate(-mid * S0, 0);

      const R1 = S0, teeth1 = 24;
      const R2 = S0 * 0.5, teeth2 = 12;
      const pitch1 = R1 * 0.92, pitch2 = R2 * 0.92;
      const gap = pitch1 + pitch2;                            // centre distance
      const a1 = M.ang;
      const a2 = -a1 * (teeth1 / teeth2) + Math.PI / teeth2;  // meshing pinion

      // ---- construction: centre lines (dash-dot) ----
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.setLineDash([14, 5, 3, 5]);
      ctx.beginPath();
      ctx.moveTo(EXT_L * R1, 0); ctx.lineTo(EXT_R * R1, 0);
      ctx.moveTo(0, -R1 * 1.7); ctx.lineTo(0, R1 * 1.7);
      ctx.moveTo(gap, -R2 * 2.4); ctx.lineTo(gap, R2 * 2.4);
      ctx.stroke();
      ctx.setLineDash([]);

      // ---- pitch circles ----
      ctx.strokeStyle = faint;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, pitch1, 0, TAU);
      ctx.moveTo(gap + pitch2, 0);
      ctx.arc(gap, 0, pitch2, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // ---- gear bodies ----
      const drawGear = (x, ang, R, teeth, spokes) => {
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(ang);
        const p = new Path2D(gearPath(0, 0, R, teeth, 0.86, 0));
        ctx.fillStyle = 'rgba(29,94,150,.05)';
        ctx.fill(p);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6;
        ctx.stroke(p);
        // hub, bore, keyway
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.3, 0, TAU);
        ctx.moveTo(R * 0.13, 0); ctx.arc(0, 0, R * 0.13, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-R * 0.035, -R * 0.155, R * 0.07, R * 0.045);
        ctx.stroke();
        // spokes / lightening holes
        ctx.beginPath();
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * TAU;
          const rr = R * 0.58;
          ctx.moveTo(Math.cos(a) * rr + R * 0.12, Math.sin(a) * rr);
          ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.12, 0, TAU);
        }
        ctx.stroke();
        ctx.restore();
      };
      drawGear(0, a1, R1, teeth1, 5);
      drawGear(gap, a2, R2, teeth2, 3);

      // ---- slider-crank driven by the pinion ----
      const crankR = R2 * 0.62;
      const rodL = R2 * 3.0;
      const px = gap + Math.cos(a2) * crankR;
      const py = Math.sin(a2) * crankR;
      const sx = gap + Math.sqrt(Math.max(1, rodL * rodL - py * py)) + crankR * 0.0;

      // cylinder body
      const cylX0 = gap + crankR + rodL * 0.42;
      const cylX1 = gap + crankR + rodL * 1.32;
      const cylH = R2 * 0.78;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.rect(cylX0, -cylH, cylX1 - cylX0, cylH * 2);
      ctx.stroke();
      // hatched end cap
      ctx.save();
      ctx.beginPath();
      ctx.rect(cylX1 - cylH * 0.34, -cylH, cylH * 0.34, cylH * 2);
      ctx.clip();
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -3; i < 14; i++) {
        const x0 = cylX1 - cylH * 0.34 + i * 6;
        ctx.moveTo(x0, cylH); ctx.lineTo(x0 + cylH * 2, -cylH);
      }
      ctx.stroke();
      ctx.restore();
      // ports
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.rect(cylX0 + cylH * 0.25, -cylH - cylH * 0.35, cylH * 0.3, cylH * 0.35);
      ctx.rect(cylX1 - cylH * 0.9, -cylH - cylH * 0.35, cylH * 0.3, cylH * 0.35);
      ctx.stroke();

      // connecting rod + piston
      const pistonX = clamp(sx, cylX0 + cylH * 0.5, cylX1 - cylH * 0.9);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(pistonX, 0);
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.rect(pistonX, -cylH * 0.72, cylH * 0.55, cylH * 1.44);   // piston
      ctx.stroke();
      ctx.fillStyle = 'rgba(29,94,150,.08)';
      ctx.fill();
      // crank pin + joints
      ctx.fillStyle = accent;
      [[px, py], [pistonX, 0], [gap, 0], [0, 0]].forEach(([jx, jy], i) => {
        ctx.beginPath();
        ctx.arc(jx, jy, i > 1 ? 3.2 : 4.2, 0, TAU);
        ctx.fill();
      });

      // ---- live stroke dimension under the cylinder ----
      const dimY = cylH * 2.1;
      const strokeMM = Math.round(((pistonX - (cylX0 + cylH * 0.5)) / (cylX1 - cylH * 0.9 - cylX0 - cylH * 0.5)) * 120);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cylX0 + cylH * 0.5, cylH * 1.1); ctx.lineTo(cylX0 + cylH * 0.5, dimY + 10);
      ctx.moveTo(pistonX, cylH * 1.1); ctx.lineTo(pistonX, dimY + 10);
      ctx.moveTo(cylX0 + cylH * 0.5, dimY); ctx.lineTo(pistonX, dimY);
      ctx.stroke();
      const arrow = (x, dir) => {
        ctx.beginPath();
        ctx.moveTo(x, dimY); ctx.lineTo(x + 7 * dir, dimY - 3); ctx.lineTo(x + 7 * dir, dimY + 3);
        ctx.closePath(); ctx.fillStyle = accent; ctx.fill();
      };
      arrow(cylX0 + cylH * 0.5, 1); arrow(pistonX, -1);
      ctx.save();
      if (rtl()) { ctx.translate((cylX0 + pistonX) / 2, 0); ctx.scale(-1, 1); ctx.translate(-(cylX0 + pistonX) / 2, 0); }
      ctx.font = mono;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.fillText(`${strokeMM} mm`, (cylX0 + cylH * 0.5 + pistonX) / 2, dimY - 7);
      // gear ratio callout
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.fillText(`z1=24 / z2=12 · i=2:1`, -R1 * 0.2, -R1 * 1.35);
      ctx.restore();

      ctx.restore();
      if (!animate) cancelAnimationFrame(M.raf);
    };
    M.raf = requestAnimationFrame(draw);
  }

  /* ------------------------------------------------------- project modal */

  let galleryIndex = 0, galleryImages = [], lastFocused = null;

  function initProjects() {
    const grid = $('#projects-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-project]');
      if (card) openProject(Number(card.dataset.project), card, e);
    });

    const filters = $('#filters');
    const movePill = (btn) => {
      if (!filters || !btn) return;
      const pill = $('.filters__pill', filters);
      pill.style.width = btn.offsetWidth + 'px';
      pill.style.height = btn.offsetHeight + 'px';
      pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    };
    requestAnimationFrame(() => movePill($('.filter.is-active')));
    if (document.fonts) document.fonts.ready.then(() => movePill($('.filter.is-active')));
    window.addEventListener('resize', () => movePill($('.filter.is-active')), { passive: true });

    $$('.filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.filter').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        movePill(btn);
        const f = btn.dataset.filter;
        const cards = $$('.project-card', grid);
        const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
        cards.forEach((card) => {
          card.classList.toggle('is-hidden', f !== '*' && card.dataset.category !== f);
          card.classList.add('is-visible');
        });
        if (!motionOn()) return;
        cards.forEach((card, i) => {
          if (card.classList.contains('is-hidden')) return;
          const a = first.get(card);
          const b = card.getBoundingClientRect();
          const wasHidden = a.width === 0;
          const kf = wasHidden
            ? [{ opacity: 0, transform: 'scale(.9) translateY(24px)' }, { opacity: 1, transform: 'none' }]
            : [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }];
          card.animate(kf, { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', delay: wasHidden ? i * 40 : 0, fill: 'backwards' });
        });
      });
    });
  }

  function openProject(i, trigger, evt) {
    const p = DATA.projects;
    const item = visibleProjects()[i];
    if (!item) return;
    const L = p.detailLabels;
    lastFocused = trigger || null;

    galleryImages = (item.gallery && item.gallery.length)
      ? item.gallery : [{ image: item.cover, caption: item.title }];
    galleryIndex = 0;

    const thumbs = galleryImages.length > 1 ? `
      <div class="gallery__thumbs">
        ${galleryImages.map((g, n) => `
          <button class="gallery__thumb ${n === 0 ? 'is-active' : ''}" data-thumb="${n}" type="button"
                  aria-label="Image ${n + 1}"><img src="${esc(g.image)}" alt="" loading="lazy"></button>`).join('')}
      </div>` : '';

    const navBtns = galleryImages.length > 1 ? `
      <button class="gallery__nav gallery__nav--prev" data-step="-1" type="button" aria-label="Previous">${rtl() ? ICONS.arrowRight : ICONS.arrowLeft}</button>
      <button class="gallery__nav gallery__nav--next" data-step="1"  type="button" aria-label="Next">${rtl() ? ICONS.arrowLeft : ICONS.arrowRight}</button>
      <span class="gallery__count mono" id="gallery-count">01 / ${String(galleryImages.length).padStart(2, '0')}</span>` : '';

    const specs = (item.specs || []).map((s) => `
      <div class="spec-row">
        <span class="spec-row__key mono">${te(s.label)}</span>
        <span class="spec-row__val">${te(s.value)}</span>
      </div>`).join('');

    let n = 0;
    const block = (label, body) => t(body)
      ? `<div class="detail-block m-in" style="--d:${n++}"><p class="detail-block__label mono">${te(label)}</p><p>${te(body)}</p></div>` : '';

    const modal = $('#modal');
    modal.innerHTML = `
      <div class="modal__panel" role="document">
        <button class="modal__close" id="modal-close" type="button" aria-label="${te(L.close)}">${ICONS.close}</button>
        <div class="sheet modal__inner">
          <span class="sheet__tick sheet__tick--tl"></span><span class="sheet__tick sheet__tick--tr"></span>
          <span class="sheet__tick sheet__tick--bl"></span><span class="sheet__tick sheet__tick--br"></span>
          <header class="modal__head">
            <p class="modal__meta mono m-in" style="--d:0">
              <span>${esc(item.code || '')}</span>
              <span>${te(item.category)}</span>
              <span>${esc(item.year || '')}</span>
              ${t(item.client) ? `<span>${te(item.client)}</span>` : ''}
            </p>
            <h2 class="modal__title split" id="modal-title">${words(item.title)}</h2>
            <p class="modal__summary m-in" style="--d:2">${te(item.summary)}</p>
          </header>

          <div class="gallery m-in" style="--d:3">
            <div class="gallery__main">
              <img id="gallery-img" src="${esc(galleryImages[0].image)}" alt="${te(item.title)}">
              ${navBtns}
            </div>
            <p class="gallery__caption" id="gallery-caption">${te(galleryImages[0].caption)}</p>
            ${thumbs}
          </div>

          <div class="modal__grid">
            <div>
              ${block(L.problem, item.problem)}
              ${block(L.solution, item.solution)}
              ${block(L.role, item.role)}
            </div>
            <aside>
              ${t(item.outcome) ? `
                <div class="outcome-box detail-block m-in" style="--d:${n++}">
                  <p class="detail-block__label mono">${te(L.outcome)}</p>
                  <p>${te(item.outcome)}</p>
                </div>` : ''}
              ${(item.tools || []).length ? `
                <div class="detail-block m-in" style="--d:${n++}">
                  <p class="detail-block__label mono">${te(L.tools)}</p>
                  <div class="tag-list">${item.tools.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>
                </div>` : ''}
              ${specs ? `
                <div class="spec-card spec-card--flat m-in" style="--d:${n++}">
                  <div class="spec-card__head mono">${ICONS.caliper}<span>${te(L.specs)}</span></div>${specs}
                </div>` : ''}
            </aside>
          </div>
        </div>
      </div>`;

    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.remove('is-closing');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.body.classList.add('no-scroll');

    $('#modal-close').addEventListener('click', closeProject);
    modal.onclick = (e) => { if (e.target === modal) closeProject(); };
    $$('[data-step]', modal).forEach((b) => b.addEventListener('click', () => stepGallery(Number(b.dataset.step))));
    $$('[data-thumb]', modal).forEach((b) => b.addEventListener('click', () => showGallery(Number(b.dataset.thumb))));

    const main = $('.gallery__main', modal);
    let sx = null;
    main.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) stepGallery((dx < 0 ? 1 : -1) * (rtl() ? -1 : 1));
      sx = null;
    });

    setTimeout(() => $('#modal-close')?.focus({ preventScroll: true }), 50);
  }

  function showGallery(nIdx, dir = 1) {
    if (!galleryImages.length) return;
    galleryIndex = (nIdx + galleryImages.length) % galleryImages.length;
    const g = galleryImages[galleryIndex];
    const img = $('#gallery-img');
    if (motionOn() && img.animate) {
      const off = 36 * dir * (rtl() ? -1 : 1);
      img.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-off}px)` }],
        { duration: 170, easing: 'ease-in' }).onfinish = () => {
        img.src = g.image;
        img.animate([{ opacity: 0, transform: `translateX(${off}px)` }, { opacity: 1, transform: 'none' }],
          { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' });
      };
    } else img.src = g.image;
    $('#gallery-caption').textContent = t(g.caption);
    const cnt = $('#gallery-count');
    if (cnt) cnt.textContent = `${String(galleryIndex + 1).padStart(2, '0')} / ${String(galleryImages.length).padStart(2, '0')}`;
    $$('[data-thumb]').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.thumb) === galleryIndex));
  }

  const stepGallery = (d) => showGallery(galleryIndex + d, d);

  function closeProject() {
    const modal = $('#modal');
    modal.classList.add('is-closing');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    setTimeout(() => {
      if (!modal.classList.contains('is-open')) { modal.innerHTML = ''; modal.classList.remove('is-closing'); }
    }, 700);
    if (lastFocused) lastFocused.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- form */

  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('#form-status');
    const say = (kind) => {
      status.textContent = status.dataset[kind];
      status.className = 'form__status is-visible ' +
        (kind === 'success' ? 'is-ok' : kind === 'error' ? 'is-error' : '');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (form.querySelector('[name="bot-field"]').value) return;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      say('sending');
      const provider = form.dataset.provider;
      const data = new FormData(form);
      try {
        if (provider === 'formspree' && form.dataset.endpoint) {
          const res = await fetch(form.dataset.endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error('bad response');
        } else if (provider === 'mailto') {
          const to = (DATA.contact.details.find((d) => d.type === 'email') || {}).value || '';
          const body = `${data.get('name')} (${data.get('email')})\n${data.get('company')}\n\n${data.get('message')}`;
          window.location.href = `mailto:${to}?subject=${encodeURIComponent('Website enquiry')}&body=${encodeURIComponent(body)}`;
        } else {
          const res = await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(data).toString()
          });
          if (!res.ok) throw new Error('bad response');
        }
        say('success');
        form.reset();
      } catch (err) { say('error'); } finally { btn.disabled = false; }
    });
  }

  /* ------------------------------------- structured data (SEO: Google) --- */

  function initStructuredData() {
    const email = (DATA.contact.details || []).find((d) => d.type === 'email');
    const data = {
      '@context': 'https://schema.org', '@type': 'Person',
      name: t(DATA.hero.name), jobTitle: t(DATA.hero.eyebrow),
      description: t(DATA.site.metaDescription),
      url: DATA.site.siteUrl || undefined,
      email: email ? email.value : undefined,
      sameAs: (DATA.contact.socials || []).filter(on).map((s) => s.url)
    };
    let tag = $('#ld-json');
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json'; tag.id = 'ld-json';
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(data);
  }

  /* ------------------------------------------- start-up sequence (loader) */

  function runLoader(readyPromise) {
    const loader = $('#loader');
    const count = $('#loader-count');
    const rod = $('#loader-rod');

    // draw the three gears of the start-up train
    const gears = [['#ld-gear-a', 60, 70, 46, 18], ['#ld-gear-b', 152, 70, 30, 12], ['#ld-gear-c', 224, 70, 22, 9]];
    gears.forEach(([sel, gx, gy, r, z]) => {
      const g = $(sel);
      if (!g) return;
      g.innerHTML = `<path d="${gearPath(0, 0, r, z, 0.82, 0.3)}"/><circle r="${(r * 0.12).toFixed(1)}"/>`;
      g.parentElement.style.setProperty('--cx', gx);
      g.parentElement.style.setProperty('--cy', gy);
      g.setAttribute('transform', `translate(${gx} ${gy})`);
      g.parentElement.style.transformOrigin = `${gx}px ${gy}px`;
    });

    const finish = () => {
      document.documentElement.classList.remove('is-loading');
      document.documentElement.classList.add('is-ready');
      introHero();
      if (loader) setTimeout(() => loader.remove(), 1500);
    };
    if (!loader || !motionOn()) {
      loader?.remove();
      document.documentElement.classList.remove('is-loading');
      document.documentElement.classList.add('is-ready');
      return;
    }

    let ready = false;
    readyPromise.then(() => { ready = true; });
    const t0 = performance.now();
    let shown = 0;
    const step = (now) => {
      const elapsed = now - t0;
      const target = ready ? 100 : Math.min(88, elapsed / 13);
      shown = lerp(shown, target, ready ? 0.14 : 0.08);
      if (ready && shown > 99.4) shown = 100;
      const v = Math.round(shown);
      count.textContent = String(v).padStart(3, '0');
      if (rod) rod.style.transform = `scaleX(${v / 100})`;
      if (v >= 100 && elapsed > 1100) { loader.classList.add('is-done'); setTimeout(finish, 520); return; }
      if (elapsed > 7000) { loader.classList.add('is-done'); setTimeout(finish, 520); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ----------------------------------------------------------------- boot */

  async function boot() {
    try {
      const res = await fetch('content.json?v=' + Date.now());
      if (!res.ok) throw new Error('content.json could not be loaded (HTTP ' + res.status + ')');
      DATA = await res.json();
    } catch (err) {
      $('#loader')?.remove();
      document.documentElement.classList.remove('is-loading');
      $('#app').innerHTML = `
        <div style="padding:4rem 1.5rem;max-width:640px;margin:auto;font-family:system-ui">
          <h1 style="font-size:1.4rem">The site content could not be loaded</h1>
          <p style="color:#6A7280">There is probably a small typo in <code>content.json</code> —
             a missing comma, bracket or quote mark.</p>
          <p style="color:#6A7280">Paste the file into <a href="https://jsonlint.com" style="color:#D4541A">jsonlint.com</a>
             to find the exact line, fix it, and reload this page.</p>
          <pre style="color:#B3261E;white-space:pre-wrap">${esc(err.message)}</pre>
        </div>`;
      return;
    }

    let saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    LANG = saved || DATA.site.defaultLanguage || 'en';

    applyTheme(DATA.theme || {});
    applyLanguage();
    render();
    initGlobalListeners();

    const heroImg = $('.about__photo img');
    const imgReady = heroImg && !heroImg.complete
      ? new Promise((r) => { heroImg.onload = heroImg.onerror = r; }) : Promise.resolve();
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    runLoader(Promise.all([imgReady, fontsReady]).then(() => collectScrollTargets()));
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
