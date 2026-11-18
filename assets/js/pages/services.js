// Signature component: The Service Keyboard — press a keycap (or type its letter) and the screen types out who the service is for, what you get and the timeline; two keys in a row show how they combine.
/* /services/ page behaviour (prefix sv-). Also: rolling job beads on touch screens, label tapes that print in,
   a wiring diagram that draws itself, and parallax depth on the two artworks. Everything respects
   html.motion-off (the site's Motion toggle / reduced motion) by showing final states. */
(function () {
  'use strict';
  var root = document.documentElement;
  var motionOff = function () { return root.classList.contains('motion-off'); };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var hasIO = 'IntersectionObserver' in window;
  var navSpace = function () { var n = $('[data-nav] .nav-bar'); return n ? n.getBoundingClientRect().bottom + 12 : 84; };
  // Below the fold right now? Only then is it worth arming an entrance (never hide what someone already sees).
  var belowFold = function (el) { return el.getBoundingClientRect().top > window.innerHeight * 0.92; };

  /* ============================================================ The Service Keyboard */
  var kb = $('[data-sv-kb]');
  if (kb) {
    var ORDER = 'celarpik';
    var COMBOS = {
      ce: 'Custom site + e-commerce: your story and your shop in one design and one codebase.',
      cl: 'Custom site + landing page: the full site builds trust, a focused page carries each campaign.',
      ca: 'Custom site + AI search: pages written answer-first, with structured data from day one.',
      cr: 'Custom site + redesign: a from-scratch design that keeps the content and rankings worth keeping.',
      cp: 'Custom site + product design: the marketing site and the product speak one visual language.',
      ci: 'Custom site + integrations: forms, bookings and your CRM connected, so leads land where you work.',
      ck: 'Custom site + care: launched, then kept fast, secure and up to date.',
      el: 'E-commerce + landing page: a launch page for a new product that sends buyers straight to checkout.',
      ea: 'E-commerce + AI search: product pages with structured data that search and AI assistants can read.',
      er: 'E-commerce + redesign: a new storefront that keeps your catalog and your existing links working.',
      ep: 'E-commerce + product design: the shopping flow designed and prototyped before a line of code.',
      ei: 'E-commerce + integrations: payments, shipping and email tools wired into one smooth flow.',
      ek: 'E-commerce + care: checkout and payments watched and kept up to date after launch.',
      la: 'Landing page + AI search: a launch page that search and AI assistants can read on day one.',
      lr: 'Landing page + redesign: try a new direction on one page before you redesign the whole site.',
      lp: 'Landing page + product design: a page that shows the real interface, designed alongside it.',
      li: 'Landing page + integrations: sign-ups flow straight into your email or CRM tool.',
      lk: 'Landing page + care: copy and offer changes after launch, without starting a new project.',
      ar: 'AI search + redesign: the new site launches with structured data and answer-first pages built in.',
      ap: 'AI search + product design: help and docs pages that AI assistants can quote accurately.',
      ai: 'AI search + integrations: structured data generated from your CMS, so it stays accurate as content changes.',
      ak: 'AI search + care: regular checks that crawlers can reach the site and the structured data stays valid.',
      rp: 'Redesign + product design: the website and the product refreshed together, in one design system.',
      ri: 'Redesign + integrations: a rebuilt site with clean connections in place of a pile of plugins.',
      rk: 'Redesign + care: the new site launched, then kept healthy month after month.',
      pi: 'Product design + integrations: interfaces designed around the tools and data your team already uses.',
      pk: 'Product design + care: the design system kept up to date as the product grows.',
      ik: 'Integrations + care: connections monitored and updated when the tools on the other end change.'
    };
    var letter = function (k) { return k.toUpperCase(); };
    var pairKey = function (a, b) { return ORDER.indexOf(a) < ORDER.indexOf(b) ? a + b : b + a; };

    var keysBar = $('[data-sv-keys]', kb);
    var keys = $$('.sv-key', kb);
    var items = {};
    $$('.sv-item', kb).forEach(function (li) { items[li.getAttribute('data-sv-key')] = li; });
    var chordEl = $('[data-sv-chord]', kb);
    var live = $('[data-sv-live]', kb);
    var stack = $('[data-sv-combo-stack]', kb);
    var hint = $('.sv-combo-hint', stack);
    hint.setAttribute('data-k', 'Combo');
    var screen = $('[data-sv-screen]', kb);
    var caseEl = $('.sv-case', kb);
    var caret = document.createElement('i');
    caret.className = 'sv-caret';
    caret.setAttribute('aria-hidden', 'true');

    // every combo line sits in the same grid cell as the hint, so the strip is always as tall as the longest one
    var comboEls = {};
    Object.keys(COMBOS).forEach(function (k) {
      var p = document.createElement('p');
      var t = COMBOS[k], c = t.indexOf(':');
      var b = document.createElement('b');
      b.textContent = t.slice(0, c + 1);
      p.appendChild(b);
      p.appendChild(document.createTextNode(t.slice(c + 1)));
      stack.appendChild(p);
      comboEls[k] = p;
    });

    var active = null, prev = null, raf = 0, typingLi = null;
    var deck = $('.sv-deck', kb);
    var enter = $('[data-sv-enter]', kb), enterT = $('[data-sv-enter-t]', kb), enterB = $('[data-sv-enter-b]', kb);
    var keyOf = function (btn) { return btn.getAttribute('data-sv-key'); };
    var btnOf = function (k) { return keys.filter(function (b) { return keyOf(b) === k; })[0]; };

    // roving tabindex: one tab stop for the whole keyboard; arrows move between keys
    var setRoving = function (btn) { keys.forEach(function (b) { b.tabIndex = b === btn ? 0 : -1; }); };
    setRoving(keys[0]);

    var finishTyping = function () {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (typingLi) {
        $$('dd', typingLi).forEach(function (dd) { if (dd.hasAttribute('data-full')) dd.textContent = dd.getAttribute('data-full'); });
        var dds = $$('dd', typingLi);
        dds[dds.length - 1].appendChild(caret);
      }
      typingLi = null;
      kb.classList.remove('is-typing');
    };

    var typeOut = function (li) {
      finishTyping();
      var dds = $$('dd', li);
      var texts = dds.map(function (dd) {
        if (!dd.hasAttribute('data-full')) dd.setAttribute('data-full', dd.textContent);
        return dd.getAttribute('data-full');
      });
      typingLi = li;
      if (motionOff()) { finishTyping(); return; }
      var parts = dds.map(function (dd, i) {
        var on = document.createElement('span'), off = document.createElement('span');
        off.className = 'sv-ghost';
        off.textContent = texts[i];
        dd.textContent = '';
        dd.appendChild(on); dd.appendChild(off);
        return { dd: dd, on: on, off: off, text: texts[i] };
      });
      var total = texts.reduce(function (n, t) { return n + t.length; }, 0);
      var dur = Math.max(520, Math.min(1150, total * 6)); // fast terminal feel, ~1s for the longest card
      var t0 = 0;
      kb.classList.add('is-typing');
      var step = function (now) {
        if (!t0) t0 = now;
        var n = Math.min(total, Math.round(total * (now - t0) / dur));
        var left = n;
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], c = Math.max(0, Math.min(p.text.length, left));
          p.on.textContent = p.text.slice(0, c);
          p.off.textContent = p.text.slice(c);
          left -= p.text.length;
          if (c > 0 && c < p.text.length) p.dd.insertBefore(caret, p.off);
        }
        if (n < total) raf = requestAnimationFrame(step);
        else finishTyping();
      };
      raf = requestAnimationFrame(step);
    };

    var press = function (k) {
      var btn = btnOf(k), li = items[k];
      if (!btn || !li) return;
      prev = active;
      active = k;
      // single-select: the key whose answer is on screen is the current one (not an independent toggle)
      keys.forEach(function (b) {
        b.classList.toggle('is-on', b === btn);
        if (b === btn) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      Object.keys(items).forEach(function (x) { items[x].classList.toggle('is-on', x === k); });
      kb.classList.add('has-key');

      // combo: the previous key and this one, if they differ
      var combo = prev && prev !== k ? comboEls[pairKey(prev, k)] : null;
      hint.classList.toggle('is-on', !combo);
      kb.classList.toggle('has-combo', !!combo);
      Object.keys(comboEls).forEach(function (x) { comboEls[x].classList.toggle('is-on', comboEls[x] === combo); });
      chordEl.textContent = combo ? letter(prev) + ' + ' + letter(k) : letter(k);
      if (combo) combo.setAttribute('data-k', chordEl.textContent); // the phone pill reads in the order you pressed

      // restart the title spring
      var t = $('.sv-item-t', li);
      t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';

      typeOut(li);

      // the long Enter key under the keys opens the service on screen (it follows the keys in focus order)
      var go = $('.sv-item-go', li);
      if (go && enter) {
        enter.setAttribute('href', go.getAttribute('href'));
        enterT.textContent = $('span', go).textContent;
        enterB.textContent = $('b', go).textContent;
        if (!motionOff()) { enter.classList.remove('is-new'); void enter.offsetWidth; enter.classList.add('is-new'); }
      }

      // one announcement with the whole answer (never character by character)
      var d = $$('dt', li).map(function (dt, i) { return dt.textContent + ': ' + $$('dd', li)[i].getAttribute('data-full'); });
      var msg = $('.sv-item-t', li).textContent.replace(/^[A-Z]/, '') + '. ' + d.join(' ') + (combo ? ' ' + combo.textContent : '');
      live.textContent = '';
      setTimeout(function () { live.textContent = msg; }, 40);

      if (!motionOff()) {
        caseEl.classList.remove('is-thunk'); void caseEl.offsetWidth; caseEl.classList.add('is-thunk');
      }
      keepInView();
    };

    // Scroll only as far as needed. If the screen and the keys fit between the nav and the bottom edge, show both;
    // if they don't (a short phone with its toolbars, or bigger text), keep the keys under the finger and show as
    // much of the screen as fits. Never push the tapped row out of view.
    var keepInView = function () {
      var top = navSpace(), vh = window.innerHeight, pad = 8;
      var s = screen.getBoundingClientRect(), d = deck.getBoundingClientRect();
      var dy = 0;
      if (d.bottom - s.top <= vh - pad - top) {
        if (s.top < top) dy = s.top - top;
        else if (d.bottom > vh - pad) dy = d.bottom - (vh - pad);
      } else {
        // too tall: line the deck's bottom up with the screen's bottom edge, which shows the most screen above it
        dy = d.bottom - (vh - pad);
        if (s.top - dy > top) dy = s.top - top; // never scroll further than the screen top needs
      }
      if (Math.abs(dy) > 2) window.scrollBy({ top: dy, behavior: motionOff() ? 'auto' : 'smooth' });
    };

    // physical feel: the cap goes down on pointer/keyboard down and springs back on release
    var down = function (btn) { btn.classList.add('is-down'); };
    var up = function (btn) { btn.classList.remove('is-down'); };
    var tap = function (btn) { down(btn); setTimeout(function () { up(btn); }, 110); };
    keys.forEach(function (btn) {
      btn.addEventListener('pointerdown', function () { down(btn); });
      ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (ev) { btn.addEventListener(ev, function () { up(btn); }); });
      btn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') down(btn); });
      btn.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') up(btn); });
      btn.addEventListener('click', function (e) {
        if (e.detail === 0) tap(btn); // keyboard activation: give it the same travel
        setRoving(btn);
        press(keyOf(btn));
      });
    });

    // keyboard: arrows move (nearest key in the row above/below), Home/End, letters press their key
    keysBar.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var cur = document.activeElement, i = keys.indexOf(cur);
      if (i < 0) return;
      var go = null;
      if (e.key === 'ArrowRight') go = keys[(i + 1) % keys.length];
      else if (e.key === 'ArrowLeft') go = keys[(i - 1 + keys.length) % keys.length];
      else if (e.key === 'Home') go = keys[0];
      else if (e.key === 'End') go = keys[keys.length - 1];
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        var r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, dir = e.key === 'ArrowDown' ? 1 : -1, best = null, bestD = Infinity;
        keys.forEach(function (b) {
          var r = b.getBoundingClientRect();
          if (dir > 0 ? r.top < r0.bottom - 4 : r.bottom > r0.top + 4) return;
          var dy = Math.abs(r.top - r0.top), dx = Math.abs(r.left + r.width / 2 - cx), dist = dy * 4 + dx;
          if (dist < bestD) { bestD = dist; best = b; }
        });
        go = best || cur;
      } else if (e.key.length === 1 && ORDER.indexOf(e.key.toLowerCase()) > -1) {
        var b = btnOf(e.key.toLowerCase());
        e.preventDefault();
        setRoving(b); b.focus(); tap(b); press(keyOf(b));
        return;
      }
      if (go) { e.preventDefault(); setRoving(go); go.focus(); }
    });
  }

  /* ============================================================ keep the WhatsApp bead off the keys and the job pills
     Page-scoped: while the keyboard or the job list crosses the bottom band where the bead floats, .sv-hold-wa on
     <main> lets services.css tuck the bead away (app.js keeps deciding everything else about it). */
  var mainEl = $('#main');
  var holdEls = [$('.sv-case'), $('[data-sv-jobs]')].filter(Boolean);
  if (mainEl && holdEls.length && hasIO) {
    var holding = new Set();
    var hio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) holding.add(en.target); else holding.delete(en.target); });
      mainEl.classList.toggle('sv-hold-wa', holding.size > 0);
    }, { rootMargin: '-86% 0px 0px 0px' });
    holdEls.forEach(function (el) { hio.observe(el); });
  }

  /* ============================================================ job rows: beads roll on touch screens */
  var jobs = $$('[data-sv-jobs] .sv-job');
  if (jobs.length && hasIO && window.matchMedia('(hover: none)').matches) {
    var jio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, idx = jobs.indexOf(el);
        setTimeout(function () { el.classList.add('is-rolled'); }, motionOff() ? 0 : idx % 3 * 90);
        jio.unobserve(el);
      });
    }, { rootMargin: '0px 0px -28% 0px' });
    jobs.forEach(function (j) { jio.observe(j); });
  }

  /* ============================================================ label tapes print in */
  var tapes = $('[data-sv-tapes]');
  if (tapes && hasIO && !motionOff() && belowFold(tapes)) {
    tapes.classList.add('sv-armed');
    var tio = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      tapes.classList.add('is-printed');
      tio.disconnect();
      // drop the armed state once the last tape has stuck, so nothing depends on the animation afterwards
      setTimeout(function () { tapes.classList.remove('sv-armed'); }, 2600);
    }, { rootMargin: '0px 0px -18% 0px' });
    tio.observe(tapes);
  }

  /* ============================================================ wiring diagram: draws itself, packets on hover/tap */
  var dg = $('[data-sv-diagram]');
  if (dg) {
    var paths = {}, nodes = {}, rows = {};
    $$('[data-sv-path]', dg).forEach(function (p) { paths[p.getAttribute('data-sv-path')] = p; });
    $$('[data-sv-node]', dg).forEach(function (n) { nodes[n.getAttribute('data-sv-node')] = n; });
    $$('[data-sv-wire]').forEach(function (li) { rows[li.getAttribute('data-sv-wire')] = li; });
    var layer = $('[data-sv-packets]', dg);
    var NS = 'http://www.w3.org/2000/svg';
    var hot = function (k, on) {
      if (paths[k]) paths[k].classList.toggle('is-hot', on);
      if (nodes[k]) nodes[k].classList.toggle('is-hot', on);
      if (rows[k]) rows[k].classList.toggle('is-hot', on);
    };
    var send = function (k, delay) {
      if (motionOff() || !paths[k]) return;
      var path = paths[k], len = path.getTotalLength();
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', '5');
      var start = 0;
      var tick = function (now) {
        if (!start) { start = now; layer.appendChild(c); }
        var t = Math.min(1, (now - start) / 620), e = 1 - Math.pow(1 - t, 3);
        var pt = path.getPointAtLength(e * len);
        c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
        if (t < 1) requestAnimationFrame(tick);
        else {
          c.remove();
          var n = nodes[k];
          if (n && n.animate) n.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }
      };
      setTimeout(function () { requestAnimationFrame(tick); }, delay || 0);
    };
    var keysOrder = Object.keys(paths);
    // mouse: hover lights a wire and sends a packet; touch/pen: a tap does the same for a moment
    var timers = {};
    var bind = function (el, k) {
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hot(k, true); send(k); } });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hot(k, false); });
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        clearTimeout(timers[k]);
        hot(k, true); send(k);
        timers[k] = setTimeout(function () { hot(k, false); }, 1100);
      });
    };
    keysOrder.forEach(function (k) {
      if (rows[k]) bind(rows[k], k);
      if (nodes[k]) bind(nodes[k], k);
    });
    // pointer events on the decorative svg only (the figure stays aria-hidden; the list carries the content)
    if (hasIO && !motionOff() && belowFold(dg)) {
      dg.classList.add('sv-armed');
      var dio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        dio.disconnect();
        dg.classList.add('is-drawn');
        dg.classList.remove('sv-armed');
        keysOrder.forEach(function (k, i) { send(k, 1500 + i * 160); });
      }, { rootMargin: '0px 0px -22% 0px' });
      dio.observe(dg);
    }
  }

  /* ============================================================ parallax depth on the two artworks */
  var depth = $$('[data-sv-depth]');
  if (depth.length && hasIO) {
    var visible = [], ticking = false;
    var update = function () {
      ticking = false;
      if (motionOff()) { depth.forEach(function (f) { f.style.removeProperty('--sv-p'); }); return; }
      var vh = window.innerHeight;
      visible.forEach(function (f) {
        var r = f.getBoundingClientRect();
        var p = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2); // -1 (leaving top) .. 1 (entering bottom)
        f.style.setProperty('--sv-p', Math.max(-1, Math.min(1, p)).toFixed(3));
      });
    };
    var onScroll = function () { if (!ticking && visible.length) { ticking = true; requestAnimationFrame(update); } };
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = visible.indexOf(en.target);
        if (en.isIntersecting && i < 0) visible.push(en.target);
        else if (!en.isIntersecting && i > -1) visible.splice(i, 1);
      });
      onScroll();
    });
    depth.forEach(function (f) { vio.observe(f); });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  /* ============================================================ phones: the tapes become a label sheet
     ≤ 767px the eight tapes sit together like printed labels; tapping one prints its line into one strip under
     the sheet. While the sheet is on screen it steps through the labels by itself (motion on), until the first
     tap. Wider screens (and no JS) keep every tape with its own description. */
  if (tapes) (function () {
    var mq = window.matchMedia('(max-width: 767px)');
    var items = $$('[data-sv-tapes] > li');
    var N = items.length, cur = 0, on = false, auto = null, user = false, seen = false, DWELL = 3600;
    var out = document.createElement('div');
    out.className = 'sv-tape-out'; out.id = 'sv-tape-out';
    out.innerHTML = '<p class="sv-tape-out-k"><span>Label</span><b></b></p><p class="sv-tape-out-t"></p><p class="sv-tape-out-d"></p><span class="sv-tape-out-bar" aria-hidden="true"><i></i></span>';
    out.style.setProperty('--sv-dwell', DWELL + 'ms');
    var outN = $('.sv-tape-out-k b', out), outT = $('.sv-tape-out-t', out), outD = $('.sv-tape-out-d', out), bar = $('.sv-tape-out-bar i', out);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    function show(i, fromUser) {
      cur = (i + N) % N;
      items.forEach(function (li, k) { var b = $('.sv-tape-b', li); if (b) b.setAttribute('aria-pressed', String(k === cur)); });
      var tape = $('.sv-tape', items[cur]), d = $('.sv-tape-d', items[cur]);
      outN.textContent = pad(cur + 1) + ' / ' + pad(N);
      outT.textContent = tape.textContent;
      outD.textContent = d ? d.textContent : '';
      out.setAttribute('aria-live', fromUser ? 'polite' : 'off');
      out.classList.toggle('is-new', false); void out.offsetWidth;
      if (!motionOff()) out.classList.add('is-new');
      // restart the progress rail
      if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    }
    function stopAuto() { clearInterval(auto); auto = null; out.classList.toggle('is-auto', false); }
    function startAuto() {
      if (auto || user || motionOff() || !on || !seen) return;
      out.classList.add('is-auto');
      auto = setInterval(function () { show(cur + 1, false); }, DWELL);
    }
    function enable() {
      if (on) return; on = true;
      items.forEach(function (li, k) {
        var tape = $('.sv-tape', li), b = document.createElement('button');
        b.type = 'button'; b.className = 'sv-tape-b'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-controls', 'sv-tape-out');
        li.insertBefore(b, tape); b.appendChild(tape);
        b.addEventListener('click', function () { user = true; stopAuto(); show(k, true); });
      });
      tapes.classList.add('is-sheet');
      tapes.parentNode.insertBefore(out, tapes.nextSibling);
      show(cur, false);
      startAuto();
    }
    function disable() {
      if (!on) return; on = false; stopAuto();
      items.forEach(function (li) { var b = $('.sv-tape-b', li); if (b) li.replaceChild($('.sv-tape', b), b); });
      tapes.classList.toggle('is-sheet', false);
      if (out.parentNode) out.parentNode.removeChild(out);
    }
    var sync = function () { if (mq.matches) enable(); else disable(); };
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
    if (hasIO) {
      new IntersectionObserver(function (en) {
        seen = en[0].isIntersecting;
        if (seen) startAuto(); else stopAuto();
      }, { rootMargin: '0px 0px -20% 0px' }).observe(tapes);
    }
    // the Motion toggle stops the autoplay straight away
    new MutationObserver(function () { if (motionOff()) stopAuto(); else startAuto(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  })();

  /* ============================================================ phones: the agency comparison as a swipeable deck
     (the cards come from site.css under 640px; the row, the keycaps and the bead pager only show there) */
  $$('.sv-vs table.compare').forEach(function (table) {
    var body = table.tBodies[0];
    if (!body) return;
    var rows = $$('tr', body), N = rows.length, idx = -1;
    var nav = document.createElement('div');
    nav.className = 'sv-cmp-nav';
    nav.innerHTML = '<button type="button" data-d="-1" aria-label="Previous question"><span aria-hidden="true">←</span></button>' +
      '<span class="sv-cmp-dots" aria-hidden="true">' + rows.map(function () { return '<i></i>'; }).join('') + '</span>' +
      '<span class="sv-cmp-count" aria-hidden="true"></span>' +
      '<button type="button" data-d="1" aria-label="Next question"><span aria-hidden="true">→</span></button>';
    var wrap = table.closest('.table-wrap') || table;
    wrap.parentNode.insertBefore(nav, wrap.nextSibling);
    var dots = $$('.sv-cmp-dots i', nav), count = $('.sv-cmp-count', nav), btns = $$('button', nav);
    var mq = window.matchMedia('(max-width: 639px)');
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
        var n = Math.max(0, Math.min(N - 1, current() + +b.getAttribute('data-d')));
        body.scrollTo({ left: rows[n].offsetLeft - rows[0].offsetLeft, behavior: motionOff() ? 'auto' : 'smooth' });
        set(n);
      });
    });
    set(0);
  });
})();
