/* Zstore AI — Tactile Play: DOM interactions (no dependencies).
   One file for every page. Home-only parts (study dialog, concept deck, process tabs, brief form, sticker)
   simply find nothing on inner pages; inner-page parts (Services disclosure, reveal, TOC, compare tables)
   find nothing where they are not used. Never fork this file per page: page code goes in
   assets/js/pages/<slug>.js or assets/js/guides/<slug>.js (see tools/COMPONENTS.md). */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motionOff = () => root.classList.contains('motion-off');
  const EMAIL = 'zstore.ai295@gmail.com';
  const emit = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));
  // "#id" -> element, without querySelector (a hash like "#1-intro" is not a valid selector)
  const byHash = h => { if (!h || h.length < 2) return null; try { return document.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { return null; } };
  const plainClick = e => !(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

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
    if (target.id === 'top' || target === document.body) scrollTo({ top: 0, behavior });
    else el.scrollIntoView({ behavior, block: 'start' });
    const f = focusEl || target;
    if (!f.hasAttribute('tabindex') && !f.matches('a,button,input,textarea,select')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  };
  // Same-page anchors outside popups are intercepted (menu links and the study CTA run their own settled version):
  // no hash history entry (so BACK always leaves the page, never just clears a hash), and "#top" works even though
  // the hero is sticky (a native jump to it settles mid-document at its stuck box). Inner pages have no #top element:
  // there "#top" (footer "Back to top") scrolls to the very top and moves focus to the start of the page.
  const hashTarget = h => byHash(h) || (h === '#top' ? document.body : null);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !plainClick(e) || a.closest('dialog')) return;
    const target = hashTarget(a.hash);
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
    // Scroll restoration is 'manual' only while popup entries are in play (the page and its popup entry share one
    // document, and the browser must not restore a scroll offset over the locked body). Once the last popup entry is
    // popped it goes back to 'auto', so BACK from another page returns to the exact spot on this one.
    const restore = m => { try { history.scrollRestoration = m; } catch (e) {} };
    if (history.state && history.state.zsPopup) history.replaceState(null, '');
    restore('auto');
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
      restore('manual'); // before pushState: the base entry and the popup entry both opt out
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
      if (!stack.length && !pending && !stateToken()) restore('auto');
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

  /* ------------------------------------------------------------ hook: accessibility panel (/assets/js/a11y.js)
     The panel reuses the one Popups stack (same history entry / BACK / scroll-lock rules as the menu) and the one
     Motion state: ZS.setMotion() does exactly what the Motion toggle does (class, saved choice, every toggle's
     label, 'zs:motion' for gl.js), so the panel's "Pause animations" and the toggles can never disagree. */
  window.ZS = Object.assign(window.ZS || {}, {
    Popups,
    setMotion(off) {
      root.classList.toggle('motion-off', !!off);
      try { localStorage.setItem('zs-motion', off ? 'off' : 'on'); } catch (e) {}
      syncMotion(); emit('zs:motion');
    }
  });

  /* ------------------------------------------------------------ mobile menu */
  const menu = $('#menu'), menuBtn = $('[data-menu-open]');
  if (menu && menuBtn) {
    Popups.wire(menu);
    // the fallback catches a menu that closes because the viewport crossed 1024px, where the opener is display:none
    menuBtn.addEventListener('click', () => { menuBtn.setAttribute('aria-expanded', 'true'); Popups.open(menu, menuBtn, $('.nav .logo')); });
    menu.addEventListener('close', () => menuBtn.setAttribute('aria-expanded', 'false'));
    $$('[data-menu-link]', menu).forEach(link => link.addEventListener('click', e => {
      e.preventDefault();
      const target = hashTarget(link.hash);
      Popups.close(menu, true).then(() => requestAnimationFrame(() => scrollToTarget(target)));
    }));
    // links to other pages: close first (the popup's history entry is consumed), then navigate, so BACK from the
    // next page lands here with the menu shut instead of on a dead popup entry
    $$('a[href]', menu).forEach(link => {
      if (link.hasAttribute('data-menu-link') || link.target === '_blank' || !/^https?:$/.test(link.protocol)) return;
      link.addEventListener('click', e => {
        if (!plainClick(e)) return;
        e.preventDefault();
        const href = link.href, same = href.split('#')[0] === location.href.split('#')[0];
        Popups.close(menu, true).then(() => { if (same) scrollToTarget(document.body); else location.assign(href); });
      });
    });
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
  const nav = $('[data-nav]'), navBar = nav && $('.nav-bar', nav), darkZones = $$('[data-tone="dark"], [data-nav-dark]'), work = $('.work'), cards = $$('.card');
  let ticking = false, booted = false, toneT = 0, shiftT = 0, restT = 0, settled = true, lastY = scrollY, lastT = 0, vel = 0, toneAt = -1e4;
  // [data-nav-dark] marks an ink panel inside a light section that darkens the capsule (on phones it spans the
  // capsule's width) without the rest of what [data-tone="dark"] brings (the a11y contrast ladder, focus colours).
  // The capsule goes dark only over an ink band that runs under (nearly) its whole width, so a half-width card
  // (the /work/ projector, a figure in a guide's prose column) never darkens glass that still sits over chalk.
  // Ink bands closer together than the capsule's height (+32px) count as one run, so a thin chalk gap between two
  // ink panels never blinks the glass light. A 16px dead band at each edge keeps it from flipping back and forth
  // while the page moves (once it has rested 200ms the band narrows to 4px, so the tone at rest is the same
  // whichever way the page arrived), and a strip the capsule will be past within ~240ms at the current scroll
  // speed (a light gap between two ink zones, a thin ink band) does not pulse it: the tone holds and is rechecked
  // once scrolling stops. That look-ahead never reaches past the scroll that is left, so a band the page cannot
  // scroll out of (an ink hero at the top, the footer at the bottom) takes its tone at once.
  // The first frame after a pause (a PageDown, Space, a smooth scroll, a trackpad fling) starts slow, so it carries
  // no usable speed: a change seen there waits one frame (or the recheck) instead of pulsing over a band the eased
  // scroll is about to cross. A change also holds ~320ms, so a keyboard step that stops just inside a band edge
  // and leaves it on the next press gives one full fade, never a blink.
  // .tone-shift (tactile.css) is on only around a change: the glass fades, everything on it swaps at the midpoint.
  // On load the first tone is set with no fade (.tone-snap), so a page that opens on an ink hero starts dark.
  function setTone(d, snap) {
    if (snap) { nav.classList.add('tone-snap'); nav.classList.toggle('is-dark', d); void nav.offsetWidth; nav.classList.remove('tone-snap'); return; }
    nav.classList.add('tone-shift'); nav.classList.toggle('is-dark', d); toneAt = performance.now();
    clearTimeout(shiftT); shiftT = setTimeout(() => nav.classList.remove('tone-shift'), 450);
  }
  function navTone(now, snap) {
    const t = performance.now(), sy = scrollY, dt = t - lastT;
    vel = now ? 0 : (sy - lastY) / Math.max(dt, 1); if (!now) { lastY = sy; lastT = t; } // a recheck at rest leaves the last scroll frame as the reference
    const r = (navBar || nav).getBoundingClientRect(), y = r.top + r.height / 2;
    const dark = nav.classList.contains('is-dark'), m = (dark ? -1 : 1) * (settled ? 4 : 16);
    const bands = [];
    darkZones.map(z => z.getBoundingClientRect()).filter(b => b.height && Math.min(b.right, r.right) - Math.max(b.left, r.left) >= r.width * .85)
      .sort((a, b) => a.top - b.top).forEach(b => {
        const last = bands[bands.length - 1];
        if (last && b.top - last.bottom <= r.height + 32) last.bottom = Math.max(last.bottom, b.bottom);
        else bands.push({ top: b.top, bottom: b.bottom });
      });
    const under = b => b.top + m <= y && b.bottom - m >= y;
    const d = bands.some(under);
    clearTimeout(toneT); toneT = 0;
    if (d === dark) return;
    if (snap) { setTone(d, true); return; }
    if (!now && dt > 200) { toneT = setTimeout(() => navTone(true), 140); return; }
    if (t - toneAt < 320) { toneT = setTimeout(() => navTone(true), 340 - (t - toneAt)); return; }
    const room = vel > 0 ? document.documentElement.scrollHeight - innerHeight - sy : sy;
    const ahead = Math.min(Math.abs(vel) * 240, room);
    if (ahead > 1 && (vel > 0
      ? (d ? bands.some(b => under(b) && b.bottom - y < ahead) : bands.some(b => b.top + 16 > y && b.top + 16 - y < ahead))
      : (d ? bands.some(b => under(b) && y - b.top < ahead) : bands.some(b => b.bottom - 16 < y && y - b.bottom + 16 < ahead)))) {
      toneT = setTimeout(() => navTone(true), 140); return;
    }
    setTone(d);
  }
  function onScroll(now) {
    ticking = false;
    const vh = innerHeight;
    if (nav) {
      if (now !== true) { settled = false; clearTimeout(restT); restT = setTimeout(() => { settled = true; navTone(true); }, 200); }
      navTone(now === true, !booted);
    }
    booted = true;
    if (work) { const t = work.getBoundingClientRect().top; root.style.setProperty('--hp', Math.min(1, Math.max(0, 1 - t / vh)).toFixed(3)); }
    cards.forEach((c, i) => {
      const next = cards[i + 1]; const slab = c.firstElementChild;
      if (!next || innerWidth < 768) { slab.style.setProperty('--cover', 0); return; }
      const a = c.getBoundingClientRect(), b = next.getBoundingClientRect();
      slab.style.setProperty('--cover', Math.min(1, Math.max(0, (a.bottom - b.top) / a.height)).toFixed(3));
    });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => onScroll(false)); } }, { passive: true });
  addEventListener('resize', () => onScroll(true)); onScroll(true);
  // A card taller than the space below its sticky top would be buried by the next card before its
  // copy and button ever scrolled into view; CSS uses its height to stick it by its bottom edge instead.
  const measureCards = () => cards.forEach(c => c.style.setProperty('--ch', c.offsetHeight + 'px'));
  measureCards();
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(measureCards); cards.forEach(c => ro.observe(c)); }
  else addEventListener('resize', measureCards);
  // Home: the nav links are pages now. The section in view lights the dot on the link to its full page
  // (Work section -> Work, Services -> Services, Studio -> About, Process -> Process). It is a visual hint only
  // (.is-here, no ARIA: the link does not point at the section). Inner pages mark their link with aria-current in HTML.
  const sectionLinks = $$('.nav-links [data-section]');
  if (sectionLinks.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      sectionLinks.forEach(l => l.classList.toggle('is-here', l.dataset.section === en.target.id));
    }), { rootMargin: '-20% 0px -60% 0px' });
    sectionLinks.forEach(l => { const s = document.getElementById(l.dataset.section); s && io.observe(s); });
    // sections without a page link (hero, FAQ, contact): seeing them clears a stale dot
    ['top', 'faq', 'contact'].forEach(id => { const s = document.getElementById(id); s && io.observe(s); });
  }

  /* ------------------------------------------------------------ nav: Services disclosure (desktop)
     "Services" is a link to the hub; the chevron button beside it opens the mega panel (aria-expanded).
     Click / Enter / Space toggle; ArrowDown (or Up) opens and moves into the links; arrows, Home and End move
     between them; Escape closes and returns focus to the button; a click outside, tabbing out, BACK/forward
     cache restores and dropping under 1024px close it. Mouse hover opens it after a short intent delay
     (a click on the chevron while hover-opened pins it open instead of closing it). */
  $$('[data-dd]').forEach(dd => {
    const btn = $('[data-dd-btn]', dd), panel = $('[data-dd-panel]', dd);
    if (!btn || !panel) return;
    const links = () => $$('a', panel);
    let hoverT = 0, viaHover = false, openY = 0;
    const isOpen = () => dd.classList.contains('is-open');
    const set = (open, refocus) => {
      clearTimeout(hoverT);
      if (!open) viaHover = false;
      if (open === isOpen()) return;
      dd.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (open) openY = scrollY;
      if (!open && refocus) btn.focus({ preventScroll: true });
    };
    btn.addEventListener('click', () => {
      if (isOpen() && viaHover) { viaHover = false; return; } // hover opened it: the click keeps it open
      set(!isOpen());
    });
    btn.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault(); set(true); viaHover = false;
      const ls = links(); (e.key === 'ArrowDown' ? ls[0] : ls[ls.length - 1]).focus();
    });
    panel.addEventListener('keydown', e => {
      const ls = links(), i = ls.indexOf(document.activeElement);
      let n = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % ls.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + ls.length) % ls.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = ls.length - 1;
      if (n > -1) { e.preventDefault(); ls[n].focus(); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) { e.preventDefault(); set(false, dd.contains(document.activeElement)); } });
    document.addEventListener('pointerdown', e => { if (isOpen() && !dd.contains(e.target)) set(false); });
    dd.addEventListener('focusout', e => { if (isOpen() && e.relatedTarget && !dd.contains(e.relatedTarget)) set(false); });
    if (fine) {
      dd.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(hoverT);
        if (!isOpen()) hoverT = setTimeout(() => { set(true); viaHover = true; }, 110);
      });
      dd.addEventListener('pointerleave', e => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(hoverT);
        if (isOpen() && viaHover) hoverT = setTimeout(() => set(false), 280);
      });
    }
    // a click-opened panel follows the page for a moment, then folds away once the visitor scrolls on
    addEventListener('scroll', () => { if (isOpen() && !dd.matches(':hover') && Math.abs(scrollY - openY) > 120) set(false); }, { passive: true });
    addEventListener('pageshow', () => set(false));
    matchMedia('(max-width: 1023px)').addEventListener('change', ev => { if (ev.matches) set(false); });
  });

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

  /* ------------------------------------------------------------ footer: link groups fold on phones
     Under 768px each .fm-col's heading gets a disclosure button (aria-expanded / aria-controls) holding the group
     name, a link-count chip and an orange plus bead; the list opens with a spring. The heading stays a heading.
     Crossing 768px rebuilds the plain columns (no JS: the columns are simply shown). */
  const fmNav = $('.fm-nav');
  if (fmNav) {
    const fmMq = matchMedia('(max-width: 767px)');
    const fmCols = $$('.fm-col', fmNav).filter(c => $('.fm-h', c) && $('ul', c));
    let folded = false;
    const fmToggle = (col, btn, list) => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      if (list._anim) { list._anim.cancel(); list._anim = null; }
      const from = col.classList.contains('is-shut') ? 0 : list.offsetHeight;
      col.classList.remove('is-shut'); col.classList.toggle('is-open', open);
      if (motionOff() || !list.animate) { col.classList.toggle('is-shut', !open); return; }
      col.classList.add('is-anim');
      const anim = list.animate([{ height: from + 'px' }, { height: (open ? list.scrollHeight : 0) + 'px' }], { duration: open ? 640 : 340, easing: open ? 'cubic-bezier(.34,1.3,.64,1)' : EASE });
      list._anim = anim;
      anim.onfinish = () => { if (list._anim !== anim) return; list._anim = null; col.classList.remove('is-anim'); if (!open) col.classList.add('is-shut'); };
    };
    const fmFold = () => {
      if (folded === fmMq.matches) return;
      folded = fmMq.matches;
      fmNav.classList.toggle('is-fold', folded);
      fmCols.forEach((col, i) => {
        const h = $('.fm-h', col), list = $('ul', col);
        if (list._anim) { list._anim.cancel(); list._anim = null; }
        col.classList.remove('is-open', 'is-anim', 'is-shut');
        if (folded) {
          if (!list.id) list.id = 'fm-list-' + (i + 1);
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'fm-tog';
          btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', list.id);
          const n = document.createElement('span'); n.className = 'fm-n'; n.setAttribute('aria-hidden', 'true'); n.textContent = list.children.length;
          const pm = document.createElement('i'); pm.className = 'fm-pm'; pm.setAttribute('aria-hidden', 'true');
          btn.append(...h.childNodes, n, pm); h.append(btn);
          $$('li', list).forEach((li, k) => li.style.setProperty('--li', Math.min(k, 8)));
          btn.addEventListener('click', () => fmToggle(col, btn, list));
          col.classList.add('is-shut');
        } else {
          const btn = $('.fm-tog', h);
          if (btn) { $$('.fm-n, .fm-pm', btn).forEach(x => x.remove()); h.append(...btn.childNodes); btn.remove(); }
        }
      });
    };
    fmFold();
    fmMq.addEventListener('change', fmFold);
  }

  /* ------------------------------------------------------------ process tabs (ARIA tabs, roving tabindex) */
  const tabs = $$('[data-step]'), kit = $('[data-kit]');
  let stepNow = 0;
  const activateStep = (index, focus) => {
    stepNow = index;
    tabs.forEach((tab, i) => {
      const sel = i === index; tab.setAttribute('aria-selected', String(sel)); tab.tabIndex = sel ? 0 : -1;
      const p = $('#step-panel-' + i); p.hidden = !sel; p.classList.remove('is-in');
      if (sel) { void p.offsetWidth; p.classList.add('is-in'); }
    });
    if (kit) kit.dataset.kit = String(index);
    if (focus) tabs[index].focus();
  };
  // auto-advance: once the step area scrolls into view the four steps cycle every 2s, so the
  // process tells itself. Any real interaction (tap, click, arrow keys) hands control back for
  // good; hovering the tab bar or keeping focus inside the section only holds the timer, and so
  // do motion-off and a hidden tab, so nothing moves for people who asked it not to.
  let stepTimer = 0, stepManual = false, stepHover = false;
  const stopStepAuto = () => { stepManual = true; if (stepTimer) { clearInterval(stepTimer); stepTimer = 0; } };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { stopStepAuto(); activateStep(i); });
    tab.addEventListener('keydown', e => {
      let n;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') n = 0; if (e.key === 'End') n = tabs.length - 1;
      if (n !== undefined) { e.preventDefault(); stopStepAuto(); activateStep(n, true); }
    });
  });
  const stepsBar = $('.steps'), stepBody = $('[data-step-body]'), processSec = $('#process');
  if (stepsBar && stepBody && processSec && tabs.length && 'IntersectionObserver' in window) {
    stepsBar.addEventListener('pointerenter', () => { stepHover = true; });
    stepsBar.addEventListener('pointerleave', () => { stepHover = false; });
    const stepTick = () => {
      if (motionOff() || document.hidden || stepHover || processSec.contains(document.activeElement)) return;
      activateStep((stepNow + 1) % tabs.length);
    };
    const stepIO = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting && !stepManual) { if (!stepTimer) stepTimer = setInterval(stepTick, 2000); }
      else if (stepTimer) { clearInterval(stepTimer); stepTimer = 0; }
    }), { threshold: 0.35 });
    stepIO.observe(stepBody);
  }

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
  // the floating WhatsApp bead springs in once the visitor leaves the hero (where it would
  // cover the CTA row on phones) and slips away again at the top. It also steps aside so it never floats over
  // content: while the footer is on screen (the credit badge and the footer's own contact links live there), and
  // while a guide's article is being read where the bead would sit over the copy (the TOC code sets waHold.article).
  // Site-wide "never over copy": the spot under the bead is probed (5 points, elementsFromPoint, ~10 times a second
  // while scrolling). Text, controls, the closing CTA slab (its own WhatsApp button and Z live there) and anything marked
  // [data-wa-hold] under it hide the bead at once (images and figures do not: the bead may float over a picture); it only springs back after the page has been still
  // and clear for a moment, so it never flickers between paragraphs.
  // Page hook: dispatchEvent(new CustomEvent('zs:wa-hold', { detail: { key: 'my-dock', on: true } })).
  const waFab = $('.wa-fab');
  const waHold = { footer: false, article: false, cover: false };
  let waSync = () => {};
  if (waFab) {
    let waRaf = false, probeAt = 0, idle = 0;
    const COPY = 'p,li,dt,dd,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,pre,label,legend,summary,a,button,input,select,textarea,[role="button"],[role="slider"],[role="tab"],[role="radio"],[role="switch"],[contenteditable],.cta-slab,[data-wa-hold]';
    // the email bead (.mail-fab, the next sibling) rides on top of this one and follows it through CSS
    const mailFab = waFab.nextElementSibling && waFab.nextElementSibling.matches('.mail-fab') ? waFab.nextElementSibling : null;
    const fabs = mailFab ? [waFab, mailFab] : [waFab];
    const ownFab = el => fabs.some(f => el === f || f.contains(el));
    const spot = fab => {
      const cs = getComputedStyle(fab), w = parseFloat(cs.width) || 54, vw = root.clientWidth, vh = innerHeight;
      const x0 = vw - (parseFloat(cs.right) || 14) - w, y0 = vh - (parseFloat(cs.bottom) || 14) - w, i = 8;
      const m = w / 2;
      return [[x0 + m, y0 + m], [x0 + i, y0 + i], [x0 + w - i, y0 + i], [x0 + i, y0 + w - i], [x0 + w - i, y0 + w - i]];
    };
    // WhatsApp keeps its own "never over copy" probe. The email bead (which follows it in CSS) only vetoes the pair
    // where it would block something to tap or a held dock, so the main contact bead doesn't lose visibility on phones.
    const TAP = 'button,input,select,textarea,summary,label,[role="button"],[role="slider"],[role="tab"],[role="radio"],[role="switch"],[contenteditable],[data-wa-hold],.cta-slab,a:not(p a, dd a, td a, figcaption a, blockquote a)'; // links inside running prose don't count; card titles and link lists do
    const hits = (fab, sel) => spot(fab).some(([x, y]) => {
      const hit = document.elementsFromPoint(x, y).find(el => !ownFab(el));
      return !!(hit && hit.closest(sel) && !hit.closest('.footer'));
    });
    // Phones (<768px): the copy column spans the whole width, so a text probe would keep the contact beads hidden
    // almost everywhere. There they only step aside for something to tap or a held dock, and may float over text.
    const covered = () => hits(waFab, innerWidth < 768 ? TAP : COPY) || (!!mailFab && hits(mailFab, TAP));
    const pageHold = new Set(); // keys held by page code through 'zs:wa-hold'
    const apply = () => waFab.classList.toggle('is-on', scrollY > innerHeight * 0.6 && !waHold.footer && !waHold.article && !waHold.cover && !pageHold.size);
    const settle = () => { waHold.cover = covered(); apply(); };
    waSync = () => {
      waRaf = false;
      const now = performance.now();
      if (now - probeAt > 100) { probeAt = now; if (covered()) waHold.cover = true; }
      clearTimeout(idle); idle = setTimeout(settle, 260);
      apply();
    };
    addEventListener('scroll', () => { if (!waRaf) { waRaf = true; requestAnimationFrame(waSync); } }, { passive: true });
    addEventListener('resize', waSync);
    addEventListener('zs:wa-hold', e => { const d = e.detail || {}; if (!d.key) return; if (d.on) pageHold.add(String(d.key)); else pageHold.delete(String(d.key)); apply(); });
    const foot = $('.footer');
    if (foot && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => { waHold.footer = e.isIntersecting; apply(); }).observe(foot);
    waSync();
  }

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

  /* ------------------------------------------------------------ reveal on scroll (inner pages)
     [data-reveal] rises into place with a spring once it enters the viewport; [data-reveal="stagger"] does the
     same for each of its children in turn. Content is never hidden before this runs: html.reveal-on is only set
     here, after everything already on screen has been marked in, so above-the-fold copy (and the LCP) never blinks
     and nothing stays hidden if this file fails. Motion off: everything is simply shown (CSS). */
  const reveals = $$('[data-reveal]');
  if (reveals.length && 'IntersectionObserver' in window) {
    reveals.forEach(el => { if (el.dataset.reveal === 'stagger') [...el.children].forEach((c, i) => c.style.setProperty('--ri', Math.min(i, 8))); });
    const vh = innerHeight;
    // already on screen: shown as is (.is-shown, no entrance), so nothing that was painted ever disappears
    reveals.forEach(el => { const r = el.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) el.classList.add('is-shown'); });
    root.classList.add('reveal-on');
    const rio = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in'); rio.unobserve(en.target);
    }), { rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(el => { if (!el.classList.contains('is-shown')) rio.observe(el); });
  }

  /* ------------------------------------------------------------ glazed Z kits lean away from the pointer
     A [data-push] zone feeds --px/--py (-1..1) to the .zkit pieces inside it (fine pointers, motion on). */
  if (fine) $$('[data-push]').forEach(zone => {
    const kits = $$('.zkit', zone); if (!kits.length) return;
    let raf = 0, px = 0, py = 0;
    const apply = () => { raf = 0; kits.forEach(k => { k.style.setProperty('--px', px.toFixed(3)); k.style.setProperty('--py', py.toFixed(3)); }); };
    zone.addEventListener('pointermove', e => {
      if (motionOff()) return;
      const r = zone.getBoundingClientRect();
      px = -((e.clientX - r.left) / r.width - .5) * 2; py = -((e.clientY - r.top) / r.height - .5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    zone.addEventListener('pointerleave', () => { px = py = 0; if (!raf) raf = requestAnimationFrame(apply); });
  });

  /* ------------------------------------------------------------ comparison tables: mobile labels
     Under 640px a table.compare stacks each row into a card; every cell shows its column name from data-label.
     Cells without one get it from the header row here (write data-label by hand for no-JS readers). */
  $$('table.compare').forEach(t => {
    const heads = $$('thead th', t).map(th => th.textContent.trim());
    $$('tbody tr', t).forEach(tr => [...tr.children].forEach((cell, i) => { if (!cell.hasAttribute('data-label') && heads[i]) cell.setAttribute('data-label', heads[i]); }));
  });

  /* ------------------------------------------------------------ table of contents + reading progress (guides)
     Any element with [data-toc] (the article body) gets a contents list built from its h2s (skip one with
     data-toc-skip; data-toc-label="Short name" overrides the text). Headings without an id get one from their text.
     - Desktop (>= 1100px): fills the page's <nav class="toc" data-toc-nav> rail: a meter that fills as you read,
       an orange bead riding its end, and the current section highlighted.
     - Phones / tablets: a floating "On this page" pill (bottom-left, with a progress ring and "03 / 07") opens a
       sheet in a native <dialog> through Popups, so BACK closes it like every other popup on the site. So it never
       sits over the copy while you read, the pill tucks away while you scroll down and comes back when you scroll
       up (it stays while it has focus). It also steps aside while it would cover an interactive demo: any
       [data-toc-hide] block at least 40% in view, or a control (button, input, slider, canvas...) under it.
       On wide screens the WhatsApp bead stays hidden while the article column reaches its lane (waHold.article). */
  const tocRoot = $('[data-toc]');
  const tocHeads = tocRoot ? $$('h2', tocRoot).filter(h => !h.hasAttribute('data-toc-skip') && !h.closest('[data-toc-skip]')) : [];
  if (tocHeads.length >= 2) {
    const slug = t => t.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    tocHeads.forEach((h, i) => {
      if (h.id) return;
      let id = slug(h.textContent) || 'section-' + (i + 1);
      while (document.getElementById(id)) id += '-' + (i + 1);
      h.id = id;
    });
    const pad = n => String(n).padStart(2, '0');
    const total = pad(tocHeads.length);
    const buildList = () => {
      const ol = document.createElement('ol'); ol.className = 'toc-list';
      tocHeads.forEach((h, i) => {
        const li = document.createElement('li'), a = document.createElement('a'), n = document.createElement('span'), t = document.createElement('span');
        a.href = '#' + h.id; n.className = 'toc-i'; n.textContent = pad(i + 1); t.className = 'toc-t'; t.textContent = (h.dataset.tocLabel || h.textContent).trim();
        a.append(n, t); li.append(a); ol.append(li);
      });
      return ol;
    };
    const lists = [];
    const rail = $('[data-toc-nav]');
    if (rail) {
      const k = document.createElement('p'); k.className = 'toc-k'; k.textContent = 'On this page';
      const meter = document.createElement('span'); meter.className = 'toc-meter'; meter.setAttribute('aria-hidden', 'true'); meter.innerHTML = '<i></i><b></b>';
      const body = document.createElement('div'); body.className = 'toc-body';
      const ol = buildList(); body.append(meter, ol); rail.append(k, body); lists.push(ol);
      rail.classList.add('is-built');
    }
    // the phone pill + sheet
    const pill = document.createElement('button');
    pill.type = 'button'; pill.className = 'toc-pill'; pill.setAttribute('aria-haspopup', 'dialog'); pill.setAttribute('aria-controls', 'toc-sheet');
    pill.innerHTML = '<svg class="toc-ring" viewBox="0 0 44 44" aria-hidden="true" focusable="false"><circle cx="22" cy="22" r="18" pathLength="100"></circle><circle class="toc-ring-fill" cx="22" cy="22" r="18" pathLength="100"></circle></svg><span class="toc-pill-t"><span class="toc-pill-k">On this page</span><span class="toc-pill-n"></span></span>';
    const pillN = $('.toc-pill-n', pill);
    const sheet = document.createElement('dialog');
    sheet.className = 'toc-sheet'; sheet.id = 'toc-sheet'; sheet.setAttribute('aria-labelledby', 'toc-sheet-title');
    sheet.innerHTML = '<div class="toc-sheet-in"><div class="toc-sheet-top"><p id="toc-sheet-title">On this page</p><button class="icon-btn icon-btn-ink" type="button" data-popup-close aria-label="Close contents"><span aria-hidden="true">×</span></button></div></div>';
    const sheetList = buildList(); $('.toc-sheet-in', sheet).append(sheetList); lists.push(sheetList);
    document.body.append(pill, sheet);
    Popups.wire(sheet);
    pill.addEventListener('click', () => Popups.open(sheet, pill));
    $$('a', sheetList).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const target = byHash(a.hash);
      Popups.close(sheet, true).then(() => requestAnimationFrame(() => scrollToTarget(target)));
    }));
    // demos the pill must never sit on: marked blocks (40% in view) + any control under the pill's footprint
    const tocHideIn = new Set();
    if ('IntersectionObserver' in window) {
      const hio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.intersectionRatio >= 0.4) tocHideIn.add(e.target); else tocHideIn.delete(e.target); }), { threshold: [0, 0.4, 1] });
      $$('[data-toc-hide]').forEach(el => hio.observe(el));
    }
    const CONTROL = 'button, input, select, textarea, label, summary, canvas, .btn, [role="button"], [role="slider"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [draggable="true"], [tabindex]:not([tabindex="-1"])';
    // a demo = a [data-toc-hide] block, or any block of the article (figure, aside, section…) that holds controls
    const demos = new Set($$('[data-toc-hide]'));
    [...tocRoot.children].forEach(el => { if (!/^(P|H[2-6]|UL|OL|BLOCKQUOTE)$/.test(el.tagName) && el.querySelector(CONTROL)) demos.add(el); });
    const isDemo = el => { for (let n = el; n && n !== tocRoot; n = n.parentElement) if (demos.has(n)) return true; return false; };
    const overControl = () => {
      const L = pill.offsetLeft, T = pill.offsetTop, W = pill.offsetWidth, H = pill.offsetHeight;
      if (!W) return false;
      return [[L + 10, T + 10], [L + W / 2, T + H / 2], [L + W - 10, T + 10], [L + 10, T + H - 10], [L + W - 10, T + H - 10]].some(([x, y]) => {
        const el = document.elementsFromPoint(x, y).find(e => e !== pill && !pill.contains(e) && !e.closest('.wa-fab, .mail-fab'));
        return !!el && (!!el.closest(CONTROL) || isDemo(el));
      });
    };
    const meters = [rail, pill].filter(Boolean);
    let tocTick = false, lastAct = -1, lastY = scrollY, goingDown = false;
    const tocUpdate = () => {
      tocTick = false;
      const vh = innerHeight, r = tocRoot.getBoundingClientRect(), line = vh * 0.36;
      const p = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height - vh * 0.5)));
      meters.forEach(m => m.style.setProperty('--read', p.toFixed(4)));
      let act = -1;
      tocHeads.forEach((h, i) => { if (h.getBoundingClientRect().top <= line) act = i; });
      if (act !== lastAct) {
        lastAct = act;
        lists.forEach(ol => $$('a', ol).forEach((a, i) => { if (i === act) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }));
        pillN.textContent = pad(Math.max(1, act + 1)) + ' / ' + total;
      }
      const inArticle = r.top < vh * 0.25 && r.bottom > vh * 0.6;
      const dy = scrollY - lastY;
      if (Math.abs(dy) > 8) { goingDown = dy > 0; lastY = scrollY; }
      const pillFocused = document.activeElement === pill;
      const wantPill = inArticle && (!goingDown || pillFocused);
      pill.classList.toggle('is-on', wantPill && (pillFocused || (!tocHideIn.size && !(innerWidth < 1100 && overControl()))));
      // wide screens: hold the bead while the column reaches its lane. Under 1100px the copy probe decides, so the
      // bead still shows beside pictures, demos and gaps in the article instead of vanishing for the whole read.
      waHold.article = inArticle && innerWidth >= 1100 && r.right > innerWidth - 96;
      waSync();
    };
    addEventListener('scroll', () => { if (!tocTick) { tocTick = true; requestAnimationFrame(tocUpdate); } }, { passive: true });
    addEventListener('resize', tocUpdate);
    tocUpdate();
  }
})();
