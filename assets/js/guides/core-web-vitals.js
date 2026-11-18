// Signature component: Catch the Button — load an example page as a slow site or a tuned one and tap "Order ahead" the moment it appears; on the slow site a late widget shoves the button out from under your thumb and a busy main thread makes the tap wait, while three gauges score the run's own LCP, INP and CLS.
/* /guides/core-web-vitals/ page script (prefixes .cwv-, .cwv-ct-, .cwv-m-). Vanilla, no dependencies; touches only this
   page's own DOM. Also runs the page's smaller living touches: the three-channel vitals monitor that sweeps while in
   view, the 75th-percentile line-up (twenty visits sort themselves into a bar chart; one more slow visit tips the
   score) and the image that drops into its reserved slot. Everything enhances content that is readable without JS
   (the demo's step-by-step lists, the value chips, the static figure). Motion off (html.motion-off: the site toggle or
   prefers-reduced-motion) and the a11y widget's paused animations = final states, no movement.
   Honesty: LCP comes from the demo's own load timeline, INP is timed with a real clock; CLS applies the layout-shift formula
   (impact fraction × distance fraction, largest session window) to how far the example page's content really moved. */
(() => {
  'use strict';
  const root = document.documentElement;
  const still = () => root.classList.contains('motion-off') || root.classList.contains('a11y-noauto');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const now = () => performance.now();

  /* ---------------------------------------------------------------- one observer for the page's reveals */
  const seen = new Map();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const fn = seen.get(e.target);
        if (fn) fn(e.isIntersecting, e);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: [0, 0.25] })
    : null;
  const watch = (el, fn) => { if (!el) return; if (io) { seen.set(el, fn); io.observe(el); } else fn(true); };

  /* ---------------------------------------------------------------- the vitals monitor: sweep while in view */
  const mon = $('[data-cwv-mon]');
  watch(mon, (on, e) => { if (on && (!e || e.intersectionRatio >= 0.25)) { mon.classList.add('is-live'); io && io.unobserve(mon); } });

  /* ---------------------------------------------------------------- the reserved slot: the image drops into place */
  const slot = $('[data-cwv-slot]');
  watch(slot, (on, e) => { if (on && (!e || e.intersectionRatio >= 0.25)) { slot.classList.add('is-in'); io && io.unobserve(slot); } });

  /* ---------------------------------------------------------------- the 75th-percentile line-up */
  const p75 = $('[data-p75]');
  if (p75) {
    const row = $('[data-p75-row]', p75);
    const pin = $('[data-p75-pin]', p75);
    const pinV = $('[data-p75-pin-v]', p75);
    const btn = $('[data-p75-btn]', p75);
    const live = $('[data-p75-live]', p75);
    const chart = $('.cwv-p75-chart', p75);
    const items = $$('li', row);
    const MAX = 5.6; const LIMIT = 2.5;
    const base = items.map((li) => parseFloat(li.dataset.v));
    const tipIdx = items.findIndex((li) => li.classList.contains('is-p75')); // the visit we can slow down
    const TIPPED = 2.9;
    let tipped = false;
    // a fixed shuffle so the "before" order is the same every time
    const scramble = [11, 3, 17, 7, 0, 14, 19, 5, 9, 2, 16, 12, 6, 18, 1, 10, 15, 4, 13, 8];
    chart.style.setProperty('--lim', String(LIMIT / MAX));
    btn.hidden = false;

    const values = () => items.map((li, i) => (tipped && i === tipIdx ? TIPPED : base[i]));
    const rankOf = () => { // sorted position of every item (stable)
      const v = values();
      return v.map((x, i) => i).sort((a, b) => v[a] - v[b] || a - b).reduce((acc, item, pos) => { acc[item] = pos; return acc; }, []);
    };
    const paint = (order) => { // order[i] = visual slot of item i
      const v = values();
      items.forEach((li, i) => {
        li.style.order = String(order[i]);
        li.style.setProperty('--h', String(Math.min(1, v[i] / MAX)));
        li.classList.toggle('is-slow', v[i] > LIMIT);
        $('span', li).textContent = v[i].toFixed(1);
      });
    };
    const placePin = () => {
      const rank = rankOf();
      const v = values();
      const p = rank.indexOf(14); // the item now in the 15th slot
      items.forEach((li, i) => li.classList.toggle('is-p75', i === p));
      const w = row.clientWidth; const n = items.length; const gap = 3;
      const bw = (w - gap * (n - 1)) / n;
      pin.style.setProperty('--px', ((14 * (bw + gap) + bw / 2) / w * 100) + '%');
      pin.style.setProperty('--ph', String(Math.min(1, v[p] / MAX)));
      const val = v[p];
      const verdict = val <= 2.5 ? 'Good' : val <= 4 ? 'Needs improvement' : 'Poor';
      pinV.textContent = val.toFixed(1) + ' s · ' + verdict;
      return { val, verdict, slow: v.filter((x) => x > LIMIT).length };
    };
    // FLIP: measure, reorder, play back from the old spots with a spring
    const flip = (order) => {
      const first = items.map((li) => li.getBoundingClientRect().left);
      paint(order);
      if (still()) return;
      items.forEach((li, i) => {
        const dx = first[i] - li.getBoundingClientRect().left;
        if (!dx) return;
        li.style.transition = 'none';
        li.style.transform = 'translateX(' + dx + 'px)';
      });
      row.getBoundingClientRect();
      items.forEach((li) => { li.style.transition = ''; li.style.transform = ''; });
    };
    const sorted = () => rankOf();
    // before it scrolls in: scrambled (motion on only); once in view: it sorts itself
    if (!still()) { paint(scramble); pin.style.opacity = '0'; } else { row.classList.add('is-sorted'); paint(sorted()); }
    placePin();
    let done = false;
    const sortNow = () => {
      if (done) return; done = true;
      row.classList.add('is-sorted');
      flip(sorted());
      placePin();
      setTimeout(() => { pin.style.opacity = ''; }, still() ? 0 : 700);
    };
    watch(p75, (on, e) => { if (on && (!e || e.intersectionRatio >= 0.25)) { sortNow(); io && io.unobserve(p75); } });
    btn.addEventListener('click', () => {
      sortNow();
      tipped = !tipped;
      btn.setAttribute('aria-pressed', String(tipped));
      flip(sorted());
      const r = placePin();
      live.textContent = tipped
        ? 'One more visit slowed down to ' + TIPPED.toFixed(1) + ' seconds. Now ' + r.slow + ' of 20 visits are slower than 2.5 seconds, and the 75th percentile is ' + r.val.toFixed(1) + ' seconds: ' + r.verdict.toLowerCase() + '. One visit made the difference.'
        : 'The 15th of 20 visits, the 75th percentile, took ' + r.val.toFixed(1) + ' seconds: ' + r.verdict.toLowerCase() + ', even though ' + r.slow + ' visits were slower than 2.5 seconds.';
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => placePin()).observe(row);
  }

  /* ================================================================ Catch the Button (signature) */
  const ct = $('[data-ct]');
  if (!ct) return;
  const view = $('[data-ct-view]', ct);
  const page = $('[data-ct-page]', ct);
  const go = $('[data-ct-go]', ct);
  const goL = $('[data-ct-go-l]', ct);
  const clock = $('[data-ct-clock]', ct);
  const live = $('[data-ct-live]', ct);
  const loadBar = $('[data-ct-load]', ct);
  const thread = $('[data-ct-thread]', ct);
  const track = $('[data-ct-track]', ct);
  const nowLine = $('[data-ct-now]', ct);
  const ghost = $('[data-ct-ghost]', ct);
  const touch = $('[data-ct-touch]', ct);
  const toast = $('[data-ct-toast]', ct);
  const modes = $$('[data-ct-mode]', ct);
  const order = $('[data-ct-hit="order"]', page);
  const SCALE = 5000; // the main-thread track shows five seconds

  // the two timelines (ms from "Load the page")
  const TL = {
    slow: { text: 900, font: 1300, promo: 2000, hero: 3200, end: 4300, tasks: [[900, 1600], [2000, 2700], [3200, 4300]], idle: 240, label: 'Slow site' },
    tuned: { text: 450, hero: 1000, promo: 1100, end: 1400, tasks: [[1150, 1220]], idle: 40, label: 'Tuned site' },
  };
  const NAMES = { order: 'Order ahead', promo: "Today's specials", hero: "This week's loaves" };
  let mode = 'slow';
  let run = null;
  let pd = null; // pending pointer press
  let pending = 0; // a start waiting for the auto-scroll
  let viaKeys = false;
  const hero = $('[data-ct-hit="hero"]', page);
  const promo = $('[data-ct-hit="promo"]', page);

  const say = (t, cls) => { live.textContent = t; live.classList.toggle('is-miss', cls === 'miss'); live.classList.toggle('is-hit', cls === 'hit'); };
  const verdict = (m, v) => {
    const [g, n] = m === 'lcp' ? [2500, 4000] : m === 'inp' ? [200, 500] : [0.1, 0.25];
    return v <= g ? 'good' : v <= n ? 'ni' : 'poor';
  };
  const VERD = { good: 'Good', ni: 'Needs improvement', poor: 'Poor' };
  const fmt = {
    lcp: (v) => (v / 1000).toFixed(2),
    inp: (v) => String(Math.round(v)),
    cls: (v) => v.toFixed(3),
  };
  const gauge = (m, v) => {
    const g = $('[data-g="' + m + '"]', ct);
    const vEl = $('[data-g-v]', g); const sEl = $('[data-g-s]', g); const bead = $('[data-g-bead]', g);
    if (v == null) { g.removeAttribute('data-verdict'); vEl.textContent = '—'; sEl.textContent = m === 'inp' && run && run.ended && !run.tapT ? 'No tap' : 'Waiting'; return; }
    const vd = verdict(m, v);
    g.dataset.verdict = vd;
    vEl.textContent = fmt[m](v);
    sEl.textContent = VERD[vd];
    // bead: each third of the band is one verdict, placed proportionally inside it
    const [a, b, c] = m === 'lcp' ? [2500, 4000, 6000] : m === 'inp' ? [200, 500, 800] : [0.1, 0.25, 0.4];
    const p = v <= a ? (v / a) / 3 : v <= b ? (1 + (v - a) / (b - a)) / 3 : (2 + Math.min(1, (v - b) / (c - b))) / 3;
    bead.style.setProperty('--p', String(Math.max(0.02, Math.min(0.98, p))));
  };
  const resetGauges = () => ['lcp', 'inp', 'cls'].forEach((m) => gauge(m, null));

  // CLS: impact fraction × distance fraction per shift; the score is the largest session window
  // (shifts less than 1 s apart, window at most 5 s), as Chrome reports it.
  const movers = () => $$('[data-m]', page);
  const rects = (els) => els.map((el) => el.getBoundingClientRect());
  const shiftScore = (before, after, vr) => {
    let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity; let dist = 0;
    before.forEach((b, i) => {
      const a = after[i];
      if (!b.width || !b.height || !a.width || !a.height) return; // new or removed elements aren't "unstable"
      const dx = a.left - b.left; const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      dist = Math.max(dist, Math.abs(dx), Math.abs(dy));
      [b, a].forEach((r) => {
        x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
      });
    });
    if (!dist) return 0;
    const ix = Math.max(0, Math.min(x2, vr.right) - Math.max(x1, vr.left));
    const iy = Math.max(0, Math.min(y2, vr.bottom) - Math.max(y1, vr.top));
    const impact = (ix * iy) / (vr.width * vr.height);
    return impact * (dist / Math.max(vr.width, vr.height));
  };
  const cls = (shifts) => {
    let best = 0; let sum = 0; let start = -1; let last = -1;
    shifts.forEach((s) => {
      if (start < 0 || s.t - last >= 1000 || s.t - start >= 5000) { sum = 0; start = s.t; }
      sum += s.score; last = s.t; best = Math.max(best, sum);
    });
    return best;
  };

  // apply a state change to the example page, measuring how far the content moved
  const step = (cls_, at) => {
    if (!run) return;
    const els = movers();
    const visible = page.classList.contains('is-text');
    const before = visible ? rects(els) : null;
    const ob = order.getBoundingClientRect();
    page.classList.add(cls_);
    if (!visible) return;
    const vr = view.getBoundingClientRect();
    const after = rects(els);
    const score = shiftScore(before, after, vr);
    const recent = run.tapT != null && at >= run.tapT && at - run.tapT < 500;
    if (score > 0 && !recent) {
      run.shifts.push({ t: at, score });
      gauge('cls', cls(run.shifts));
      const oa = order.getBoundingClientRect();
      if (Math.abs(oa.top - ob.top) > 2) {
        ghost.style.left = (ob.left - vr.left) + 'px'; ghost.style.top = (ob.top - vr.top) + 'px';
        ghost.style.width = ob.width + 'px'; ghost.style.height = ob.height + 'px';
        ghost.classList.remove('is-on'); void ghost.offsetWidth; ghost.classList.add('is-on');
      }
      if (!still()) { view.classList.remove('is-jolt'); void view.offsetWidth; view.classList.add('is-jolt'); }
    }
  };

  const clearRun = () => {
    if (!run) return;
    run.timers.forEach(clearTimeout);
    cancelAnimationFrame(run.raf);
    run = null;
  };
  const resetStage = () => {
    clearTimeout(pending); pending = 0;
    clearRun(); pd = null;
    hero.disabled = false; promo.disabled = false;
    page.className = 'cwv-ct-page is-' + mode;
    view.classList.remove('is-running', 'is-ran', 'is-jolt');
    thread.classList.remove('is-running');
    $$('.cwv-ct-th-task, .cwv-ct-th-tap, .cwv-ct-th-wait', track).forEach((n) => n.remove());
    ghost.classList.remove('is-on'); touch.className = 'cwv-m-touch'; toast.className = 'cwv-m-toast'; toast.textContent = '';
    order.classList.remove('is-pressed');
    loadBar.classList.remove('is-done'); loadBar.style.setProperty('--load', '0');
    clock.textContent = '0.00';
    nowLine.style.setProperty('--now', '0px');
    resetGauges();
  };

  const pct = (ms) => Math.min(100, (ms / SCALE) * 100);
  const drawTasks = () => {
    TL[mode].tasks.forEach(([a, b]) => {
      const t = document.createElement('span');
      t.className = 'cwv-ct-th-task';
      t.style.left = pct(a) + '%'; t.style.width = (pct(b) - pct(a)) + '%';
      t.dataset.a = a; t.dataset.b = b;
      track.insertBefore(t, nowLine);
    });
  };

  const tick = () => {
    if (!run) return;
    const t = now() - run.t0;
    clock.textContent = (t / 1000).toFixed(2);
    const T = TL[mode];
    loadBar.style.setProperty('--load', String(Math.min(1, t / T.end)));
    nowLine.style.setProperty('--now', (Math.min(1, t / SCALE) * track.clientWidth) + 'px');
    $$('.cwv-ct-th-task', track).forEach((n) => {
      const a = +n.dataset.a; const b = +n.dataset.b;
      n.style.setProperty('--grow', String(Math.max(0, Math.min(1, (t - a) / (b - a)))));
    });
    if (!run.ended || !run.settled) run.raf = requestAnimationFrame(tick);
  };

  const start = () => {
    resetStage();
    const T = TL[mode];
    run = { t0: now(), timers: [], shifts: [], lcp: null, tapT: null, inp: null, hit: null, ended: false, settled: false, raf: 0, forced: false };
    const at = (ms, fn) => run.timers.push(setTimeout(fn, ms));
    view.classList.add('is-running');
    thread.classList.add('is-running');
    drawTasks();
    // tuned: the reserved slots hold space but aren't controls until their content arrives
    if (mode === 'tuned') { hero.disabled = true; promo.disabled = true; }
    go.classList.add('is-down');
    setTimeout(() => go.classList.remove('is-down'), 160);
    goL.textContent = 'Loading…';
    const keys = viaKeys ? ' Keyboard: press Shift+Tab to reach Order ahead, then Enter.' : '';
    say((mode === 'slow' ? 'Loading the slow site. Order ahead appears in under a second: tap it as soon as you see it.' : 'Loading the tuned site. Tap Order ahead as soon as you see it.') + keys);
    at(T.text, () => { page.classList.add('is-text'); });
    if (mode === 'slow') at(T.font, () => step('is-font', T.font));
    at(T.promo, () => { promo.disabled = false; if (!page.classList.contains('is-promo')) step('is-promo', T.promo); });
    at(T.hero, () => { hero.disabled = false; step('is-hero', T.hero); if (run) { run.lcp = T.hero; gauge('lcp', run.lcp); } });
    at(T.end, () => { if (!run) return; loadBar.classList.add('is-done'); run.ended = true; if (!run.tapT) say('The page has finished loading. Tap Order ahead to finish the run.'); maybeFinish(); });
    at(12000, () => { if (run && !run.tapT) finish(); });
    run.raf = requestAnimationFrame(tick);
  };

  // a tap lands: work out what it hit, make it wait as long as the main thread is busy, then respond
  const respond = (hitEl, tAbs, point) => {
    if (!run || run.tapT != null || run.settled || !page.classList.contains('is-text') || hitEl.disabled) return;
    const name = hitEl.dataset.ctHit;
    const T = TL[mode];
    const t = tAbs - run.t0;
    run.tapT = t; run.hit = name;
    const vr = view.getBoundingClientRect();
    const hb = hitEl.getBoundingClientRect();
    const px = point ? point.x - vr.left : hb.left - vr.left + hb.width / 2;
    const py = point ? point.y - vr.top : hb.top - vr.top + hb.height / 2;
    touch.style.left = px + 'px'; touch.style.top = py + 'px';
    touch.className = 'cwv-m-touch is-on';
    const busy = T.tasks.find(([a, b]) => t >= a && t < b);
    const wait = busy ? busy[1] - t + 90 : T.idle;
    run.busy = !!busy;
    if (wait > 120) touch.classList.add('is-wait');
    // the tap and the wait on the main-thread track
    const tap = document.createElement('span'); tap.className = 'cwv-ct-th-tap'; tap.style.left = pct(t) + '%';
    const w = document.createElement('span'); w.className = 'cwv-ct-th-wait'; w.style.left = pct(t) + '%'; w.style.width = (pct(t + wait) - pct(t)) + '%';
    track.insertBefore(w, nowLine); track.insertBefore(tap, nowLine);
    if (wait > 120) say('Tapped. Waiting for the page to respond…');
    run.timers.push(setTimeout(() => {
      if (!run) return;
      touch.classList.remove('is-wait');
      if (name === 'order') { order.classList.add('is-pressed'); toast.textContent = 'Order started. Pick a time for pickup.'; toast.className = 'cwv-m-toast is-on'; }
      else { toast.textContent = NAMES[name] + ' opened. Not what you meant?'; toast.className = 'cwv-m-toast is-on is-miss'; }
      // the next frame is the "next paint"; a timer backs it up when frames are throttled (background tab)
      let measured = false;
      const measure = (fallback) => {
        if (measured || !run) return; measured = true;
        run.inp = document.hidden || fallback ? wait + 16 : now() - tAbs;
        gauge('inp', run.inp);
        maybeFinish();
      };
      requestAnimationFrame(() => measure(false));
      run.timers.push(setTimeout(() => measure(true), 120));
    }, wait));
  };

  const maybeFinish = () => { if (run && run.ended && run.inp != null) run.timers.push(setTimeout(finish, 350)); };

  const finish = () => {
    if (!run || run.settled) return;
    run.ended = true; run.settled = true;
    const r = { lcp: run.lcp, inp: run.inp, cls: cls(run.shifts), hit: run.hit, forced: run.forced };
    gauge('lcp', r.lcp); gauge('cls', r.cls); gauge('inp', r.inp);
    view.classList.remove('is-running'); view.classList.add('is-ran');
    thread.classList.remove('is-running');
    goL.textContent = 'Run it again';
    // the runs table
    const tr = $('[data-ct-row="' + mode + '"]', ct);
    const cells = $$('td', tr);
    cells[0].textContent = r.lcp != null ? fmt.lcp(r.lcp) + ' s' : '—';
    cells[1].textContent = r.inp != null ? fmt.inp(r.inp) + ' ms' : '—';
    cells[2].textContent = fmt.cls(r.cls);
    cells[3].textContent = !r.hit ? 'No tap' : r.hit === 'order' ? 'Caught Order ahead' : 'Missed: opened ' + NAMES[r.hit];
    $$('tr', tr.parentNode).forEach((x) => x.classList.toggle('is-new', x === tr));
    // the verdict, in words
    const v = (m, x) => VERD[verdict(m, x)].toLowerCase();
    const scores = 'LCP ' + fmt.lcp(r.lcp) + ' seconds, ' + v('lcp', r.lcp) + '. ' +
      (r.inp != null ? 'INP ' + fmt.inp(r.inp) + ' milliseconds, ' + v('inp', r.inp) + '. ' : 'INP: no tap recorded. ') +
      'CLS ' + fmt.cls(r.cls) + ', ' + v('cls', r.cls) + '.';
    let lead;
    if (!r.hit) lead = 'No tap this time.';
    else if (r.hit !== 'order') lead = r.forced
      ? 'Missed. The specials widget loaded right above the button just as your thumb came down, so you opened ' + NAMES[r.hit] + ' instead.'
      : mode === 'tuned' ? 'You opened ' + NAMES[r.hit] + ' instead of Order ahead.' : 'Missed. The button had moved, and you opened ' + NAMES[r.hit] + ' instead.';
    else if (mode === 'slow') lead = r.inp > 200 ? 'Caught it, but the page took ' + fmt.inp(r.inp) + ' ms to react, ' + (run.busy ? 'because third-party scripts were busy on the main thread' : 'because its tap handler does too much work before it shows anything') + '. That wait is a big part of what INP measures.' : 'Caught it.';
    else lead = 'Caught it. The button stayed put and reacted in ' + fmt.inp(r.inp) + ' ms.';
    const next = mode === 'slow' && !$('[data-ct-row="tuned"] td', ct).textContent.match(/\d/) ? ' Now try the tuned site.' : '';
    say(lead + ' ' + TL[mode].label + ': ' + scores + next, r.hit && r.hit !== 'order' ? 'miss' : r.hit ? 'hit' : '');
    cancelAnimationFrame(run.raf);
    clock.textContent = r.hit ? ((run.tapT) / 1000).toFixed(2) : clock.textContent;
  };

  // pointer taps: the press is resolved where the finger is AFTER any shift it triggered
  view.addEventListener('pointerdown', (e) => {
    if (!run || run.tapT != null || run.settled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (!page.classList.contains('is-text')) return;
    const t = now();
    const hit = e.target.closest('[data-ct-hit]');
    // the classic: a late widget lands right above the button a split second before the tap
    if (mode === 'slow' && hit === order && !page.classList.contains('is-promo')) {
      const at = Math.max(0, t - run.t0 - 16);
      run.forced = true;
      step('is-promo', at);
    }
    pd = { id: e.pointerId, x: e.clientX, y: e.clientY, t };
  });
  view.addEventListener('pointerup', (e) => {
    if (!pd || e.pointerId !== pd.id) return;
    const p = pd; pd = null;
    if (!run || run.tapT != null) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) return; // a scroll, not a tap
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const hit = el && el.closest('[data-ct-hit]');
    if (hit && page.contains(hit) && getComputedStyle(hit).visibility === 'visible') respond(hit, p.t, { x: e.clientX, y: e.clientY });
    else {
      touch.style.left = (e.clientX - view.getBoundingClientRect().left) + 'px';
      touch.style.top = (e.clientY - view.getBoundingClientRect().top) + 'px';
      touch.className = 'cwv-m-touch is-on';
    }
  });
  view.addEventListener('pointercancel', () => { pd = null; });
  // keyboard (and any click the pointer path didn't take): Enter or Space on a focused button in the example page
  view.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-ct-hit]');
    if (!hit) return;
    e.preventDefault();
    if (!run || run.tapT != null || e.detail !== 0) return;
    respond(hit, now(), null);
  });

  go.addEventListener('click', (e) => {
    viaKeys = e.detail === 0;
    const r = ct.querySelector('.cwv-ct-phone').getBoundingClientRect();
    const vh = window.innerHeight;
    const navH = 76;
    if (r.top < navH || r.bottom > vh - 8) {
      ct.querySelector('.cwv-ct-phone').scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' });
      resetStage();
      say('Get ready…');
      pending = setTimeout(() => { pending = 0; start(); }, still() ? 60 : 520);
    } else start();
  });

  modes.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.ctMode === mode && !run) return;
    mode = b.dataset.ctMode;
    modes.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    resetStage();
    goL.textContent = 'Load the page';
    say((mode === 'slow' ? 'Slow site' : 'Tuned site') + ' selected. Press Load the page, then tap Order ahead as soon as it appears.');
  }));

  resetStage();
})();
