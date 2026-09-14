/* Zstore AI — Tactile Play: DOM interactions (no dependencies). */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motionOff = () => root.classList.contains('motion-off');
  const EMAIL = 'zstore.ai295@gmail.com';
  const emit = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

  /* ------------------------------------------------------------ letter roll
     Built in idle time: it swaps each label's text for per-character spans with the exact same metrics,
     so deferring it is invisible but keeps ~40 DOM rebuilds off the critical path (TBT). */
  const buildRolls = () => $$('[data-roll]').forEach(el => {
    const text = el.textContent.trim();
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
    const wrap = document.createElement('span'); wrap.className = 'roll'; wrap.setAttribute('aria-hidden', 'true');
    [...text].forEach((c, i) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.dataset.c = c; s.style.setProperty('--i', i); wrap.appendChild(s); });
    el.textContent = ''; el.append(sr, wrap);
  });
  if ('requestIdleCallback' in window) requestIdleCallback(buildRolls, { timeout: 1500 }); else setTimeout(buildRolls, 350);

  /* ------------------------------------------------------------ motion toggle */
  const motionBtns = $$('[data-motion]');
  const syncMotion = () => {
    const off = motionOff();
    motionBtns.forEach(b => {
      b.setAttribute('aria-pressed', String(!off));
      // the visible label ("Motion on/off") must be a prefix of the accessible name (WCAG 2.5.3 label-in-name)
      b.setAttribute('aria-label', off ? 'Motion off. Turn motion on' : 'Motion on. Turn motion off');
      const l = $('.motion-label', b); if (l) l.textContent = off ? 'Motion off' : 'Motion on';
    });
  };
  syncMotion();
  motionBtns.forEach(b => b.addEventListener('click', () => {
    root.classList.toggle('motion-off');
    try { localStorage.setItem('zs-motion', motionOff() ? 'off' : 'on'); } catch (e) {}
    syncMotion(); emit('zs:motion');
  }));

  /* ------------------------------------------------------------ clock + year */
  const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  const tick = () => { const t = clockFmt.format(new Date()); $$('[data-clock]').forEach(c => { c.textContent = t; }); };
  tick(); setInterval(tick, 20000);
  $$('[data-year]').forEach(y => { y.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------ smooth in-page scroll */
  const scrollToTarget = (target, focusEl) => {
    if (!target) return;
    const behavior = motionOff() ? 'instant' : 'smooth';
    // a section whose heading sits far below its top (the studio portrait on small screens) scrolls to the
    // heading instead, so the visitor always lands seeing the title
    let el = target;
    if (target.matches && target.matches('section[id]')) {
      const h = target.querySelector('h2');
      if (h && h.getBoundingClientRect().top - target.getBoundingClientRect().top > innerHeight * 0.45) el = h;
    }
    if (target.id === 'top') scrollTo({ top: 0, behavior });
    else el.scrollIntoView({ behavior, block: 'start' });
    const f = focusEl || target;
    if (!f.hasAttribute('tabindex') && !f.matches('a,button,input,textarea,select')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  };
  // Same-page anchors outside popups are intercepted (menu links and the study CTA run their own settled version):
  // no hash history entry (so BACK always leaves the page, never just clears a hash), and "#top" works even though
  // the hero is sticky (a native jump to it settles mid-document at its stuck box).
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.closest('dialog')) return;
    const target = a.hash && a.hash.length > 1 && $(a.hash);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
  });

  /* ------------------------------------------------------------ popups
     Every overlay is a native <dialog> opened with showModal (focus trap, Escape, inert page).
     Opening pushes one history entry; the phone's back button (popstate) closes the top popup.
     Closing by button / backdrop / Escape removes that entry with a guarded history.back(), so
     entries never pile up. The pop is sent a beat after the popup has visibly closed: a BACK press
     that lands in that beat consumes the popup's own entry instead of leaving the site.
     Menu links and the study CTA wait for the pop to settle before they scroll.
     While any popup is open the body is pinned (position:fixed at -scrollY): nothing behind can
     scroll — not touch, wheel, keys or script — and the exact position is restored on close. */
  const Popups = (() => {
    const stack = []; const waiters = [];
    const body = document.body;
    let lockY = 0, touchY = 0, pending = null;
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    if (history.state && history.state.zsPopup) history.replaceState(null, '');
    const stateToken = () => history.state && history.state.zsPopup;

    // secondary touch/wheel guards, attached only while locked so normal page scrolling stays passive
    const scrollableIn = (node, boundary) => {
      for (let n = node; n && n !== boundary.parentElement; n = n.parentElement) {
        if (n.nodeType !== 1) continue;
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
        if (n === boundary) break;
      }
      return null;
    };
    const onTouchStart = e => { if (e.touches[0]) touchY = e.touches[0].clientY; };
    const onTouchMove = e => {
      const t = top(); if (!t || !e.touches[0] || e.touches.length > 1) return;
      const sc = t.el.contains(e.target) ? scrollableIn(e.target, t.el) : null;
      if (!sc) { if (e.cancelable) e.preventDefault(); return; }
      const dy = e.touches[0].clientY - touchY;
      const atTop = sc.scrollTop <= 0, atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atEnd)) { if (e.cancelable) e.preventDefault(); }
    };
    const onWheel = e => { const t = top(); if (t && !(t.el.contains(e.target) && scrollableIn(e.target, t.el))) e.preventDefault(); };

    let lockW = 0, anchorEl = null, anchorTop = 0;
    const lock = () => {
      lockY = scrollY; lockW = innerWidth;
      // remember what was on screen: after a rotation while locked, the same scrollY points at different content
      const probe = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight - 10, 96));
      anchorEl = probe && probe.closest('section, .card, footer');
      anchorTop = anchorEl ? anchorEl.getBoundingClientRect().top : 0;
      body.style.top = -lockY + 'px';
      root.classList.add('is-locked');
      document.addEventListener('touchstart', onTouchStart, { passive: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('wheel', onWheel, { passive: false });
    };
    const unlock = () => {
      root.classList.remove('is-locked');
      body.style.top = '';
      document.removeEventListener('touchstart', onTouchStart, { passive: true });
      document.removeEventListener('touchmove', onTouchMove, { passive: false });
      document.removeEventListener('wheel', onWheel, { passive: false });
      scrollTo({ top: lockY, behavior: 'instant' });
      if (anchorEl && anchorEl.isConnected && innerWidth !== lockW) {
        const d = anchorEl.getBoundingClientRect().top - anchorTop;
        if (Math.abs(d) > 40) scrollTo({ top: Math.max(0, scrollY + d), behavior: 'instant' });
      }
      anchorEl = null;
    };
    const sync = () => { root.classList.toggle('popup-open', stack.length > 0); emit('zs:popup', { open: stack.length > 0 }); };
    const top = () => stack[stack.length - 1];
    const dropPending = () => { if (pending) { clearTimeout(pending.timer); pending = null; } };

    function finalize(entry) {
      const i = stack.indexOf(entry); if (i < 0) return;
      stack.splice(i, 1);
      if (entry.el.open) entry.el.close();
      if (!stack.length) unlock();
      sync();
      let op = entry.opener;
      if (!op || !op.isConnected || op.closest('dialog:not([open])') || !op.getClientRects().length) op = entry.fallback;
      if (op && op.isConnected && op.getClientRects().length) op.focus({ preventScroll: true });
      for (let w = waiters.length - 1; w >= 0; w--) if (waiters[w].entry === entry) { waiters[w].resolve(); waiters.splice(w, 1); }
    }
    function open(el, opener, fallback) {
      if (!el || stack.some(s => s.el === el)) return;
      if (!stack.length) lock();
      const entry = { el, opener: opener || document.activeElement, fallback, token: 'zs' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) };
      stack.push(entry);
      if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', '');
      el.dispatchEvent(new CustomEvent('zs:opened'));
      // reopening inside the close beat reuses the entry that was about to be popped
      if (pending && stateToken() === pending.token) { dropPending(); history.replaceState({ zsPopup: entry.token }, ''); }
      else { dropPending(); history.pushState({ zsPopup: entry.token }, ''); }
      sync();
    }
    // settle: resolve only after the history pop has landed (for anything that scrolls or opens next)
    function close(el, settle = false) {
      return new Promise(resolve => {
        const entry = stack.find(s => s.el === el);
        if (!entry) { resolve(); return; }
        if (entry !== top() || stateToken() !== entry.token) { finalize(entry); resolve(); return; }
        if (settle) {
          waiters.push({ entry, resolve });
          if (entry.backing) return;
          entry.backing = true;
          history.back();
          setTimeout(() => finalize(entry), 900); // safety net if popstate never arrives
          return;
        }
        finalize(entry); resolve();
        dropPending();
        const token = entry.token;
        const pop = () => {
          if (!pending || pending.token !== token) return;
          const late = performance.now() - pending.due;
          if (late < -10) return; // an early duplicate (timer vs postTask): the on-time one will pop
          // fired late: the main thread was busy, so a BACK pressed inside the beat may still be a queued traversal.
          // Yield once more; its popstate then lands first and drops the entry, instead of two BACKs leaving the site.
          if (!pending.retried && late > 60) { clearTimeout(pending.timer); pending.retried = true; pending.due = performance.now() + 120; pending.timer = setTimeout(pop, 120); return; }
          pending = null;
          if (stateToken() === token && !stack.length) history.back();
        };
        pending = { token, due: performance.now() + 200, timer: setTimeout(pop, 200) };
        // user-blocking priority where supported, so a busy render loop can never starve the pop (the timer stays as a fallback)
        try { if (window.scheduler && scheduler.postTask) scheduler.postTask(pop, { priority: 'user-blocking', delay: 200 }).catch(() => {}); } catch (e) {}
      });
    }
    addEventListener('popstate', () => {
      const t = top(), s = stateToken();
      if (pending && s !== pending.token) dropPending(); // BACK arrived inside the close beat: the entry is already gone
      if (t) { if (s !== t.token) finalize(t); }
      else if (s && !pending) history.back(); // stale entry reached via "forward"
    });

    // Escape / Android back via close watchers arrive as "cancel": route through history.
    const wire = el => {
      el.addEventListener('cancel', e => { e.preventDefault(); close(el); });
      el.addEventListener('close', () => { if (stack.some(s => s.el === el)) close(el); });
      el.addEventListener('click', e => {
        if (e.target.closest('[data-popup-close]')) { close(el); return; }
        if (e.target !== el) return;
        const r = el.getBoundingClientRect();
        const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (outside || el.classList.contains('menu')) close(el); // the menu dialog is full-screen: its own padding is the backdrop
      });
    };
    return { open, close, wire, isOpen: el => stack.some(s => s.el === el), get depth() { return stack.length; } };
  })();

  /* ------------------------------------------------------------ mobile menu */
  const menu = $('#menu'), menuBtn = $('[data-menu-open]');
  if (menu && menuBtn) {
    Popups.wire(menu);
    // the fallback catches a menu that closes because the viewport crossed 1024px, where the opener is display:none
    menuBtn.addEventListener('click', () => { menuBtn.setAttribute('aria-expanded', 'true'); Popups.open(menu, menuBtn, $('.nav .logo')); });
    menu.addEventListener('close', () => menuBtn.setAttribute('aria-expanded', 'false'));
    $$('[data-menu-link]', menu).forEach(link => link.addEventListener('click', e => {
      e.preventDefault();
      const target = $(link.hash);
      Popups.close(menu, true).then(() => requestAnimationFrame(() => scrollToTarget(target)));
    }));
    // a quiet cue that a short sheet scrolls: the bottom edge fades until the end is reached
    const sheet = $('.menu-sheet', menu);
    const cue = () => { const more = sheet.scrollHeight - sheet.clientHeight - sheet.scrollTop > 2; menu.classList.toggle('has-more', more); };
    sheet.addEventListener('scroll', cue, { passive: true });
    menu.addEventListener('zs:opened', () => { sheet.scrollTop = 0; requestAnimationFrame(cue); });
    addEventListener('resize', () => { if (menu.open) cue(); });
    matchMedia('(min-width: 1024px)').addEventListener('change', ev => { if (ev.matches && Popups.isOpen(menu)) Popups.close(menu); });
  }

  /* ------------------------------------------------------------ concept study dialog */
  const STUDIES = {
    atelier: { title: 'Atelier Studio', kind: '01 / Web experience · Architecture', tint: '#DCCFBD', intro: 'A digital home with room to breathe.', idea: 'An architecture studio should feel as considered online as the spaces it creates. This concept explores a quieter, image-led approach to telling that story.', approach: 'Warm stone tones, generous spacing and editorial typography set the pace. Full-width photography lets the architecture lead, with restrained navigation that keeps the work in focus.', interest: 'Website' },
    lume: { title: 'Lume', kind: '02 / Commerce experience · Beauty', tint: '#C7D0B8', intro: 'A quieter kind of commerce.', idea: 'How can an online shopping experience feel like a daily ritual? Lume explores an unhurried product story built around a single, beautifully presented object.', approach: 'A botanical palette, tactile art direction and a simple split layout bring clarity to the product. The design direction balances an expressive brand with an obvious next step.', interest: 'Website' },
    meridian: { title: 'Meridian', kind: '03 / Digital product · Finance', tint: '#C9CBF3', intro: 'Complexity, made beautifully simple.', idea: 'A dashboard concept that gives busy business owners an at-a-glance understanding of their finances. Every number, card and chart has a clear place in the hierarchy.', approach: 'A compact navigation rail, calm lavender palette and generous spacing make the interface easy to scan. All balances and charts are illustrative sample data for this design study.', interest: 'UI / UX' }
  };
  const ORDER = Object.keys(STUDIES);
  const study = $('#study'); let current = null;
  const fillStudy = key => {
    const d = STUDIES[key]; if (!d || !study) return false;
    current = key;
    $('[data-study-title]', study).textContent = d.title; $('[data-study-kind]', study).textContent = d.kind;
    $('[data-study-intro]', study).textContent = d.intro;
    $('[data-study-idea]', study).textContent = d.idea; $('[data-study-approach]', study).textContent = d.approach;
    const vis = $('[data-study-visual]', study); vis.style.setProperty('--tint', d.tint);
    const src = $(`.card-open[data-open="${key}"]`).closest('.card-slab').querySelector('.shot');
    const shot = src.cloneNode(true); ['--rx', '--ry', '--mx', '--my', '--go'].forEach(p => shot.style.removeProperty(p));
    shot.querySelectorAll('img').forEach(i => { i.loading = 'eager'; });
    vis.replaceChildren(shot);
    study.scrollTop = 0;
    return true;
  };
  if (study) {
    Popups.wire(study);
    // Chrome restores a dialog's old scroll offset when it is shown, so the reset has to happen after showModal
    const toTop = () => { study.scrollTop = 0; };
    const openStudy = (key, opener) => {
      if (!fillStudy(key)) return;
      Popups.open(study, opener, $(`.card-open[data-open="${key}"]`));
      toTop(); requestAnimationFrame(toTop);
      $('[data-popup-close]', study).focus({ preventScroll: true });
    };
    study.addEventListener('close', toTop);
    $$('[data-open]').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.open;
      if (menu && menu.contains(b)) Popups.close(menu, true).then(() => openStudy(key, menuBtn));
      else openStudy(key, b);
    }));
    $$('.card-media').forEach(m => m.addEventListener('click', () => { const b = m.closest('.card-slab').querySelector('[data-open]'); b && openStudy(b.dataset.open, b); }));
    $('[data-study-next]', study).addEventListener('click', () => { fillStudy(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]); });
    $('[data-study-cta]', study).addEventListener('click', e => {
      e.preventDefault();
      selectInterest(STUDIES[current].interest);
      Popups.close(study, true).then(() => requestAnimationFrame(() => scrollToTarget($('#contact-form'), fine ? $('#full-name') : $('#contact-form'))));
    });
  }

  /* ------------------------------------------------------------ nav: tone + current section */
  const nav = $('[data-nav]'), darkZones = $$('[data-tone="dark"]'), work = $('.work'), cards = $$('.card');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const vh = innerHeight;
    if (nav) {
      const r = nav.getBoundingClientRect(); const y = r.top + r.height / 2;
      nav.classList.toggle('is-dark', darkZones.some(z => { const b = z.getBoundingClientRect(); return b.top <= y && b.bottom >= y; }));
    }
    if (work) { const t = work.getBoundingClientRect().top; root.style.setProperty('--hp', Math.min(1, Math.max(0, 1 - t / vh)).toFixed(3)); }
    cards.forEach((c, i) => {
      const next = cards[i + 1]; const slab = c.firstElementChild;
      if (!next || innerWidth < 768) { slab.style.setProperty('--cover', 0); return; }
      const a = c.getBoundingClientRect(), b = next.getBoundingClientRect();
      slab.style.setProperty('--cover', Math.min(1, Math.max(0, (a.bottom - b.top) / a.height)).toFixed(3));
    });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll); onScroll();
  // A card taller than the space below its sticky top would be buried by the next card before its
  // copy and button ever scrolled into view; CSS uses its height to stick it by its bottom edge instead.
  const measureCards = () => cards.forEach(c => c.style.setProperty('--ch', c.offsetHeight + 'px'));
  measureCards();
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(measureCards); cards.forEach(c => ro.observe(c)); }
  else addEventListener('resize', measureCards);
  const navLinks = $$('.nav-links a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      navLinks.forEach(l => { if (l.hash === '#' + en.target.id) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current'); });
    }), { rootMargin: '-20% 0px -60% 0px' });
    navLinks.forEach(l => { const s = $(l.hash); s && io.observe(s); });
    // hero and contact have no nav link: seeing them clears a stale dot
    ['#top', '#contact'].forEach(sel => { const s = $(sel); s && io.observe(s); });
  }

  /* ------------------------------------------------------------ card tilt + cursor sticker (fine pointers) */
  if (fine) $$('.card-slab').forEach(slab => {
    const media = $('[data-tilt]', slab); const shot = media && $('.shot', media); if (!shot) return;
    media.addEventListener('pointermove', e => {
      if (motionOff()) return;
      const r = media.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      shot.style.setProperty('--ry', ((x - .5) * 7).toFixed(2) + 'deg'); shot.style.setProperty('--rx', ((.5 - y) * 6).toFixed(2) + 'deg');
      shot.style.setProperty('--mx', ((.5 - x) * 18).toFixed(1) + 'px'); shot.style.setProperty('--my', ((.5 - y) * 14).toFixed(1) + 'px');
      shot.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); shot.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); shot.style.setProperty('--go', 1);
    });
    media.addEventListener('pointerleave', () => ['--rx', '--ry', '--mx', '--my', '--go'].forEach(p => shot.style.removeProperty(p)));
  });
  const cur = $('.cursor-blob');
  if (fine && cur) {
    let tx = -200, ty = -200, x = -200, y = -200, vx = 0, vy = 0, s = 0, st = 0, raf = 0, on = false;
    const loop = () => {
      raf = 0;
      vx = (vx + (tx - x) * 0.2) * 0.62; vy = (vy + (ty - y) * 0.2) * 0.62; x += vx; y += vy; s += (st - s) * 0.2;
      const sp = motionOff() ? 0 : Math.min(0.45, Math.hypot(vx, vy) / 70);
      cur.style.setProperty('--cx', x.toFixed(1) + 'px'); cur.style.setProperty('--cy', y.toFixed(1) + 'px');
      cur.style.setProperty('--ca', Math.atan2(vy, vx).toFixed(3) + 'rad');
      cur.style.setProperty('--sx', (s * (1 + sp)).toFixed(3)); cur.style.setProperty('--sy', (s * (1 - sp * 0.6)).toFixed(3));
      if (Math.abs(st - s) > 0.002 || Math.hypot(vx, vy) > 0.05) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (!on) { x = tx; y = ty; } kick(); }, { passive: true });
    $$('.card-media').forEach(h => {
      h.addEventListener('pointerenter', () => { on = true; st = 1; kick(); });
      h.addEventListener('pointerleave', () => { on = false; st = 0; kick(); });
    });
    addEventListener('scroll', () => { if (on) { const el = document.elementFromPoint(tx, ty); if (!el || !el.closest('.card-media')) { on = false; st = 0; kick(); } } }, { passive: true });
    addEventListener('zs:popup', () => { on = false; st = 0; kick(); });
  }

  /* ------------------------------------------------------------ draggable sticker with spring return */
  const stk = $('[data-drag]');
  if (stk) {
    let dx = 0, dy = 0, vx = 0, vy = 0, drag = false, sx = 0, sy = 0, raf = 0, rot = 0;
    const apply = () => { stk.style.setProperty('--dx', dx.toFixed(1) + 'px'); stk.style.setProperty('--dy', dy.toFixed(1) + 'px'); stk.style.setProperty('--dr', rot.toFixed(2) + 'deg'); };
    const loop = () => { raf = 0; if (drag) return; vx = (vx - dx * 0.09) * 0.8; vy = (vy - dy * 0.09) * 0.8; dx += vx; dy += vy; rot = vx * 0.8; apply(); if (Math.hypot(dx, dy, vx, vy) > 0.1) raf = requestAnimationFrame(loop); else { dx = dy = rot = 0; apply(); } };
    stk.addEventListener('pointerdown', e => { drag = true; sx = e.clientX - dx; sy = e.clientY - dy; stk.setPointerCapture(e.pointerId); });
    stk.addEventListener('pointermove', e => { if (!drag) return; const nx = e.clientX - sx, ny = e.clientY - sy; vx = nx - dx; vy = ny - dy; dx = nx; dy = ny; rot = Math.max(-25, Math.min(25, vx * 1.5)); apply(); });
    const end = () => { if (!drag) return; drag = false; if (motionOff()) { dx = dy = rot = 0; apply(); } else if (!raf) raf = requestAnimationFrame(loop); };
    stk.addEventListener('pointerup', end); stk.addEventListener('pointercancel', end);
    stk.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (motionOff()) return; vx = 18; vy = -14; if (!raf) raf = requestAnimationFrame(loop); } });
  }

  /* ------------------------------------------------------------ magnetic button */
  if (fine) $$('[data-magnet]').forEach(b => {
    b.addEventListener('pointermove', e => { if (motionOff()) return; const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.14}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  /* ------------------------------------------------------------ accordions (drawers + FAQ) with spring height */
  const EASE = 'cubic-bezier(.2,.9,.1,1)';
  // d._want tracks the state an item is heading to, so rapid taps reverse cleanly mid-animation.
  const setOpen = (d, open) => {
    const body = d.querySelector('summary').nextElementSibling;
    const from = d.open ? body.offsetHeight : 0;
    if (d._anim) { d._anim.cancel(); d._anim = null; }
    d._want = open;
    if (motionOff() || !body.animate) { d.open = open; return; }
    d.open = true;
    const to = open ? body.scrollHeight : 0;
    const anim = body.animate([{ height: from + 'px', opacity: open ? .2 : 1 }, { height: to + 'px', opacity: open ? 1 : 0 }], { duration: open ? 560 : 340, easing: EASE });
    d._anim = anim;
    anim.onfinish = () => { if (d._anim !== anim) return; d._anim = null; d.open = open; };
  };
  $$('[data-accordion]').forEach(group => {
    const exclusive = group.dataset.accordion === 'exclusive';
    const items = $$(':scope > details', group);
    items.forEach(d => {
      d._want = d.open;
      d.querySelector('summary').addEventListener('click', e => {
        e.preventDefault();
        const open = !d._want;
        if (open && exclusive) items.forEach(o => { if (o !== d && o._want) setOpen(o, false); });
        setOpen(d, open);
      });
    });
  });

  /* ------------------------------------------------------------ process tabs (ARIA tabs, roving tabindex) */
  const tabs = $$('[data-step]'), kit = $('[data-kit]');
  const activateStep = (index, focus) => {
    tabs.forEach((tab, i) => {
      const sel = i === index; tab.setAttribute('aria-selected', String(sel)); tab.tabIndex = sel ? 0 : -1;
      const p = $('#step-panel-' + i); p.hidden = !sel; p.classList.remove('is-in');
      if (sel) { void p.offsetWidth; p.classList.add('is-in'); }
    });
    if (kit) kit.dataset.kit = String(index);
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateStep(i));
    tab.addEventListener('keydown', e => {
      let n;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') n = 0; if (e.key === 'End') n = tabs.length - 1;
      if (n !== undefined) { e.preventDefault(); activateStep(n, true); }
    });
  });

  /* ------------------------------------------------------------ contact: interest chips, WhatsApp, form */
  const interest = $('#interest'), stageBox = $('[data-gl-stage]');
  function selectInterest(value) {
    if (!interest) return;
    interest.value = value;
    $$('[data-select-interest]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.selectInterest === value)));
    updateProgress();
  }
  $$('[data-select-interest]').forEach(b => b.addEventListener('click', () => selectInterest(b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.selectInterest)));
  $$('[data-interest]').forEach(l => l.addEventListener('click', () => selectInterest(l.dataset.interest)));
  $$('[data-wa]').forEach(link => {
    const url = new URL(link.href);
    url.searchParams.set('text', "Hi Zvi! I came across Zstore AI and I'd love to talk about a project I have in mind.");
    link.href = url.toString();
  });

  const form = $('#contact-form');
  const nameI = $('#full-name'), emailI = $('#email'), msgI = $('#message');
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const checks = {
    name: () => nameI.value.trim().length >= 2,
    email: () => emailOk(emailI.value.trim()),
    message: () => msgI.value.trim().length >= 10
  };
  const fieldOf = { name: nameI, email: emailI, message: msgI };
  const errOf = { name: '#name-err', email: '#email-err', message: '#message-err' };
  const touched = {};
  function paint(key, force) {
    const input = fieldOf[key], ok = checks[key](), wrap = input.closest('.field');
    const show = force || touched[key];
    wrap.classList.toggle('is-valid', ok);
    wrap.classList.toggle('is-invalid', !ok && show);
    input.setAttribute('aria-invalid', String(!ok && !!show));
    $(errOf[key]).hidden = ok || !show;
    return ok;
  }
  let built = false, hoverBuild = false;
  function level() { return (interest && interest.value ? 1 : 0) + (checks.name() ? 1 : 0) + (checks.email() ? 1 : 0) + (checks.message() ? 1 : 0); }
  function updateProgress() {
    if (!form) return;
    const lv = level();
    $$('[data-progress] li').forEach((li, i) => li.classList.toggle('on', i < lv));
    const shown = built || hoverBuild ? 4 : lv;
    if (stageBox) stageBox.dataset.level = String(shown); // drives the static SVG pieces when WebGL is unavailable
    emit('zs:build', { level: shown, manual: built });
  }
  if (form) {
    const loadedAt = Date.now();
    $('#form-ts').value = String(loadedAt);
    const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
    Object.keys(fieldOf).forEach(k => {
      fieldOf[k].addEventListener('input', () => { if (touched[k]) paint(k); else fieldOf[k].closest('.field').classList.toggle('is-valid', checks[k]()); updateProgress(); });
      fieldOf[k].addEventListener('blur', () => { if (fieldOf[k].value.trim()) touched[k] = true; paint(k); });
    });
    msgI.addEventListener('input', () => { $('#msg-counter').textContent = msgI.value.length; });
    const status = $('#form-status');
    const setStatus = (text, error = false) => { status.hidden = false; status.textContent = text; status.classList.toggle('is-error', error); };
    // the sent toast: a clear, self-dismissing confirmation on top of the status line below the form
    const toastEl = $('#sent-toast');
    let toastT = 0, toastT2 = 0;
    const showToast = (title, line) => {
      if (!toastEl) return;
      $('[data-toast-title]', toastEl).textContent = title;
      $('[data-toast-line]', toastEl).textContent = line;
      clearTimeout(toastT); clearTimeout(toastT2);
      toastEl.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => toastEl.classList.add('is-on')));
      toastT = setTimeout(() => {
        toastEl.classList.remove('is-on');
        toastT2 = setTimeout(() => { toastEl.hidden = true; }, 450);
      }, 5200);
    };
    let submitting = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (submitting) return;
      const bad = Object.keys(checks).filter(k => { touched[k] = true; return !paint(k, true); });
      if (bad.length) {
        setStatus('Please add your name, an email address and at least 10 characters about your idea.', true);
        // preventScroll + centre the whole field: a plain focus() with the keyboard open pulls the input under the nav
        const fld = fieldOf[bad[0]]; fld.focus({ preventScroll: true });
        const w = fld.closest('.field'); if (w) w.scrollIntoView({ block: 'center', behavior: motionOff() ? 'auto' : 'smooth' });
        return;
      }
      if ($('#company').value) { setStatus('Submission blocked.', true); return; }
      if (localPreview) {
        setStatus('Preview complete — your form is valid. This local preview does not send messages. Your details have not been submitted.');
        emit('zs:celebrate');
        showToast('Preview only', 'The form is valid — nothing is sent from localhost.');
        return;
      }
      if (Date.now() - loadedAt < 3000) { setStatus('Please take a moment before sending your message.', true); return; }
      let lastSent = 0;
      try { lastSent = Number(sessionStorage.getItem('zs_last_submit') || 0); } catch (err) {}
      if (Date.now() - lastSent < 30000) { setStatus('Please wait a little before sending another message.', true); return; }
      const data = new FormData();
      data.append('name', nameI.value.trim()); data.append('email', emailI.value.trim());
      data.append('message', (interest.value ? `Interested in: ${interest.value}\n\n` : '') + msgI.value.trim());
      data.append('ts', String(loadedAt)); data.append('dt', String(Math.round((Date.now() - loadedAt) / 1000)));
      const submit = $('button[type="submit"]', form); const label = submit.innerHTML;
      submitting = true; submit.disabled = true; submit.textContent = 'Sending…'; form.setAttribute('aria-busy', 'true');
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        await fetch(form.action, { method: 'POST', body: data, mode: 'no-cors', signal: controller.signal });
        try { sessionStorage.setItem('zs_last_submit', String(Date.now())); } catch (err) {}
        setStatus(`Your request has been sent. Delivery cannot be confirmed here; you can also reach me directly at ${EMAIL}.`);
        emit('zs:celebrate');
        const first = nameI.value.trim().split(/\s+/)[0];
        showToast(first ? `Thanks, ${first}!` : 'Message sent!', "Your brief is on its way to my inbox. I personally reply within one business day.");
        form.reset(); selectInterest(''); $('#msg-counter').textContent = '0';
        Object.keys(touched).forEach(k => { touched[k] = false; paint(k); });
      } catch (err) {
        setStatus(`I couldn't confirm the send. Please try again, or email ${EMAIL} directly.`, true);
      } finally {
        clearTimeout(timeout); submitting = false; submit.disabled = false; submit.innerHTML = label; form.setAttribute('aria-busy', 'false'); updateProgress();
      }
    });
    // hovering or focusing the submit button previews the finished Z
    const submitBtn = $('[data-assemble]', form);
    const hb = v => { hoverBuild = v; updateProgress(); };
    submitBtn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hb(true); });
    submitBtn.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hb(false); });
    submitBtn.addEventListener('focus', () => hb(true));
    submitBtn.addEventListener('blur', () => hb(false));
    const toggle = $('[data-assemble-toggle]');
    toggle && toggle.addEventListener('click', () => {
      built = !built; toggle.setAttribute('aria-pressed', String(built));
      $('.sb-label', toggle).textContent = built ? 'Take it apart' : 'Build it now';
      updateProgress();
    });
    updateProgress();
  }
})();
