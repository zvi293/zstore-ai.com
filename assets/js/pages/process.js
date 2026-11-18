// Signature component: Domino Run — tip a chain of ten project milestones; three switches open the gaps where projects stall.
/* Zstore AI — /process/ page behaviour (vanilla, no dependencies). Touches only .pc- elements.
   1. Domino Run: dominoes are built into the tray from the milestone list (the list is the real content and
      the no-JS version). A small rigid-body loop tips them: each one falls about its bottom corner under gravity,
      leans on the next, and the chain compresses as it goes. A switch that is off lifts the next domino off the
      tray, so the chain falls into the gap and stops there. Motion off / reduced motion: final states at once.
   2. Steps: each keycap rolls its digit up from 0 and fills its beads as the step arrives; the sticky odometer
      (wide screens) rolls to the step in view; below 1100px it docks as an island inside the nav capsule.
   3. Step art: the Develop print develops with your scroll; the Launch test card switches on like an old TV.
   4. Tape measure: the timeline bars grow when the table scrolls in.
   5. Readiness list: a meter counts the boxes you tick.
   6. Async relay: a paper plane carries the notes overnight and the reply back, flying with your scroll. */
(() => {
  'use strict';
  const root = document.documentElement;
  const motionOff = () => root.classList.contains('motion-off');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const HALF_PI = Math.PI / 2;
  const DEG = 180 / Math.PI;

  /* ================================================================ 1. Domino Run */
  const run = $('[data-pc-run]');
  if (run) {
    const tray = $('[data-pc-tray]', run);
    const items = $$('.pc-st', run);
    const goBtn = $('[data-pc-go]', run), goLabel = $('span', goBtn);
    const resetBtn = $('[data-pc-reset]', run);
    const statusEl = $('[data-pc-status]', run), countEl = $('[data-pc-count]', run);
    const stalls = $$('.pc-stall', run);
    const switches = $$('[data-pc-gate]', run);
    const REASON = {
      content: 'the content wasn’t ready',
      feedback: 'review feedback arrived late',
      access: 'the domain and accounts weren’t ready',
    };
    const AGAIN_MSG = 'Standing again. Tip the first one.';
    const NS = 'http://www.w3.org/2000/svg';

    const make = (cls, parent = tray) => { const e = document.createElement('span'); e.className = cls; parent.appendChild(e); return e; };
    const rails = [make('pc-rail'), make('pc-rail')];
    const turn = make('pc-turn');
    const post = make('pc-post');
    const stop = make('pc-stop');
    const zs = document.createElementNS(NS, 'svg'); zs.setAttribute('viewBox', '0 0 48 48');
    const zu = document.createElementNS(NS, 'use'); zu.setAttribute('href', '#z-glyph'); zs.appendChild(zu); stop.appendChild(zs);
    const live = make('sticker pc-live'); live.textContent = 'Live';
    const hint = make('sticker pc-hint'); hint.textContent = 'Tap to tip ↓';

    // one domino per milestone, glazed by who acts (me / you / both)
    const doms = items.map((li, i) => {
      const el = make('pc-dom'); el.dataset.who = li.dataset.who || 'both';
      const b = make('pc-dom-b', el); const n = make('pc-dom-i', b); n.textContent = String(i + 1).padStart(2, '0');
      const gate = li.dataset.gate || null;
      const slot = gate ? make('pc-slot') : null;
      return { i, el, li, gate, slot, name: $('.pc-st-n', li).textContent.trim(), th: 0, om: 0, phase: 'up', lifted: false, x: 0, base: 0, dir: 1, gap: 0, tgt: null };
    });
    const N = doms.length;

    let G = null;            // geometry of the current layout
    let state = 'idle';      // idle | running | done
    let raf = 0, last = 0, relayT = 0, fallen = 0, stoppedAt = null, settleT = 0;

    /* ---------- geometry: positions from the tray size (phones: two rows that snake, else one row) */
    const layout = () => {
      const W = tray.clientWidth, H = tray.clientHeight;
      if (!W || !H) return false;
      const cs = getComputedStyle(tray);
      const w = parseFloat(cs.getPropertyValue('--dw')) || 18;
      let h = parseFloat(cs.getPropertyValue('--dh')) || 74;
      const snake = W < 640;
      const pad = snake ? 12 : 22;
      const lift = w + 16;
      let col;
      if (snake) {
        col = (W - 2 * pad) / 6.4;                 // 5 dominoes + a lane for the post / stop at each end
        h = Math.min(h, 2 * col - w - 6);           // a domino falling into an empty slot must not reach the next one
        const base2 = H - 22, base1 = base2 - (h + lift + 30);
        doms.forEach((d, i) => {
          if (i < 5) { d.x = pad + col * (0.7 + i + 0.5); d.base = base1; d.dir = 1; }
          else { d.x = pad + col * (0.7 + (9 - i) + 0.5); d.base = base2; d.dir = -1; }
        });
        G = { W, H, w, h, col, lift, snake, base1, base2, pad };
      } else {
        // wide screens: one domino above each milestone card (the cards sit in ten columns)
        const tr = tray.getBoundingClientRect();
        const r0 = items[0].getBoundingClientRect(), r1 = items[1].getBoundingClientRect();
        const aligned = Math.abs(r0.top - items[N - 1].getBoundingClientRect().top) < 2 && r1.left > r0.left;
        if (aligned) {
          col = r1.left - r0.left;
          doms.forEach((d, i) => { const r = items[i].getBoundingClientRect(); d.x = r.left - tr.left + r.width / 2; });
        } else {
          col = (W - 2 * pad) / 10.9;
          doms.forEach((d, i) => { d.x = pad + col * (i + 0.5); });
        }
        h = Math.min(h, 2 * col - w - 6);
        const base = H - 34;
        doms.forEach(d => { d.base = base; d.dir = 1; });
        G = { W, H, w, h, col, lift, snake, base1: base, base2: base, pad };
      }
      const { w: dw, h: dh } = G;
      doms.forEach(d => {
        Object.assign(d.el.style, { left: (d.x - dw / 2) + 'px', top: (d.base - dh) + 'px', width: dw + 'px', height: dh + 'px' });
        d.el.dataset.dir = d.dir;
        if (d.slot) Object.assign(d.slot.style, { left: (d.x - dw / 2) + 'px', top: (d.base - dh) + 'px', width: dw + 'px', height: dh + 'px' });
      });
      // post (phones: end of row one, relays to row two) and stop (end of the chain)
      const pw = Math.round(dw * 0.9), ph = Math.round(dh * 0.55), sw = Math.max(26, Math.round(dw * 1.1)), sh = Math.round(dh * 0.62);
      G.pw = pw; G.ph = ph; G.sw = sw; G.sh = sh;
      const gapOf = () => G.col - dw;
      if (G.snake) {
        const d4 = doms[4], d9 = doms[9];
        const pl = d4.x + dw / 2 + gapOf();
        Object.assign(post.style, { display: '', left: pl + 'px', top: (G.base1 - ph) + 'px', width: pw + 'px', height: ph + 'px' });
        const sr = d9.x - dw / 2 - gapOf();
        Object.assign(stop.style, { left: (sr - sw) + 'px', top: (G.base2 - sh) + 'px', width: sw + 'px', height: sh + 'px' });
        Object.assign(turn.style, { display: '', left: (d4.x) + 'px', top: (G.base1 - 4) + 'px', width: (W - d4.x - 8) + 'px', height: (G.base2 - G.base1 + 8) + 'px' });
        Object.assign(rails[0].style, { display: '', left: (pad * 0.5) + 'px', top: (G.base1 - 2) + 'px', width: (d4.x - pad * 0.5 + 2) + 'px' });
        Object.assign(rails[1].style, { display: '', left: (sr - sw - 6) + 'px', top: (G.base2 - 2) + 'px', width: (d4.x - sr + sw + 8) + 'px' });
        Object.assign(live.style, { left: (sr - sw - 4) + 'px', top: (G.base2 - sh - 36) + 'px' });
        G.postGap = pl - (d4.x + dw / 2);
        G.stopGap = (d9.x - dw / 2) - sr;
      } else {
        const d9 = doms[9];
        const sl = Math.min(d9.x + dw / 2 + gapOf(), W - sw - 10);
        Object.assign(stop.style, { left: sl + 'px', top: (G.base1 - sh) + 'px', width: sw + 'px', height: sh + 'px' });
        post.style.display = 'none'; turn.style.display = 'none'; rails[1].style.display = 'none';
        Object.assign(rails[0].style, { display: '', left: (pad * 0.5) + 'px', top: (G.base1 - 2) + 'px', width: (W - pad) + 'px' });
        Object.assign(live.style, { left: (sl - 30) + 'px', top: (G.base1 - sh - 38) + 'px' });
        G.stopGap = sl - (d9.x + dw / 2);
      }
      Object.assign(hint.style, { left: Math.max(6, doms[0].x - dw / 2 - 8) + 'px', top: Math.max(6, doms[0].base - dh - 38) + 'px' });
      // what each domino falls toward: the next domino, the post (phones, end of row one) or the stop
      doms.forEach((d, i) => {
        if (i === N - 1) { d.tgt = 'stop'; d.gap = G.stopGap; }
        else if (G.snake && i === 4) { d.tgt = 'post'; d.gap = G.postGap; }
        else { d.tgt = doms[i + 1]; d.gap = d.dir === 1 ? (doms[i + 1].x - dw / 2) - (d.x + dw / 2) : (d.x - dw / 2) - (doms[i + 1].x + dw / 2); }
      });
      return true;
    };

    /* ---------- contact geometry (local frame: our pivot at 0,0, falling toward +x, y up).
       Returns the angle at which our top corner meets the target's near face (or its top corner meets our face);
       90° if it never does (the domino lies flat on the tray). */
    const contact = (gap, h, wn, hn, phi) => {
      const Bx = gap + wn - wn * Math.cos(phi), By = wn * Math.sin(phi);
      const ux = Math.sin(phi), uy = Math.cos(phi);
      const f = th => (h * Math.sin(th) - Bx) * uy - (h * Math.cos(th) - By) * ux;
      if (f(HALF_PI) < 0) return HALF_PI;
      let lo = 0, hi = HALF_PI;
      for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
      let th = hi;
      const t = (h * Math.sin(th) - Bx) * ux + (h * Math.cos(th) - By) * uy;
      if (t > hn) th = Math.atan2(Bx + hn * ux, By + hn * uy);
      return Math.max(0, Math.min(th, HALF_PI));
    };
    const limitOf = d => {
      const { w, h } = G;
      if (d.tgt === 'stop') return contact(d.gap, h, G.sw, G.sh, 0);
      if (d.tgt === 'post') return contact(d.gap, h, G.pw, G.ph, 0);
      const n = d.tgt;
      if (n.lifted) return HALF_PI;
      return contact(d.gap, h, w, h, n.th);
    };

    /* ---------- drawing */
    const paint = d => {
      const lift = d.lifted && d.phase === 'up';
      const rot = d.th * DEG * d.dir;
      d.el.style.transform = lift ? `translateY(${-G.lift}px) rotate(${-5 * d.dir}deg)` : (rot ? `rotate(${rot.toFixed(2)}deg)` : '');
      d.el.classList.toggle('is-lifted', lift);
      if (d.slot) d.slot.classList.toggle('is-open', lift);
    };
    const paintAll = () => doms.forEach(paint);
    const setCount = n => {
      countEl.textContent = String(n).padStart(2, '0');
      if (!motionOff()) { countEl.classList.add('is-tick'); clearTimeout(countEl._t); countEl._t = setTimeout(() => countEl.classList.remove('is-tick'), 160); }
    };
    const hit = d => {
      d.li.classList.add('is-hit');
      fallen += 1; setCount(fallen);
    };
    const bump = el => { if (motionOff()) return; el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); };

    /* ---------- the physics loop: gravity torque about the bottom corner, contact limits, a damped bounce on the tray */
    const step = dt => {
      let moving = false;
      const K = 7.5 * Math.sqrt(150 / G.h);  // smaller dominoes fall faster, like real ones
      for (const d of doms) {
        if (d.phase === 'fall' || d.phase === 'bounce') {
          moving = true;
          d.om += K * (Math.sin(d.th) + 0.16) * dt;
          d.th += d.om * dt;
          const lim = limitOf(d);
          if (d.th >= lim) {
            d.th = lim;
            const t = d.tgt;
            if (lim >= HALF_PI - 1e-3) {
              // nothing to lean on: it lands flat on the tray and bounces a little
              if (d.phase === 'fall' && t && t !== 'stop' && t !== 'post' && t.lifted) {
                stoppedAt = t; t.el.classList.remove('is-miss'); void t.el.offsetWidth; t.el.classList.add('is-miss');
              }
              if (Math.abs(d.om) < 0.9) { d.om = 0; d.phase = 'rest'; }
              else { d.om = -d.om * 0.3; d.phase = 'bounce'; d.th -= 0.001; }
            } else if (t === 'stop') {
              d.phase = 'lean'; d.om = 0; bump(stop); live.classList.add('is-on');
            } else if (t === 'post') {
              d.phase = 'lean'; d.om = 0; bump(post);
              const n = doms[5];
              relayT = setTimeout(() => {
                relayT = 0;
                if (state !== 'running') return;
                if (n.lifted) { stoppedAt = n; n.el.classList.remove('is-miss'); void n.el.offsetWidth; n.el.classList.add('is-miss'); }
                else if (n.phase === 'up') { n.phase = 'fall'; n.om = 2.2; hit(n); }
                kick();
              }, motionOff() ? 0 : 160);
            } else if (t.phase === 'up') {
              d.phase = 'lean';
              t.phase = 'fall'; t.om = Math.max(1.8, d.om * 0.62); hit(t);
              d.om = 0;
            } else {
              d.phase = 'lean'; d.om = 0;
            }
          }
        } else if (d.phase === 'lean') {
          // resting on the target: follows it down as the chain compresses
          const lim = limitOf(d);
          if (lim > d.th + 1e-4) { d.th = lim; moving = true; }
        }
      }
      return moving;
    };

    const frame = now => {
      raf = 0;
      if (state !== 'running') return;
      const dt = Math.min(0.034, (now - last) / 1000 || 0.016); last = now;
      const moving = step(dt / 2) | step(dt / 2);
      paintAll();
      if (moving || relayT) { settleT = now; raf = requestAnimationFrame(frame); return; }
      if (now - settleT < 160) { raf = requestAnimationFrame(frame); return; }
      finish();
    };
    const kick = () => { if (!raf && state === 'running') { last = performance.now(); settleT = last; raf = requestAnimationFrame(frame); } };

    /* ---------- the instant version (motion off, a resize mid-run): solve the resting pose directly */
    const solveFinal = () => {
      // walk the chain from the first domino until it stops
      const chain = [];
      let stopped = null;
      for (let i = 0; i < N; i++) {
        const d = doms[i];
        if (d.lifted) { stopped = d; break; }
        chain.push(d);
        if (G.snake && i === 4 && doms[5].lifted) { stopped = doms[5]; break; }
      }
      for (let k = chain.length - 1; k >= 0; k--) { const d = chain[k]; d.phase = 'lean'; d.om = 0; d.th = limitOf(d); }
      // a leaning domino depends on the one after it, so settle from the end backwards twice
      for (let k = chain.length - 1; k >= 0; k--) chain[k].th = limitOf(chain[k]);
      doms.forEach(d => { if (!chain.includes(d)) { d.phase = 'up'; d.th = 0; d.om = 0; } });
      chain.forEach(d => d.li.classList.add('is-hit'));
      fallen = chain.length; setCount(fallen);
      stoppedAt = stopped;
      if (!stopped) live.classList.add('is-on');
      paintAll();
    };

    /* ---------- run, finish, reset */
    const setGo = text => { goLabel.textContent = text; };
    const go = () => {
      if (state === 'running') return;
      if (state === 'done') { reset(true); return; }
      if (!G && !layout()) return;
      state = 'running'; run.dataset.state = 'running';
      fallen = 0; stoppedAt = null;
      hint.classList.add('is-used');
      // aria-disabled, not disabled: a disabled button would drop keyboard focus to <body> mid-run
      goBtn.setAttribute('aria-disabled', 'true'); resetBtn.disabled = true;
      stalls.forEach(s => s.classList.remove('is-hit'));
      statusEl.textContent = 'Running…';
      const first = doms[0];
      if (motionOff()) { solveFinal(); finish(); return; }
      first.phase = 'fall'; first.om = 1.5; hit(first);
      tray.classList.remove('is-settling');
      kick();
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; clearTimeout(relayT); relayT = 0;
      state = 'done'; run.dataset.state = 'done';
      run.classList.toggle('is-done', !stoppedAt);
      goBtn.removeAttribute('aria-disabled'); resetBtn.disabled = false; setGo('Run it again');
      if (stoppedAt) {
        const idx = String(stoppedAt.i + 1).padStart(2, '0');
        stoppedAt.li.classList.add('is-stuck');
        const note = stalls.find(s => s.dataset.stall === stoppedAt.gate);
        if (note) note.classList.add('is-hit');
        statusEl.textContent = '';
        const b = document.createElement('strong'); b.textContent = `The chain stopped before ${idx} · ${stoppedAt.name}: ${REASON[stoppedAt.gate] || 'a step wasn’t ready'}.`;
        statusEl.append(b, ' How we prevent it is marked below.');
      } else {
        statusEl.textContent = '';
        const b = document.createElement('strong'); b.textContent = 'All ten fell, kickoff call to 30 days of care.';
        statusEl.append(b, ' Now switch one of the three off and run it again.');
      }
    };
    const reset = (andRun = false) => {
      cancelAnimationFrame(raf); raf = 0; clearTimeout(relayT); relayT = 0;
      state = 'idle'; run.dataset.state = 'idle'; run.classList.remove('is-done');
      fallen = 0; setCount(0); stoppedAt = null;
      items.forEach(li => li.classList.remove('is-hit', 'is-stuck'));
      stalls.forEach(s => s.classList.remove('is-hit'));
      live.classList.remove('is-on');
      if (document.activeElement === resetBtn) goBtn.focus({ preventScroll: true });
      setGo('Tip the first domino'); resetBtn.disabled = true; goBtn.removeAttribute('aria-disabled');
      const instant = motionOff();
      if (!instant) {
        tray.classList.add('is-settling');
        doms.forEach((d, i) => { d.el.style.transitionDelay = ((N - 1 - i) * 32) + 'ms'; });
      }
      doms.forEach(d => { d.th = 0; d.om = 0; d.phase = 'up'; d.el.classList.remove('is-miss'); });
      paintAll();
      const after = () => {
        tray.classList.remove('is-settling'); doms.forEach(d => { d.el.style.transitionDelay = ''; });
        if (andRun) go();
      };
      if (instant) { statusEl.textContent = andRun ? '' : AGAIN_MSG; after(); }
      else { if (!andRun) statusEl.textContent = AGAIN_MSG; setTimeout(after, 760 + N * 32); }
    };

    /* ---------- switches: off lifts the domino it guards off the tray */
    const applyGates = animate => {
      switches.forEach(sw => {
        const d = doms.find(x => x.gate === sw.dataset.pcGate);
        if (d) d.lifted = !sw.checked;
      });
      if (animate && !motionOff()) tray.classList.add('is-settling');
      paintAll();
      if (animate && !motionOff()) setTimeout(() => { if (state !== 'running') tray.classList.remove('is-settling'); }, 800);
    };
    switches.forEach(sw => {
      const d = doms.find(x => x.gate === sw.dataset.pcGate);
      sw.addEventListener('change', () => {
        if (state === 'running') { cancelAnimationFrame(raf); raf = 0; }
        if (state !== 'idle') {
          applyGates(false);
          reset(false);
          statusEl.textContent = sw.checked ? 'Back in line, and standing again. Tip the first one.' : `${d ? d.name : 'That milestone'} is off the tray. Tip the first domino and watch where the chain stops.`;
          return;
        }
        applyGates(true);
        statusEl.textContent = sw.checked ? `${d ? d.name : 'The milestone'} is back in line.` : `${d ? d.name : 'That milestone'} is off the tray. Tip the first domino and watch where the chain stops.`;
      });
      // pointing at a switch makes its domino hop, so the link between the two is visible
      const peek = on => { if (d) d.el.classList.toggle('is-peek', on && !motionOff()); };
      const lab = sw.closest('.pc-gate');
      lab.addEventListener('pointerenter', () => peek(true));
      lab.addEventListener('pointerleave', () => peek(false));
      sw.addEventListener('focus', () => peek(true));
      sw.addEventListener('blur', () => peek(false));
    });

    goBtn.addEventListener('click', go);
    resetBtn.addEventListener('click', () => reset(false));
    // the tray itself is the toy: tap it to tip the first domino, tap again to stand them up
    tray.addEventListener('click', () => { if (state === 'idle') go(); else if (state === 'done') reset(false); });

    /* ---------- layout now, on resize, and when the tray first comes into view (a little nudge invites a tap) */
    const relayout = () => {
      if (!layout()) return;
      if (state === 'running') { solveFinal(); finish(); }
      else if (state === 'done') { const s = stoppedAt; solveFinal(); stoppedAt = s; }
      else paintAll();
    };
    applyGates(false);
    relayout();
    let rw = tray.clientWidth;
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (tray.clientWidth !== rw) { rw = tray.clientWidth; relayout(); } }).observe(tray);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (state !== 'idle' || motionOff()) return;
        setTimeout(() => { if (state === 'idle') doms[0].el.classList.add('is-nudge'); }, 500);
      }), { threshold: 0.6 });
      io.observe(tray);
    }
    addEventListener('zs:motion', () => { if (motionOff() && state === 'running') { solveFinal(); finish(); } });
  }

  /* ================================================================ 2. Steps: keycap rolls, beads, the odometer */
  const dial = $('.pc-dial');
  const steps = $$('[data-pc-step]');
  if (steps.length && 'IntersectionObserver' in window) {
    const beads = dial ? $$('.pc-dial-beads li', dial) : [];
    const setStep = n => {
      steps.forEach(s => {
        const k = +s.dataset.pcStep;
        s.classList.toggle('is-current', k === n);
        if (k <= n) s.classList.add('is-seen');   // passing a step (or jumping past it) leaves its keycap rolled
      });
      if (dial) {
        const was = dial.style.getPropertyValue('--s');
        dial.style.setProperty('--s', n - 1); beads.forEach((b, i) => b.classList.toggle('is-on', i < n));
        if (was !== '' && +was !== n - 1 && dial.classList.contains('is-on') && !motionOff()) { dial.classList.remove('is-pop'); void dial.offsetWidth; dial.classList.add('is-pop'); }
      }
    };
    // a step already on screen at load shows its final state without rolling in
    steps.forEach(s => { const r = s.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) s.classList.add('is-seen'); });
    if (dial) dial.style.setProperty('--s', 0);
    const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(+e.target.dataset.pcStep); }), { rootMargin: '-40% 0px -50% 0px' });
    steps.forEach(s => sio.observe(s));

    /* below 1100px the odometer docks as an island inside the nav capsule: in the empty glass between the logo
       and the nav buttons, only when it fits there, and only while the steps pass under the nav */
    const navBar = $('.nav-bar'), logo = navBar && $('.logo', navBar), stepsBox = $('[data-pc-steps]');
    if (dial && navBar && logo && stepsBox) {
      const small = matchMedia('(max-width: 1099px)');
      let lio = null, raf = 0;
      const dock = () => {
        raf = 0;
        if (lio) { lio.disconnect(); lio = null; }
        dial.classList.remove('is-fit', 'has-label');
        if (!small.matches) { dial.classList.remove('is-on'); return; }
        const lr = logo.getBoundingClientRect(), nb = navBar.getBoundingClientRect();
        let right = nb.right;
        $$('a, button', navBar).forEach(el => {
          if (logo.contains(el)) return;
          const r = el.getBoundingClientRect();
          if (r.width && r.left > lr.right - 1 && r.left < right) right = r.left;
        });
        const room = right - lr.right - 14;
        dial.style.setProperty('--isl-x', ((lr.right + right) / 2).toFixed(1) + 'px');
        dial.classList.add('is-fit', 'has-label');
        if (dial.offsetWidth > room) dial.classList.remove('has-label');
        if (dial.offsetWidth > room) { dial.classList.remove('is-fit', 'is-on'); return; }
        // on while the steps box crosses the strip just under the nav
        const line = Math.round(nb.bottom + 6);
        lio = new IntersectionObserver(es => es.forEach(e => dial.classList.toggle('is-on', e.isIntersecting)),
          { rootMargin: `-${line}px 0px -${Math.max(0, innerHeight - line - 2)}px 0px` });
        lio.observe(stepsBox);
      };
      const later = () => { if (!raf) raf = requestAnimationFrame(dock); };
      dock();
      addEventListener('resize', later, { passive: true });
      document.fonts && document.fonts.ready && document.fonts.ready.then(later);
    }
  } else steps.forEach(s => s.classList.add('is-seen'));

  /* ---------- scroll helper: fn runs once per frame, only while the element is near the screen */
  const onScrollWhileVisible = (el, fn) => {
    let ticking = false, on = false;
    const tick = () => { ticking = false; fn(); };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting && !on) { on = true; addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll, { passive: true }); onScroll(); }
      else if (!e.isIntersecting && on) { on = false; removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); fn(); }
    }), { rootMargin: '10% 0px 10% 0px' });
    io.observe(el);
    addEventListener('zs:motion', onScroll);
  };
  const clamp01 = v => Math.max(0, Math.min(1, v));

  /* ================================================================ 3. Step art */
  // Develop: pale, flat paper as it enters at the bottom of the screen; full contrast by the middle
  const dev = $('[data-pc-dev]');
  if (dev && 'IntersectionObserver' in window) {
    const num = $('[data-pc-dev-n]', dev);
    const img = $('img', dev);
    let lastP = -1;
    const update = () => {
      let p = 1;
      if (!motionOff()) {
        const r = img.getBoundingClientRect();
        p = clamp01((innerHeight * 0.98 - r.top) / (innerHeight * 0.5));
      }
      p = Math.round(p * 100) / 100;
      if (p === lastP) return;
      lastP = p;
      dev.style.setProperty('--dev', p);
      num.textContent = Math.round(p * 100);
    };
    onScrollWhileVisible(dev, update);
    update();
  }
  // Launch: the test card powers on when it scrolls in; the Switch keycap turns it off and on again
  const tv = $('[data-pc-tv]');
  if (tv) {
    const btn = $('[data-pc-tv-btn]', tv), label = $('[data-pc-tv-l]', tv);
    const set = (on, animate) => {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      label.textContent = on ? 'live' : 'off';
      tv.classList.remove('is-on-anim', 'is-off-anim');
      const anim = animate && !motionOff();
      if (anim) { void tv.offsetWidth; tv.classList.add(on ? 'is-on-anim' : 'is-off-anim'); }
      if (on) tv.classList.remove('is-off');
      else if (!anim) tv.classList.add('is-off');
    };
    tv.addEventListener('animationend', e => {
      if (e.animationName === 'pcTvOff') { tv.classList.remove('is-off-anim'); tv.classList.add('is-off'); }
      if (e.animationName === 'pcTvOn') tv.classList.remove('is-on-anim');
    });
    btn.addEventListener('click', () => set(btn.getAttribute('aria-pressed') !== 'true', true));
    const r = tv.getBoundingClientRect();
    if (!motionOff() && 'IntersectionObserver' in window && r.top > innerHeight) {
      tv.classList.add('is-off');
      const tio = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        tio.disconnect();
        if (btn.getAttribute('aria-pressed') === 'true') set(true, true);
      }), { threshold: 0.55 });
      tio.observe(tv);
    }
    addEventListener('zs:motion', () => { if (motionOff()) { tv.classList.remove('is-on-anim', 'is-off-anim'); tv.classList.toggle('is-off', btn.getAttribute('aria-pressed') !== 'true'); } });
  }

  /* ================================================================ 4. Tape measure bars grow in */
  const tape = $('[data-pc-tape]');
  if (tape && 'IntersectionObserver' in window) {
    const r = tape.getBoundingClientRect();
    if (r.top > innerHeight) {
      tape.classList.add('is-armed');
      const tio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { tape.classList.add('is-in'); tio.disconnect(); } }), { threshold: 0.35 });
      tio.observe(tape);
    }
  }

  /* ================================================================ 5. Readiness list meter */
  const meter = $('[data-pc-meter]');
  const boxes = $$('.pc-pack input[type="checkbox"]');
  if (meter && boxes.length) {
    const n = $('[data-pc-ready]', meter), note = $('[data-pc-ready-note]', meter), segs = $$('.pc-meter-bar li', meter);
    const NOTES = ['Tick what you already have.', 'A good start.', 'Getting there.', 'More than half way.', 'One to go.', 'That’s everything. You’re ready for a kickoff call.'];
    const update = () => {
      const c = boxes.filter(b => b.checked).length;
      n.textContent = c; note.textContent = NOTES[c];
      segs.forEach((s, i) => s.classList.toggle('is-on', i < c));
    };
    boxes.forEach(b => b.addEventListener('change', update));
    update();
  }

  /* ================================================================ 6. Async relay */
  const relay = $('[data-pc-relay]');
  if (relay && 'IntersectionObserver' in window) {
    const path = $('.pc-relay-path', relay), trail = $('.pc-relay-trail', relay), plane = $('.pc-plane', relay);
    const legs = $$('.pc-relay-steps li', relay);
    const svg = $('svg', relay);
    let L = 0;
    try { L = path.getTotalLength(); } catch (e) { L = 0; }
    if (L) {
      let lastP = -1;
      const place = p => {
        const at = Math.min(L - 0.5, Math.max(0.5, p * L));
        const a = path.getPointAtLength(at - 0.5), b = path.getPointAtLength(at + 0.5), m = path.getPointAtLength(p * L);
        const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const bank = Math.sin(p * Math.PI * 2) * 6;   // a little bank into each turn
        plane.setAttribute('transform', `translate(${m.x.toFixed(2)} ${m.y.toFixed(2)}) rotate(${(ang + bank).toFixed(2)})`);
        trail.style.strokeDasharray = `${p.toFixed(4)} 1`;
        legs.forEach((li, i) => li.classList.toggle('is-on', p >= [0.02, 0.5, 0.985][i]));
      };
      const update = () => {
        let p = 1;
        if (!motionOff()) {
          const r = svg.getBoundingClientRect();
          // takes off as the drawing enters from the bottom, lands back home a little above the middle
          p = clamp01((innerHeight * 0.92 - r.top) / (innerHeight * 0.62));
        }
        p = Math.round(p * 1000) / 1000;
        if (p === lastP) return;
        lastP = p; place(p);
      };
      onScrollWhileVisible(relay, update);
      update();
    }
  }

  /* ================================================================ 7. Design: an example prototype you can tap through
     Three screens slide past inside the phone; the label says which one is showing. Motion off = the screen
     simply changes. Without JS the first screen shows and nothing pretends to be clickable. */
  const proto = $('[data-pc-proto]');
  if (proto) {
    const btn = $('[data-pc-proto-btn]', proto), num = $('[data-pc-proto-n]', proto);
    const total = $$('.pc-proto-scr', proto).length;
    let n = 0, tapT = 0;
    btn.addEventListener('click', () => {
      n = (n + 1) % total;
      proto.dataset.scr = String(n);
      if (num) num.textContent = String(n + 1);
      btn.setAttribute('aria-label', 'Example prototype, screen ' + (n + 1) + ' of ' + total + '. Press to go to the next screen.');
      if (!motionOff()) {
        proto.classList.remove('is-tap'); void proto.offsetWidth; proto.classList.add('is-tap');
        clearTimeout(tapT); tapT = setTimeout(() => proto.classList.remove('is-tap'), 650);
      }
    });
  }
})();
