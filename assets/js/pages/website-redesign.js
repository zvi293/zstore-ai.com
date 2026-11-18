// Signature component: Refresh–Rebuild Dial — a glazed rotary knob with five detents shows what a redesign changes, keeps and requires at each depth.
/* Zstore AI: /services/website-redesign/ page behaviour (prefix rd-). Also: hero slab depth, a URL map whose
   301 wires draw with scroll, a process deck that deals into a staircase (one card at a time on phones), platform
   image depth, and the audit lock: six pins spring up to the shear line as the prep kit fills, then the shackle pops.
   Everything respects html.motion-off (final states, no springs) and works from the static HTML without JS. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOff = () => root.classList.contains('motion-off');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

  /* ------------------------------------------------------------ shared scroll loop (only for parts in view) */
  const scrollers = new Set();
  let ticking = false;
  const runScroll = () => { ticking = false; scrollers.forEach(fn => fn()); };
  const kick = () => { if (!ticking && scrollers.size) { ticking = true; requestAnimationFrame(runScroll); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick, { passive: true });
  const whileVisible = (el, fn, margin = '10% 0px') => {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { scrollers.add(fn); fn(); } else { scrollers.delete(fn); fn(); }
    }), { rootMargin: margin }).observe(el);
  };

  /* ------------------------------------------------------------ the dial */
  const dial = $('[data-rd-dial]');
  if (dial) {
    const face = $('[data-rd-face]', dial), knob = $('[data-rd-knob]', dial), turn = $('[data-rd-turn]', dial);
    const range = $('[data-rd-range]', dial), fill = $('[data-rd-fill]', dial);
    const dets = $$('[data-rd-set]', dial), levels = $$('.rd-level', dial);
    const mock = $('[data-rd-mock]', dial), tag = $('[data-rd-tag]', dial);
    const peb = $('[data-rd-pebbles]', dial), careV = $('[data-rd-care]', dial), live = $('[data-rd-live]', dial);
    const read = $('[data-rd-read]', dial);
    const readN = $('[data-rd-read-n]', dial), readName = $('[data-rd-read-name]', dial), readSum = $('[data-rd-read-sum]', dial), readMust = $('[data-rd-read-must]', dial);
    const flips = $$('[data-flip]', mock);
    const ANG = [-120, -60, 0, 60, 120];
    const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    const data = levels.map(li => ({
      name: li.dataset.name, care: li.dataset.care, tag: li.dataset.tag,
      sum: txt($('.rd-lv-sum', li)), must: txt($('.rd-lv-must span', li)),
      ch: $$('.rd-lv-ch li', li).map(txt), st: $$('.rd-lv-st li', li).map(txt)
    }));
    const nearest = deg => { let n = 0; ANG.forEach((d, i) => { if (Math.abs(d - deg) < Math.abs(ANG[n] - deg)) n = i; }); return n; };

    let level = clamp(+range.value || 0, 0, 4), a = ANG[level], v = 0, target = a, running = false, drag = null;
    let liveT = 0, flipT = 0, swapT = 0;

    const render = () => {
      turn.style.transform = `rotate(${a.toFixed(2)}deg)`;
      fill.style.strokeDasharray = `${clamp(a + 120, 0.001, 240).toFixed(2)} 400`;
    };
    const step = () => {
      const k = drag ? .3 : .15, d = drag ? .58 : .74;
      v = (v + (target - a) * k) * d;
      a += v;
      if (!drag && Math.abs(v) < .015 && Math.abs(target - a) < .04) { a = target; v = 0; running = false; render(); return; }
      render();
      requestAnimationFrame(step);
    };
    const go = () => {
      if (motionOff()) { a = target; v = 0; render(); return; }
      if (!running) { running = true; requestAnimationFrame(step); }
    };

    // FLIP the mock's pieces from where they are to their new grid places
    const morph = (n, prev) => {
      const animate = !motionOff() && mock.getClientRects().length > 0;
      const first = animate ? flips.map(el => el.getBoundingClientRect()) : null;
      if (animate) flips.forEach(el => { el.style.transition = 'none'; el.style.transform = ''; });
      mock.dataset.level = String(n);
      tag.textContent = data[n].tag;
      if (!motionOff()) { tag.classList.remove('is-pop'); void tag.offsetWidth; tag.classList.add('is-pop'); }
      if ((n === 4) !== (prev === 4) && !motionOff()) {
        clearTimeout(swapT); mock.classList.remove('is-swap'); void mock.offsetWidth; mock.classList.add('is-swap');
        swapT = setTimeout(() => mock.classList.remove('is-swap'), 750);
      }
      if (!animate) return;
      const moved = [];
      flips.forEach((el, i) => {
        const f = first[i], l = el.getBoundingClientRect();
        if (!l.width || !l.height || !f.width || !f.height) return;
        const dx = f.left - l.left, dy = f.top - l.top, sx = f.width / l.width, sy = f.height / l.height;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        moved.push(el);
      });
      void mock.offsetWidth;
      moved.forEach((el, i) => {
        el.style.transition = `transform .75s ${SPRING} ${Math.min(i, 10) * 14}ms, background-color .45s, border-radius .45s, opacity .35s, scale .45s ${SPRING}`;
        el.style.transform = '';
      });
      clearTimeout(flipT);
      flipT = setTimeout(() => flips.forEach(el => { el.style.transition = ''; el.style.transformOrigin = ''; }), 1000);
    };

    // the level name is already spoken by the range (aria-valuetext) or the pressed button: the summary skips it
    const announce = n => {
      const d = data[n];
      live.textContent = `${d.sum} Changes: ${d.ch.join(', ')}. Stays the same: ${d.st.join(', ')}. Must do: ${d.must}`;
    };
    const valueText = n => `${data[n].name}, ${n + 1} of 5`;

    const setLevel = (n, opt = {}) => {
      n = clamp(n, 0, 4);
      if (n === level) return;
      const prev = level;
      level = n;
      range.value = String(n);
      range.setAttribute('aria-valuetext', valueText(n));
      dets.forEach((b, i) => b.setAttribute('aria-pressed', String(i === n)));
      levels.forEach((li, i) => li.classList.toggle('is-on', i === n));
      peb.dataset.on = String(n + 1);
      careV.textContent = data[n].care;
      if (read) {
        readN.textContent = `0${n + 1}`; readName.textContent = data[n].name; readSum.textContent = data[n].sum; readMust.textContent = data[n].must;
        if (!motionOff()) { read.classList.remove('is-tick'); void read.offsetWidth; read.classList.add('is-tick'); }
      }
      morph(n, prev);
      if (opt.click && !motionOff()) { knob.classList.remove('is-click'); void knob.offsetWidth; knob.classList.add('is-click'); }
      // a tiny detent tick on phones, only once the page may vibrate (no console intervention before a first tap)
      if (opt.buzz && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) { try { navigator.vibrate(6); } catch (e) { /* not allowed */ } }
      clearTimeout(liveT);
      liveT = setTimeout(() => announce(n), opt.quiet ? 700 : 250);
    };
    knob.addEventListener('animationend', () => knob.classList.remove('is-click'));
    tag.addEventListener('animationend', () => tag.classList.remove('is-pop'));
    if (read) read.addEventListener('animationend', e => { if (e.target === read.lastElementChild) read.classList.remove('is-tick'); });

    // keyboard (arrows, Home/End, PageUp/PageDown) through the native range input
    // (arrow keys step quickly: the spoken summary waits until the user settles on a level)
    range.addEventListener('input', () => { const n = +range.value; setLevel(n, { click: true, quiet: true }); target = ANG[n]; go(); });
    // the ring on the knob shows for keyboard focus only (focus that follows a press on the dial stays quiet)
    let pointerFocus = false;
    range.addEventListener('focus', () => { let kb = !pointerFocus; try { kb = kb && range.matches(':focus-visible'); } catch (e) { /* old engine */ } face.classList.toggle('is-kb', kb); });
    range.addEventListener('keydown', () => face.classList.add('is-kb'));
    range.addEventListener('blur', () => face.classList.remove('is-kb'));

    // tap a detent label
    dets.forEach(b => b.addEventListener('click', () => { const n = +b.dataset.rdSet; setLevel(n, { click: true }); target = ANG[n]; go(); }));

    // circular drag on the knob (or, with a mouse, press anywhere on the dial ring to swing the pointer there).
    // On touch only the knob grabs: the rest of the face is left to scroll the page (CSS: touch-action pan-y).
    const centre = () => { const r = knob.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
    const angleAt = (x, y, c) => Math.atan2(x - c.x, c.y - y) * 180 / Math.PI; // 0 = straight up, clockwise positive
    const soft = raw => {
      const c = clamp(raw, -120, 120), over = raw - c;
      const pull = (ANG[nearest(c)] - c) * .32;  // a little magnet toward each detent: it feels notched
      return c + pull + Math.sign(over) * Math.min(14, Math.abs(over) * .3);
    };
    face.addEventListener('pointerdown', e => {
      if (e.button || drag || e.target.closest('[data-rd-set]')) return;
      const c = centre(), dist = Math.hypot(e.clientX - c.x, e.clientY - c.y);
      if (dist > c.r * 1.75) return;
      const onKnob = dist <= c.r * 1.06, p = angleAt(e.clientX, e.clientY, c);
      if (e.pointerType === 'touch' && !onKnob) return;
      drag = { id: e.pointerId, c, last: p, raw: onKnob ? a : clamp(p, -135, 135), onKnob, moved: false, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
      try { face.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      face.classList.add('is-drag');
      pointerFocus = true; range.focus({ preventScroll: true }); pointerFocus = false;
      face.classList.remove('is-kb');
      if (!onKnob) { target = soft(drag.raw); const n = nearest(clamp(drag.raw, -120, 120)); if (n !== level) setLevel(n, { click: true, quiet: true }); go(); }
      e.preventDefault();
    });
    face.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const c = drag.c, p = angleAt(e.clientX, e.clientY, c);
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < c.r * .22) { drag.last = p; return; } // too close to the centre to read an angle
      let dl = p - drag.last;
      if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
      drag.last = p;
      drag.raw = clamp(drag.raw + dl, -170, 170);
      target = soft(drag.raw);
      const n = nearest(clamp(drag.raw, -120, 120));
      if (n !== level) setLevel(n, { click: true, buzz: drag.touch, quiet: true });
      go();
    });
    const end = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      let n = nearest(clamp(drag.raw, -120, 120));
      if (drag.onKnob && !drag.moved && e && e.type === 'pointerup') n = (level + 1) % 5; // a plain tap on the knob turns it one notch
      drag = null;
      face.classList.remove('is-drag');
      setLevel(n, { click: true });
      target = ANG[n];
      go();
    };
    face.addEventListener('pointerup', end);
    face.addEventListener('pointercancel', end);
    face.addEventListener('lostpointercapture', end);

    addEventListener('zs:motion', () => { if (motionOff()) { a = target; v = 0; running = false; render(); } });
    range.setAttribute('aria-valuetext', valueText(level));
    render();
  }

  /* ------------------------------------------------------------ hero: the "before" slab drifts as the hero scrolls away */
  const art = $('[data-rd-art]');
  if (art) {
    const hero = art.closest('.ph');
    const upd = () => {
      if (motionOff()) { art.style.removeProperty('--rd-p'); return; }
      const r = hero.getBoundingClientRect();
      art.style.setProperty('--rd-p', clamp(-r.top / Math.max(1, r.height * .6), 0, 1).toFixed(3));
    };
    whileVisible(hero, upd, '0px');
  }

  /* ------------------------------------------------------------ URL map: wires draw with scroll, 301 beads pop on landing */
  const map = $('[data-rd-map]');
  if (map) {
    const rows = $$('.rd-map-row', map);
    const paths = rows.map(r => $('path', r));
    const track = map.closest('.rd-seo-grid') || map;
    const upd = () => {
      if (motionOff()) { map.classList.remove('is-armed'); return; }
      map.classList.add('is-armed');
      const sticky = getComputedStyle(map).position === 'sticky';
      const t = (sticky ? track : map).getBoundingClientRect(), vh = innerHeight;
      const p = clamp((vh * .85 - t.top) / (vh * .3 + t.height * (sticky ? .55 : 1)), 0, 1);
      const n = rows.length;
      rows.forEach((row, i) => {
        const local = clamp((p - (i / n) * .78) / .3, 0, 1);
        paths[i].style.setProperty('--d', (1 - local).toFixed(3));
        row.classList.toggle('is-done', local > .97);
      });
    };
    whileVisible(map, upd, '20% 0px');
    addEventListener('zs:motion', upd);
  }

  /* ------------------------------------------------------------ process: the deck deals out into a staircase
     Wide screens: the four cards wait stacked on the first one and deal out in turn. Phones (one column): each card
     waits a little low and tilted, and drops into place when it reaches the reader, so the motion happens on screen. */
  const stairs = $('[data-rd-stairs]');
  if (stairs && 'IntersectionObserver' in window && !motionOff()) {
    const cards = [...stairs.children];
    const first = cards[0].getBoundingClientRect();
    const narrow = matchMedia('(max-width: 767px)').matches;
    const clear = c => { c.style.translate = ''; c.style.rotate = ''; };
    const w = innerWidth;
    if (narrow) {
      const waiting = cards.filter(c => c.getBoundingClientRect().top > innerHeight);
      waiting.forEach(c => {
        const side = cards.indexOf(c) % 2 ? 1 : -1;
        c.style.translate = `${side * 22}px 64px`;
        c.style.rotate = `${side * 3.5}deg`;
      });
      const drop = (c, instant) => {
        if (!instant) { c.classList.add('is-drop'); setTimeout(() => c.classList.remove('is-drop'), 1000); }
        clear(c);
      };
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) { io.unobserve(e.target); drop(e.target, !e.isIntersecting || motionOff()); }
      }), { rootMargin: '0px 0px -10% 0px' });
      waiting.forEach(c => io.observe(c));
      const bail = () => { io.disconnect(); waiting.forEach(c => drop(c, true)); removeEventListener('resize', onResize); };
      const onResize = () => { if (innerWidth !== w) bail(); };
      addEventListener('resize', onResize, { passive: true });
      addEventListener('zs:motion', () => { if (motionOff()) bail(); });
    } else if (first.top > innerHeight) {
      const deal = instant => {
        stairs.classList.remove('is-stacked');
        if (!instant) stairs.classList.add('is-dealing');
        cards.forEach(clear);
        setTimeout(() => { stairs.classList.remove('is-dealing'); cards.forEach(c => { c.style.removeProperty('--rd-i'); c.style.zIndex = ''; }); }, instant ? 0 : 1600);
      };
      stairs.classList.add('is-stacked');
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--rd-i', i);
        c.style.zIndex = String(cards.length - i);
        if (!i) return;
        c.style.translate = `${(first.left - r.left).toFixed(1)}px ${(first.top - r.top + i * 6).toFixed(1)}px`;
        c.style.rotate = `${(i % 2 ? 2.5 : -2) * i * .6}deg`;
      });
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) { io.disconnect(); deal(!e.isIntersecting || motionOff()); }
      }), { rootMargin: '0px 0px -28% 0px' });
      io.observe(cards[0]);
      const bail = () => { io.disconnect(); deal(true); removeEventListener('resize', onResize); };
      const onResize = () => { if (innerWidth !== w) bail(); };
      addEventListener('resize', onResize, { passive: true });
      addEventListener('zs:motion', () => { if (motionOff()) bail(); });
    }
  }

  /* ------------------------------------------------------------ platform image: three depth layers */
  const depth = $('[data-rd-depth]');
  if (depth) {
    const upd = () => {
      if (motionOff()) { depth.style.removeProperty('--rd-y'); return; }
      const r = depth.getBoundingClientRect(), vh = innerHeight;
      depth.style.setProperty('--rd-y', clamp(((r.top + r.height / 2) - vh / 2) / vh, -1, 1).toFixed(3));
    };
    whileVisible(depth, upd, '10% 0px');
  }

  /* ------------------------------------------------------------ the audit lock: one pin per thing to gather
     The static list becomes six toggle buttons. Each one lifts its own pin to the shear line; when all six are
     set, the keyhole turns and the shackle pops open. The count is spoken through a polite live region. */
  const kit = $('[data-rd-kit]'), lock = $('[data-rd-lock]');
  if (kit && lock) {
    const pins = $$('.rd-pins i', lock);
    const out = $('[data-rd-count]', lock), nOut = $('[data-rd-lock-n]', lock);
    const words = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    const btns = $$('li', kit).map((li, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rd-kit-i'; b.setAttribute('aria-pressed', 'false');
      const n = document.createElement('span'); n.className = 'rd-kit-n'; n.setAttribute('aria-hidden', 'true'); n.textContent = `0${i + 1}`;
      const t = document.createElement('span'); t.className = 'rd-kit-t'; t.textContent = li.textContent.trim();
      const r = document.createElement('span'); r.className = 'rd-kit-s'; r.setAttribute('aria-hidden', 'true'); r.textContent = 'Ready';
      b.append(n, t, r);
      li.replaceChildren(b);
      return b;
    });
    out.setAttribute('aria-live', 'polite');
    const upd = () => {
      const on = btns.map(b => b.getAttribute('aria-pressed') === 'true'), n = on.filter(Boolean).length, all = n === btns.length;
      pins.forEach((p, i) => p.classList.toggle('is-set', !!on[i]));
      nOut.textContent = all ? 'Open' : `${n}/${btns.length}`;
      lock.classList.toggle('is-open', all);
      out.textContent = all ? 'All six ready. The lock is open: bring them to our first call.' : `${words[n]} of six ready.`;
    };
    btns.forEach(b => b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); upd(); }));
  }
})();
