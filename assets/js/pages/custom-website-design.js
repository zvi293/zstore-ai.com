// Signature component: Exploded Build — a ceramic-Z slider pulls a finished page apart into its six build layers, each slab on its own spring.
/* /services/custom-website-design/ page script (prefix .cwd-). Also runs the page's smaller living touches:
   self-drawing order chains, the self-ticking work order, the week ruler, the 1.2-second load bar, the pressed
   keys and the mini CMS headline swap. Motion off / reduced motion → final states, no springs, no autoplay. */
(function () {
  'use strict';
  var root = document.documentElement;
  var motionOff = function () { return root.classList.contains('motion-off'); };
  var hasIO = 'IntersectionObserver' in window;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };

  /* a fast fling (or a jump link) can carry an element past the viewport between two frames, so its observer never
     fires; a light scroll sweep finishes anything that is already above the screen */
  var late = [], sweepRaf = 0;
  function onSweep() {
    if (sweepRaf) return;
    sweepRaf = requestAnimationFrame(function () {
      sweepRaf = 0;
      late = late.filter(function (p) { if (p.el.getBoundingClientRect().bottom < 0) { p.done(); return false; } return true; });
      if (!late.length) removeEventListener('scroll', onSweep);
    });
  }
  function finishIfPassed(el, done) {
    if (!late.length) addEventListener('scroll', onSweep, { passive: true });
    late.push({ el: el, done: done });
  }

  /* ------------------------------------------------------------ Exploded Build */
  var box = $('[data-xb]');
  if (box) explodedBuild(box);

  function explodedBuild(box) {
    var range = $('.cwd-range', box);
    var status = $('.cwd-status', box);
    var stage = $('.cwd-stage', box);
    var pin = $('.cwd-pin', box) || stage;
    var ends = $$('[data-xb-to]', box);
    var items = $$('.cwd-layers > li', box);
    var names = items.map(function (li) { return $('.cwd-lt', li).textContent; });
    var N = names.length, STEP = 10, MAX = N * STEP, LIFT = 12, TIGHT = 0.34, SIN = Math.sin(55 * Math.PI / 180);
    // it opens on the overview (all six layers apart); the first drag or tap takes over
    var v = N * STEP, active = -1, overview = true, raf = 0, last = 0;
    var gap = 54, dia = 118, lid = 150, sc = 1, goal = [];
    // closed, the single page glides to the middle of the stage (apart, it sits left so the tags fit beside it)
    var iso = $('.cwd-iso', box), centerOff = 0, shift = { x: 0, vel: 0 };
    var springs = $$('.cwd-slab', box).map(function (el, i) {
      return { el: el, tag: $('.cwd-tag', el), note: $('.cwd-tnote', el), x: 0, vel: 0, k: 240 - i * 24 };
    });

    // geometry: slab gap, the slab's projected height on screen, the "lid" clearance and a fit-to-stage scale
    function measure() {
      var cs = getComputedStyle(box), px = function (n, d) { return parseFloat(cs.getPropertyValue(n)) || d; };
      gap = px('--gap', 54);
      dia = (px('--w', 128) + px('--h', 164)) / Math.SQRT2 * Math.cos(55 * Math.PI / 180);
      lid = dia * 0.9 / SIN + LIFT;                 // slabs above the active one lift clear of its face
      var need = Math.max((N - 1) * gap + LIFT, (N - 2) * gap * TIGHT + lid + LIFT) * SIN + dia + 44;
      sc = Math.min(1, stage.clientHeight / need);
      box.style.setProperty('--sc', sc.toFixed(3));
      centerOff = iso ? stage.clientWidth / 2 - (iso.offsetLeft + iso.offsetWidth / 2) : 0;
    }
    function layerOf(val) { return overview ? -2 : val <= 0 ? 0 : clamp(Math.ceil(val / STEP - 1e-6), 1, N); }
    function label(n) { return n > 0 ? 'Layer ' + n + ' of ' + N + ': ' + names[n - 1] + (n === 4 ? '. A template starts here.' : '') : n === 0 ? 'Closed: the finished page' : 'All six layers apart'; }

    // where each slab rests for a state: closed = one page; overview / last layer = evenly apart;
    // any middle layer = the layers up to it stay stacked and everything above lifts away like a lid
    function targets(n) {
      var t = [], i;
      for (i = 0; i < N; i++) {
        if (n === 0) t.push(0);
        else if (n < 0 || n === N) t.push((i - (N - 1) / 2) * gap + (i + 1 === n ? LIFT : 0));
        else t.push(i * gap * TIGHT + (i >= n ? lid : 0) + (i + 1 === n ? LIFT : 0));
      }
      if (n > 0 && n < N) { var mid = (t[0] + t[N - 1]) / 2; t = t.map(function (z) { return z - mid; }); }
      return t;
    }

    // each layer name becomes a button that jumps the build to that layer
    var buttons = items.map(function (li, i) {
      var h = $('.cwd-ln', li), b = document.createElement('button');
      b.type = 'button'; b.className = 'cwd-lb'; b.setAttribute('aria-pressed', 'false');
      while (h.firstChild) b.appendChild(h.firstChild);
      h.appendChild(b);
      b.addEventListener('click', function () { setV((i + 1) * STEP); });
      return b;
    });

    // phones: the names sit in a compact 2 x 3 picker; one porcelain card under it reads out the active layer
    var phone = window.matchMedia('(max-width: 767px)');
    var list = $('.cwd-layers', box), detail = document.createElement('div');
    detail.className = 'cwd-ldetail';
    detail.innerHTML = '<p class="cwd-ld-k"></p><p class="cwd-ld-t"></p><p class="cwd-ld-d"></p>';
    list.parentNode.insertBefore(detail, list.nextSibling);
    var ldK = $('.cwd-ld-k', detail), ldT = $('.cwd-ld-t', detail), ldD = $('.cwd-ld-d', detail);
    function fillDetail(n) {
      ldD.replaceChildren();
      if (n > 0) {
        ldK.textContent = 'Layer 0' + n + ' of 0' + N;
        ldT.textContent = names[n - 1];
        [].slice.call($('p', items[n - 1]).childNodes).forEach(function (c) { ldD.appendChild(c.cloneNode(true)); });
      } else if (n === 0) {
        ldK.textContent = 'Closed';
        ldT.textContent = 'One finished page';
        ldD.textContent = 'Six layers, pressed into one page. Drag the Z to pull it apart, or pick a layer above.';
      } else {
        ldK.textContent = 'All six apart';
        ldT.textContent = 'Six layers, in build order';
        ldD.textContent = 'A template starts at layer four; a custom site starts at layer one. Pick a layer to see what goes into it.';
      }
      detail.classList.toggle('is-new', false); void detail.offsetWidth;
      if (!motionOff()) detail.classList.add('is-new');
    }

    // quiet: the change came from the slider itself (its valuetext speaks) or from scrolling, so the live region stays silent
    function setV(n, quiet) { overview = false; v = clamp(Math.round(n), 0, MAX); range.value = v; update(quiet); }

    function update(quiet) {
      var n = layerOf(v);
      box.style.setProperty('--v', (v / MAX).toFixed(4));
      box.style.setProperty('--t', (v / MAX).toFixed(4));
      range.setAttribute('aria-valuetext', label(n));
      ends.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-xb-to') === (n < 0 ? MAX : v))); });
      if (n !== active) {
        active = n;
        box.classList.toggle('has-on', n > 0);
        springs.forEach(function (s, i) {
          s.el.classList.toggle('is-on', i + 1 === n);
          s.el.classList.toggle('is-above', n > 0 && n < N && i >= n);
        });
        items.forEach(function (li, i) { li.classList.toggle('is-on', i + 1 === n); buttons[i].setAttribute('aria-pressed', String(i + 1 === n)); });
        status.setAttribute('aria-live', quiet ? 'off' : 'polite');
        status.replaceChildren();
        var b = document.createElement('b');
        b.textContent = n > 0 ? 'Layer ' + n + ' of ' + N + ' · ' + names[n - 1] : n === 0 ? 'Closed: one finished page.' : 'All six layers, pulled apart.';
        status.appendChild(b);
        fillDetail(n);
        status.appendChild(document.createTextNode(n === 4 ? ' A template starts here.' : n === N ? ' Built by hand, ready to ship.' : n === 0 ? ' Drag the Z to pull it apart again.' : n < 0 ? ' Drag the Z to close the page, or pick a layer.' : ''));
      }
      goal = targets(n);
      kick();
    }

    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    function frame(now) {
      var dt = Math.min(0.032, (now - last) / 1000 || 0.016); last = now;
      var still = true, off = motionOff(), low = Infinity;
      springs.forEach(function (s, i) {
        var target = goal[i];
        if (off) { s.x = target; s.vel = 0; }
        else {
          var c = 2 * 0.5 * Math.sqrt(s.k);                      // under-damped: a little overshoot, mass you can feel
          s.vel += (-s.k * (s.x - target) - c * s.vel) * dt;
          s.x += s.vel * dt;
          if (Math.abs(s.x - target) > 0.05 || Math.abs(s.vel) > 0.05) still = false; else { s.x = target; s.vel = 0; }
        }
        low = Math.min(low, s.x);
        s.el.style.setProperty('--z', s.x.toFixed(2) + 'px');
      });
      var sx = active === 0 ? centerOff : 0;
      if (off) { shift.x = sx; shift.vel = 0; }
      else {
        shift.vel += (-110 * (shift.x - sx) - 2 * 0.62 * Math.sqrt(110) * shift.vel) * dt;
        shift.x += shift.vel * dt;
        if (Math.abs(shift.x - sx) > 0.2 || Math.abs(shift.vel) > 0.2) still = false; else { shift.x = sx; shift.vel = 0; }
      }
      box.style.setProperty('--cwd-sx', shift.x.toFixed(1) + 'px');
      // the floor shadow always sits right under the lowest slab, so a closed page rests on it
      box.style.setProperty('--fy', (sc * (dia / 2 + (7 - low) * SIN + 4)).toFixed(1) + 'px');
      // tags swing out once the slabs are evenly apart; the active one shows as soon as it lifts
      var sep = (springs[N - 1].x - springs[0].x) / ((N - 1) * gap);
      var shown = active < 0 || active === N ? clamp((sep - 0.86) / 0.12, 0, 1) : 0;   // all tags only when evenly apart
      springs.forEach(function (s, i) {
        var o = i + 1 === active ? Math.max(shown, clamp(sep * 5, 0, 1)) : shown;
        s.tag.style.setProperty('--to', o.toFixed(3));
        s.tag.style.setProperty('--tr', ((1 - o) * -22).toFixed(2) + 'deg');
        if (s.note) s.note.style.setProperty('--no', (active === 4 ? Math.min(1, o) : v === MAX ? shown : 0).toFixed(3));
      });
      raf = still ? 0 : requestAnimationFrame(frame);
    }

    range.addEventListener('input', function () { overview = false; v = +range.value; update(true); });
    range.addEventListener('keydown', function (e) {
      var k = e.key, n = null, cur = +range.value;
      if (k === 'ArrowRight' || k === 'ArrowUp' || k === 'PageUp') n = Math.floor(cur / STEP) * STEP + STEP;
      else if (k === 'ArrowLeft' || k === 'ArrowDown' || k === 'PageDown') n = Math.ceil(cur / STEP) * STEP - STEP;
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = MAX;
      if (n === null) return;
      e.preventDefault(); setV(n, true);
    });
    var grab = function (on) { return function () { box.classList.toggle('is-grab', on); }; };
    range.addEventListener('pointerdown', grab(true));
    ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) { range.addEventListener(ev, grab(false)); });
    ends.forEach(function (b) { b.addEventListener('click', function () { setV(+b.getAttribute('data-xb-to')); }); });

    // phones and tablets: the stage is pinned above the list, and reading down the list walks the build layer by layer
    var narrow = window.matchMedia('(max-width: 1023px)'), lio = null;
    function band() {
      if (lio) { lio.disconnect(); lio = null; }
      if (!hasIO || !narrow.matches || phone.matches) return;
      var top = parseFloat(getComputedStyle(pin).top) || 0, edge = Math.round(top + pin.offsetHeight);
      var rest = Math.max(0, innerHeight - edge - 120);
      lio = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (!e.isIntersecting) return;
          var i = items.indexOf(e.target);
          if (i + 1 !== active) setV((i + 1) * STEP, true);
        });
      }, { rootMargin: -edge + 'px 0px ' + -rest + 'px 0px', threshold: 0 });
      items.forEach(function (li) { lio.observe(li); });
    }

    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { measure(); goal = targets(active); band(); kick(); }, 120);
    }, { passive: true });

    if (phone.addEventListener) phone.addEventListener('change', band); else if (phone.addListener) phone.addListener(band);
    measure(); band();
    // the first time the build scrolls into view it assembles itself: slabs spring apart from the closed page
    // (motion on only; with motion off, no IO or already on screen it simply shows the overview)
    range.value = v;
    var r = stage.getBoundingClientRect();
    if (!hasIO || motionOff() || (r.top < innerHeight && r.bottom > 0)) { update(true); return; }
    springs.forEach(function (s) { s.el.style.setProperty('--z', '0px'); s.tag.style.setProperty('--to', '0'); });
    update(true); cancelAnimationFrame(raf); raf = 0;
    box.style.setProperty('--fy', (sc * (dia / 2 + 7 * SIN + 4)).toFixed(1) + 'px');
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect(); setTimeout(kick, 120);
    }, { threshold: 0.45 });
    io.observe(stage);
  }

  /* ------------------------------------------------------------ reveal helper: add a class once in view
     Anything already on screen (or with motion off / no IO) gets its final state at once. */
  function arm(el, cls, threshold, hide) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (!hasIO || motionOff() || (r.top < innerHeight * 0.85 && r.bottom > 0)) { el.classList.add(cls); return; }
    if (hide) el.classList.add('is-armed');
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      el.classList.add(cls); io.disconnect();
    }, { threshold: threshold, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    finishIfPassed(el, function () { el.classList.add(cls); io.disconnect(); });
  }
  arm($('[data-chains]'), 'is-drawn', 0.3, true);
  arm($('[data-ruler]'), 'is-in', 0.6, true);
  $$('.cwd-keys').forEach(function (k) { arm(k, 'is-in', 0.6, false); });

  /* ------------------------------------------------------------ work order: each line ticks itself off as it is read */
  var order = $$('[data-order] .cwd-order-list > li');
  if (order.length) {
    if (!hasIO || motionOff()) order.forEach(function (li) { li.classList.add('is-ticked'); });
    else {
      var queue = [], busy = false;
      var pump = function () {
        if (!queue.length) { busy = false; return; }
        busy = true; queue.shift().classList.add('is-ticked');
        setTimeout(pump, 140);
      };
      // forgiving threshold (the card is tilted, so a row never reads as 100% visible); a row ticks every row above it
      // too, and scrolling or jumping past the whole list ticks everything at once
      var take = function (k) {
        for (var j = 0; j <= k; j++) if (!order[j].cwdQ) { order[j].cwdQ = 1; queue.push(order[j]); oio.unobserve(order[j]); }
      };
      var oio = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) take(order.indexOf(e.target)); });
        queue.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
        if (!busy) pump();
      }, { rootMargin: '0px 0px -15% 0px', threshold: 0.5 });
      finishIfPassed($('[data-order]'), function () {
        queue.length = 0;
        order.forEach(function (li) { li.cwdQ = 1; li.classList.add('is-ticked'); });
        oio.disconnect();
      });
      order.forEach(function (li) { oio.observe(li); });
    }
  }

  /* ------------------------------------------------------------ the 1.2-second bar (real time, linear) */
  $$('[data-load]').forEach(function (el) {
    var ms = $('.cwd-load-ms', el), btn = $('.cwd-load-btn', el), t0 = 0, id = 0;
    function tick(now) {
      var s = Math.min(1.2, (now - t0) / 1000);
      ms.textContent = s.toFixed(1) + 's';
      id = s < 1.2 ? requestAnimationFrame(tick) : 0;
    }
    function run() {
      if (motionOff()) { el.classList.remove('is-armed', 'is-run'); ms.textContent = '1.2s'; return; }
      cancelAnimationFrame(id);
      el.classList.remove('is-run'); void el.offsetWidth; el.classList.add('is-run');
      t0 = performance.now(); id = requestAnimationFrame(tick);
    }
    btn.addEventListener('click', run);
    if (!hasIO || motionOff()) return;
    el.classList.add('is-armed'); ms.textContent = '0.0s';
    var lio = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      lio.disconnect(); setTimeout(run, 200);
    }, { threshold: 0.6, rootMargin: '0px 0px -10% 0px' });
    lio.observe($('.cwd-load-bar', el));
    finishIfPassed(el, function () { lio.disconnect(); el.classList.remove('is-armed'); ms.textContent = '1.2s'; });
  });

  /* ------------------------------------------------------------ mini CMS: swap the headline, the layout holds */
  $$('[data-cms]').forEach(function (cms) {
    var h = $('.cwd-cms-h', cms), opts = $$('.cwd-cms-opts button', cms);
    opts.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-pressed') === 'true') return;
        opts.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        var s = document.createElement('span');
        s.className = 'is-new'; s.textContent = b.getAttribute('data-h');
        h.replaceChildren(s);
      });
    });
  });
})();
