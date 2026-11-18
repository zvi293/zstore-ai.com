// Signature component: One Lanyard — flip a switch and six agency name badges swing along their rail into one badge: Zvi Moshe, all of the above.
/* Zstore AI — /about/ page behaviour (prefix .ab-). Also: a split-flap board that flips the studio facts in, principle
   stickers that lift and flutter with the speed of your scroll, the page's own source typed in line by line. Everything here only enhances content that is already readable in the
   HTML; Motion off (html.motion-off, set by boot.js from the toggle or prefers-reduced-motion) shows final states. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOff = () => root.classList.contains('motion-off');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const below = el => el.getBoundingClientRect().top > innerHeight * .92;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ------------------------------------------------------------ One Lanyard
     Each badge hangs from the rail by its strap (transform-origin at the top). Its hook is driven by a spring with a
     capped force (a motor, not a slingshot) and the badge is a damped pendulum that feels the hook's acceleration,
     so it swings back as the hook sets off and forward as it brakes. Physics only ever writes transforms. */
  const ly = $('[data-ly]');
  if (ly) {
    const sw = $('[data-ly-switch]', ly);
    const live = $('[data-ly-live]', ly);
    const stage = $('[data-ly-stage]', ly);
    const agency = $('[data-ly-agency]', ly);
    const oneGrp = $('[data-ly-one]', ly);
    const zvi = $('[data-ly-zvi]', ly);
    const opts = $$('[data-ly-set]', ly);
    const mk = el => ({ el, x: 0, vx: 0, y: 0, vy: 0, a: 0, va: 0, s: 1, vs: 0, tx: 0, ty: 0, ta: 0, ts: 1, wait: 0, imp: 0 });
    const B = $$('[data-ly-badge]', ly).map(mk);
    const Z = mk(zvi);
    const P = { K: .028, C: .27, MAXA: 1.8, VMAX: 20, G: .028, D: .075, COUPLE: .22, AMAX: 28 };
    const MSG = {
      on: 'Zstore AI: Zvi Moshe does all six roles. Your request goes straight to the person who builds your site.',
      off: 'Typical agency: six roles. Your request passes through five hand-offs before an answer comes back to you.'
    };
    let one = false, raf = 0, last = 0;

    // rest positions come from untransformed boxes (slots, the Zvi group's offset), so a running animation never skews them
    const measure = () => {
      if (!one) { B.forEach(b => { b.tx = 0; b.ty = 0; b.ta = 0; b.ts = 1; }); return; }
      const g = oneGrp.getBoundingClientRect();
      const zx = g.left + zvi.offsetLeft + zvi.offsetWidth / 2;
      const zy = g.top + zvi.offsetTop;
      B.forEach((b, i) => {
        const slot = b.el.parentElement.getBoundingClientRect();
        b.tx = zx - (slot.left + slot.width / 2);
        b.ty = zy - slot.top;
        b.ta = (i - 2.5) * 4;     // they fan in and are absorbed into Zvi's badge (paint fades them by distance)
        b.ts = .72;
      });
    };
    const paint = b => {
      const still = !b.x && !b.y && !b.a && b.s === 1;
      b.el.style.transform = still ? '' : `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${b.a.toFixed(2)}deg) scale(${b.s.toFixed(3)})`;
      if (b !== Z) b.el.style.opacity = one ? clamp((Math.hypot(b.tx - b.x, b.ty - b.y) - 24) / 110, 0, 1).toFixed(3) : '';
    };
    const snap = b => { b.x = b.tx; b.y = b.ty; b.a = b.ta; b.s = b.ts; b.vx = b.vy = b.va = b.vs = 0; b.wait = 0; b.imp = 0; paint(b); };
    const step = b => {
      if (b.wait > 0) { b.wait--; return true; }
      if (b.imp) { b.va += b.imp; b.imp = 0; }
      let ax = clamp((b.tx - b.x) * P.K - b.vx * P.C, -P.MAXA, P.MAXA);
      b.vx = clamp(b.vx + ax, -P.VMAX, P.VMAX); b.x += b.vx;
      const ay = clamp((b.ty - b.y) * P.K * 1.4 - b.vy * P.C, -P.MAXA, P.MAXA);
      b.vy = clamp(b.vy + ay, -P.VMAX, P.VMAX); b.y += b.vy;
      b.va += (b.ta - b.a) * P.G - b.va * P.D + ax * P.COUPLE * 1;
      b.a += b.va;
      if (Math.abs(b.a - b.ta) > P.AMAX) { b.a = b.ta + Math.sign(b.a - b.ta) * P.AMAX; b.va *= -.4; }
      b.vs += (b.ts - b.s) * .11 - b.vs * .28; b.s += b.vs;
      const moving = Math.abs(b.tx - b.x) > .25 || Math.abs(b.ty - b.y) > .25 || Math.abs(b.vx) > .04 || Math.abs(b.vy) > .04
        || Math.abs(b.ta - b.a) > .15 || Math.abs(b.va) > .03 || Math.abs(b.ts - b.s) > .002 || Math.abs(b.vs) > .002;
      if (!moving) snap(b); else paint(b);
      return moving;
    };
    const loop = now => {
      raf = 0;
      const n = clamp(Math.round((now - (last || now - 16.7)) / 16.7), 1, 4); last = now;
      let busy = false;
      for (let k = 0; k < n; k++) { busy = false; B.forEach(b => { if (step(b)) busy = true; }); if (step(Z)) busy = true; }
      if (busy) raf = requestAnimationFrame(loop); else last = 0;
    };
    const kick = () => { if (motionOff()) { B.forEach(snap); snap(Z); return; } if (!raf) raf = requestAnimationFrame(loop); };

    const set = on => {
      if (on === one) return;
      one = on;
      ly.classList.add('is-used');
      ly.classList.toggle('is-one', one);
      sw.setAttribute('aria-checked', String(one));
      opts.forEach(o => o.classList.toggle('is-on', o.dataset.lySet === (one ? '1' : '0')));
      // the agency state (its heading, badges and chain) leaves the accessibility tree while Zvi's state is shown
      if (one) agency.setAttribute('aria-hidden', 'true'); else agency.removeAttribute('aria-hidden');
      live.textContent = one ? MSG.on : MSG.off;
      measure();
      if (motionOff()) { Z.ta = 0; Z.ty = 0; Z.ts = 1; B.forEach(snap); snap(Z); return; }
      if (one) {
        B.forEach((b, i) => { b.wait = Math.round(Math.abs(i - 2.5) * 2); });
        Object.assign(Z, { s: .55, y: -34, a: -16, va: 0, vs: 0, vy: 0, ts: 1, ty: 0, ta: 0, wait: 14 });
      } else {
        B.forEach((b, i) => { b.wait = 6 + Math.round(Math.abs(i - 2.5) * 2); });
        Object.assign(Z, { ts: .82, ty: -14, ta: 8, wait: 0 });
      }
      paint(Z); kick();
    };
    sw.addEventListener('click', () => set(!one));
    opts.forEach(o => o.addEventListener('click', () => set(o.dataset.lySet === '1')));

    // a nudge: badges swing when the pointer brushes past or a finger taps them (decorative, no content)
    B.concat(Z).forEach(b => {
      const card = b.el.querySelector('.ab-ly-card, .ab-ly-zcard');
      if (!card) return;
      if (fine) card.addEventListener('pointerenter', e => { if (motionOff()) return; b.imp += clamp((e.movementX || 4) * .14, -2.2, 2.2); kick(); });
      card.addEventListener('pointerdown', e => { if (motionOff() || e.pointerType === 'mouse') return; b.imp += (Math.random() < .5 ? -1 : 1) * 2.2; kick(); });
    });

    // the rail gets a bump the first time it scrolls into view: a swing travels along it
    if (hasIO) {
      const io = new IntersectionObserver(es => {
        if (!es.some(e => e.isIntersecting)) return;
        io.disconnect();
        if (motionOff()) return;
        B.forEach((b, i) => { b.wait = i * 4; b.imp = 1.5; });
        kick();
      }, { threshold: .35 });
      io.observe(stage);
    }

    // layout changes (rotation, text size, the a11y widget) move the rest positions
    let rz = 0;
    const relayout = () => { rz = 0; measure(); if (raf) return; B.forEach(snap); snap(Z); };
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (!rz) rz = requestAnimationFrame(relayout); }).observe(stage);
    addEventListener('zs:motion', () => { if (motionOff()) { cancelAnimationFrame(raf); raf = 0; last = 0; measure(); Z.ta = 0; Z.ty = 0; Z.ts = one ? 1 : Z.ts; B.forEach(snap); snap(Z); } });
  }

  /* ------------------------------------------------------------ principles: stuck down along the top edge only
     The scroll's speed is the wind: each sticker tips on rotateX (hinged at its top edge), so the loose bottom edge
     lifts while the page moves and flutters back on a damped spring when it stops. Each sticker has its own mass,
     so the board ripples rather than moving as one sheet. A tap flicks a sticker's edge. Transform only. */
  const board = $('[data-ab-board]');
  if (board) {
    const S = $$('.ab-pr-item', board).map((el, i) => ({ el, a: 0, v: 0, k: .05 + (i % 3) * .018, on: false }));
    let vis = false, raf = 0, lastY = scrollY, wind = 0;
    const rest = s => { s.a = s.v = 0; s.on = false; s.el.style.transform = ''; s.el.classList.remove('is-lifting'); };
    const tick = () => {
      raf = 0;
      if (motionOff()) { S.forEach(rest); return; }
      const y = scrollY, dy = y - lastY; lastY = y;
      wind += (clamp(dy, -60, 60) - wind) * .35;          // smoothed px per frame
      if (Math.abs(wind) < .05) wind = 0;
      let busy = wind !== 0;
      const target = clamp(wind * -.32, -9, 9);
      S.forEach(s => {
        s.v += (target - s.a) * s.k - s.v * .14;
        s.a += s.v;
        if (Math.abs(s.a) > .04 || Math.abs(s.v) > .02) {
          busy = true;
          if (!s.on) { s.on = true; s.el.classList.add('is-lifting'); }
          s.el.style.transform = `perspective(60rem) rotateX(${s.a.toFixed(2)}deg)`;
        } else if (s.on) rest(s);
      });
      if (busy && vis) raf = requestAnimationFrame(tick); else if (!vis) S.forEach(rest);
    };
    const kickB = () => { if (!raf && vis && !motionOff()) raf = requestAnimationFrame(tick); };
    addEventListener('scroll', kickB, { passive: true });
    if (hasIO) new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; lastY = scrollY; wind = 0; kickB(); }).observe(board);
    S.forEach(s => s.el.addEventListener('pointerdown', e => {
      if (motionOff() || e.pointerType === 'mouse' || e.target.closest('a')) return;
      s.v -= 2.4; kickB();
    }));
    addEventListener('zs:motion', () => { if (motionOff()) { cancelAnimationFrame(raf); raf = 0; S.forEach(rest); } });
  }

  /* ------------------------------------------------------------ the rest of the page: one-time entrances
     Only things still below the fold are armed (nothing on screen ever disappears), and turning Motion off at any
     point releases them to their final state. */
  const armed = [];
  const release = () => armed.forEach(el => el.classList.remove('is-armed', 'is-typing'));
  addEventListener('zs:motion', () => { if (motionOff()) release(); });
  if (!hasIO || motionOff()) return;

  /* split-flap board: the digit tiles start blank and flip through a run of digits to the real value, left to right,
     like a departures board. Each tile is two static halves plus two hinged leaves (each holds the whole glyph and is
     clipped to its half): the top leaf falls away showing the next digit, the bottom leaf swings down over the old one. */
  const flap = $('[data-ab-flap]');
  if (flap && below(flap) && 'animate' in Element.prototype) {
    const half = cls => { const e = document.createElement('span'); e.className = cls; return e; };
    const tiles = $$('.ab-ft', flap).map(el => {
      const t = { el, to: el.dataset.d, ht: half('ab-fh ab-fh-t'), hb: half('ab-fh ab-fh-b'), lt: half('ab-fl ab-fl-t'), lb: half('ab-fl ab-fl-b') };
      el.textContent = '';
      el.append(t.ht, t.hb, t.lt, t.lb);
      return t;
    });
    let stop = false;
    const done = t => {
      [t.lt, t.lb].forEach(l => { l.getAnimations().forEach(a => a.cancel()); l.style.visibility = ''; l.textContent = ''; });
      t.ht.textContent = t.hb.textContent = t.to;
    };
    const flip = async (t, from, to, d, last) => {
      t.ht.textContent = to; t.hb.textContent = from; t.lt.textContent = from; t.lb.textContent = to;
      t.lt.style.visibility = 'visible';
      await t.lt.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: d * .5, easing: 'cubic-bezier(.55,0,1,.6)', fill: 'forwards' }).finished;
      t.lt.style.visibility = ''; t.lb.style.visibility = 'visible';
      const kf = last ? [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(-16deg)', offset: .55 }, { transform: 'rotateX(6deg)', offset: .8 }, { transform: 'rotateX(0deg)' }]
                      : [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }];
      await t.lb.animate(kf, { duration: last ? d * 2.6 : d * .5, easing: last ? 'ease-out' : 'cubic-bezier(0,.4,.45,1)', fill: 'forwards' }).finished;
      t.lb.style.visibility = ''; t.hb.textContent = to;
    };
    const run = async (t, n, delay) => {
      await new Promise(r => setTimeout(r, delay));
      let cur = '';
      for (let k = n - 1; k >= 0 && !stop; k--) {
        const next = String((+t.to - k + 30) % 10);
        try { await flip(t, cur, next, 100, k === 0); } catch (e) { break; }
        cur = next;
      }
      done(t);
    };
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      const rows = $$(':scope > div', flap);
      tiles.forEach(t => {
        const row = rows.findIndex(r => r.contains(t.el));
        const col = $$('.ab-ft', rows[row]).indexOf(t.el);
        run(t, 6 + col * 3 + row, row * 220 + col * 90);
      });
    }, { rootMargin: '0px 0px -22% 0px' });
    io.observe(flap);
    addEventListener('zs:motion', () => { if (motionOff()) { stop = true; io.disconnect(); tiles.forEach(done); } });
  }

  // this page's own source, typed in line by line; then the shortcut keys press themselves once
  const src = $('[data-ab-src]');
  const keys = $('.ab-code-keys');
  if (src && below(src)) {
    src.classList.add('is-armed'); armed.push(src);
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      src.classList.replace('is-armed', 'is-typing');
      if (keys) setTimeout(() => { if (!motionOff()) keys.classList.add('is-pressed'); }, 2700);
    }, { threshold: .45 });
    io.observe(src);
  }
  /* ------------------------------------------------------------ where am I: a live local clock per city
     Each tile shows the city's local time (12-hour, as US visitors read it) on a small ceramic dial. The hands rest
     at twelve until the tiles come into view, then spring round to the time; after that they move with the minute.
     Night hours (before 7 AM, from 9 PM) glaze the dial dark. Motion off: the hands are simply set. */
  const tz = $('[data-ab-tz]');
  if (tz) {
    const cells = $$('li[data-tz]', tz).map(li => {
      try {
        return {
          li, now: $('[data-tz-now]', li),
          fmt: new Intl.DateTimeFormat('en-US', { timeZone: li.dataset.tz, hour: 'numeric', minute: '2-digit', hour12: true }),
          hf: new Intl.DateTimeFormat('en-GB', { timeZone: li.dataset.tz, hour: '2-digit', minute: '2-digit', hour12: false })
        };
      } catch (e) { return null; }
    }).filter(Boolean);
    if (cells.length) {
      let shown = false;
      const set = () => {
        const d = new Date();
        cells.forEach(c => {
          const parts = c.fmt.formatToParts(d);
          const hm = parts.filter(p => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value.trim() === ':')).map(p => p.value).join('');
          const ap = (parts.find(p => p.type === 'dayPeriod') || {}).value || '';
          const [h, m] = c.hf.format(d).split(':').map(Number);
          c.now.textContent = hm;
          if (ap) { const sm = document.createElement('small'); sm.textContent = ap; c.now.append(' ', sm); }
          c.now.setAttribute('datetime', String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
          c.li.classList.toggle('is-night', h < 7 || h >= 21);
          if (shown) {
            c.li.style.setProperty('--tz-h', ((h % 12) * 30 + m * .5) + 'deg');
            c.li.style.setProperty('--tz-m', (m * 6) + 'deg');
          }
        });
      };
      const show = () => { if (shown) return; shown = true; tz.classList.add('is-set'); set(); setTimeout(() => tz.classList.add('is-swept'), 1900); };
      set();
      tz.classList.add('is-live');
      if (hasIO && !motionOff() && below(tz)) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(show, 120); } }, { threshold: .35 });
        io.observe(tz);
      } else show();
      setInterval(set, 15000);
    }
  }
})();
