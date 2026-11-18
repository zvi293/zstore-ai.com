// Signature component: Light Table — lift a mounted slide off a glowing table onto the projector (tap, keys or swipe), then drop it back into its slot.
/* Zstore AI — /work/ page behaviour (page-scoped, .wk- classes only). Also: the table's pointer-following lamp,
   concept prints that develop like instant film, and spec plates pulled into focus. Without JS the table is a plain
   grid of captioned figures; with Motion off / reduced motion every change is an instant swap and every print and
   plate is simply there. No history entries, no popups: the projector lives in the page. On phones (projector above
   the table) the slide lifts from under the finger while the page glides up to the projector, so the flight is
   always on screen. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOff = () => root.classList.contains('motion-off');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const EASE = 'cubic-bezier(.2,.9,.1,1)';
  const pad = n => String(n).padStart(2, '0');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ============================================================ Light Table */
  const lt = $('[data-wk-lt]');
  if (lt) lightTable(lt);

  function lightTable(lt) {
    const proj = $('.wk-proj', lt), screen = $('[data-wk-screen]', lt), shot = $('[data-wk-shot]', lt);
    const cap = $('[data-wk-cap]', lt), kEl = $('[data-wk-k]', lt), tEl = $('[data-wk-t]', lt), dEl = $('[data-wk-d]', lt), mEl = $('[data-wk-m]', lt);
    const countEl = $('[data-wk-count]', lt), live = $('[data-wk-live]', lt), table = $('[data-wk-table]', lt);
    const prevB = $('[data-wk-prev]', lt), nextB = $('[data-wk-next]', lt), backB = $('[data-wk-back]', lt);
    const slots = $$('.wk-slide', lt);
    if (!proj || !screen || !shot || !cap || !slots.length || getComputedStyle(proj).display === 'none') return;
    const N = slots.length;
    const txt = (el, s) => { const n = $(s, el); return n ? n.textContent.trim() : ''; };
    const data = slots.map((li, i) => {
      const img = $('img', li);
      return {
        li, img, mount: $('.wk-mount', li), idx: 'S/' + pad(i + 1),
        cat: txt(li, '.wk-cat'), did: txt(li, '.wk-did'), more: txt(li, '.wk-more'),
        src: img.getAttribute('src'), srcset: img.getAttribute('srcset'), alt: img.getAttribute('alt'),
        w: +img.getAttribute('width') || 2, h: +img.getAttribute('height') || 1
      };
    });

    // every slide becomes a real button (no-JS readers keep the plain figure)
    data.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wk-pick';
      b.setAttribute('aria-controls', 'wk-proj');
      b.setAttribute('aria-label', `${d.idx}, ${d.cat}`);
      b.addEventListener('click', () => pick(i));
      // the empty slot's label is real text, so it scales with the accessibility text sizes
      const k = document.createElement('span');
      k.className = 'wk-out-k'; k.setAttribute('aria-hidden', 'true'); k.textContent = 'On the projector';
      d.mount.appendChild(k);
      d.mount.appendChild(b); d.btn = b;
      d.img.draggable = false;
    });
    shot.draggable = false;
    lt.classList.add('wk-on');

    let cur = 0, busy = false;
    const mark = (i, out) => {
      const d = data[i]; if (!d) return;
      d.li.classList.toggle('is-out', out);
      if (out) d.btn.setAttribute('aria-current', 'true'); else d.btn.removeAttribute('aria-current');
    };
    const settle = i => {
      const li = data[i].li;
      li.classList.remove('is-back');
      if (motionOff()) return;
      void li.offsetWidth; li.classList.add('is-back');
      setTimeout(() => li.classList.remove('is-back'), 700);
    };
    const freshCaption = () => {
      if (motionOff()) return;
      cap.classList.remove('is-new'); void cap.offsetWidth; cap.classList.add('is-new');
    };
    const say = s => { live.textContent = ''; setTimeout(() => { live.textContent = s; }, 40); };
    // "Website design & development · Hebrew-language site": the language becomes its own chip, so it never breaks
    // at the hyphen on a phone (screen readers still hear one phrase)
    const setDid = s => {
      const [what, lang] = String(s).split(' · ');
      dEl.textContent = what;
      if (!lang) return;
      const sep = document.createElement('span'); sep.className = 'wk-sr'; sep.textContent = ', ';
      const chip = document.createElement('span'); chip.className = 'wk-lang'; chip.textContent = lang;
      dEl.append(sep, chip);
    };

    function fill(i) {
      const d = data[i];
      shot.removeAttribute('srcset');
      shot.src = d.src; shot.srcset = d.srcset; shot.alt = d.alt;
      shot.width = d.w; shot.height = d.h;
      kEl.textContent = `${d.idx} · Real website`;
      tEl.textContent = d.cat; setDid(d.did); mEl.textContent = d.more;
      countEl.textContent = `${d.idx} · ${pad(N)}`;
      proj.classList.remove('is-empty');
      backB.disabled = false;
      freshCaption();
    }
    function empty() {
      proj.classList.add('is-empty');
      [kEl.textContent, tEl.textContent, , mEl.textContent] = EMPTY; setDid(EMPTY[2]);
      countEl.textContent = `S/-- · ${pad(N)}`;
      backB.disabled = true;
      freshCaption();
    }
    // decode the projector-size image before it is shown, so a swap never flashes an empty screen
    const preload = d => {
      const im = new Image();
      im.sizes = shot.sizes || '(max-width: 1023px) 92vw, 760px';
      im.srcset = d.srcset; im.src = d.src;
      const p = im.decode ? im.decode().catch(() => {}) : Promise.resolve();
      return Promise.race([p, wait(1200)]);
    };
    const lit = () => {
      if (motionOff()) return;
      screen.classList.remove('is-lit'); void screen.offsetWidth; screen.classList.add('is-lit');
      setTimeout(() => screen.classList.remove('is-lit'), 750);
    };

    // geometry: the box an image really paints inside an object-fit: contain element
    const contain = (cx, cy, bw, bh, ar) => {
      let w = bw, h = bw / ar;
      if (h > bh) { h = bh; w = bh * ar; }
      return { cx, cy, w, h };
    };
    const boxOf = (el, ar) => {
      const r = el.getBoundingClientRect();
      // a rotated mount reports its axis-aligned bounds: keep the centre, use the unrotated layout size
      return contain(r.left + r.width / 2, r.top + r.height / 2, el.offsetWidth, el.offsetHeight, ar);
    };
    // a slot's resting tilt (its --wk-r), not the value mid-transition
    const rotOf = el => parseFloat(getComputedStyle(el).getPropertyValue('--wk-r')) || 0;
    const navBottom = () => { const n = $('.nav-bar'); return n ? Math.max(0, n.getBoundingClientRect().bottom) : 0; };

    // boxes are viewport boxes; with doc = true the copy is placed in page coordinates, so it can travel while the
    // page itself scrolls (phones: the slot is under the finger, the projector is above the fold)
    function fly(src, from, to, endRot, startRot, lift, doc) {
      const c = document.createElement('img');
      c.className = 'wk-fly'; c.alt = ''; c.setAttribute('aria-hidden', 'true'); c.decoding = 'sync';
      c.src = src;
      const L = to.cx - to.w / 2, T = to.cy - to.h / 2;
      Object.assign(c.style, { width: to.w + 'px', height: to.h + 'px' });
      if (doc) {
        c.style.position = 'absolute';
        c.style.left = (L + scrollX) + 'px'; c.style.top = (T + scrollY) + 'px';
        document.body.appendChild(c);
        // whatever the containing block, land exactly where the viewport box says
        const r = c.getBoundingClientRect();
        if (Math.abs(r.left - L) > .5 || Math.abs(r.top - T) > .5) { c.style.left = (L + scrollX - (r.left - L)) + 'px'; c.style.top = (T + scrollY - (r.top - T)) + 'px'; }
      } else {
        Object.assign(c.style, { left: L + 'px', top: T + 'px' });
        document.body.appendChild(c);
      }
      const s = from.w / to.w, dx = from.cx - to.cx, dy = from.cy - to.cy;
      const a = c.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${startRot}deg)`, boxShadow: '0 6px 12px -6px rgba(0,0,0,.35)', easing: EASE },
        { offset: .3, transform: `translate(${dx * .78}px, ${dy * .78 - lift}px) scale(${s * 1.16 + .06}) rotate(${-startRot * 1.6 + (endRot - startRot) * .3}deg)`, boxShadow: '0 44px 60px -22px rgba(0,0,0,.55)', easing: SPRING },
        { transform: `rotate(${endRot}deg)`, boxShadow: '0 18px 30px -12px rgba(0,0,0,.5)' }
      ], { duration: doc ? 900 : 780, fill: 'forwards' });
      return a.finished.catch(() => {}).then(() => c);
    }

    // where the page must scroll so the projector's screen is fully in view (null = it already is)
    function projTarget() {
      const r = proj.getBoundingClientRect(), nb = navBottom();
      const sr = screen.getBoundingClientRect();
      if (sr.top >= nb + 4 && sr.bottom <= innerHeight - 4) return null;
      return Math.max(0, Math.round(scrollY + r.top - nb - 12));
    }
    const glide = (top, instant) => scrollTo({ top, behavior: instant ? 'instant' : 'smooth' });
    const settled = () => new Promise(res => {
      let done = false;
      const fin = () => { if (done) return; done = true; removeEventListener('scrollend', fin); res(); };
      addEventListener('scrollend', fin, { once: true });
      setTimeout(fin, 750);
    });
    // bring the projector into view and wait (used when no flight runs, or the projector is sticky)
    function showProjector() {
      const t = projTarget();
      if (t === null) return Promise.resolve();
      if (motionOff()) { glide(t, true); return Promise.resolve(); }
      glide(t); return settled();
    }
    const isSticky = () => getComputedStyle(proj).position === 'sticky';

    async function pick(i) {
      if (busy) return;
      const d = data[i];
      if (i === cur) { await showProjector(); lit(); say(`${d.idx}, ${d.cat}, is already on the projector.`); return; }
      busy = true;
      const old = cur;
      try {
        // phones / tablets: the projector sits above the table. Instead of scrolling first (which would start the
        // flight off screen), the slide lifts from under the finger and flies while the page glides up to meet it.
        const target = projTarget();
        const travel = target !== null && !motionOff() && !isSticky();
        if (!travel) await showProjector();
        if (motionOff()) {
          if (old >= 0) mark(old, false);
          cur = i; mark(i, true); fill(i);
        } else {
          const ar = d.w / d.h;
          const from = boxOf(d.img, ar);
          const fromRot = rotOf(d.mount);
          const shotBox = boxOf(shot, ar);
          const ready = preload(d);
          let backFlight = Promise.resolve(null);
          if (old >= 0) {
            const od = data[old], oar = od.w / od.h;
            const sBox = boxOf(shot, oar);
            mark(old, false); // the slot gets its slide back (hidden while the copy lands)
            od.mount.style.visibility = 'hidden';
            const to = boxOf(od.img, oar);
            backFlight = fly(shot.currentSrc || shot.src, sBox, to, rotOf(od.mount), 0, 14, travel).then(c => { od.mount.style.visibility = ''; settle(old); c.remove(); });
          }
          proj.classList.add('is-landing');
          proj.classList.remove('is-empty');
          cur = i; mark(i, true);
          const landed = fly(d.img.currentSrc || d.img.src, from, shotBox, 0, fromRot, travel ? 30 : 46, travel);
          if (travel) glide(target);
          await ready;
          fill(i);
          const c = await landed;
          await (shot.decode ? shot.decode().catch(() => {}) : null);
          proj.classList.remove('is-landing');
          c.remove(); lit();
          await backFlight;
        }
        say(`${d.idx} of ${pad(N)} on the projector: ${d.cat}. ${d.did}.`);
      } finally { busy = false; proj.classList.remove('is-landing'); }
    }

    async function step(dir, fromX = 0) {
      if (busy) return;
      const n = cur < 0 ? (dir > 0 ? 0 : N - 1) : (cur + dir + N) % N;
      const d = data[n];
      busy = true;
      try {
        if (motionOff()) {
          if (cur >= 0) mark(cur, false);
          cur = n; mark(n, true); fill(n);
        } else {
          const ready = preload(d);
          if (cur >= 0) {
            const out = shot.animate([
              { transform: `translateX(${fromX}px) rotate(${fromX * .02}deg)`, opacity: 1 },
              { transform: `translateX(${-dir * 46}%) rotate(${-dir * 5}deg) scale(.9)`, opacity: 0 }
            ], { duration: 210, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
            await Promise.all([out.finished.catch(() => {}), ready]);
            mark(cur, false); settle(cur);
            cur = n; mark(n, true); fill(n);
            await (shot.decode ? shot.decode().catch(() => {}) : null);
            out.cancel();
          } else {
            await ready;
            cur = n; mark(n, true); fill(n);
          }
          shot.style.transform = '';
          await shot.animate([
            { transform: `translateX(${dir * 48}%) rotate(${dir * 6}deg) scale(.92)`, opacity: 0 },
            { offset: .25, opacity: 1 },
            { transform: 'none', opacity: 1 }
          ], { duration: 640, easing: SPRING }).finished.catch(() => {});
        }
        say(`${d.idx} of ${pad(N)} on the projector: ${d.cat}. ${d.did}.`);
      } finally { busy = false; shot.style.transform = ''; }
    }

    // where the page must scroll so a slot is fully in view (null = it already is)
    function slotTarget(li) {
      const r = li.getBoundingClientRect(), nb = navBottom();
      if (r.top >= nb + 4 && r.bottom <= innerHeight - 4) return null;
      return Math.max(0, Math.round(r.bottom > innerHeight - 4 ? scrollY + r.bottom - innerHeight + 16 : scrollY + r.top - nb - 12));
    }

    async function back() {
      if (busy || cur < 0) return;
      busy = true;
      const i = cur, d = data[i];
      try {
        if (motionOff()) {
          mark(i, false); cur = -1; empty();
        } else {
          const ar = d.w / d.h;
          const from = boxOf(shot, ar);
          mark(i, false);
          d.mount.style.visibility = 'hidden';
          const to = boxOf(d.img, ar);
          cur = -1;
          // the slot may be below the fold (phones): glide down with the slide instead of landing off screen
          const t = slotTarget(d.li);
          const travel = t !== null && !isSticky();
          const flight = fly(shot.currentSrc || shot.src, from, to, rotOf(d.mount), 0, 18, travel);
          if (travel) glide(t);
          empty();
          const c = await flight;
          d.mount.style.visibility = ''; settle(i); c.remove();
        }
        d.btn.focus({ preventScroll: true });
        const t2 = slotTarget(d.li);
        if (t2 !== null) glide(t2, motionOff());
        say(`${d.idx} is back on the table. The projector is empty.`);
      } finally { busy = false; }
    }

    prevB.addEventListener('click', () => step(-1));
    nextB.addEventListener('click', () => step(1));
    backB.addEventListener('click', back);

    // keyboard: arrows on the projector step through slides; arrows on the table move between slides
    lt.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (proj.contains(e.target) && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); step(k === 'ArrowRight' ? 1 : -1); return; }
      const b = e.target.closest && e.target.closest('.wk-pick');
      if (!b) return;
      const i = data.findIndex(d => d.btn === b);
      let n = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') n = Math.min(N - 1, i + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp') n = Math.max(0, i - 1);
      else if (k === 'Home') n = 0; else if (k === 'End') n = N - 1;
      if (n >= 0) { e.preventDefault(); data[n].btn.focus(); }
    });

    // swipe (touch, pen or a mouse drag) on the screen: the slide follows the finger, a flick changes it
    let pid = null, x0 = 0, y0 = 0, dx = 0, dragging = false;
    screen.addEventListener('pointerdown', e => {
      if (busy || cur < 0 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; dragging = false;
    });
    screen.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!dragging) {
        if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my) * 1.2) { dragging = true; try { screen.setPointerCapture(pid); } catch (err) {} }
        else if (Math.abs(my) > 10) { pid = null; return; }
      }
      if (dragging) { dx = mx; if (!motionOff()) shot.style.transform = `translateX(${dx}px) rotate(${dx * .02}deg)`; }
    });
    const endDrag = e => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > 56) { step(dx < 0 ? 1 : -1, motionOff() ? 0 : dx); return; }
      if (!motionOff() && dx) {
        const from = dx;
        shot.style.transform = '';
        shot.animate([{ transform: `translateX(${from}px) rotate(${from * .02}deg)` }, { transform: 'none' }], { duration: 520, easing: SPRING });
      } else shot.style.transform = '';
    };
    screen.addEventListener('pointerup', endDrag);
    screen.addEventListener('pointercancel', endDrag);
    screen.addEventListener('dragstart', e => e.preventDefault());

    // the table's lamp follows a fine pointer (motion on): a soft bright patch under the glass
    if (fine && table) {
      let raf = 0, px = 0, py = 0;
      table.addEventListener('pointermove', e => {
        if (motionOff()) return;
        const r = table.getBoundingClientRect();
        px = ((e.clientX - r.left) / r.width) * 100; py = ((e.clientY - r.top) / r.height) * 100;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; table.style.setProperty('--mx', px.toFixed(1) + '%'); table.style.setProperty('--my', py.toFixed(1) + '%'); });
      });
      table.addEventListener('pointerleave', () => { table.style.removeProperty('--mx'); table.style.removeProperty('--my'); });
    }

    // the caption keeps the height of its longest slide, so stepping through slides never makes the page jump
    const EMPTY = ['Projector · lamp on', 'Nothing projected', `${N} slides on the table`, 'Pick a slide on the table to see it at full size, or press Next slide to start from S/01.'];
    let capW = 0;
    function fitCaption() {
      const w = cap.offsetWidth; if (!w) return;
      capW = w;
      const els = [kEl, tEl, dEl, mEl], save = els.map(e => [...e.childNodes]);
      const put = t => els.forEach((e, j) => { if (e === dEl) setDid(t[j]); else e.textContent = t[j]; });
      cap.style.minHeight = '0px';
      let max = 0;
      [...data.map(d => [`${d.idx} · Real website`, d.cat, d.did, d.more]), EMPTY].forEach(t => {
        put(t);
        max = Math.max(max, cap.offsetHeight);
      });
      els.forEach((e, j) => { e.replaceChildren(...save[j]); });
      cap.style.minHeight = Math.ceil(max) + 'px';
    }
    setDid(dEl.textContent);
    fitCaption();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitCaption);
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (cap.offsetWidth !== capW) fitCaption(); }).observe(proj);

    mark(0, true);
  }

  /* ============================================================ arrivals: prints develop, plates pull into focus */
  // Both only run with motion on; with Motion off (or reduced motion) the prints and plates are simply there, and
  // switching motion off half-way finishes every one at once.
  function arrive(list, onCls, doneCls, opts) {
    if (!list || !('IntersectionObserver' in window) || motionOff()) return;
    const items = $$(opts.item, list);
    // anything already scrolled past (e.g. arriving from a #link) is shown finished, never left waiting
    const past = el => el.getBoundingClientRect().bottom < 0;
    list.classList.add(onCls);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting && !past(e.target)) return;
      e.target.classList.add(doneCls); io.unobserve(e.target);
    }), { threshold: opts.threshold, rootMargin: opts.margin });
    items.forEach(el => { if (past(el)) el.classList.add(doneCls); else io.observe(el); });
    addEventListener('zs:motion', () => { if (motionOff()) { io.disconnect(); items.forEach(el => el.classList.add(doneCls)); } });
  }
  /* ============================================================ in common: pager keys for the phone swipe row */
  const pts = $('[data-wk-focus]');
  if (pts) pager(pts);
  function pager(row) {
    const items = $$('.wk-pt', row);
    if (items.length < 2) return;
    const bar = document.createElement('div');
    bar.className = 'wk-pager';
    let cur = -1;
    const set = i => {
      if (i === cur) return; cur = i;
      keys.forEach((b, j) => { if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    };
    const keys = items.map((li, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wk-pg';
      const h = $('h3', li);
      b.setAttribute('aria-label', 'Show ' + pad(i + 1) + ': ' + (h ? h.textContent.trim() : ''));
      const k = document.createElement('span'); k.setAttribute('aria-hidden', 'true'); k.textContent = pad(i + 1);
      b.appendChild(k);
      b.addEventListener('click', () => {
        row.scrollTo({ left: li.offsetLeft - items[0].offsetLeft, behavior: motionOff() ? 'instant' : 'smooth' });
        set(i);
      });
      bar.appendChild(b);
      return b;
    });
    row.after(bar);
    set(0);
    // the keys only appear when the row really scrolls sideways (phones)
    const sync = () => bar.classList.toggle('is-on', row.scrollWidth > row.clientWidth + 4);
    sync();
    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(row);
    let raf = 0;
    row.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = row.scrollLeft;
        let best = 0, bd = Infinity;
        items.forEach((li, j) => { const d = Math.abs(li.offsetLeft - items[0].offsetLeft - x); if (d < bd) { bd = d; best = j; } });
        if (x + row.clientWidth >= row.scrollWidth - 4) best = items.length - 1;
        set(best);
      });
    }, { passive: true });
  }

  arrive($('.wk-cc-list'), 'wk-dev-on', 'is-dev', { item: '.wk-cc', threshold: .2, margin: '0px 0px -8% 0px' });
  arrive($('[data-wk-focus]'), 'wk-focus-on', 'is-sharp', { item: '.wk-pt', threshold: .2, margin: '-10% 0px -24% 0px' });
})();
