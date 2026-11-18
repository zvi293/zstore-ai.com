// Signature component: Scope Scale — put scope factors on a ceramic balance and watch a no-numbers proposal build line by line.
/* Zstore AI — /pricing/ page behaviour (vanilla, no dependencies; touches only .pr- DOM).
   1. Scope Scale: toggle-button weights (tap / click / keyboard, plus mouse drag onto the stage) drop onto the
      right pan; the beam tilts with a damped spring; a qualitative gauge, a timeline note and the proposal card
      update; "Send me a brief" carries the chosen factors to the contact form via sessionStorage (never the URL).
      Phones/tablets: a sticky summary pill follows the tray and jumps to the proposal lines it just changed.
   2. Living touches: ceramic tile word wobble, label-maker price tag (the words punch into embossed tape, letter by
      letter), self-drawing proposal ticks, 30-day bead meter, scroll-scrubbed statement, self-drawing quote route.
   Motion off (html.motion-off: the site toggle or reduced motion) = final states, no loops. Without JS the page
   shows the full factor list, the filled meter and the drawn route. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const still = () => root.classList.contains('motion-off');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------ 1. Scope Scale */
  const scale = $('[data-pr-scale]');
  if (scale) {
    const stage = $('.pr-stage', scale);
    const beam = $('[data-pr-beam]', scale);
    const panL = $('[data-pr-pan="l"]', scale);
    const panR = $('[data-pr-pan="r"]', scale);
    const load = $('[data-pr-load]', scale);
    const hint = $('[data-pr-hint]', scale);
    const readout = $('[data-pr-readout]', scale);
    const gauge = $('[data-pr-gauge]', scale);
    const levelEl = $('[data-pr-level]', scale);
    const countEl = $('[data-pr-count]', scale);
    const timeEl = $('[data-pr-time]', scale);
    const tray = $('[data-pr-tray]', scale);
    const grid = $('[data-pr-buttons]', scale);
    const cardT = $('[data-pr-card-t]', scale);
    const cardSub = $('[data-pr-card-sub]', scale);
    const empty = $('[data-pr-empty]', scale);
    const send = $('[data-pr-send]', scale);
    const reset = $('[data-pr-reset]', scale);
    const live = $('[data-pr-live]', scale);
    const card = $('[data-pr-card]', scale);
    const sumBar = $('[data-pr-sum]', scale);
    const trayGrid = $('[data-pr-buttons]', scale);
    // the pill only floats while it has news: after a tap it peeks for a few seconds, then tucks away if it is stuck
    // to the bottom of the screen (proposal card still below the fold), so it never sits over the weights for long
    const narrowMQ = matchMedia('(max-width: 1023px)');
    let peeking = false, peekT = 0, tuckRaf = 0;
    const tuck = () => {
      tuckRaf = 0;
      if (!sumBar || !sumBar.classList.contains('is-on')) return;
      const stuck = narrowMQ.matches && getComputedStyle(sumBar).position === 'sticky' && card.getBoundingClientRect().top > innerHeight - 8;
      // never float over the weights themselves: while the tray's last row sits in the pill's lane, it waits below
      const tr = trayGrid ? trayGrid.getBoundingClientRect() : null;
      const overTray = stuck && !!tr && tr.top < innerHeight && tr.bottom > innerHeight - sumBar.offsetHeight - 30;
      sumBar.classList.toggle('is-tucked', overTray || (stuck && !peeking));
    };
    const peek = () => { peeking = true; clearTimeout(peekT); tuck(); peekT = setTimeout(() => { peeking = false; tuck(); }, 2800); };
    if (sumBar) addEventListener('scroll', () => { if (!tuckRaf) tuckRaf = requestAnimationFrame(tuck); }, { passive: true });
    const factors = $$('.pr-f[data-key]:not(.pr-f-base)', scale).map((el, i) => ({
      el, key: el.dataset.key, w: Number(el.dataset.w) || 1, short: el.dataset.short || $('dt', el).textContent.trim(),
      name: $('dt', el).textContent.trim(), tone: 't' + (i % 3), on: false, btn: null, tile: null
    }));
    const LEVELS = ['Focused', 'Standard', 'Substantial', 'Ambitious'];
    // Timeline note: only the two confirmed reference points (landing page 1–2 weeks, full marketing site 4–6 weeks),
    // tied to the factors that define them; anything bigger, or a store, is set in the proposal.
    const W1 = '1\u2060–\u20602\u00A0weeks', W4 = '4\u2060–\u20606\u00A0weeks';
    const isOn = k => factors.some(f => f.key === k && f.on);
    const timeOf = (lv, n) => {
      if (isOn('store') || lv >= 2) return 'Set in your proposal, with milestones';
      if (isOn('pages')) return n === 1 ? `Full marketing site: usually ${W4}` : `Marketing sites usually take ${W4}; yours is set in the proposal`;
      return n === 0 ? `Landing page: usually ${W1}` : `Landing pages usually take ${W1}; yours is set in the proposal`;
    };
    const BASE = 3;                       // "Your goals" on the left pan
    const DEG_PER = 1.7, MIN_A = -5.1, MAX_A = 12.5;
    const sum = () => factors.reduce((s, f) => s + (f.on ? f.w : 0), 0);
    const levelOf = s => (s <= 1 ? 0 : s <= 5 ? 1 : s <= 9 ? 2 : 3);
    const target = () => clamp((sum() - BASE) * DEG_PER, MIN_A, MAX_A);

    /* --- beam physics: a damped angular spring; pans hang vertically from the beam ends */
    let ang = target(), vel = 0, raf = 0, last = 0, stageW = 0;
    const measure = () => { stageW = stage ? stage.clientWidth : 0; };
    const paint = () => {
      if (!beam) return;
      beam.style.setProperty('--pr-a', ang.toFixed(3) + 'deg');
      const L = stageW * 0.34, r = ang * Math.PI / 180;
      const dy = L * Math.sin(r), dx = L * (1 - Math.cos(r));
      panL.style.transform = `translate(${dx.toFixed(2)}px, ${(-dy).toFixed(2)}px)`;
      panR.style.transform = `translate(${(-dx).toFixed(2)}px, ${dy.toFixed(2)}px)`;
    };
    const step = now => {
      raf = 0;
      const dt = Math.min(0.034, last ? (now - last) / 1000 : 0.016); last = now;
      const t = target();
      // stiffness / damping tuned for one visible overshoot and a settle under a second
      const k = 90, c = 9.5;
      for (let i = 0; i < 2; i++) { const h = dt / 2; vel += (-k * (ang - t) - c * vel) * h; ang += vel * h; }
      paint();
      if (Math.abs(ang - t) > 0.01 || Math.abs(vel) > 0.01) raf = requestAnimationFrame(step);
      else { ang = t; vel = 0; paint(); last = 0; }
    };
    const kick = (impulse = 0) => {
      if (still()) { cancelAnimationFrame(raf); raf = 0; ang = target(); vel = 0; paint(); return; }
      vel += impulse;
      if (!raf) { last = 0; raf = requestAnimationFrame(step); }
    };

    /* --- build the tray (real toggle buttons) from the factor list */
    const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
    factors.forEach(f => {
      const b = el('button', 'pr-w');
      b.type = 'button'; b.dataset.key = f.key;
      b.setAttribute('aria-pressed', 'false');
      const g = el('span', `pr-w-glyph ${f.tone}`); g.dataset.w = String(f.w); g.setAttribute('aria-hidden', 'true');
      const st = el('span', 'pr-w-state', '+'); st.setAttribute('aria-hidden', 'true');
      b.append(g, el('span', 'pr-w-l', f.short), st);
      f.btn = b; grid.appendChild(b);
    });

    const announce = msg => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 40); };
    const render = (changed, added) => {
      const s = sum(), lv = levelOf(s), n = factors.filter(f => f.on).length;
      gauge.dataset.level = String(lv);
      levelEl.textContent = LEVELS[lv];
      countEl.textContent = n ? `${n} ${n === 1 ? 'factor' : 'factors'} on the scale` : 'Just your goals so far';
      const tl = timeOf(lv, n);
      timeEl.textContent = tl;
      factors.forEach(f => { f.el.hidden = !f.on; f.btn.setAttribute('aria-pressed', String(f.on)); $('.pr-w-state', f.btn).textContent = f.on ? '✓' : '+'; });
      empty.hidden = n > 0;
      reset.hidden = n === 0;
      if (hint) hint.classList.toggle('is-gone', n > 0);
      cardT.textContent = n ? 'Your proposal, so far' : 'Your proposal starts here';
      if (sumBar) {
        $('[data-pr-sum-n]', sumBar).textContent = String(n);
        $('[data-pr-sum-t]', sumBar).textContent = n === 1 ? 'factor' : 'factors';
        $('[data-pr-sum-l]', sumBar).textContent = LEVELS[lv];
        sumBar.classList.toggle('is-on', n > 0);
        if (changed && n > 0 && !still()) { sumBar.classList.remove('is-pulse'); void sumBar.offsetWidth; sumBar.classList.add('is-pulse'); }
        if (changed && n > 0) peek(); else tuck();
      }
      if (changed) {
        changed.el.classList.remove('is-new');
        if (added && !still()) { void changed.el.offsetWidth; changed.el.classList.add('is-new'); }
        announce(`${changed.name} ${added ? 'added' : 'removed'}. Scope: ${LEVELS[lv]}. Timeline: ${tl}.`);
      }
    };

    const addTile = f => {
      const t = document.createElement('span');
      t.className = `pr-wt ${f.tone}`; t.dataset.w = String(f.w); t.dataset.key = f.key;
      f.tile = t;
      // heavier pieces sit lower in the pile: insert by weight so the stack stays tidy
      const after = [...load.children].find(c => Number(c.dataset.w) < f.w);
      load.insertBefore(t, after || null);
      if (!still()) { t.classList.add('is-drop'); setTimeout(() => kick(18 + f.w * 10), 300); t.addEventListener('animationend', () => t.classList.remove('is-drop'), { once: true }); }
      else kick();
    };
    const removeTile = f => {
      const t = f.tile; f.tile = null;
      if (!t) return;
      if (still()) { t.remove(); kick(); return; }
      t.classList.add('is-lift');
      t.addEventListener('animationend', () => t.remove(), { once: true });
      setTimeout(() => { if (t.isConnected) t.remove(); }, 500);
      kick(-(12 + f.w * 6));
    };
    const toggle = (f, force) => {
      const next = typeof force === 'boolean' ? force : !f.on;
      if (next === f.on) return;
      f.on = next;
      if (next) addTile(f); else removeTile(f);
      render(f, next);
    };

    grid.addEventListener('click', e => {
      const b = e.target.closest('.pr-w'); if (!b) return;
      if (b.dataset.dragged) { delete b.dataset.dragged; return; }
      const f = factors.find(x => x.key === b.dataset.key); if (f) toggle(f);
    });
    reset.addEventListener('click', () => {
      factors.forEach(f => { if (f.on) { f.on = false; removeTile(f); } });
      render(null);
      announce('Scale cleared. Scope: Focused.');
      (factors[0] && factors[0].btn).focus();
    });

    /* --- mouse drag: pick a weight up and drop it on the stage (touch keeps tap, so scrolling stays free) */
    if (fine && stage) {
      let drag = null;
      const over = (x, y) => { const r = stage.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
      grid.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const b = e.target.closest('.pr-w'); if (!b) return;
        const f = factors.find(x => x.key === b.dataset.key);
        if (!f || f.on) return;
        drag = { b, f, x0: e.clientX, y0: e.clientY, ghost: null, id: e.pointerId };
      });
      addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.ghost) {
          if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
          drag.ghost = document.createElement('span');
          drag.ghost.className = `pr-ghost ${drag.f.tone}`;
          drag.ghost.setAttribute('aria-hidden', 'true');
          document.body.appendChild(drag.ghost);
          drag.b.dataset.dragged = '1';
        }
        drag.ghost.style.transform = `translate(${e.clientX - 17}px, ${e.clientY - 10}px) rotate(${clamp((e.clientX - drag.x0) * .05, -14, 14)}deg)`;
        stage.classList.toggle('is-hot', over(e.clientX, e.clientY));
      });
      const end = e => {
        if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
        const d = drag; drag = null;
        stage.classList.remove('is-hot');
        if (!d.ghost) return;
        d.ghost.remove();
        if (e.type === 'pointerup' && over(e.clientX, e.clientY)) toggle(d.f, true);
        // the click that follows a drag is swallowed by the dataset flag; clear it if no click comes
        setTimeout(() => { delete d.b.dataset.dragged; }, 0);
      };
      addEventListener('pointerup', end);
      addEventListener('pointercancel', end);
    }

    /* --- "Send me a brief": carry the selection to the contact form (sessionStorage, never the URL) */
    send.addEventListener('click', () => {
      const on = factors.filter(f => f.on);
      if (!on.length) return;
      const lv = LEVELS[levelOf(sum())];
      const msg = `Hi Zvi, I tried the Scope Scale on your pricing page. My project will likely include: ${on.map(f => f.name.charAt(0).toLowerCase() + f.name.slice(1)).join('; ')}. It feels like a ${lv.toLowerCase()} scope. Here's a bit more about it: `;
      try { sessionStorage.setItem('zs-brief-prefill', JSON.stringify({ source: 'pricing-scope-scale', factors: on.map(f => f.key), level: lv, message: msg, at: Date.now() })); } catch (err) {}
    });

    /* --- summary pill (below 1024px): jump to the card, land on its title so the lines are read next */
    if (sumBar) {
      sumBar.addEventListener('click', e => {
        e.preventDefault();
        card.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
        cardT.setAttribute('tabindex', '-1');
        cardT.focus({ preventScroll: true });
      });
      sumBar.addEventListener('animationend', () => sumBar.classList.remove('is-pulse'));
      sumBar.hidden = false;
    }

    /* --- go live: show the stage controls, hide the not-yet-chosen lines */
    scale.classList.add('is-live');
    if (fine && hint) hint.textContent = 'Click or drag a weight onto the scale';
    readout.hidden = false; tray.hidden = false;
    cardSub.textContent = 'Each weight you add brings its lines into the proposal: why it matters, and what it adds.';
    render(null);
    measure(); paint();
    if ('ResizeObserver' in window && stage) new ResizeObserver(() => { measure(); paint(); }).observe(stage);
    addEventListener('zs:motion', () => { if (still()) kick(); });
    // phones/tablets: the shared WhatsApp bead steps aside while the scale is on screen, so it never covers a
    // weight or the summary pill (page-scoped: only toggles a class on <html> that pricing.css reads)
    if ('IntersectionObserver' in window) {
      const narrow = matchMedia('(max-width: 1023px)');
      const wo = new IntersectionObserver(es => es.forEach(en => root.classList.toggle('pr-wa-away', en.isIntersecting && narrow.matches)), { rootMargin: '0px 0px -40px 0px' });
      wo.observe(scale);
    }
    // first visit: a small settle when the scale scrolls into view, so it reads as a physical object
    if ('IntersectionObserver' in window && stage) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { io.disconnect(); if (!still()) { ang = 2; vel = 0; kick(-30); } } }), { threshold: 0.5 });
      io.observe(stage);
    }
  }

  /* ------------------------------------------------------------ 2a. ceramic tile word: tap or hover to wobble */
  const tile = $('[data-pr-tile]');
  if (tile) {
    const wob = () => { if (still()) return; tile.classList.remove('is-wobble'); void tile.offsetWidth; tile.classList.add('is-wobble'); };
    tile.addEventListener('animationend', e => { if (e.animationName === 'prTileWobble') tile.classList.remove('is-wobble'); });
    tile.addEventListener('pointerdown', wob);
    if (fine) tile.addEventListener('pointerenter', wob);
  }

  /* ------------------------------------------------------------ shared: in-view flags + one scroll loop */
  const inView = new Map();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { inView.set(en.target, en.isIntersecting); if (en.isIntersecting) schedule(); }), { rootMargin: '10% 0px' }) : null;
  const watch = el => { if (!el) return; inView.set(el, !io); if (io) io.observe(el); };
  let ticking = false, lastY = scrollY;
  const loops = [];
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  function frame() {
    ticking = false;
    const y = scrollY, dy = y - lastY; lastY = y;
    const vh = innerHeight;
    loops.forEach(fn => fn(dy, vh));
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });

  /* ------------------------------------------------------------ 2b. label-maker price tag: the words punch into
     embossed ink tape one letter at a time (the tape feeds out as it goes); tap or hover to print it again */
  const tag = $('[data-pr-tag]');
  const label = $('[data-pr-label]');
  if (tag && label) {
    const text = label.textContent;
    label.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = ch === ' ' || ch === '\u00A0' ? 'ch sp' : 'ch';
      s.textContent = ch;
      s.style.setProperty('--i', i);
      label.appendChild(s);
    });
    label.style.setProperty('--n', [...text].length);
    let busy = false;
    const punch = () => {
      if (still() || busy) return;
      busy = true;
      tag.classList.remove('is-punch'); void tag.offsetWidth; tag.classList.add('is-punch');
      setTimeout(() => { busy = false; }, 1250);
    };
    label.addEventListener('animationend', e => { if (e.animationName === 'prFeed') tag.classList.remove('is-punch'); });
    tag.addEventListener('pointerdown', punch);
    if (fine) tag.addEventListener('pointerenter', punch);
    // printed once as the page settles (the hero is on screen at load)
    if (!still()) { tag.classList.add('is-armed'); setTimeout(() => { tag.classList.remove('is-armed'); punch(); }, 900); }
  }

  /* ------------------------------------------------------------ 2c. proposal sheet: ticks draw themselves in order */
  const sheet = $('[data-pr-sheet]');
  if (sheet) {
    $$('.pr-sheet-list > li', sheet).forEach((li, i) => {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'pr-tick'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '11');
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M7 12.4l3.4 3.4L17.2 8.6'); p.setAttribute('pathLength', '1');
      svg.append(c, p); li.appendChild(svg);
      li.style.setProperty('--i', i);
    });
    if (!still() && 'IntersectionObserver' in window) {
      sheet.classList.add('is-armed');
      const o = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { sheet.classList.add('is-in'); o.disconnect(); } }), { threshold: 0.35 });
      o.observe(sheet);
    }
  }

  /* ------------------------------------------------------------ 2d. 30-day meter: beads fill one day at a time */
  const days = $('[data-pr-days]');
  if (days) {
    $$('.pr-days-beads i', days).forEach((b, i) => b.style.setProperty('--i', i));
    if (!still() && 'IntersectionObserver' in window) {
      days.classList.add('is-armed');
      const o = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { days.classList.add('is-in'); o.disconnect(); } }), { threshold: 0.6 });
      o.observe(days);
    }
  }

  /* ------------------------------------------------------------ 2e. scrubbed statement: words light up as you read */
  const scrub = $('[data-pr-scrub]');
  if (scrub) {
    const words = scrub.textContent.trim().split(/\s+/);
    scrub.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span'); s.className = 'w'; s.textContent = w; s.style.setProperty('--i', i);
      scrub.append(s, i < words.length - 1 ? ' ' : '');
    });
    scrub.style.setProperty('--n', words.length);
    watch(scrub);
    const upd = (dy, vh) => {
      if (still()) { scrub.style.setProperty('--p', 1); return; }
      if (!inView.get(scrub)) return;
      const r = scrub.getBoundingClientRect();
      // fully lit once the statement's middle reaches the upper third of the screen
      const p = clamp((vh * 0.9 - r.top) / (vh * 0.9 - vh * 0.3 + r.height * 0.5), 0, 1);
      scrub.style.setProperty('--p', (p * 1.08).toFixed(3));
    };
    loops.push(upd);
  }

  /* ------------------------------------------------------------ 2f. quote route: the path draws itself, beads pop */
  const route = $('[data-pr-route]');
  if (route) {
    const stops = $$('.pr-stop', route);
    watch(route);
    const wide = matchMedia('(min-width: 768px)');
    const upd = (dy, vh) => {
      if (still()) { route.style.setProperty('--draw', 1); route.classList.remove('is-armed'); return; }
      if (!inView.get(route)) return;
      route.classList.add('is-armed');
      const r = route.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3), 0, 1);
      route.style.setProperty('--draw', p.toFixed(4));
      stops.forEach((s, i) => {
        const at = wide.matches ? [0.02, 0.36, 0.70][i] : (s.offsetTop + 15) / r.height;
        s.classList.toggle('is-hit', p >= at - 0.01);
      });
    };
    loops.push(upd);
  }

  addEventListener('zs:motion', schedule);
  schedule();
})();
