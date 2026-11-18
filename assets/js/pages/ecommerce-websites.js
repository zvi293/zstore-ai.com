// Signature component: Thumb Reach — drag the Add to cart button onto a sample product page and see whether one thumb, on the first screen, next to the options, can reach it.
/* /services/ecommerce-websites/ page behaviour (prefix .ec-). Touches only this page's own DOM.
   Also: ceramic tile drop + wobble and a neon OPEN sign (hero), a conveyor belt driven by scroll and drag (no autoplay),
   barcode cards scanned as they arrive, a packing slip you pack by tapping, code lines that light in turn.
   Everything settles to its final state when html.motion-off is set (reduced motion or the site's Motion toggle). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, win = window;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var motionOff = function () { return root.classList.contains('motion-off'); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var hasIO = 'IntersectionObserver' in win;
  var motionHooks = [], scrollHooks = [];

  // run fn the first time el is (partly) on screen
  function onceInView(el, fn, threshold) {
    if (!el) return;
    if (!hasIO) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: threshold || 0.2 });
    io.observe(el);
  }
  // keep a boolean in sync with whether el is near the viewport
  function watchView(el, fn, margin) {
    if (!el || !hasIO) { if (el) fn(true); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { fn(en.isIntersecting); });
    }, { rootMargin: margin || '120px 0px' }).observe(el);
  }

  /* ------------------------------------------------------------ hero: ceramic tile + neon OPEN sign */
  var tile = $('[data-ec-tile]');
  if (tile) {
    var wobble = function () {
      if (motionOff()) return;
      tile.classList.remove('is-wobble'); void tile.offsetWidth; tile.classList.add('is-wobble');
    };
    tile.addEventListener('animationend', function (e) { if (e.animationName === 'ecTileWobble') tile.classList.remove('is-wobble'); });
    tile.addEventListener('pointerdown', wobble);
    if (win.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) tile.addEventListener('pointerenter', wobble);
  }
  var neon = $('[data-ec-neon]'), shop = $('[data-ec-window]');
  if (neon && shop) {
    var buzz = function () {
      if (motionOff() || neon.classList.contains('is-buzz')) return;
      neon.classList.add('is-buzz');
    };
    neon.addEventListener('animationend', function (e) { if (e.animationName === 'ecNeonBuzz') neon.classList.remove('is-buzz'); });
    shop.addEventListener('pointerdown', buzz);
    shop.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') buzz(); });
  }

  /* ------------------------------------------------------------ conveyor belt: moves only with your scroll or your hand, then coasts */
  var belt = $('[data-ec-belt]');
  if (belt) {
    var run = $('.ec-belt-run', belt), list = $('.ec-belt-list', belt);
    var clone = list.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    run.appendChild(clone);
    var off = 0, v = 0, loopW = 0, coasting = false, beltIn = false, lastSY = win.scrollY, grab = null;
    var measureBelt = function () { loopW = list.offsetWidth; };
    var paintBelt = function () {
      if (!loopW) measureBelt();
      if (loopW) off = ((off % loopW) + loopW) % loopW;
      run.style.transform = 'translate3d(' + (-off).toFixed(1) + 'px,0,0)';
      belt.style.setProperty('--ec-belt', off.toFixed(1));
    };
    var coast = function () {
      if (grab || motionOff()) { coasting = false; return; }
      off += v; v *= 0.9;
      paintBelt();
      if (Math.abs(v) > 0.08) requestAnimationFrame(coast); else { v = 0; coasting = false; }
    };
    var push = function (dv) {
      if (motionOff()) return;
      v = clamp(v + dv, -40, 40);
      if (!coasting) { coasting = true; requestAnimationFrame(coast); }
    };
    watchView(belt, function (vis) { beltIn = vis; lastSY = win.scrollY; });
    scrollHooks.push(function () {
      var y = win.scrollY, d = y - lastSY; lastSY = y;
      if (beltIn && d) push(clamp(d, -80, 80) * 0.09);
    });
    belt.addEventListener('pointerdown', function (e) {
      if (motionOff() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      grab = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, v: 0, horizontal: e.pointerType === 'mouse' };
      v = 0;
    });
    belt.addEventListener('pointermove', function (e) {
      if (!grab || e.pointerId !== grab.id) return;
      var dx = e.clientX - grab.lx;
      if (!grab.horizontal) {
        // touch: take over only once the gesture is clearly sideways (vertical swipes keep scrolling the page)
        var tx = Math.abs(e.clientX - grab.x), ty = Math.abs(e.clientY - grab.y);
        if (tx < 8 && ty < 8) return;
        if (ty > tx) { grab = null; return; }
        grab.horizontal = true;
      }
      if (!belt.classList.contains('is-grab')) { belt.classList.add('is-grab'); try { belt.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } }
      off -= dx; grab.lx = e.clientX; grab.v = -dx;
      paintBelt();
    });
    var letGo = function (e) {
      if (!grab || e.pointerId !== grab.id) return;
      var fling = grab.v || 0; grab = null;
      belt.classList.remove('is-grab');
      push(fling);
    };
    belt.addEventListener('pointerup', letGo);
    belt.addEventListener('pointercancel', letGo);
    var beltSync = function () {
      belt.classList.toggle('is-live', !motionOff());
      if (motionOff()) { run.style.transform = ''; v = 0; } else paintBelt();
    };
    if ('ResizeObserver' in win) new ResizeObserver(function () { measureBelt(); if (!motionOff()) paintBelt(); }).observe(list);
    beltSync();
    motionHooks.push(beltSync);
  }

  /* ------------------------------------------------------------ three moments: each card is scanned as it arrives */
  var stopsWrap = $('[data-ec-stops]');
  if (stopsWrap) {
    var cards = $$('.ec-stop', stopsWrap);
    var scanAll = function () { cards.forEach(function (c) { c.classList.add('is-scanned'); }); };
    if (motionOff() || !hasIO) scanAll();
    else {
      stopsWrap.classList.add('is-ready');
      var queueUntil = 0;
      var scanIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          scanIO.unobserve(en.target);
          var card = en.target, now = Date.now();
          // cards that arrive together are scanned one after another, like items at a checkout
          var at = Math.max(now, queueUntil); queueUntil = at + 320;
          card.style.setProperty('--ec-h', card.offsetHeight + 'px');
          setTimeout(function () { card.classList.add('is-scanned'); }, at - now);
        });
      }, { threshold: 0.45 });
      cards.forEach(function (c) { scanIO.observe(c); });
    }
    motionHooks.push(function () { if (motionOff()) { stopsWrap.classList.remove('is-ready'); scanAll(); } });
  }

  /* ------------------------------------------------------------ Thumb Reach (signature) */
  var lab = $('[data-ec-lab]');
  if (lab) {
    var stage = $('[data-ec-stage]', lab), pill = $('[data-ec-pill]', lab), hole = $('[data-ec-hole]', lab);
    var verdict = $('[data-ec-verdict]', lab), vH = $('[data-ec-v-h]', lab), vR = $('[data-ec-v-r]', lab);
    var vA = { reach: $('[data-ec-v-a="reach"]', lab), seen: $('[data-ec-v-a="seen"]', lab), near: $('[data-ec-v-a="near"]', lab) };
    var radios = $$('input[name="ec-spot"]', lab), handBtns = $$('[data-ec-hand]', lab), zonesBtn = $('[data-ec-zones]', lab);
    var arm = $('[data-ec-arm]', lab), thumb = arm && arm.firstElementChild;
    var all = $('[data-ec-all]');
    var dock = $('[data-ec-dock]', lab), mini = $('[data-ec-mini]', lab);
    var miniS = mini && $('[data-ec-mini-s]', mini), miniH = mini && $('[data-ec-mini-h]', mini), miniB = mini ? $$('[data-ec-mini-b]', mini) : [];
    var KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
    // phones + tablets: while the sheet sits in the bottom strip of the screen, the WhatsApp bead steps aside so it never
    // covers the verdict chips (the bead's own probe only runs on scroll, and a drop changes the sheet without one)
    if (dock && hasIO) {
      var dockHold = false, narrowQ = win.matchMedia('(max-width: 767px)');
      var holdFab = function (on) {
        on = !!on && narrowQ.matches;
        if (on === dockHold) return;
        dockHold = on;
        win.dispatchEvent(new CustomEvent('zs:wa-hold', { detail: { key: 'ec-dock', on: on } }));
      };
      new IntersectionObserver(function (en) { holdFab(en[en.length - 1].isIntersecting); }, { rootMargin: '-86% 0px 0px 0px', threshold: 0 }).observe(dock);
    }
    var slotEl = {};
    KEYS.forEach(function (k) { slotEl[k] = $('[data-ec-slot="' + k + '"]', lab); });
    // x / y: the spot's centre in screen units (100 wide, 210 tall); reach follows the zones drawn on the phone
    var DATA = {
      a: { name: 'Top bar, by the cart icon', x: 64, y: 17, reach: { r: 'hard', l: 'hard' }, seen: 'Yes', near: 'No',
        h: 'One out of three. Seen, but out of reach.',
        why: "It's seen right away, but the top of the screen is the hardest place for one thumb to reach, and it's far from where shoppers choose a size. Keep the cart icon up here and the main button lower." },
      b: { name: 'On the photo', x: 50, y: 79.5, reach: { r: 'stretch', l: 'stretch' }, seen: 'Yes', near: 'No',
        h: 'One out of three. In the way.',
        why: 'It covers the product people came to look at, and it sits a stretch away from the thumb. Let the photo be the photo.' },
      c: { name: 'Beside the product name', x: 71, y: 120, reach: { r: 'easy', l: 'stretch' }, seen: 'Yes', near: 'Above the options',
        h: { r: 'Two out of three. Close, but too early.', l: 'One out of three. Too early, and a stretch.' },
        why: { r: "It's easy for a right thumb and close to the price, but it sits above the size choice, so shoppers reach it before they've picked one.",
          l: "It sits above the size choice, so shoppers reach it before they've picked one, and for a left thumb it's a stretch across the screen." } },
      d: { name: 'Under the price and options', x: 50, y: 159, reach: { r: 'easy', l: 'easy' }, seen: 'Yes', near: 'Yes',
        h: "All three. This is where I'd put it.",
        why: 'Right under the price and size choice, on the first screen, in the natural sweep of the thumb. Shoppers pick an option and the button is waiting.' },
      e: { name: 'Sticky bar at the bottom', x: 71, y: 200, reach: { r: 'easy', l: 'easy' }, seen: 'Always', near: 'No',
        h: 'Two out of three. The perfect backup.',
        why: 'Always visible and always in reach, but on its own it sits far from the options. I add it as a backup: the bar slides up once the main button scrolls out of view and repeats the chosen option.' },
      f: { name: 'After the description', x: 50, y: null, reach: { r: 'scroll', l: 'scroll' }, seen: 'No', near: 'No',
        h: 'One out of three. Out of sight.',
        why: "Easy to tap once shoppers get there, but it's below the first screen, so anyone ready to buy has to go looking for it." }
    };
    var REACH = { easy: 'Yes', stretch: 'A stretch', hard: 'Hard to reach', scroll: 'Yes, once scrolled' };
    var state = { slot: null, hand: 'r' }, pending = null, drag = null, nearKey = null, suppress = false, timers = [];
    var pos = { x: 0, y: 0 };

    // a polite status line for keyboard previews (the verdict card is its own live region)
    var status = doc.createElement('p');
    status.className = 'sr'; status.setAttribute('aria-live', 'polite');
    lab.appendChild(status);

    var setPill = function (x, y) {
      pos.x = x; pos.y = y;
      pill.style.setProperty('--ec-x', x.toFixed(1) + 'px');
      pill.style.setProperty('--ec-y', y.toFixed(1) + 'px');
    };
    var centreOf = function (el) {
      var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
    };
    var placeAt = function (key, instant) {
      var c = centreOf(key ? slotEl[key] : hole);
      if (instant) pill.style.transition = 'none';
      setPill(c.x - pill.offsetWidth / 2, c.y - pill.offsetHeight / 2);
      if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
    };
    var highlight = function (key) {
      if (nearKey === key) return;
      if (nearKey) slotEl[nearKey].classList.remove('is-near');
      nearKey = key;
      if (key) slotEl[key].classList.add('is-near');
    };
    var clearTimers = function () { timers.forEach(clearTimeout); timers = []; };
    var retract = function () { if (thumb) { thumb.style.setProperty('--ec-reach', '-14'); thumb.classList.remove('is-strain'); } };
    var press = function () {
      pill.classList.add('is-press');
      timers.push(setTimeout(function () { pill.classList.remove('is-press'); }, 170));
    };
    // the thumb swings round from the corner of the grip, reaches for the button and taps it (or strains short)
    var reachFor = function (key) {
      clearTimers(); retract();
      if (!thumb || motionOff()) return;
      var D = DATA[key];
      if (D.y === null) return;
      var px = state.hand === 'l' ? 4 : 96, dx = D.x - px, dy = D.y - 214, dist = Math.sqrt(dx * dx + dy * dy);
      var deg = Math.atan2(dx, -dy) * 180 / Math.PI;
      timers.push(setTimeout(function () { arm.style.setProperty('--ec-ang', deg.toFixed(1) + 'deg'); }, 160));
      timers.push(setTimeout(function () {
        thumb.style.setProperty('--ec-reach', (Math.min(dist, 158) - 7).toFixed(1));
        if (dist > 165) thumb.classList.add('is-strain');
      }, 420));
      if (dist <= 165) timers.push(setTimeout(press, 820));
      timers.push(setTimeout(retract, dist > 165 ? 1700 : 1200));
    };
    var squash = function (delay) {
      if (motionOff()) return;
      timers.push(setTimeout(function () {
        pill.classList.remove('is-squash'); void pill.offsetWidth; pill.classList.add('is-squash');
      }, delay));
    };
    pill.addEventListener('animationend', function () { pill.classList.remove('is-squash'); });

    var render = function (key) {
      verdict.classList.remove('is-new'); void verdict.offsetWidth; verdict.classList.add('is-new');
      var lis = $$('.ec-v-checks li', verdict);
      if (!key) {
        vH.textContent = 'Drop the button somewhere.';
        vR.textContent = "Drag the orange Add to cart button onto the phone, or choose a spot. I'll check three things: reach, visibility and context.";
        ['reach', 'seen', 'near'].forEach(function (k, i) { vA[k].textContent = '—'; lis[i].setAttribute('data-ok', ''); });
        return;
      }
      var D = DATA[key], hand = state.hand, rc = D.reach[hand];
      var ok = { reach: rc === 'easy' || rc === 'scroll', seen: D.seen !== 'No', near: D.near === 'Yes' };
      vH.textContent = typeof D.h === 'string' ? D.h : D.h[hand];
      vR.textContent = typeof D.why === 'string' ? D.why : D.why[hand];
      vA.reach.textContent = REACH[rc]; vA.seen.textContent = D.seen; vA.near.textContent = D.near;
      ['reach', 'seen', 'near'].forEach(function (k, i) { lis[i].setAttribute('data-ok', ok[k] ? '1' : '0'); });
      // the mini verdict on the sheet under the phone (phones + tablets): same result, one glance
      if (mini) {
        var score = (ok.reach ? 1 : 0) + (ok.seen ? 1 : 0) + (ok.near ? 1 : 0);
        miniS.textContent = score + '/3';
        miniH.textContent = vH.textContent;
        ['reach', 'seen', 'near'].forEach(function (k, i) { if (miniB[i]) miniB[i].setAttribute('data-ok', ok[k] ? '1' : '0'); });
        mini.classList.remove('is-new'); void mini.offsetWidth; mini.classList.add('is-new');
      }
    };

    var endPreview = function () {
      pending = null;
      pill.classList.remove('is-preview');
      stage.classList.remove('is-choosing');
      highlight(null);
    };
    var drop = function (key, fromDrag) {
      endPreview();
      state.slot = key;
      stage.setAttribute('data-slot', key);
      if (dock) dock.classList.add('is-out');
      placeAt(key);
      radios.forEach(function (r) { r.checked = r.value === key; });
      render(key);
      squash(fromDrag ? 30 : 240);
      reachFor(key);
      status.textContent = '';
    };
    var preview = function (key) {
      pending = key;
      pill.classList.add('is-preview');
      stage.classList.add('is-choosing');
      highlight(key);
      placeAt(key);
      status.textContent = DATA[key].name + '. Press Enter to drop the button here, or Escape to cancel.';
    };
    var cancelPreview = function () {
      endPreview();
      placeAt(state.slot);
      status.textContent = 'Cancelled.';
    };

    // pointer: drag the pill anywhere; it snaps to the nearest spot within reach of the drop, otherwise flies back
    var nearest = function () {
      var cx = pos.x + pill.offsetWidth / 2, cy = pos.y + pill.offsetHeight / 2, best = null, bd = Infinity;
      KEYS.forEach(function (k) {
        var c = centreOf(slotEl[k]), d = Math.sqrt((c.x - cx) * (c.x - cx) + (c.y - cy) * (c.y - cy));
        if (d < bd) { bd = d; best = k; }
      });
      return bd < Math.max(64, pill.offsetHeight * 1.7) ? best : null;
    };
    pill.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pending) endPreview();
      var sr = stage.getBoundingClientRect();
      // grab offset inside the pill, so the pill stays under the finger even while the page auto-scrolls
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, gx: e.clientX - sr.left - pos.x, gy: e.clientY - sr.top - pos.y, moved: false };
      try { pill.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    });
    var follow = function () {
      var sr = stage.getBoundingClientRect();
      setPill(drag.cx - sr.left - drag.gx, drag.cy - sr.top - drag.gy);
      highlight(nearest());
    };
    // near the top or bottom edge of the screen the page scrolls along, so every spot is reachable on short phones
    var edgeScroll = function () {
      if (!drag || !drag.moved) return;
      var vh = win.innerHeight, top = 84, sp = 0;
      if (drag.cy < top) sp = -Math.min(14, (top - drag.cy) / 4 + 3);
      else if (drag.cy > vh - 56) sp = Math.min(14, (drag.cy - (vh - 56)) / 4 + 3);
      if (sp) {
        // only as far as the stage itself: the page never runs away from the component
        var sr = stage.getBoundingClientRect();
        if ((sp > 0 && sr.bottom < vh - 24) || (sp < 0 && sr.top > top + 8)) sp = 0;
      }
      if (sp) { win.scrollBy({ top: sp, behavior: 'instant' }); follow(); }
      requestAnimationFrame(edgeScroll);
    };
    pill.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      drag.cx = e.clientX; drag.cy = e.clientY;
      if (!drag.moved) {
        if (dx * dx + dy * dy < 36) return;
        drag.moved = true;
        clearTimers(); retract();
        pill.classList.add('is-drag');
        stage.classList.add('is-choosing');
        requestAnimationFrame(edgeScroll);
      }
      follow();
      e.preventDefault();
    });
    var release = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      pill.classList.remove('is-drag');
      if (!d.moved) return;
      suppress = true;
      setTimeout(function () { suppress = false; }, 350);
      var k = e.type === 'pointercancel' ? null : nearKey;
      stage.classList.remove('is-choosing');
      highlight(null);
      if (k) drop(k, true);
      else { placeAt(state.slot); status.textContent = state.slot ? 'Back to ' + DATA[state.slot].name + '.' : 'Back on the sheet.'; }
    };
    pill.addEventListener('pointerup', release);
    pill.addEventListener('pointercancel', release);
    pill.addEventListener('lostpointercapture', function (e) { if (drag) release(e); });

    // click / tap / Enter without a preview: hop to the next spot, so the button works without dragging too
    pill.addEventListener('click', function () {
      if (suppress) { suppress = false; return; }
      if (pending) { drop(pending); return; }
      var i = state.slot ? KEYS.indexOf(state.slot) : -1;
      drop(KEYS[(i + 1) % KEYS.length]);
    });
    pill.addEventListener('keydown', function (e) {
      var k = e.key, cur = pending || state.slot, i = cur ? KEYS.indexOf(cur) : -1, n = null;
      if (k === 'ArrowDown' || k === 'ArrowRight') n = i < 0 ? 0 : Math.min(KEYS.length - 1, i + 1);
      else if (k === 'ArrowUp' || k === 'ArrowLeft') n = i < 0 ? KEYS.length - 1 : Math.max(0, i - 1);
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = KEYS.length - 1;
      if (n !== null) { e.preventDefault(); preview(KEYS[n]); return; }
      if ((k === 'Enter' || k === ' ') && pending) {
        e.preventDefault();
        suppress = true;
        setTimeout(function () { suppress = false; }, 400);
        drop(pending);
      } else if (k === 'Escape' && pending) { e.preventDefault(); cancelPreview(); }
    });
    pill.addEventListener('blur', function () { if (pending) cancelPreview(); });

    radios.forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) drop(r.value); });
    });
    handBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        state.hand = b.getAttribute('data-ec-hand');
        handBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        stage.classList.toggle('is-left', state.hand === 'l');
        if (state.slot) { render(state.slot); reachFor(state.slot); }
      });
    });
    if (zonesBtn) zonesBtn.addEventListener('click', function () {
      var on = zonesBtn.getAttribute('aria-pressed') !== 'true';
      zonesBtn.setAttribute('aria-pressed', String(on));
      stage.classList.toggle('is-zones', on);
    });

    // start: the pill sits on its sticker sheet, the comparison table folds away (it stays one tap away)
    stage.removeAttribute('data-slot');
    radios.forEach(function (r) { r.checked = false; });
    render(null);
    verdict.classList.remove('is-new');
    if (all) all.open = false;
    placeAt(null, true);
    pill.classList.add('is-ready');
    var relayout = function () { if (!drag) placeAt(pending || state.slot, true); };
    if ('ResizeObserver' in win) new ResizeObserver(relayout).observe(stage);
    win.addEventListener('resize', relayout);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(relayout);
    motionHooks.push(function () { clearTimers(); retract(); pill.classList.remove('is-squash', 'is-press'); });
  }

  /* ------------------------------------------------------------ packing slip: tap a tick to pack it; all nine close the box */
  var slip = $('[data-ec-slip]');
  if (slip) {
    var rows = $$('.ec-slip-list > li', slip), pack = $('[data-ec-pack]', slip), packT = $('[data-ec-pack-t]', slip);
    var art = $('.ec-box-art', slip), btns = [];
    var status2 = doc.createElement('p');
    status2.className = 'sr'; status2.setAttribute('aria-live', 'polite');
    slip.appendChild(status2);
    var allBtn = doc.createElement('button');
    allBtn.type = 'button'; allBtn.className = 'ec-pack-btn';
    pack.appendChild(allBtn);
    var countText = function (n) { return n === btns.length ? 'All nine packed.' : n + ' of ' + btns.length + ' packed.'; };
    var packSync = function (announce) {
      var n = btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).length, full = n === btns.length;
      pack.classList.toggle('is-open', !full);
      art.style.setProperty('--fill', (n / btns.length).toFixed(2));
      packT.textContent = '';
      var strong = doc.createElement('strong');
      strong.textContent = countText(n);
      packT.appendChild(strong);
      packT.appendChild(doc.createTextNode(full ? ' Box closed and taped: ready to launch.' : ' Tap the boxes on the slip to pack them.'));
      allBtn.textContent = full ? 'Unpack' : 'Pack everything';
      if (announce) status2.textContent = full ? 'All nine packed. The box is closed.' : countText(n);
    };
    rows.forEach(function (li) {
      var old = $('.ec-tick', li), label = $('strong', li);
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'ec-tick';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Pack: ' + (label ? label.textContent : 'item'));
      li.replaceChild(b, old);
      btns.push(b);
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        li.classList.toggle('is-packed', on);
        packSync(true);
      });
    });
    allBtn.addEventListener('click', function () {
      var full = btns.every(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
      btns.forEach(function (b, i) {
        var set = function () { b.setAttribute('aria-pressed', String(!full)); rows[i].classList.toggle('is-packed', !full); packSync(i === btns.length - 1); };
        if (motionOff() || full) set(); else setTimeout(set, i * 90);
      });
    });
    packSync(false);
  }

  /* ------------------------------------------------------------ code card: lines light up one after another */
  var code = $('[data-ec-code]');
  if (code) {
    $$('code > span', code).forEach(function (s, i) { s.style.setProperty('--i', i); });
    onceInView(code, function () { if (!motionOff()) code.classList.add('is-in'); }, 0.4);
  }

  /* ------------------------------------------------------------ shared scroll + Motion toggle plumbing */
  if (scrollHooks.length) {
    var queued = false;
    win.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; scrollHooks.forEach(function (fn) { fn(); }); });
    }, { passive: true });
  }
  if ('MutationObserver' in win) {
    var wasOff = motionOff();
    new MutationObserver(function () {
      var off = motionOff();
      if (off === wasOff) return;
      wasOff = off;
      motionHooks.forEach(function (fn) { fn(); });
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  /* ------------------------------------------------------------ phones + tablets: a chip tap always shows its payoff
     The chips sit under the phone; if the phone's screen isn't fully in view when a spot is chosen, the page glides
     so the screen sits just under the nav and the button can be seen landing. */
  (function () {
    var narrow = win.matchMedia('(max-width: 1023px)');
    var scr = $('[data-ec-lab] .ec-screen');
    if (!scr) return;
    $$('[data-ec-lab] input[name="ec-spot"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (!narrow.matches) return;
        var bar = $('[data-nav] .nav-bar'), top = (bar ? bar.getBoundingClientRect().bottom : 70) + 10;
        var b = scr.getBoundingClientRect();
        if (b.top >= top - 2 && b.bottom <= win.innerHeight + 2) return;
        win.scrollBy({ top: b.top - top, behavior: motionOff() ? 'auto' : 'smooth' });
      });
    });
  })();

  /* ------------------------------------------------------------ phones: hosted vs custom as a swipeable deck
     (the shared .compare cards under 640px, in one scroll-snap row with two keycaps and a bead pager) */
  $$('.ec-build table.compare').forEach(function (table) {
    var body = table.tBodies[0];
    if (!body) return;
    var rows = $$('tr', body), N = rows.length, idx = -1;
    var nav = doc.createElement('div');
    nav.className = 'ec-cmp-nav';
    nav.innerHTML = '<button type="button" data-d="-1" aria-label="Previous comparison"><span aria-hidden="true">←</span></button>' +
      '<span class="ec-cmp-dots" aria-hidden="true">' + rows.map(function () { return '<i></i>'; }).join('') + '</span>' +
      '<span class="ec-cmp-count" aria-hidden="true"></span>' +
      '<button type="button" data-d="1" aria-label="Next comparison"><span aria-hidden="true">→</span></button>';
    var wrap = table.closest('.table-wrap') || table;
    wrap.parentNode.insertBefore(nav, wrap.nextSibling);
    var dots = $$('.ec-cmp-dots i', nav), count = $('.ec-cmp-count', nav), btns = $$('button', nav);
    var mq = win.matchMedia('(max-width: 639px)');
    var syncTab = function () { if (mq.matches) body.setAttribute('tabindex', '0'); else body.removeAttribute('tabindex'); };
    syncTab();
    if (mq.addEventListener) mq.addEventListener('change', syncTab); else if (mq.addListener) mq.addListener(syncTab);
    function set(i) {
      if (i === idx) return; idx = i;
      rows.forEach(function (r, k) { r.classList.toggle('is-on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
      count.textContent = (i + 1) + ' / ' + N;
      btns[0].disabled = i === 0; btns[1].disabled = i === N - 1;
    }
    function current() {
      var x = body.scrollLeft, best = 0, bd = Infinity;
      rows.forEach(function (r, k) { var d = Math.abs(r.offsetLeft - rows[0].offsetLeft - x); if (d < bd) { bd = d; best = k; } });
      return best;
    }
    var tick = false;
    body.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; set(current()); }); } }, { passive: true });
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var n = clamp(current() + +b.getAttribute('data-d'), 0, N - 1);
        body.scrollTo({ left: rows[n].offsetLeft - rows[0].offsetLeft, behavior: motionOff() ? 'auto' : 'smooth' });
        set(n);
      });
    });
    set(0);
  });
})();
