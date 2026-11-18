// Signature component: Tab Race — press a big Tab keycap to step a focus ring through an example page, broken vs fixed, and race to "Book now".
/* /guides/website-accessibility-ada/ page behaviour (prefixes .tr- and .ada-). Vanilla, no dependencies; touches only
   this page's own DOM. Also: braille section numbers that rise dot by dot, a self-drawing "you are here" key-dates timeline, a blooming and a
   tipping figure, an honest "1 in 6" meter and the unplug-the-mouse tip. Everything enhances content that is already
   readable without JS (the Tab Race walkthrough is a pair of ordered lists in the HTML). Motion off (html.motion-off:
   the site toggle or prefers-reduced-motion) = final states, the ring jumps instead of gliding. */
(() => {
  'use strict';
  const root = document.documentElement;
  const motionOff = () => root.classList.contains('motion-off');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------------------------------------------------------------- reveal helper (one observer for the page) */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.classList.add(el.classList.contains('ada-br') ? 'is-up' : 'is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.2 })
    : null;
  const watch = (el, cls) => { if (io) io.observe(el); else el.classList.add(cls); };

  /* ---------------------------------------------------------------- braille section numbers (decorative) */
  // Braille digits: number sign (dots 3-4-5-6) + the letters a–j (dots numbered 1-2-3 down the left, 4-5-6 down the right).
  const DIGIT = { 1: [1], 2: [1, 2], 3: [1, 4], 4: [1, 4, 5], 5: [1, 5], 6: [1, 2, 4], 7: [1, 2, 4, 5], 8: [1, 2, 5], 9: [2, 4], 0: [2, 4, 5] };
  const cell = (dots, base) => {
    const c = document.createElement('span'); c.className = 'ada-cell';
    for (let d = 1; d <= 6; d++) {
      const i = document.createElement('i');
      if (dots.includes(d)) { i.className = 'on'; i.style.setProperty('--d', base + d); }
      c.append(i);
    }
    return c;
  };
  $$('.ada-br[data-n]').forEach((br) => {
    const n = String(br.dataset.n);
    br.append(cell([3, 4, 5, 6], 0));
    n.split('').forEach((ch, k) => br.append(cell(DIGIT[ch] || [], 6 + k * 6)));
    if (br.closest('.ada-brnote')) br.classList.add('is-up'); else watch(br, 'is-up');
  });

  /* ---------------------------------------------------------------- key dates: the "you are here" timeline */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const away = (from, to) => {
    let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) m--;
    if (m < 1) { const d = Math.max(1, Math.ceil((to - from) / 864e5)); return d + (d === 1 ? ' day away' : ' days away'); }
    if (m >= 24) return 'About ' + Math.round(m / 12) + ' years away';
    return m + (m === 1 ? ' month away' : ' months away');
  };
  $$('[data-ada-tl]').forEach((list) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const items = $$('.ada-tl-i', list);
    let next = null;
    items.forEach((li) => {
      const t = $('time', li);
      const [y, m, d] = (t ? t.getAttribute('datetime') : '').split('-').map(Number);
      if (!y) return;
      const when = new Date(y, m - 1, d);
      const ahead = when > today;
      li.classList.toggle('is-past', !ahead);
      if (ahead) {
        if (!next) next = li;
        const chip = document.createElement('span');
        chip.className = 'ada-tl-due';
        chip.textContent = away(today, when);
        $('.ada-tl-t', li).append(chip);
      }
    });
    // the "Today" bead goes between the last date that has passed and the first one still ahead
    const mark = document.createElement('li');
    mark.className = 'ada-tl-now';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = '<span class="ada-tl-now-b"></span><span class="ada-tl-now-l"></span>';
    $('.ada-tl-now-l', mark).textContent = 'Today · ' + MON[today.getMonth()] + ' ' + today.getFullYear();
    if (next) list.insertBefore(mark, next); else list.append(mark);
    const fit = () => {
      const b = $('.ada-tl-now-b', mark);
      list.style.setProperty('--tl-now', Math.max(0, mark.offsetTop + b.offsetTop + b.offsetHeight / 2 - 20) + 'px');
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(list);
    watch(list, 'is-in');
    items.forEach((li) => watch(li, 'is-in'));
  });
  $$('[data-ada-in]').forEach((el) => watch(el, 'is-in'));
  $$('[data-ada-six]').forEach((fig) => {
    $$('.ada-six-row i', fig).forEach((i, k) => i.style.setProperty('--d', k));
    watch(fig, 'is-in');
  });

  /* ---------------------------------------------------------------- unplug-the-mouse tip */
  const plug = $('[data-ada-plug]');
  if (plug) {
    const label = $('[data-ada-plug-l]', plug);
    plug.addEventListener('click', () => {
      const on = plug.getAttribute('aria-pressed') !== 'true';
      plug.setAttribute('aria-pressed', String(on));
      label.textContent = on ? 'Mouse unplugged. Now try your site' : 'Unplug the mouse';
      if (on && !motionOff() && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* not supported */ } }
    });
  }

  /* ---------------------------------------------------------------- desktop companion: read the guide like a keyboard user
     (CSS shows it from 1340px in the free right gutter). Tab / Shift+Tab jump heading to heading, scroll it in, move real
     focus onto it (tabindex -1) and ring it the way a focus indicator would; the card follows the section in view. */
  const side = $('[data-ada-side]');
  const heads = $$('.ada-prose > h2');
  if (side && heads.length > 1) {
    const nOut = $('[data-ada-side-n]', side), ofOut = $('[data-ada-side-of]', side), tOut = $('[data-ada-side-t]', side);
    const brOut = $('[data-ada-side-br]', side), dotsOut = $('[data-ada-side-dots]', side);
    const navBar = $('[data-nav]');
    const label = (h) => h.dataset.tocLabel || h.textContent.trim();
    ofOut.textContent = String(heads.length).padStart(2, '0');
    heads.forEach(() => dotsOut.append(document.createElement('i')));
    let cur = -1;
    const show = (i, animate) => {
      if (i === cur) return;
      cur = i;
      nOut.textContent = String(i + 1).padStart(2, '0');
      tOut.textContent = label(heads[i]);
      brOut.textContent = '';
      brOut.append(cell([3, 4, 5, 6], 0));
      String(i + 1).split('').forEach((ch) => brOut.append(cell(DIGIT[ch] || [], 0)));
      $$('i', dotsOut).forEach((d, k) => { d.classList.toggle('is-on', k === i); d.classList.toggle('is-past', k < i); });
      if (animate && !motionOff()) { tOut.classList.remove('is-new'); void tOut.offsetWidth; tOut.classList.add('is-new'); }
    };
    const inView = () => {
      const line = innerHeight * 0.32;
      let i = 0;
      heads.forEach((h, k) => { if (h.getBoundingClientRect().top < line) i = k; });
      return i;
    };
    let raf = 0;
    const track = () => { raf = 0; show(inView(), true); };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(track); }, { passive: true });
    let ringT = 0;
    const jump = (dir) => {
      const edge = (navBar ? navBar.getBoundingClientRect().bottom : 80) + 30;
      const tops = heads.map((h) => h.getBoundingClientRect().top);
      let i;
      if (dir > 0) { i = tops.findIndex((t) => t > edge); if (i < 0) i = heads.length - 1; }
      else { i = 0; tops.forEach((t, k) => { if (t < edge - 40) i = k; }); }
      const h = heads[i];
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.scrollIntoView({ block: 'start', behavior: motionOff() ? 'auto' : 'smooth' });
      h.focus({ preventScroll: true });
      $$('.ada-ringed').forEach((o) => o.classList.remove('ada-ringed'));
      void h.offsetWidth; h.classList.add('ada-ringed');
      clearTimeout(ringT); ringT = setTimeout(() => h.classList.remove('ada-ringed'), 1900);
      show(i, true);
    };
    $$('[data-ada-side-key]', side).forEach((b) => b.addEventListener('click', () => {
      jump(b.dataset.adaSideKey === 'back' ? -1 : 1);
      if (motionOff()) return;
      b.classList.add('is-down'); setTimeout(() => b.classList.remove('is-down'), 110);
    }));
    heads.forEach((h) => h.addEventListener('blur', () => h.classList.remove('ada-ringed')));
    // the Tab Race breaks out into the same gutter: the companion steps aside while it is on screen
    const race = $('.tr');
    if (race && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => side.classList.toggle('is-away', e.isIntersecting), { rootMargin: '-12% 0px -12% 0px' }).observe(race);
    }
    side.hidden = false;
    show(inView(), false);
  }

  /* ================================================================ TAB RACE */
  const stage = $('[data-tr]');
  if (!stage) return;
  const fig = stage.closest('.tr');
  const screen = $('[data-tr-screen]', stage);
  const ring = $('[data-tr-ring]', stage);
  const ghost = $('[data-tr-ghost]', stage);
  const live = $('[data-tr-live]', stage);
  const sw = $('[data-tr-switch]', stage);
  const stepOut = $('[data-tr-step]', stage);
  const pressOut = $('[data-tr-press]', stage);
  const stickerList = $('[data-tr-stickers]', stage);
  const car = $('[data-tr-car]', stage);
  const cookie = $('[data-tr-cookie]', stage);
  const booked = $('[data-tr-booked]', stage);
  const slides = $$('.tr-slide', stage);
  const dots = $$('.tr-dots i', stage);
  const el = (s) => $('[data-s="' + s + '"]', screen);
  const keys = {};
  $$('[data-tr-key]', stage).forEach((k) => { keys[k.dataset.trKey] = k; });

  const NAME = { skip: '“Skip to booking” link', logo: 'Juniper Dental logo', nav1: '“Home” link', nav2: '“Services” link', nav3: '“Team” link', nav4: '“Visit” link', nav5: '“Contact” link', book: '“Book now” button', prev: 'carousel’s previous arrow', next: 'carousel’s next arrow', accept: 'cookie banner’s Accept button' };
  const SHORT = { skip: 'Skip link', logo: 'Logo', nav1: 'Home', nav2: 'Services', nav3: 'Team', nav4: 'Visit', nav5: 'Contact', book: 'Book now', prev: 'Arrow ‹', next: 'Arrow ›', accept: 'Accept' };
  const SEQ = {
    broken: ['logo', 'nav1', 'nav2', 'nav3', 'nav4', 'nav5', 'prev', 'next'],
    fixed: ['skip', 'logo', 'nav1', 'nav2', 'nav3', 'nav4', 'nav5', 'book', 'prev', 'next', 'accept'],
  };
  const STICK = {
    b247: { c: '2.4.7', n: 'Focus Visible', t: 'You can’t see where you are.', pass: false },
    b211: { c: '2.1.1', n: 'Keyboard', t: '“Book now” is a styled <div>, so Tab skips it.', pass: false },
    b212: { c: '2.1.2', n: 'No Keyboard Trap', t: 'Trapped! 6 presses and you’re still here.', pass: false },
    b211c: { c: '2.1.1', n: 'Keyboard', t: 'The cookie banner is out of reach, so it never closes.', pass: false },
    f241: { c: '2.4.1', n: 'Bypass Blocks', t: 'A skip link jumps straight to booking.', pass: true },
    f247: { c: '2.4.7', n: 'Focus Visible', t: 'A clear ring shows where you are.', pass: true },
    f211: { c: '2.1.1', n: 'Keyboard', t: 'A real <button>: Tab stops on it, Enter presses it.', pass: true },
    f212: { c: '2.1.2', n: 'No Keyboard Trap', t: 'Tab leaves the carousel like anything else.', pass: true },
    f211c: { c: '2.1.1', n: 'Keyboard', t: 'The cookie banner can be reached and closed.', pass: true },
  };
  const fresh = () => ({ pos: -1, presses: 0, trapN: 0, reached: 0, stickers: [], skipped: false, cookieGone: false, booked: false, slide: 0 });
  const runs = { broken: fresh(), fixed: fresh() };
  const best = { broken: 0, fixed: 0 };
  let mode = 'broken';
  const run = () => runs[mode];
  const pad2 = (n) => String(Math.min(n, 99)).padStart(2, '0');

  /* ---- ring geometry: layout offsets inside the screen (ignores transforms, so a sliding skip link lands right) */
  const boxOf = (node) => {
    let x = 0, y = 0, n = node;
    while (n && n !== screen) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    if (node.dataset.s === 'skip') x -= node.offsetWidth / 2;
    const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 8;
    return { x, y, w: node.offsetWidth, h: node.offsetHeight, r };
  };
  const place = (target, node) => {
    const b = boxOf(target), g = 4;
    node.style.setProperty('--tr-x', (b.x - g) + 'px');
    node.style.setProperty('--tr-y', (b.y - g) + 'px');
    node.style.setProperty('--tr-w', (b.w + g * 2) + 'px');
    node.style.setProperty('--tr-h', (b.h + g * 2) + 'px');
    node.style.setProperty('--tr-r', Math.min(b.r + g, 999) + 'px');
    // the ghost's "focus is here" tag stays inside the screen next to an edge
    if (node === ghost) node.dataset.al = b.x < 46 ? 'l' : (b.x + b.w > screen.clientWidth - 46 ? 'r' : 'c');
    // in the nav row the logo sits right above the links, so there the tag hangs below the link instead
    if (node === ghost) node.dataset.v = /^nav/.test(target.dataset.s || '') ? 'b' : 't';
  };

  /* ---- render the whole state of the current mode */
  const renderStickers = (animate) => {
    const r = run();
    const have = $$('li', stickerList).map((li) => li.dataset.k);
    const want = r.stickers.slice().reverse(); // newest first
    if (have.join() === want.join()) return;
    stickerList.textContent = '';
    want.forEach((k, idx) => {
      const s = STICK[k];
      const li = document.createElement('li');
      li.dataset.k = k;
      if (s.pass) li.classList.add('is-pass');
      if (!animate || idx > 0) li.style.animation = 'none';
      const c = document.createElement('span'); c.className = 'tr-st-c'; c.textContent = s.c;
      const n = document.createElement('span'); n.className = 'tr-st-n';
      const tag = document.createElement('span'); tag.textContent = s.pass ? 'Pass' : 'Fail';
      n.append(tag, document.createTextNode(s.n));
      const t = document.createElement('span'); t.className = 'tr-st-t'; t.textContent = s.t;
      li.append(c, n, t);
      stickerList.append(li);
    });
    stickerList.scrollLeft = 0;
  };

  const laneText = (m) => {
    const r = runs[m];
    if (r.reached) return 'Reached in ' + r.reached;
    if (m === 'broken' && r.trapN >= 6) return r.presses + ' presses · stuck';
    if (r.presses) return r.presses + (r.presses === 1 ? ' press' : ' presses');
    if (best[m]) return 'Best: ' + best[m];
    return 'Not started';
  };
  const renderLanes = () => {
    ['broken', 'fixed'].forEach((m) => {
      const lane = $('[data-lane="' + m + '"]', stage);
      const r = runs[m];
      const done = !!r.reached;
      lane.classList.toggle('is-done', done);
      lane.classList.toggle('is-stuck', m === 'broken' && r.trapN >= 6);
      lane.classList.toggle('is-active', m === mode);
      $('.tr-bead', lane).style.setProperty('--p', done ? 1 : Math.min(r.presses, 11) / 12);
      $('[data-lane-r]', lane).textContent = laneText(m);
    });
  };

  const render = (opts = {}) => {
    const r = run();
    const seq = SEQ[mode];
    const id = r.pos >= 0 ? seq[r.pos] : null;
    const target = id ? el(id) : null;
    const visible = mode === 'fixed';

    stage.dataset.mode = mode;
    el('skip').classList.toggle('is-shown', mode === 'fixed' && id === 'skip');
    el('book').classList.toggle('is-skipped', mode === 'broken' && r.skipped);
    car.classList.toggle('is-trapped', mode === 'broken' && r.trapN >= 6);
    cookie.classList.toggle('is-gone', r.cookieGone);
    booked.classList.toggle('is-on', r.booked);
    slides.forEach((s, k) => s.classList.toggle('is-on', k === r.slide));
    dots.forEach((d, k) => d.classList.toggle('is-on', k === r.slide));

    if (target) {
      const node = visible ? ring : ghost;
      // jump (no glide) on reset, mode switch and layout change, and the first time the ring appears: it fades in
      // where it belongs instead of flying in from the corner
      const jump = opts.jump || !node.classList.contains('is-on');
      if (jump) node.style.transition = 'transform 0s, width 0s, height 0s, opacity .2s';
      place(target, node);
      if (jump) { void node.offsetWidth; node.style.transition = ''; }
    }
    ring.classList.toggle('is-on', !!target && visible);
    ghost.classList.toggle('is-on', !!target && !visible);

    stepOut.textContent = !id ? '—' : (visible ? SHORT[id] : '?');
    pressOut.textContent = pad2(r.presses);
    renderStickers(opts.animate);
    renderLanes();
    keys.enter.classList.toggle('is-hint', mode === 'fixed' && (id === 'skip' || id === 'book') && !r.booked && !motionOff());
  };

  const say = (msg) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };
  const addSticker = (k) => { const r = run(); if (!r.stickers.includes(k)) { r.stickers.push(k); return true; } return false; };
  const shake = () => { if (motionOff()) return; car.classList.remove('is-shake'); void car.offsetWidth; car.classList.add('is-shake'); };
  const pressRing = () => { if (motionOff()) return; ring.classList.remove('is-press'); void ring.offsetWidth; ring.classList.add('is-press'); };
  const reach = () => {
    const r = run();
    if (!r.reached) { r.reached = r.presses; if (!best[mode] || r.presses < best[mode]) best[mode] = r.presses; addSticker('f211'); }
  };
  const label = (n) => 'Press ' + n + '. ';

  /* ---- the broken page */
  const broken = (key) => {
    const r = run();
    const seq = SEQ.broken;
    if (key === 'enter') {
      const id = r.pos >= 0 ? seq[r.pos] : null;
      if (!id) return 'Nothing on the page has focus yet. Press Tab first.';
      if (id === 'prev' || id === 'next') {
        r.slide = (r.slide + (id === 'next' ? 1 : 2)) % 3; shake();
        return 'Enter changes the slide, but Tab still can’t leave the carousel.';
      }
      return 'Enter would open a page, but with no focus ring you can’t tell which one.';
    }
    if (r.pos >= 6) { // inside the carousel: both directions only swap arrows
      r.pos = r.pos === 6 ? 7 : 6; r.trapN++; shake();
      if (r.trapN === 6) { addSticker('b212'); return 'Trapped! 6 presses and you’re still in the carousel: Tab and Shift+Tab only swap between its two arrows. Fails 2.1.2 No Keyboard Trap.'; }
      if (r.trapN === 7) { addSticker('b211c'); return 'Still trapped, so the cookie banner is never reached and can’t be closed. Fails 2.1.1 Keyboard. “Book now” is out of reach: press Reset, or flip the switch to Fixed.'; }
      if (r.trapN > 7) return 'Still trapped after ' + r.presses + ' presses. “Book now” can’t be reached on this page.';
      return 'Focus is on the ' + NAME[seq[r.pos]] + '. Tab only moves between the two arrows.';
    }
    if (key === 'back') {
      if (r.pos < 0) return 'Focus is already in the browser’s address bar. Press Tab to step into the page.';
      r.pos--;
      return r.pos < 0 ? 'Focus is back in the browser’s address bar.' : 'Focus moved back to the ' + NAME[seq[r.pos]] + ', still invisible.';
    }
    r.pos++;
    const id = seq[r.pos];
    if (id === 'logo') { addSticker('b247'); return 'Focus is on the logo, but nothing on screen shows it. Fails 2.4.7 Focus Visible: you can’t see where you are.'; }
    if (id === 'prev') { r.skipped = true; r.trapN = 1; addSticker('b211'); shake(); return 'Focus jumped over “Book now” into the carousel. “Book now” is a styled div with no keyboard support, so Tab skips it. Fails 2.1.1 Keyboard.'; }
    return 'Focus is on the ' + NAME[id] + '. Still no visible focus ring.';
  };

  /* ---- the fixed page */
  const fixed = (key) => {
    const r = run();
    const seq = SEQ.fixed;
    const usable = (i) => !(seq[i] === 'accept' && r.cookieGone);
    const id = r.pos >= 0 ? seq[r.pos] : null;
    if (key === 'enter') {
      if (!id) return 'Nothing on the page has focus yet. Press Tab first.';
      if (id === 'skip') {
        r.pos = seq.indexOf('book'); reach(); pressRing();
        return 'Enter followed the skip link: focus jumped straight to “Book now”, ' + r.presses + ' presses in all. Press Enter again to book.';
      }
      if (id === 'book') {
        r.booked = true; reach(); pressRing();
        return '“Book now” pressed: the booking form opens. You made it in ' + r.reached + ' presses.';
      }
      if (id === 'prev' || id === 'next') {
        r.slide = (r.slide + (id === 'next' ? 1 : 2)) % 3; pressRing();
        return 'Enter changes the slide. Tab moves on whenever you’re ready.';
      }
      if (id === 'accept') {
        r.cookieGone = true; r.pos = 0; addSticker('f211c');
        return 'Banner closed with Enter, and focus returns to the top of the page. Meets 2.1.1 Keyboard.';
      }
      return 'Enter would open the ' + NAME[id].replace(' link', '') + ' page. Stay here and keep pressing Tab.';
    }
    r.booked = false; // focus moves on: the booking panel closes, so it never covers the cookie banner (2.4.11)
    if (key === 'back') {
      let p = r.pos < 0 ? seq.length - 1 : r.pos - 1;
      while (p >= 0 && !usable(p)) p--;
      r.pos = p;
    } else {
      let p = r.pos + 1;
      while (p < seq.length && !usable(p)) p++;
      r.pos = p >= seq.length ? -1 : p;
    }
    const now = r.pos >= 0 ? seq[r.pos] : null;
    if (!now) return 'Focus left the page for the browser’s address bar. Press Tab to go round again.';
    if (now === 'skip') { addSticker('f241'); return 'A “Skip to booking” link appears at the top. Press Enter to follow it, or Tab to walk the page. Meets 2.4.1 Bypass Blocks.'; }
    if (now === 'logo') { addSticker('f247'); return 'Focus is on the logo, with a clear ring around it. Meets 2.4.7 Focus Visible.'; }
    if (now === 'book') {
      const first = !r.reached; reach();
      return 'Focus is on “Book now”, a real button. ' + (first ? 'Reached in ' + r.reached + ' presses. ' : '') + 'Press Enter to book.';
    }
    if (now === 'accept') { addSticker('f212'); return 'Tab left the carousel (no trap) and reached the cookie banner’s Accept button. Press Enter to close it.'; }
    return 'Focus is on the ' + NAME[now] + ', with a visible ring.';
  };

  const NAMES = { tab: 'Tab', back: 'Shift+Tab', enter: 'Enter' };
  const press = (key) => {
    if (key === 'reset') {
      runs[mode] = fresh();
      render({ jump: true });
      say('Reset. ' + (mode === 'fixed' ? 'Fixed' : 'Broken') + ' page, focus back in the address bar. Press Tab to start.');
      return;
    }
    const r = run();
    r.presses++;
    const msg = mode === 'broken' ? broken(key) : fixed(key);
    render({ animate: true });
    say(label(NAMES[key]) + msg);
    if (!motionOff() && navigator.vibrate && matchMedia('(pointer: coarse)').matches) { try { navigator.vibrate(6); } catch (e) { /* not supported */ } }
  };

  // phones: the keys dock to the bottom edge; a press with the example page partly off screen first glides the race up,
  // so the page, the keys and the readout share one screen and every ring move is seen
  const navEl = $('[data-nav]');
  const modeRow = $('.tr-mode', stage), phoneEl = $('[data-tr-phone]', stage), padEl = $('.tr-pad', stage);
  const frame = () => {
    if (fig.getBoundingClientRect().width >= 640) return;
    const want = Math.max(navEl ? navEl.getBoundingClientRect().bottom : 0, 56) + 10;
    const top = modeRow.getBoundingClientRect().top, pb = phoneEl.getBoundingClientRect().bottom;
    const room = innerHeight - padEl.offsetHeight - 16;
    if (Math.abs(top - want) > 6 && (top < want - 6 || pb > room)) scrollBy({ top: top - want, behavior: motionOff() ? 'auto' : 'smooth' });
  };

  Object.entries(keys).forEach(([k, btn]) => {
    btn.addEventListener('click', () => {
      frame();
      press(k);
      if (motionOff()) return;
      btn.classList.add('is-down');
      setTimeout(() => btn.classList.remove('is-down'), 110);
    });
  });

  sw.addEventListener('click', () => {
    mode = mode === 'broken' ? 'fixed' : 'broken';
    sw.setAttribute('aria-checked', String(mode === 'fixed'));
    render({ jump: true });
    const r = run();
    say(mode === 'fixed'
      ? 'Fixed page. ' + (r.presses ? 'Your run continues: ' + r.presses + ' presses so far.' : 'Press Tab to race to “Book now”.')
      : 'Broken page. ' + (r.presses ? 'Your run continues: ' + r.presses + ' presses so far.' : 'Press Tab to start.'));
  });

  /* the interactive instructions only make sense once the stage exists (the static HTML stays neutral) */
  const title = $('#tr-title', fig);
  if (title) title.innerHTML = 'Get to <q>Book now</q> on an example page using only the keys below. Then flip the switch and race the fixed version.';
  const cap = $('.tr-cap', fig);
  if (cap) cap.textContent = 'A simulation on a fictional example page. The page itself isn’t focusable: the keys above are the real controls, and each step is announced.';

  /* walkthrough lists: shown without JS; with JS behind a toggle under the stage */
  const walk = $('[data-tr-walk]', fig);
  if (walk) {
    walk.id = walk.id || 'tr-walk';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tr-walk-btn';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', walk.id);
    btn.innerHTML = '<span>Read both runs as a list</span><b aria-hidden="true">↓</b>';
    walk.before(btn);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      walk.classList.toggle('is-open', open);
      $('span', btn).textContent = open ? 'Hide the lists' : 'Read both runs as a list';
    });
  }

  // keep the ring on its element when the layout changes (rotation, text size, fonts)
  if ('ResizeObserver' in window) new ResizeObserver(() => render({ jump: true })).observe(screen);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render({ jump: true }));
  render({ jump: true });
})();
