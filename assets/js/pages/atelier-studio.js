// Signature component: Floor Plan Walk — scroll (or tap a room) and a glazed ceramic piece walks the Atelier floor plan room by room while the plan's camera pans to follow it.
/* /work/atelier-studio/ only. Everything here enhances content that is already readable without JS:
   1. Floor Plan Walk (signature): IntersectionObserver checkpoints pick the room; a damped spring walks the
      figure along the route, a solid trail draws behind it, the SVG viewBox is the camera.
   2. Hero drafting crosshair: the mounted photo turns into a drawing board under the pointer (or a tap).
   3. The question steps in word by word while a glazed piece walks the dashed path beneath it.
   4. Daylight study: a window's shadow crosses the sample board as you scroll, with the sun time.
   5. Pace test: replay a mini Atelier page as "slow loading" or "designed pace".
   Motion off (html.motion-off: the site toggle or reduced motion) = final states, no animation. */
(() => {
  'use strict';
  const root = document.documentElement;
  const off = () => root.classList.contains('motion-off');
  const hasIO = 'IntersectionObserver' in window;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };

  /* ------------------------------------------------------------ 1. Floor Plan Walk */
  const walk = $('[data-as-walk]');
  if (walk) {
    const svg = $('.as-svg', walk), view = $('.as-plan-view', walk), plan = $('.as-plan', walk);
    const fig = $('.as-fig', svg), body = $('.as-fig-body', svg), shadow = $('.as-fig-shadow', svg), trail = $('.as-trail', svg);
    const zones = $$('[data-as-shape]', svg);
    const links = $$('[data-as-room]', walk);
    const rooms = links.map(a => document.getElementById(a.hash.slice(1)));
    const nowI = $('[data-as-now-i]', walk), nowN = $('[data-as-now-n]', walk), live = $('[data-as-live]', walk);
    const names = links.map(a => a.dataset.asName || $('.as-rn', a).textContent.trim());

    // the route (plan units) and the five stops along it
    const PTS = [[85, 325], [85, 305], [300, 305], [485, 305], [485, 135], [270, 135], [85, 135]];
    const STOPS = [0, 2, 4, 5, 6];
    const PW = 600, PH = 380, PAD = 8;
    const cum = [0];
    for (let i = 1; i < PTS.length; i++) cum.push(cum[i - 1] + Math.hypot(PTS[i][0] - PTS[i - 1][0], PTS[i][1] - PTS[i - 1][1]));
    const L = cum[cum.length - 1];
    const stopLen = STOPS.map(i => cum[i]);
    const at = s => {
      s = Math.max(0, Math.min(L, s));
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const a = PTS[i - 1], b = PTS[i], t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
    };

    let idx = 0, s = 0, v = 0, ang = -90, phase = 0, hop = 0;
    let drop = 0, dropV = 0, dropped = false;
    let cx = PTS[0][0], cy = PTS[0][1], zoom = 1;
    let raf = 0, last = 0;
    // phones: past the first room the pinned strip folds into a mini-map (c = px folded away, sprung toward cT)
    let cutMax = 0, c = 0, cV = 0, cT = 0, cPainted = -1;

    const readZoom = () => {
      zoom = parseFloat(getComputedStyle(view).getPropertyValue('--as-zoom')) || 1;
      cutMax = parseFloat(getComputedStyle(walk).getPropertyValue('--as-cut')) || 0;
    };
    const foldTarget = () => (idx > 0 ? cutMax : 0);
    const setStrip = () => { walk.style.setProperty('--as-strip', (matchMedia('(min-width: 1024px)').matches ? 0 : Math.round(plan.offsetHeight + 6 - cT)) + 'px'); };

    const camera = () => {
      const box = svg.getBoundingClientRect(), W = box.width, H = box.height;
      if (!W || !H) return;
      // the scale is set by the full strip; folding only crops it, and the figure stays centred in what's left
      const u = Math.max((PW + PAD * 2) / W, (PH + PAD * 2) / H) / zoom;
      const vw = W * u, vh = H * u, seen = Math.max(1, H - c) * u;
      const fit = (p, size, full) => size >= full + PAD * 2 ? (full - size) / 2 : Math.min(Math.max(p - size / 2, -PAD), full + PAD - size);
      svg.setAttribute('viewBox', `${fit(cx, vw, PW).toFixed(1)} ${fit(cy, seen, PH).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
    };

    const paint = () => {
      const p = at(s);
      fig.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      const lift = hop + drop;
      body.setAttribute('transform', `translate(0 ${(-lift).toFixed(2)}) rotate(${ang.toFixed(1)}) scale(${(1 - hop * .012).toFixed(3)} ${(1 + hop * .02).toFixed(3)})`);
      const sh = Math.max(.35, 1 - lift / 40);
      shadow.setAttribute('transform', `scale(${sh.toFixed(3)})`);
      shadow.style.opacity = Math.max(.25, sh).toFixed(2);
      trail.style.strokeDasharray = `${s.toFixed(1)} ${(L + 10).toFixed(0)}`;
      zones.forEach((z, i) => {
        z.classList.toggle('is-seen', stopLen[i] <= s + 1);
        z.classList.toggle('is-now', i === idx && Math.abs(s - stopLen[i]) < 40);
      });
      const cp = Math.round(c * 2) / 2;
      if (cp !== cPainted) { plan.style.setProperty('--as-c', cp + 'px'); cPainted = cp; }
      camera();
    };

    const step = now => {
      raf = 0;
      const dt = Math.min(.034, Math.max(.001, (now - (last || now)) / 1000)) || .016; last = now;
      const target = stopLen[idx];
      // damped spring along the route, speed-capped so a long jump visibly walks through the rooms in between
      for (let k = 0; k < 2; k++) {
        const h = dt / 2;
        v += (42 * (target - s) - 10.6 * v) * h;
        v = Math.max(-980, Math.min(980, v));
        const ds = v * h; s += ds;
        phase += Math.abs(ds) / 17 * Math.PI;
      }
      const speed = Math.abs(v);
      // hop like a toy piece while it moves; settle flat when it stops
      const want = speed > 18 ? Math.abs(Math.sin(phase)) * 4.2 * Math.min(1, speed / 160) : 0;
      hop += (want - hop) * Math.min(1, dt * 22);
      // face the direction of travel (a bar looks the same both ways, so turn the short way)
      if (speed > 6) {
        let d = at(s).ang - ang; d = ((d + 90) % 180 + 180) % 180 - 90;
        ang += d * Math.min(1, dt * 12);
      }
      // drop-in when the walk first appears
      if (drop || dropV) { dropV += (-170 * drop - 11 * dropV) * dt; drop += dropV * dt; if (drop < 0) { drop = -drop * .35; dropV = -dropV * .35; } if (Math.abs(drop) < .05 && Math.abs(dropV) < 1) { drop = 0; dropV = 0; } }
      // the strip folds / unfolds on a firm, barely-overshooting spring (clamped: it never folds past the mini-map)
      cV += (210 * (cT - c) - 28 * cV) * dt; c = Math.max(0, Math.min(cutMax, c + cV * dt));
      // the camera follows with a little lag
      const p = at(s), f = 1 - Math.exp(-dt * 7);
      cx += (p.x - cx) * f; cy += (p.y - cy) * f;
      paint();
      const busy = Math.abs(target - s) > .05 || speed > .05 || hop > .02 || drop || dropV || Math.abs(p.x - cx) > .15 || Math.abs(p.y - cy) > .15 || Math.abs(cT - c) > .3 || Math.abs(cV) > 2;
      if (busy) raf = requestAnimationFrame(step); else { s = target; v = 0; hop = 0; c = cT; cV = 0; last = 0; paint(); }
    };
    const kick = () => { if (off()) return snap(); if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
    const snap = () => {
      if (raf) cancelAnimationFrame(raf); raf = 0; last = 0;
      s = stopLen[idx]; v = 0; hop = 0; drop = 0; dropV = 0; c = cT; cV = 0;
      const p = at(s); cx = p.x; cy = p.y;
      const segAng = at(Math.max(0, s - 1)).ang; ang = Math.abs(segAng) === 90 ? 90 : 0;
      paint();
    };

    const setRoom = (i, announce) => {
      if (i < 0 || i >= rooms.length) return;
      if (i !== idx) {
        rooms[idx] && rooms[idx].classList.add('was-now');
        idx = i;
      }
      rooms.forEach((r, k) => r && r.classList.toggle('is-now', k === idx));
      links.forEach((a, k) => { if (k === idx) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      nowI.textContent = String(idx + 1).padStart(2, '0');
      nowN.textContent = names[idx];
      if (announce) live.textContent = `Walking to room ${idx + 1} of ${rooms.length}: ${names[idx]}.`;
      // set before a tapped key's own jump, so the room lands just under the (folded or full) strip
      const t = foldTarget(); if (t !== cT) { cT = t; setStrip(); }
      plan.classList.toggle('is-folded', cT > 0);
      kick();
    };

    links.forEach((a, i) => a.addEventListener('click', () => setRoom(i, true)));
    zones.forEach((z, i) => z.addEventListener('click', () => links[i].click()));

    if (hasIO) {
      // a thin band across the middle of the screen: whichever room crosses it is the room you're in
      const band = new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) setRoom(rooms.indexOf(en.target), false);
      }), { rootMargin: '-48% 0px -48% 0px' });
      rooms.forEach(r => r && band.observe(r));
      // the figure drops onto the plan the first time it comes into view
      const seen = new IntersectionObserver(entries => {
        if (!entries.some(en => en.isIntersecting) || dropped) return;
        dropped = true; seen.disconnect();
        if (!off()) { drop = 46; dropV = 0; kick(); }
      }, { threshold: .35 });
      if (!onScreen(view)) seen.observe(view); else dropped = true;
    }

    // phones/tablets: while the dock is pinned it gets an opaque backdrop up under the nav (CSS .is-stuck)
    const narrow = matchMedia('(max-width: 1023px)');
    let stuckR = 0, stuckOn = false, stuckListen = false;
    const stuck = () => {
      stuckR = 0;
      const t = parseFloat(getComputedStyle(plan).top) || 0, r = plan.getBoundingClientRect();
      const on = narrow.matches && getComputedStyle(plan).position === 'sticky' && r.top <= t + 1 && walk.getBoundingClientRect().bottom > r.bottom + 2;
      if (on !== stuckOn) { stuckOn = on; plan.classList.toggle('is-stuck', on); }
    };
    const onStuck = () => { if (!stuckR) stuckR = requestAnimationFrame(stuck); };
    if (hasIO) {
      new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting && !stuckListen) { addEventListener('scroll', onStuck, { passive: true }); stuckListen = true; onStuck(); }
        else if (!en.isIntersecting && stuckListen) { removeEventListener('scroll', onStuck); stuckListen = false; onStuck(); }
      })).observe(walk);
    }

    readZoom(); setStrip(); snap(); setRoom(0, false);
    const relayout = () => { readZoom(); cT = foldTarget(); plan.classList.toggle('is-folded', cT > 0); setStrip(); if (raf) camera(); else snap(); };
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(view);
    else addEventListener('resize', relayout);
    addEventListener('zs:motion', () => { if (off()) snap(); });
  }

  /* ------------------------------------------------------------ 2. hero drafting crosshair (honest image coordinates) */
  const mat = $('[data-as-aim]');
  if (mat) {
    const img = $('img', mat), tag = $('.as-cross-t', mat);
    let hide = 0, r = 0, px = 0, py = 0;
    const draw = () => {
      r = 0;
      const m = mat.getBoundingClientRect(), b = img.getBoundingClientRect();
      const x = px - m.left, y = py - m.top;
      mat.style.setProperty('--cx', x.toFixed(1) + 'px'); mat.style.setProperty('--cy', y.toFixed(1) + 'px');
      mat.style.setProperty('--tx', x > m.width - 150 ? '-138px' : '12px'); mat.style.setProperty('--ty', y > m.height - 40 ? '-34px' : '12px');
      const nx = Math.round((px - b.left) / b.width * 1536), ny = Math.round((py - b.top) / b.height * 1024);
      tag.textContent = nx >= 0 && ny >= 0 && nx <= 1536 && ny <= 1024 ? `x ${String(nx).padStart(4, '0')} · y ${String(ny).padStart(4, '0')}` : 'mat · off the print';
    };
    const aim = e => { px = e.clientX; py = e.clientY; mat.classList.add('is-aim'); if (!r) r = requestAnimationFrame(draw); };
    mat.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') aim(e); });
    mat.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mat.classList.remove('is-aim'); });
    // touch / pen: only a real tap aims (a scroll that starts on the photo moves the finger or gets cancelled)
    let down = null;
    mat.addEventListener('pointerdown', e => { down = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY }; });
    mat.addEventListener('pointercancel', () => { down = null; });
    mat.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
      down = null; aim(e); clearTimeout(hide); hide = setTimeout(() => mat.classList.remove('is-aim'), 1600);
    });
  }

  /* ------------------------------------------------------------ 3. the question steps in word by word */
  const q = $('[data-as-words]');
  if (q) {
    let n = 0;
    const wrap = node => {
      [...node.childNodes].forEach(c => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/( +)/).forEach(part => {
            if (!part) return;
            if (/^ +$/.test(part)) { frag.append(part); return; }
            const w = document.createElement('span'); w.className = 'as-w'; w.textContent = part; w.style.setProperty('--wi', n++); frag.append(w);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1) {
          const w = document.createElement('span'); w.className = 'as-w'; w.style.setProperty('--wi', n++);
          c.replaceWith(w); w.append(c);
        }
      });
    };
    wrap(q);
    const walkLine = q.nextElementSibling;
    if (walkLine) { walkLine.style.setProperty('--as-qd', (n * 90 + 500) + 'ms'); walkLine.style.setProperty('--as-qh', Math.max(2, Math.round((n * 90 + 500) / 340))); }
    if (hasIO && !off() && !onScreen(q)) {
      q.classList.add('is-armed');
      const io = new IntersectionObserver(entries => {
        if (!entries.some(en => en.isIntersecting)) return;
        q.classList.add('is-on'); io.disconnect();
      }, { threshold: .5 });
      io.observe(q);
    }
  }

  /* ------------------------------------------------------------ 4. daylight study over the sample board */
  const board = $('[data-as-sun]');
  if (board) {
    const clock = $('[data-as-sun-t]', board);
    let r = 0, txt = '', listening = false;
    const set = p => {
      board.style.setProperty('--as-sun', p.toFixed(3));
      const m = 7 * 60 + Math.round(p * 72) * 10; // 07:00 to 19:00 in ten-minute steps
      const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      if (t !== txt) { clock.textContent = t; txt = t; }
    };
    const upd = () => {
      r = 0;
      if (off()) { set(.5); return; }
      const b = board.getBoundingClientRect();
      set(Math.min(1, Math.max(0, (innerHeight - b.top) / (innerHeight + b.height))));
    };
    const onScroll = () => { if (!r) r = requestAnimationFrame(upd); };
    if (hasIO) {
      new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting && !listening) { addEventListener('scroll', onScroll, { passive: true }); listening = true; onScroll(); }
        else if (!en.isIntersecting && listening) { removeEventListener('scroll', onScroll); listening = false; }
      })).observe(board);
    }
    upd();
    addEventListener('zs:motion', upd);
  }

  /* ------------------------------------------------------------ 4b. the legend's plaques open like doors as you reach them */
  const legend = $('[data-as-legend]');
  if (legend && hasIO && !off()) {
    const items = $$(':scope > li', legend);
    const past = el => el.getBoundingClientRect().bottom < 0;
    legend.classList.add('as-leg-on');
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting && !past(en.target)) return;
      en.target.classList.add('is-in'); io.unobserve(en.target);
    }), { threshold: .25, rootMargin: '0px 0px -12% 0px' });
    items.forEach(li => { if (past(li)) li.classList.add('is-in'); else io.observe(li); });
    addEventListener('zs:motion', () => { if (off()) { io.disconnect(); items.forEach(li => li.classList.add('is-in')); } });
  }

  /* ------------------------------------------------------------ 5. pace test: replay the page two ways */
  const pace = $('[data-as-pace]');
  if (pace) {
    const screen = $('.as-ps', pace), note = $('[data-as-pace-note]', pace), btns = $$('[data-as-mode]', pace);
    const NOTES = {
      slow: 'Slow loading: a blank wait with a spinner, then everything lands at once. Nothing guides the eye.',
      paced: 'Designed pace: the page is there at once, then the rows arrive in order. Fast, and still calm.'
    };
    let timer = 0;
    const play = (mode, announce) => {
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.asMode === mode)));
      if (announce) note.textContent = NOTES[mode];
      clearTimeout(timer);
      screen.classList.remove('is-wait', 'is-play');
      if (off()) return; // Motion off: the final page, no replay
      void screen.offsetWidth;
      if (mode === 'slow') { screen.classList.add('is-wait'); timer = setTimeout(() => screen.classList.remove('is-wait'), 2200); }
      else screen.classList.add('is-play');
    };
    btns.forEach(b => b.addEventListener('click', () => play(b.dataset.asMode, true)));
    note.textContent = NOTES.paced;
    note.setAttribute('aria-live', 'polite'); // only after the text swap, so nothing is announced on load
    if (hasIO && !off()) {
      const io = new IntersectionObserver(entries => {
        if (!entries.some(en => en.isIntersecting)) return;
        io.disconnect(); play('paced', false);
      }, { threshold: .6 });
      io.observe(screen);
    }
    addEventListener('zs:motion', () => { if (off()) { clearTimeout(timer); screen.classList.remove('is-wait', 'is-play'); } });
  }
})();
