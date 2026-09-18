/* ==========================================================================
   PRECISION STEEL — site renderer
   --------------------------------------------------------------------------
   This file reads content.json and draws the whole website from it.
   YOU DO NOT NEED TO EDIT THIS FILE. To change anything you see on the site,
   edit content.json (or use the /admin editor).
   ========================================================================== */

(() => {
  'use strict';

  const STORE_KEY = 'ps-lang';
  let DATA = null;
  let LANG = 'en';

  /* ---------------------------------------------------------------- utils */

  // Picks the right language out of a { "en": "...", "fa": "..." } value.
  // Also tolerates a plain string, so single-language fields still work.
  const t = (v) => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return v[LANG] || v.en || v.fa || '';
  };

  // Escapes text so a stray < or & in content.json can never break the page.
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const te = (v) => esc(t(v));                    // translate + escape
  const on = (item) => item && item.enabled !== false;
  const rtl = () => LANG === 'fa';

  /* ---------------------------------------------------------------- icons */

  const svg = (paths, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

  const ICONS = {
    arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    arrowLeft:  svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
    arrowUp:    svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    download:   svg('<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>'),
    close:      svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    email:      svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M3 6.5l9 6 9-6"/>'),
    phone:      svg('<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 006.5 6.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.2 2 2 0 016.5 3z"/>'),
    location:   svg('<path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    // skill-category icons
    drafting:   svg('<path d="M4 20L12 4l8 16M7.5 14h9"/><circle cx="12" cy="4" r="1.2"/>'),
    analysis:   svg('<path d="M3 20h18M6 20V9M11 20V5M16 20v-7M21 20v-4"/>'),
    manufacturing: svg('<path d="M3 20h18V9l-5 3.5V9l-5 3.5V9L3 12.5V20z"/><path d="M3 12.5L4 4h3l1 8.5"/>'),
    automation: svg('<rect x="4" y="8" width="16" height="10" rx="2"/><path d="M12 8V4M9 4h6M8.5 13h.01M15.5 13h.01"/>'),
    cog:        svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>'),
    // social icons (filled)
    linkedin:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 11-.01 5 2.5 2.5 0 01.01-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95C20.4 8.75 21 11 21 14.1V21h-4v-6.1c0-1.46-.03-3.34-2.05-3.34-2.05 0-2.37 1.59-2.37 3.23V21H9z"/></svg>',
    whatsapp:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.05L2 22l5.07-1.33A10 10 0 1012 2zm5.3 14.1c-.23.64-1.33 1.22-1.84 1.27-.5.05-.97.23-3.27-.68-2.75-1.08-4.5-3.87-4.63-4.05-.14-.18-1.11-1.48-1.11-2.82s.7-2 .95-2.28c.25-.27.55-.34.73-.34l.52.01c.17 0 .4-.06.62.48l.85 2.07c.07.14.12.31.02.5l-.3.45-.44.48c-.14.14-.29.3-.12.58.16.28.73 1.2 1.56 1.95 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07l.87-1c.2-.23.37-.18.62-.09l2 .95c.25.12.42.18.48.28.06.1.06.57-.17 1.2z"/></svg>',
    telegram:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3L18.6 19.6c-.25 1.1-.9 1.37-1.83.85l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.15 9.37-8.47c.4-.36-.09-.56-.63-.2L5.78 12.9.79 11.34c-1.08-.34-1.1-1.08.23-1.6L20.5 2.9c.9-.33 1.69.2 1.4 1.4z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>',
    grabcad:   svg('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>'),
    website:   svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15 0 18M12 3c-2.5 2.7-2.5 15 0 18"/>')
  };

  const icon = (name) => ICONS[name] || ICONS.cog;

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

    if (theme.fontDisplay) root.style.setProperty('--font-display', stack(theme.fontDisplay, 'system-ui, sans-serif'));
    if (theme.fontBody)    root.style.setProperty('--font-body',    stack(theme.fontBody, 'system-ui, sans-serif'));
    if (theme.fontMono)    root.style.setProperty('--font-mono',    stack(theme.fontMono, 'ui-monospace, monospace'));

    root.dataset.grid = theme.showBlueprintGrid === false ? 'off' : 'on';
    root.dataset.anim = theme.enableAnimations === false ? 'off' : 'on';
    if (theme.colorBackground) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme.colorBackground);
    }
  }

  /* -------------------------------------------------------------- sections */

  const enabledSections = () =>
    (DATA.sections || []).filter((s) => s.enabled !== false);

  function renderHeader() {
    const navItems = enabledSections()
      .filter((s) => s.showInNav)
      .map((s) => `<a class="nav__link" href="#${esc(s.key)}" data-nav="${esc(s.key)}">${te(s.navLabel)}</a>`)
      .join('');

    const langToggle = DATA.site.showLanguageToggle === false ? '' : `
      <div class="lang-toggle" role="group" aria-label="Language">
        <button type="button" data-lang="en" class="${LANG === 'en' ? 'is-active' : ''}">EN</button>
        <button type="button" data-lang="fa" class="${LANG === 'fa' ? 'is-active' : ''}">فا</button>
      </div>`;

    return `
    <header class="site-header" id="site-header">
      <div class="shell site-header__inner">
        <a class="brand" href="#hero">
          <span class="brand__mark mono">${esc(DATA.site.brandInitials || 'SM')}</span>
          <span class="brand__name">${te(DATA.hero.name)}</span>
        </a>
        <nav class="nav" id="nav" aria-label="Main">${navItems}</nav>
        <div class="header__actions">
          ${langToggle}
          <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav"
                  aria-label="Menu"><span></span></button>
        </div>
      </div>
    </header>`;
  }

  function renderHero() {
    const h = DATA.hero;
    return `
    <section class="hero blueprint-grid" id="hero">
      <div class="shell hero__inner">
        <div class="hero__content">
          <p class="hero__eyebrow mono reveal">${te(h.eyebrow)}</p>
          <h1 class="hero__name reveal">${te(h.name)}</h1>
          <p class="hero__headline reveal">${te(h.headline)}</p>
          <p class="hero__intro reveal">${te(h.intro)}</p>
          <div class="hero__actions reveal">
            <a class="btn btn--primary" href="${esc(h.primaryButtonLink)}">
              ${te(h.primaryButtonLabel)} ${ICONS.arrowRight}
            </a>
            <a class="btn" href="${esc(h.secondaryButtonLink)}" download>
              ${ICONS.download} ${te(h.secondaryButtonLabel)}
            </a>
          </div>
        </div>
        <figure class="hero__figure reveal" style="margin:0">
          <div class="hero__photo-frame ticked">
            <img src="${esc(h.photo)}" alt="${te(h.photoAlt)}" width="640" height="800">
            <span class="hero__dimension" aria-hidden="true"></span>
          </div>
          <figcaption class="hero__photo-caption mono">${te(h.photoCaption)}</figcaption>
        </figure>
      </div>
      <span class="hero__scroll mono" aria-hidden="true">${te(h.scrollHint)}</span>
    </section>`;
  }

  function renderStats() {
    const s = DATA.stats;
    if (!s || s.enabled === false || !s.items?.length) return '';
    const cells = s.items.map((it) => `
      <div class="stat reveal">
        <div class="stat__value" data-count="${esc(it.value)}" data-suffix="${esc(it.suffix || '')}">
          ${esc(it.value)}${esc(it.suffix || '')}
        </div>
        <div class="stat__label">${te(it.label)}</div>
      </div>`).join('');
    return `<section class="stats" id="stats"><div class="shell"><div class="stats__grid">${cells}</div></div></section>`;
  }

  function sectionHead(d) {
    return `
      <div class="section__head reveal">
        <p class="section__eyebrow mono">
          <span class="section__number">${esc(d.sectionNumber || '')}</span>
          <span>${te(d.sectionTitle)}</span>
        </p>
        <h2 class="section__title">${te(d.heading)}</h2>
      </div>`;
  }

  function renderAbout() {
    const a = DATA.about;
    const paras = (a.paragraphs || []).map((p) => `<p>${te(p)}</p>`).join('');
    const rows = (a.specs || []).map((r) => `
      <div class="spec-sheet__row">
        <span class="spec-sheet__key">${te(r.label)}</span>
        <span class="spec-sheet__val">${te(r.value)}</span>
      </div>`).join('');
    return `
    <section class="section" id="about">
      <div class="shell">
        ${sectionHead(a)}
        <div class="about__grid">
          <div class="about__body reveal">${paras}</div>
          <aside class="spec-sheet reveal ticked">
            <div class="spec-sheet__head mono">${te(a.specSheetTitle)}</div>
            ${rows}
          </aside>
        </div>
      </div>
    </section>`;
  }

  function renderSkills() {
    const s = DATA.skills;
    const cards = (s.categories || []).filter(on).map((c) => {
      const rows = (c.skills || []).map((sk) => {
        const lvl = Math.max(0, Math.min(100, Number(sk.level) || 0));
        return `
        <div class="skill-row">
          <div class="skill-row__top">
            <span>${esc(sk.name)}</span>
            <span class="skill-row__level">${lvl}%</span>
          </div>
          <div class="skill-row__track"><div class="skill-row__fill" data-level="${lvl}"></div></div>
        </div>`;
      }).join('');
      return `
      <article class="skill-card reveal">
        <div class="skill-card__icon">${icon(c.icon)}</div>
        <h3 class="skill-card__title">${te(c.title)}</h3>
        <p class="skill-card__desc">${te(c.description)}</p>
        ${rows}
      </article>`;
    }).join('');
    return `
    <section class="section section--alt blueprint-grid" id="skills">
      <div class="shell">${sectionHead(s)}<div class="skills__grid">${cards}</div></div>
    </section>`;
  }

  function visibleProjects() {
    return (DATA.projects.items || []).filter(on);
  }

  function renderProjects() {
    const p = DATA.projects;
    const items = visibleProjects();

    let filters = '';
    if (p.showFilters !== false) {
      const cats = [...new Set(items.map((i) => t(i.category)).filter(Boolean))];
      filters = `
        <div class="filters reveal">
          <button class="filter is-active" data-filter="*">${te(p.allFilterLabel)}</button>
          ${cats.map((c) => `<button class="filter" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>`;
    }

    const cards = items.map((it, i) => `
      <button class="project-card reveal" data-project="${i}" data-category="${te(it.category)}"
              type="button" aria-haspopup="dialog">
        <div class="project-card__media">
          <img src="${esc(it.cover)}" alt="${te(it.title)}" loading="lazy" width="640" height="400">
          <span class="project-card__code mono">${esc(it.code || '')}</span>
          <span class="project-card__year mono">${esc(it.year || '')}</span>
        </div>
        <div class="project-card__body">
          <p class="project-card__category mono">${te(it.category)}</p>
          <h3 class="project-card__title">${te(it.title)}</h3>
          <p class="project-card__summary">${te(it.summary)}</p>
          <span class="project-card__more">${te(p.detailLabels.viewMore)} ${ICONS.arrowRight}</span>
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
        <p class="tl-item__period mono">${te(it.period)}</p>
        <h3 class="tl-item__role">${te(it.role)}</h3>
        <p class="tl-item__company"><strong>${te(it.company)}</strong> · ${te(it.location)}</p>
        <ul class="tl-item__points">${points}</ul>
      </article>`;
    }).join('');
    return `
    <section class="section section--alt" id="experience">
      <div class="shell">
        ${sectionHead(e)}
        <div class="timeline" id="timeline">
          <span class="timeline__progress" id="timeline-progress" aria-hidden="true"></span>
          ${items}
        </div>
      </div>
    </section>`;
  }

  function renderEducation() {
    const e = DATA.education;
    const degrees = (e.degrees || []).filter(on).map((d) => `
      <article class="edu-card reveal">
        <p class="edu-card__period mono">${te(d.period)}</p>
        <h4 class="edu-card__title">${te(d.degree)}</h4>
        <p class="edu-card__sub">${te(d.school)}</p>
        ${t(d.note) ? `<p class="edu-card__note">${te(d.note)}</p>` : ''}
      </article>`).join('');

    const certs = (e.certifications || []).filter(on).map((c) => `
      <article class="edu-card reveal">
        <p class="edu-card__period mono">${esc(c.year || '')}</p>
        <h4 class="edu-card__title">${te(c.title)}</h4>
        <p class="edu-card__sub">${te(c.issuer)}</p>
        ${c.link ? `<a class="edu-card__link" href="${esc(c.link)}" target="_blank" rel="noopener">Verify ↗</a>` : ''}
      </article>`).join('');

    return `
    <section class="section" id="education">
      <div class="shell">
        ${sectionHead(e)}
        <div class="edu__grid">
          <div><h3 class="edu__col-title mono">${te(e.educationTitle)}</h3>${degrees}</div>
          <div><h3 class="edu__col-title mono">${te(e.certificationsTitle)}</h3>${certs}</div>
        </div>
      </div>
    </section>`;
  }

  function renderContact() {
    const c = DATA.contact;
    const L = c.formLabels || {};

    const details = (c.details || []).filter(on).map((d) => {
      const inner = `
        <span class="contact-detail__icon">${icon(d.type)}</span>
        <span>
          <span class="contact-detail__label">${te(d.label)}</span>
          <span class="contact-detail__value" style="display:block">${esc(d.value)}</span>
        </span>`;
      return d.link
        ? `<a class="contact-detail" href="${esc(d.link)}">${inner}</a>`
        : `<div class="contact-detail">${inner}</div>`;
    }).join('');

    const socials = (c.socials || []).filter(on).map((s) => `
      <a class="social" href="${esc(s.url)}" target="_blank" rel="noopener"
         aria-label="${esc(s.label)}" title="${esc(s.label)}">${icon(s.icon)}</a>`).join('');

    const form = c.showForm === false ? '' : `
      <form class="form reveal" id="contact-form" name="contact" method="POST"
            data-provider="${esc(c.formProvider || 'netlify')}"
            data-endpoint="${esc(c.formspreeEndpoint || '')}" novalidate>
        <input type="hidden" name="form-name" value="contact">
        <p style="display:none"><label>Do not fill<input name="bot-field"></label></p>
        <div class="field">
          <label for="cf-name">${te(L.name)}</label>
          <input id="cf-name" name="name" type="text" required autocomplete="name">
        </div>
        <div class="field">
          <label for="cf-email">${te(L.email)}</label>
          <input id="cf-email" name="email" type="email" required autocomplete="email">
        </div>
        <div class="field">
          <label for="cf-company">${te(L.company)}</label>
          <input id="cf-company" name="company" type="text" autocomplete="organization">
        </div>
        <div class="field">
          <label for="cf-message">${te(L.message)}</label>
          <textarea id="cf-message" name="message" required></textarea>
        </div>
        <button class="btn btn--primary" type="submit" style="width:100%;justify-content:center">
          ${te(L.submit)}
        </button>
        <p class="form__status" id="form-status" role="status"
           data-sending="${te(L.sending)}" data-success="${te(L.success)}" data-error="${te(L.error)}"></p>
      </form>`;

    return `
    <section class="section section--alt blueprint-grid" id="contact">
      <div class="shell">
        ${sectionHead(c)}
        <div class="contact__grid">
          <div class="reveal">
            <p class="contact__intro">${te(c.intro)}</p>
            ${details}
            <div class="socials">${socials}</div>
          </div>
          ${form}
        </div>
      </div>
    </section>`;
  }

  function renderFooter() {
    const f = DATA.footer;
    const year = new Date().getFullYear();
    return `
    <footer class="site-footer">
      <div class="shell site-footer__inner">
        <div>
          <a class="brand" href="#hero">
            <span class="brand__mark mono">${esc(DATA.site.brandInitials || 'SM')}</span>
            <span class="brand__name">${te(DATA.hero.name)}</span>
          </a>
          <p class="site-footer__tagline">${te(f.tagline)}</p>
        </div>
        <a class="to-top" href="#hero">${ICONS.arrowUp} ${te(f.backToTop)}</a>
        <p class="site-footer__meta">© ${year} ${te(f.copyrightName)}<br>${te(f.note)}</p>
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

    document.getElementById('app').innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      ${renderHeader()}
      <main id="main">${html}</main>
      ${renderFooter()}
      <div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true"></div>`;

    document.getElementById('app').removeAttribute('aria-busy');
    wireUp();
  }

  function applyLanguage() {
    const html = document.documentElement;
    html.lang = LANG;
    html.dir = rtl() ? 'rtl' : 'ltr';
    document.title = t(DATA.site.pageTitle);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t(DATA.site.metaDescription));
    try { localStorage.setItem(STORE_KEY, LANG); } catch (e) { /* private mode */ }
  }

  function setLanguage(lang) {
    if (lang === LANG) return;
    LANG = lang;
    applyLanguage();
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* -------------------------------------------------------------- behaviour */

  function wireUp() {
    initNav();
    initReveal();
    initProjects();
    initForm();
    initStructuredData();
  }

  function initNav() {
    const header = document.getElementById('site-header');
    const nav = document.getElementById('nav');
    const menuBtn = document.getElementById('menu-btn');

    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', (e) => {
      if (e.target.closest('.nav__link')) {
        nav.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    // Highlight the nav link for whichever section is on screen.
    const links = [...document.querySelectorAll('[data-nav]')];
    if (!links.length) return;
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((l) => {
      const sec = document.getElementById(l.dataset.nav);
      if (sec) spy.observe(sec);
    });
  }

  function animateCount(el) {
    const raw = el.dataset.count || '';
    const target = parseFloat(raw);
    if (Number.isNaN(target)) return;
    const pad = /^0\d/.test(raw.trim());
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      let val = Math.round(target * eased);
      el.textContent = (pad && val < 10 ? '0' + val : String(val)) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function initReveal() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animOff = document.documentElement.dataset.anim === 'off';
    const els = [...document.querySelectorAll('.reveal')];

    const activate = (el) => {
      el.classList.add('is-visible');
      el.querySelectorAll('.skill-row__fill').forEach((f) => { f.style.width = f.dataset.level + '%'; });
      if (el.classList.contains('stat')) {
        const v = el.querySelector('.stat__value');
        if (v && !reduced) animateCount(v);
      }
      if (el.closest('#timeline')) {
        const bar = document.getElementById('timeline-progress');
        const tl = document.getElementById('timeline');
        if (bar && tl) bar.style.height = (el.offsetTop + el.offsetHeight - 10) + 'px';
      }
    };

    if (reduced || animOff) { els.forEach(activate); return; }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en, i) => {
        if (!en.isIntersecting) return;
        setTimeout(() => activate(en.target), Math.min(i * 70, 350));
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------- project modal */

  let galleryIndex = 0;
  let galleryImages = [];
  let lastFocused = null;

  function initProjects() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-project]');
      if (card) openProject(Number(card.dataset.project), card);
    });

    document.querySelectorAll('.filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const f = btn.dataset.filter;
        grid.querySelectorAll('.project-card').forEach((card) => {
          card.classList.toggle('is-hidden', f !== '*' && card.dataset.category !== f);
        });
      });
    });

    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('modal');
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeProject();
      if (e.key === 'ArrowRight') stepGallery(rtl() ? -1 : 1);
      if (e.key === 'ArrowLeft')  stepGallery(rtl() ? 1 : -1);
    });
  }

  function openProject(i, trigger) {
    const p = DATA.projects;
    const item = visibleProjects()[i];
    if (!item) return;
    const L = p.detailLabels;
    lastFocused = trigger || null;

    galleryImages = (item.gallery && item.gallery.length)
      ? item.gallery
      : [{ image: item.cover, caption: item.title }];
    galleryIndex = 0;

    const thumbs = galleryImages.length > 1 ? `
      <div class="gallery__thumbs">
        ${galleryImages.map((g, n) => `
          <button class="gallery__thumb ${n === 0 ? 'is-active' : ''}" data-thumb="${n}" type="button"
                  aria-label="Image ${n + 1}"><img src="${esc(g.image)}" alt="" loading="lazy"></button>`).join('')}
      </div>` : '';

    const navBtns = galleryImages.length > 1 ? `
      <button class="gallery__nav gallery__nav--prev" data-step="-1" type="button" aria-label="Previous">${ICONS.arrowLeft}</button>
      <button class="gallery__nav gallery__nav--next" data-step="1"  type="button" aria-label="Next">${ICONS.arrowRight}</button>` : '';

    const specs = (item.specs || []).map((s) => `
      <div class="spec-sheet__row">
        <span class="spec-sheet__key">${te(s.label)}</span>
        <span class="spec-sheet__val">${te(s.value)}</span>
      </div>`).join('');

    const block = (label, body) => t(body)
      ? `<div class="detail-block"><p class="detail-block__label mono">${te(label)}</p><p>${te(body)}</p></div>` : '';

    const modal = document.getElementById('modal');
    modal.innerHTML = `
      <div class="modal__panel" role="document">
        <button class="modal__close" id="modal-close" type="button" aria-label="${te(L.close)}">${ICONS.close}</button>
        <div class="modal__inner">
          <header class="modal__head">
            <p class="modal__meta mono">
              <span>${esc(item.code || '')}</span>
              <span>${te(item.category)}</span>
              <span>${esc(item.year || '')}</span>
              ${t(item.client) ? `<span>${te(item.client)}</span>` : ''}
            </p>
            <h2 class="modal__title" id="modal-title">${te(item.title)}</h2>
            <p class="modal__summary">${te(item.summary)}</p>
          </header>

          <div class="gallery">
            <div class="gallery__main">
              <img id="gallery-img" src="${esc(galleryImages[0].image)}" alt="${te(item.title)}">
              <p class="gallery__caption" id="gallery-caption">${te(galleryImages[0].caption)}</p>
              ${navBtns}
            </div>
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
                <div class="outcome-box detail-block">
                  <p class="detail-block__label mono">${te(L.outcome)}</p>
                  <p>${te(item.outcome)}</p>
                </div>` : ''}
              ${(item.tools || []).length ? `
                <div class="detail-block">
                  <p class="detail-block__label mono">${te(L.tools)}</p>
                  <div class="tag-list">${item.tools.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>
                </div>` : ''}
              ${specs ? `
                <div class="spec-sheet">
                  <div class="spec-sheet__head mono">${te(L.specs)}</div>${specs}
                </div>` : ''}
            </aside>
          </div>
        </div>
      </div>`;

    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.classList.add('no-scroll');

    document.getElementById('modal-close').addEventListener('click', closeProject);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeProject(); });
    modal.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => stepGallery(Number(b.dataset.step))));
    modal.querySelectorAll('[data-thumb]').forEach((b) =>
      b.addEventListener('click', () => showGallery(Number(b.dataset.thumb))));

    document.getElementById('modal-close').focus();
  }

  function showGallery(n) {
    if (!galleryImages.length) return;
    galleryIndex = (n + galleryImages.length) % galleryImages.length;
    const g = galleryImages[galleryIndex];
    const img = document.getElementById('gallery-img');
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = g.image;
      img.style.transition = 'opacity .3s ease';
      img.style.opacity = '1';
    }, 120);
    document.getElementById('gallery-caption').textContent = t(g.caption);
    document.querySelectorAll('[data-thumb]').forEach((b) =>
      b.classList.toggle('is-active', Number(b.dataset.thumb) === galleryIndex));
  }

  const stepGallery = (d) => showGallery(galleryIndex + d);

  function closeProject() {
    const modal = document.getElementById('modal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { modal.innerHTML = ''; }, 320);
    if (lastFocused) lastFocused.focus();
  }

  /* ---------------------------------------------------------------- form */

  function initForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const status = document.getElementById('form-status');

    const say = (kind) => {
      status.textContent = status.dataset[kind];
      status.className = 'form__status is-visible ' +
        (kind === 'success' ? 'is-ok' : kind === 'error' ? 'is-error' : '');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (form.querySelector('[name="bot-field"]').value) return;   // spam trap

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      say('sending');

      const provider = form.dataset.provider;
      const data = new FormData(form);

      try {
        if (provider === 'formspree' && form.dataset.endpoint) {
          const res = await fetch(form.dataset.endpoint, {
            method: 'POST', body: data, headers: { Accept: 'application/json' }
          });
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
      } catch (err) {
        say('error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ------------------------------------- structured data (SEO: Google) --- */

  function initStructuredData() {
    const email = (DATA.contact.details || []).find((d) => d.type === 'email');
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: t(DATA.hero.name),
      jobTitle: t(DATA.hero.eyebrow),
      description: t(DATA.site.metaDescription),
      url: DATA.site.siteUrl || undefined,
      email: email ? email.value : undefined,
      sameAs: (DATA.contact.socials || []).filter(on).map((s) => s.url)
    };
    let tag = document.getElementById('ld-json');
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json';
      tag.id = 'ld-json';
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(data);
  }

  /* ----------------------------------------------------------------- boot */

  async function boot() {
    try {
      const res = await fetch('content.json?v=' + Date.now());
      if (!res.ok) throw new Error('content.json could not be loaded (HTTP ' + res.status + ')');
      DATA = await res.json();
    } catch (err) {
      document.getElementById('app').innerHTML = `
        <div style="padding:4rem 1.5rem;max-width:640px;margin:auto;font-family:system-ui">
          <h1 style="font-size:1.4rem">The site content could not be loaded</h1>
          <p style="color:#98A3B2">There is probably a small typo in <code>content.json</code> —
             a missing comma, bracket or quote mark.</p>
          <p style="color:#98A3B2">Paste the file into <a href="https://jsonlint.com" style="color:#F2A33C">jsonlint.com</a>
             to find the exact line, fix it, and reload this page.</p>
          <pre style="color:#E4685D;white-space:pre-wrap">${esc(err.message)}</pre>
        </div>`;
      return;
    }

    let saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    LANG = saved || DATA.site.defaultLanguage || 'en';

    applyTheme(DATA.theme || {});
    applyLanguage();
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
