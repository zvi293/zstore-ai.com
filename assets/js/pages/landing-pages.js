// Signature component: Page in Order — reorder a landing page's sections until each one answers the visitor's next question.
/* /services/landing-pages/ page script (prefix lp-). Vanilla, no dependencies; touches only this page's DOM.
   Also runs the page's smaller living touches: the mono slug decode, the landing stickers, the pull-out cards,
   the folded leaflet (spring fallback where CSS scroll-driven animations are missing) and the load order player. Motion off (html.motion-off, which boot.js also sets for
   prefers-reduced-motion) = final states, no travel. Without JS the HTML already reads as the finished page. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const quiet = () => root.classList.contains('motion-off');
  const hasIO = 'IntersectionObserver' in window;
  const later = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  const finals = [];   // what to do when Motion is switched off mid-way

  /* ------------------------------------------------------------ 1. mono slug: characters decode into place */
  const flap = $('[data-lp-flap]');
  if (flap && !quiet()) {
    const text = flap.textContent;
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
    const vis = document.createElement('span'); vis.className = 'lp-flap-vis'; vis.setAttribute('aria-hidden', 'true');
    const glyphs = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789/+';
    let t0 = 0, last = 0, done = false;
    const finish = () => { if (done) return; done = true; flap.textContent = text; };
    const tick = now => {
      if (done) return;
      if (!t0) { t0 = now; flap.textContent = ''; flap.append(sr, vis); }
      if (now - last >= 45) {
        last = now;
        let out = '', settled = true;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (c === ' ' || c === '·' || now - t0 > 180 + i * 32) out += c;
          else { out += glyphs[(Math.random() * glyphs.length) | 0]; settled = false; }
        }
        vis.textContent = out;
        if (settled) return finish();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    finals.push(finish);
  }

  /* ------------------------------------------------------------ 2. "right tool for" stickers drop and land */
  const fits = $('[data-lp-land]');
  if (fits && hasIO && !quiet() && fits.getBoundingClientRect().top > innerHeight * .9) {
    [...fits.children].forEach((li, i) => li.style.setProperty('--i', i));
    fits.classList.add('is-armed');
    const o = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      fits.classList.remove('is-armed'); fits.classList.add('is-landed'); o.disconnect();
    }), { rootMargin: '0px 0px -14% 0px' });
    o.observe(fits);
    finals.push(() => { o.disconnect(); fits.classList.remove('is-armed'); });
  }

  /* ------------------------------------------------------------ 3. conversion cards pulled from the black stack */
  const pulls = $('[data-lp-pulls]');
  if (pulls && hasIO && !quiet()) {
    const items = $$('.lp-pull', pulls);
    pulls.classList.add('is-armed');
    items.forEach(li => { if (li.getBoundingClientRect().top < innerHeight * .82) li.classList.add('is-out'); });
    const o = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-out'); o.unobserve(e.target);
    }), { rootMargin: '0px 0px -16% 0px' });
    items.forEach(li => { if (!li.classList.contains('is-out')) o.observe(li); });
    finals.push(() => { o.disconnect(); pulls.classList.remove('is-armed'); });
  }

  /* ------------------------------------------------------------ 3b. phones: the seven rules become a swipeable deck
     CSS turns the list into a sideways scroller below 768px; this adds the keys, the counter and the track, and makes
     the scroller focusable for keyboards. Wider screens keep the plain list (the nav stays hidden by CSS). */
  if (pulls) {
    const cards = $$('.lp-pull', pulls);
    const mq = matchMedia('(max-width: 767px)');
    const nav = document.createElement('div');
    nav.className = 'lp-deck-nav';
    nav.innerHTML = '<button type="button" class="lp-deck-btn" aria-label="Previous rule">←</button>' +
      '<div class="lp-deck-meter" aria-hidden="true"><p class="lp-deck-n">Rule <b>01</b> of ' + String(cards.length).padStart(2, '0') + '</p><span class="lp-deck-track"><i></i></span></div>' +
      '<button type="button" class="lp-deck-btn lp-deck-btn-next" aria-label="Next rule">→</button>';
    pulls.after(nav);
    const [prev, next] = $$('.lp-deck-btn', nav), num = $('.lp-deck-n b', nav);
    let idx = -1, raf = 0;
    const gap = () => cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1;
    const show = i => {
      if (i === idx) return; idx = i;
      num.textContent = String(i + 1).padStart(2, '0');
      nav.style.setProperty('--p', cards.length > 1 ? i / (cards.length - 1) : 0);
      prev.disabled = i === 0; next.disabled = i === cards.length - 1;
    };
    const read = () => {
      raf = 0;
      const max = pulls.scrollWidth - pulls.clientWidth;
      show(pulls.scrollLeft >= max - 4 ? cards.length - 1 : Math.min(cards.length - 1, Math.round(pulls.scrollLeft / gap())));
    };
    pulls.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(read); }, { passive: true });
    const go = d => {
      const t = Math.max(0, Math.min(cards.length - 1, idx + d));
      pulls.scrollTo({ left: cards[t].offsetLeft - cards[0].offsetLeft, behavior: quiet() ? 'auto' : 'smooth' });
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    const mode = () => {
      if (mq.matches) { pulls.tabIndex = 0; pulls.setAttribute('aria-label', 'Seven rules, scroll sideways'); }
      else { pulls.removeAttribute('tabindex'); pulls.removeAttribute('aria-label'); }
      read();
    };
    if (mq.addEventListener) mq.addEventListener('change', mode); else mq.addListener(mode);
    mode();
  }

  /* ------------------------------------------------------------ 4. the leaflet unfolds panel by panel
     Where CSS scroll-driven animations exist, the CSS scrubs each panel with the scroll and this does nothing.
     Elsewhere a spring settles each panel flat as it comes into view. */
  const fold = $('[data-lp-fold]');
  const scrubbed = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  if (fold && hasIO && !scrubbed && !quiet()) {
    const leaves = $$('.lp-leaf', fold);
    fold.classList.add('is-armed');
    leaves.forEach(l => { if (l.getBoundingClientRect().top < innerHeight * .9) l.classList.add('is-flat'); });
    const o = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-flat'); o.unobserve(e.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    leaves.forEach(l => { if (!l.classList.contains('is-flat')) o.observe(l); });
    finals.push(() => { o.disconnect(); fold.classList.remove('is-armed'); });
  }

  /* ------------------------------------------------------------ 5. the load order, step by step
     Stage n draws: 1 = every block's space reserved (dashed), 2 = the largest element, 3 = the rest, 4 = tags.
     It plays once when it comes into view (Motion on); the step keys show any stage, in any mode. */
  const load = $('[data-lp-load]');
  if (load) {
    const blocks = $$('.lp-b', load);
    const steps = $$('[data-lp-steps] li', load);
    const keys = steps.map(li => {
      const span = $('.lp-step', li), b = document.createElement('button');
      b.type = 'button'; b.className = 'lp-step';
      b.setAttribute('aria-pressed', 'false');
      while (span.firstChild) b.appendChild(span.firstChild);
      span.replaceWith(b);
      return b;
    });
    let stage = 4, timer = 0;
    const draw = (n, pour) => {
      const prev = stage; stage = n;
      load.dataset.stage = String(n);
      blocks.forEach(el => {
        const s = +el.dataset.s;
        el.classList.toggle('is-off', n < 1 || (s === 4 && n < 4));
        el.classList.toggle('is-res', n >= 1 && s !== 4 && n < s);
        if (pour && n >= s && prev < s && !quiet()) {
          el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
        }
      });
      keys.forEach((k, i) => k.classList.toggle('is-lit', i < n));
    };
    const press = n => keys.forEach((k, i) => k.setAttribute('aria-pressed', String(i === n - 1)));
    const play = () => {
      clearTimeout(timer);
      draw(0, false); press(0);
      let n = 0;
      const next = () => { n++; draw(n, true); press(n); if (n < 4) timer = setTimeout(next, n === 1 ? 900 : 760); };
      timer = setTimeout(next, 260);
    };
    keys.forEach((k, i) => k.addEventListener('click', () => {
      clearTimeout(timer);
      draw(i + 1, true); press(i + 1);
    }));
    draw(4, false); press(4);
    if (hasIO && !quiet() && load.getBoundingClientRect().top > innerHeight * .6) {
      draw(0, false); press(0);
      const o = new IntersectionObserver(es => { if (es[0].isIntersecting) { o.disconnect(); later(play); } }, { threshold: .45 });
      o.observe(load);
      finals.push(() => { o.disconnect(); clearTimeout(timer); draw(4, false); press(4); });
    }
  }

  /* ------------------------------------------------------------ 6. signature: Page in Order */
  const po = $('[data-lp-order]');
  if (po) {
    const list = $('.lp-slots', po);
    const slots = $$('.lp-slot', list);
    const N = slots.length;
    const live = $('[data-lp-live]', po);
    const countEl = $('[data-lp-count]', po);
    const beads = $$('.lp-beads li', po);
    const showBtn = $('[data-lp-show]', po);
    const shuffleBtn = $('[data-lp-shuffle]', po);
    const radios = $$('input[name="lp-aud"]', po);
    const AUD = { cold: 'Cold traffic', warm: 'Warm audience' };
    let aud = 'cold', shown = false, drag = null;
    const hitBefore = new WeakMap();

    const tiles = () => slots.map(s => $('.lp-tile', s));
    const nameOf = t => $('.lp-name', t).textContent.trim();
    const target = t => +t.dataset[aud];                       // 1-based suggested position for this audience
    const question = i => slots[i].dataset[aud === 'cold' ? 'qCold' : 'qWarm'];

    let liveTimer = 0;
    const announce = msg => { live.textContent = ''; clearTimeout(liveTimer); liveTimer = setTimeout(() => { live.textContent = msg; }, 60); };

    // move keys + a screen-reader status per slot
    const arrow = d => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d < 0 ? 'M3.5 10 8 5.5 12.5 10' : 'M3.5 6 8 10.5 12.5 6');
      svg.appendChild(p); return svg;
    };
    tiles().forEach(t => {
      const box = document.createElement('span'); box.className = 'lp-moves';
      [-1, 1].forEach(d => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'lp-mv'; b.dataset.dir = d;
        b.setAttribute('aria-label', `Move ${nameOf(t)} ${d < 0 ? 'up' : 'down'}`);
        b.appendChild(arrow(d)); box.appendChild(b);
      });
      t.appendChild(box);
    });
    slots.forEach(s => { const st = document.createElement('span'); st.className = 'sr'; st.dataset.lpSt = ''; $('.lp-q', s).appendChild(st); });

    const setQuestions = () => slots.forEach((s, i) => { $('.lp-qt', s).textContent = question(i); });

    const sync = (quietSeat = false) => {
      let ok = 0;
      slots.forEach((s, i) => {
        const t = $('.lp-tile', s), hit = target(t) === i + 1;
        if (hit) ok++;
        s.classList.toggle('is-ok', hit);
        $('[data-lp-st]', s).textContent = hit ? ', answered' : '';
        if (hit && !hitBefore.get(t) && !quietSeat && !quiet()) {
          t.classList.remove('is-seat'); void t.offsetWidth; t.classList.add('is-seat');
          setTimeout(() => t.classList.remove('is-seat'), 480);
        }
        hitBefore.set(t, hit);
        const [up, down] = $$('.lp-mv', t);
        up.setAttribute('aria-disabled', String(i === 0));
        down.setAttribute('aria-disabled', String(i === N - 1));
      });
      countEl.textContent = ok;
      beads.forEach((b, i) => b.classList.toggle('is-on', i < ok));
      po.classList.toggle('is-done', ok === N);
      return ok;
    };

    // put the tiles into the slots in this order; FLIP so each one glides (with a spring) from where it was
    const place = (order, stagger = false, animate = true) => {
      const anim = animate && !quiet();
      const focused = document.activeElement && po.contains(document.activeElement) ? document.activeElement : null;
      const before = new Map();
      if (anim) order.forEach(t => before.set(t, t.getBoundingClientRect().top));
      order.forEach((t, i) => { if (t.parentNode !== slots[i]) slots[i].appendChild(t); });
      order.forEach(t => { t.classList.remove('is-glide', 'is-flip'); t.style.transform = ''; t.style.transitionDelay = ''; });
      if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
      if (!anim) return;
      const moved = [];
      order.forEach((t, i) => {
        const dy = before.get(t) - t.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        t.style.transform = `translateY(${dy.toFixed(1)}px)`;
        if (stagger) t.style.transitionDelay = `${i * 40}ms`;
        moved.push(t);
      });
      if (!moved.length) return;
      void list.offsetHeight;
      moved.forEach(t => { t.classList.add('is-flip'); t.style.transform = ''; });
      setTimeout(() => moved.forEach(t => { t.classList.remove('is-flip'); t.style.transitionDelay = ''; }), 700 + N * 40);
    };

    const report = (t, j) => {
      const ok = sync();
      const hit = target(t) === j + 1;
      let msg = `${nameOf(t)} moved to position ${j + 1} of ${N}.`;
      if (hit) msg += ` It answers “${question(j)}”`;
      msg += ` ${ok} of ${N} in order.`;
      if (ok === N) msg += ' Every question is answered in order: that page is ready to launch.';
      announce(msg);
    };

    const move = (t, dir) => {
      const order = tiles(), i = order.indexOf(t), j = i + dir;
      if (j < 0 || j >= N) return;
      [order[i], order[j]] = [order[j], order[i]];
      place(order);
      report(t, j);
    };

    const derange = () => {
      const cur = tiles();
      for (let n = 0; n < 60; n++) {
        const o = cur.slice();
        for (let i = o.length - 1; i > 0; i--) { const k = (Math.random() * (i + 1)) | 0; [o[i], o[k]] = [o[k], o[i]]; }
        if (o.every((t, i) => target(t) !== i + 1) && o.some((t, i) => t !== cur[i])) return o;
      }
      return cur.slice(1).concat(cur[0]);
    };

    const setShown = on => {
      shown = on;
      po.classList.toggle('is-shown', on);
      showBtn.setAttribute('aria-pressed', String(on));
    };

    // ---- buttons and keys
    list.addEventListener('click', e => {
      const b = e.target.closest('.lp-mv'); if (!b) return;
      if (b.getAttribute('aria-disabled') === 'true') return;
      move(b.closest('.lp-tile'), +b.dataset.dir);
    });
    list.addEventListener('keydown', e => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const t = e.target.closest('.lp-tile'); if (!t) return;
      e.preventDefault();
      move(t, e.key === 'ArrowUp' ? -1 : 1);
    });
    showBtn.addEventListener('click', () => {
      if (shown) { setShown(false); announce('Reasons hidden. The order stays as it is.'); return; }
      const order = tiles().slice().sort((a, b) => target(a) - target(b));
      place(order, true);
      setShown(true);
      sync();
      announce(`My order for ${AUD[aud].toLowerCase()}: ${order.map(nameOf).join(', ')}. Each section now shows why it sits there.`);
    });
    shuffleBtn.addEventListener('click', () => {
      setShown(false);
      place(derange(), true);
      const ok = sync(true);
      announce(`Shuffled. ${ok} of ${N} in order. Move the sections to answer each question.`);
    });
    radios.forEach(r => r.addEventListener('change', () => {
      if (!r.checked) return;
      aud = r.value; po.dataset.aud = aud;
      setQuestions();
      if (shown) place(tiles().slice().sort((a, b) => target(a) - target(b)), true);
      const ok = sync();
      announce(`${AUD[aud]}: the questions changed. ${ok} of ${N} sections answer theirs.`);
    }));

    // ---- drag: mouse anywhere on a tile; touch and pen by the section icon, so the page still scrolls
    const clearGlide = () => tiles().forEach(t => { if (!drag || t !== drag.t) { t.classList.remove('is-glide'); } });
    list.addEventListener('pointerdown', e => {
      const t = e.target.closest('.lp-tile');
      if (!t || drag || e.button > 0 || e.target.closest('.lp-mv')) return;
      if (e.pointerType !== 'mouse' && !e.target.closest('.lp-sk')) return;
      e.preventDefault();
      const order = tiles();
      // rects in page coordinates, so the page can scroll under a drag (edge auto-scroll) without breaking the maths
      drag = { t, id: e.pointerId, y0: e.clientY + scrollY, cy: e.clientY, from: order.indexOf(t), to: order.indexOf(t), order, rects: order.map(x => ({ top: x.getBoundingClientRect().top + scrollY })), moved: false, touch: e.pointerType !== 'mouse', raf: 0 };
      try { t.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      if (drag.touch) { drag.moved = true; t.classList.add('is-drag'); t.style.transform = 'scale(1.03) rotate(-.6deg)'; }
    });
    const navSpace = () => { const v = parseFloat(getComputedStyle(root).getPropertyValue('--nav-space')); return isNaN(v) ? 72 : v; };
    const update = () => {
      const dy = drag.cy + scrollY - drag.y0, r = drag.rects, f = drag.from;
      if (!drag.moved) { if (Math.abs(dy) < 5) return; drag.moved = true; drag.t.classList.add('is-drag'); }
      const lo = r[0].top - r[f].top - 14, hi = r[N - 1].top - r[f].top + 14;
      const y = Math.max(lo, Math.min(hi, dy));
      drag.t.style.transform = `translateY(${y.toFixed(1)}px) scale(1.03) rotate(-.6deg)`;
      const top = r[f].top + y;
      let to = f, best = Infinity;
      r.forEach((rr, k) => { const d = Math.abs(rr.top - top); if (d < best) { best = d; to = k; } });
      if (to === drag.to) return;
      drag.to = to;
      if (drag.touch && navigator.vibrate) { try { navigator.vibrate(6); } catch (err) { /* optional */ } }
      drag.order.forEach((x, k) => {
        if (x === drag.t) return;
        let s = 0;
        if (f < to && k > f && k <= to) s = r[k - 1].top - r[k].top;
        else if (f > to && k < f && k >= to) s = r[k + 1].top - r[k].top;
        x.classList.toggle('is-glide', !quiet());
        x.style.transform = s ? `translateY(${s.toFixed(1)}px)` : '';
      });
    };
    // near the top or bottom edge of the screen the page scrolls along, faster the closer the finger gets
    const EDGE = 72;
    const edgeSpeed = () => {
      if (!drag || !drag.moved) return 0;
      const topZone = navSpace() + EDGE, y = drag.cy;
      if (y < topZone) return -Math.min(18, 3 + (topZone - y) * .22);
      if (y > innerHeight - EDGE) return Math.min(18, 3 + (y - (innerHeight - EDGE)) * .22);
      return 0;
    };
    const roll = () => {
      if (!drag) return;
      const v = edgeSpeed();
      if (!v) { drag.raf = 0; return; }
      const before = scrollY;
      scrollBy(0, v);
      if (scrollY !== before) update();
      drag.raf = requestAnimationFrame(roll);
    };
    list.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.cy = e.clientY;
      update();
      if (drag && !drag.raf && edgeSpeed()) drag.raf = requestAnimationFrame(roll);
    });
    const drop = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const { t, from, to, order, moved, raf } = drag;
      if (raf) cancelAnimationFrame(raf);
      drag = null;
      t.classList.remove('is-drag');
      if (!moved || from === to) {
        clearGlide();
        order.forEach(x => { x.classList.add('is-flip'); x.style.transform = ''; });
        setTimeout(() => order.forEach(x => x.classList.remove('is-flip')), 650);
        return;
      }
      const next = order.slice(); next.splice(from, 1); next.splice(to, 0, t);
      place(next);
      report(t, to);
    };
    list.addEventListener('pointerup', drop);
    list.addEventListener('pointercancel', drop);
    list.addEventListener('lostpointercapture', e => { if (drag && e.pointerId === drag.id) drop(e); });

    // ---- the shared floating WhatsApp bead would sit on the move keys at the phone's right edge: it steps aside
    //      while the phone is on screen (page-scoped: a class on <html> that landing-pages.css keys off)
    //      (the load-order step keys further down get the same courtesy: they run full width at the bottom right too)
    if (hasIO) {
      const near = new Set();
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) near.add(e.target); else near.delete(e.target); });
        root.classList.toggle('lp-fab-off', near.size > 0);
      });
      [$('.lp-phone', po), $('[data-lp-steps]'), $('.lp-deck-nav')].forEach(el => { if (el) io.observe(el); });
    }

    // ---- start: live, reasons tucked away, sections shuffled so nothing answers its question yet
    po.classList.add('lp-live');
    const byKey = Object.fromEntries(tiles().map(t => [t.dataset.key, t]));
    place(['proof', 'cta', 'headline', 'objections', 'image', 'how', 'offer'].map(k => byKey[k]), false, false);
    setQuestions();
    sync(true);
  }

  /* ------------------------------------------------------------ Motion switched off mid-way: jump to final states */
  if (finals.length && 'MutationObserver' in window) {
    new MutationObserver(() => { if (quiet()) finals.forEach(f => f()); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
})();
