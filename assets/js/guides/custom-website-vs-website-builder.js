// Signature component: Sounds Like Me — swipe ten situation cards right ("sounds like me") or left; the ones you keep are lobbed down into the Builder or Custom dish below the deck with their reason, and a result says which way you lean.
/* /guides/custom-website-vs-website-builder/ page script (prefix .cvb-). Vanilla, no dependencies; touches only this
   page's own DOM. Also runs the page's smaller living touches: edge beads that roll to the winning side of each
   comparison row, the two icebergs (phone toggle + a waterline that drifts with the scroll) and the stepping stones
   that drop into the river and bob with a ripple when you step on them.
   Without JS the deck is a readable table of the ten situations. Motion off (html.motion-off: the site toggle or
   prefers-reduced-motion) = every change is instant, nothing flies or bobs. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const still = () => root.classList.contains('motion-off');
  const canAnimate = typeof Element !== 'undefined' && 'animate' in Element.prototype;
  const hasIO = 'IntersectionObserver' in window;
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  /* Arm an entrance only for blocks that are still below the fold (never hide what someone is already reading). */
  const arm = (el, onIn) => {
    if (!el) return;
    const go = () => { el.classList.add('is-in'); if (onIn) onIn(); };
    if (still() || !hasIO || el.getBoundingClientRect().top < innerHeight * 0.9) { go(); return; }
    el.classList.add('is-armed');
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); go(); }
    }, { rootMargin: '0px 0px -16% 0px' });
    io.observe(el);
  };

  /* ================================================================ Sounds Like Me (signature) */
  const slm = $('[data-cvb-slm]');
  if (slm) (() => {
    const app = $('[data-slm-app]', slm);
    const table = $('.cvb-slm-static', slm);
    const deck = $('[data-slm-deck]', slm);
    const result = $('[data-slm-result]', slm);
    const rows = table ? $$('tbody tr[data-side]', table) : [];
    if (!app || !deck || !result || !rows.length) return;

    const data = rows.map((tr, i) => ({ i, side: tr.dataset.side, q: tr.cells[0].textContent.trim(), why: tr.cells[2].textContent.trim() }));
    const N = data.length;
    const SIDE = { builder: 'a website builder', custom: 'a custom website', both: 'either option' };
    const DONE_HINT = 'Changed your mind? Undo takes back the last card.';
    const TAG = { builder: 'Builder', custom: 'Custom', both: 'Either', no: 'Not me' };
    const ROT = [-2.4, 1.8, -1.2, 2.6, -1.8, 1.2, -2.8, 2.1, -1, 2.4];
    const TILT = [-7, 5, -3, 8, -5, 3, -8, 6, -2, 4];

    const countEl = $('[data-slm-count]', app);
    const beadsEl = $('[data-slm-beads]', app);
    const reason = $('[data-slm-reason]', app);
    const btn = { yes: $('[data-slm-act="yes"]', app), no: $('[data-slm-act="no"]', app), undo: $('[data-slm-act="undo"]', app) };
    const dish = { builder: $('[data-slm-dish="builder"]', app), custom: $('[data-slm-dish="custom"]', app) };
    const num = { builder: $('[data-slm-n="builder"]', app), custom: $('[data-slm-n="custom"]', app) };
    const pile = { builder: $('.cvb-dish-stack', dish.builder), custom: $('.cvb-dish-stack', dish.custom) };

    const how = $('.cvb-slm-how', slm);
    if (how) how.textContent = 'Swipe a card right if it sounds like you and left if it doesn\'t, or use the buttons or your arrow keys. Every card you keep drops into the dish it usually points to, with the reason. Ten cards, about a minute.';
    countEl.id = 'cvb-slm-count';

    const beads = data.map(() => beadsEl.appendChild(document.createElement('i')));
    const cards = data.map((d) => {
      const c = document.createElement('div');
      c.className = 'cvb-card';
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', `Card ${d.i + 1} of ${N}`);
      c.innerHTML = `<p class="cvb-card-k"><span class="cvb-card-l"><i class="cvb-card-bead" aria-hidden="true">“</i>Situation</span><b>${pad(d.i + 1)} / ${N}</b></p>`
        + `<p class="cvb-card-q" id="cvb-q-${d.i}">${esc(d.q)}</p>`
        + '<p class="cvb-card-h" aria-hidden="true"><span>← Not me</span><span>Sounds like me →</span></p>'
        + '<span class="cvb-stamp cvb-stamp-yes" aria-hidden="true">Sounds like me</span>'
        + '<span class="cvb-stamp cvb-stamp-no" aria-hidden="true">Not me</span>';
      deck.appendChild(c);
      return c;
    });

    let pos = 0;
    const history = [];                      // { k, choice, landed }
    const counts = { builder: 0, custom: 0 };
    const slivers = { builder: [], custom: [] };

    const setVars = (c, x, rot, lift, yes, no) => {
      c.style.setProperty('--x', `${x}px`);
      c.style.setProperty('--rot', rot);
      c.style.setProperty('--y', `${lift}px`);
      c.style.setProperty('--yes', yes);
      c.style.setProperty('--no', no);
    };

    const layout = () => {
      cards.forEach((c, k) => {
        const d = k - pos;
        c.classList.toggle('is-top', d === 0);
        if (c.classList.contains('is-flying')) return;
        c.hidden = d < 0;
        if (d < 0) return;
        c.style.setProperty('--d', Math.min(d, 3));
        c.classList.toggle('is-deep', d > 3);
        if (d === 0) { c.removeAttribute('aria-hidden'); c.inert = false; setVars(c, 0, 0, 0, 0, 0); }
        else { c.setAttribute('aria-hidden', 'true'); c.inert = true; setVars(c, 0, ROT[k % ROT.length], 0, 0, 0); }
      });
      countEl.textContent = pos < N ? `Card ${pos + 1} of ${N}` : `All ${N} cards sorted`;
      // the top card's statement is read with each answer button, so a screen-reader user hears what they're answering
      [btn.yes, btn.no].forEach((b) => { if (pos < N) b.setAttribute('aria-describedby', `${countEl.id} cvb-q-${pos}`); else b.removeAttribute('aria-describedby'); });
      btn.yes.disabled = btn.no.disabled = pos >= N;
      btn.undo.disabled = !history.length;
    };

    const bump = (el) => {
      if (still()) return;
      el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
    };
    dish.builder.addEventListener('animationend', () => dish.builder.classList.remove('is-bump'));
    dish.custom.addEventListener('animationend', () => dish.custom.classList.remove('is-bump'));

    const sidesOf = (side) => (side === 'both' ? ['builder', 'custom'] : [side]);
    const land = (side) => {
      sidesOf(side).forEach((s) => {
        const i = document.createElement('i');
        const k = slivers[s].length;
        i.style.setProperty('--k', Math.min(k, 7));
        i.style.setProperty('--tilt', TILT[k % TILT.length]);
        i.className = 'is-new';
        pile[s].appendChild(i);
        slivers[s].push(i);
        bump(dish[s]);
      });
    };
    const unland = (side) => sidesOf(side).forEach((s) => { const i = slivers[s].pop(); if (i) i.remove(); });
    const paintCounts = () => { num.builder.textContent = counts.builder; num.custom.textContent = counts.custom; };

    /* the reason line reserves the height of its longest message at the current width, so the dishes, beads and the
       answer keys never move under the thumb from one card to the next */
    const reserve = () => {
      const w = reason.getBoundingClientRect().width;
      if (!w) return;
      const ghost = reason.cloneNode(false);
      ghost.removeAttribute('data-slm-reason'); ghost.removeAttribute('aria-live'); ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText = `position:absolute;left:0;top:0;width:${w}px;min-height:0;visibility:hidden;pointer-events:none;margin:0`;
      reason.parentNode.appendChild(ghost);
      const msgs = ['Keep the cards that sound like you.'];
      data.forEach((d) => {
        msgs.push(`<span><span class="cvb-tag cvb-tag-${d.side}">${TAG[d.side]}</span><b>“${esc(d.q)}”</b> ${esc(d.why)}</span>`);
        msgs.push(`<span><span class="cvb-tag cvb-tag-no">${TAG.no}</span><b>“${esc(d.q)}”</b> Set aside. It usually points to ${SIDE[d.side]}.</span>`);
        msgs.push(`<span>Back on the deck: <b>“${esc(d.q)}”</b></span>`);
      });
      let h = 0;
      msgs.forEach((m) => { ghost.innerHTML = m; h = Math.max(h, ghost.offsetHeight); });
      ghost.remove();
      app.style.setProperty('--cvb-rh', Math.ceil(h) + 'px');
    };
    let rw = 0;
    if ('ResizeObserver' in window) new ResizeObserver(() => { const w = Math.round(reason.getBoundingClientRect().width); if (w && w !== rw) { rw = w; reserve(); } }).observe(reason);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);

    const nextLine = () => (pos < N ? `<span class="sr"> Next, card ${pos + 1} of ${N}: ${esc(data[pos].q)}</span>` : '<span class="sr"> That was the last card. Your result takes the place of the deck.</span>');

    /* the card's flight: a toss into its dish (kept) or off the table to the left (not me) */
    const fly = (c, choice, side, done) => {
      if (still() || !canAnimate) { done(); return; }
      c.classList.add('is-flying');
      c.classList.remove('is-drag');
      const from = getComputedStyle(c).transform;
      let frames, opts;
      if (choice === 'no') {
        const w = deck.clientWidth;
        frames = [{ transform: from, opacity: 1 }, { transform: `translate3d(${-(w * 0.75 + 80)}px, 46px, 0) rotate(-24deg) scale(.92)`, opacity: 0 }];
        opts = { duration: 440, easing: 'cubic-bezier(.4,.1,.6,1)', fill: 'forwards' };
      } else {
        const dr = deck.getBoundingClientRect();
        const lx = dr.left + c.offsetLeft + c.offsetWidth / 2;
        const ly = dr.top + c.offsetTop + c.offsetHeight / 2;
        let tx, ty;
        if (side === 'both') {
          const a = dish.builder.getBoundingClientRect(), b = dish.custom.getBoundingClientRect();
          tx = (a.left + b.right) / 2; ty = a.top + a.height * 0.32;
        } else {
          const r = dish[side].getBoundingClientRect();
          tx = r.left + r.width / 2; ty = r.top + r.height * 0.32;
        }
        // a lob, not a swerve: the card keeps the momentum of the swipe, rises, then drops into the dish below the deck
        const x0 = parseFloat(c.style.getPropertyValue('--x')) || 0;
        const dx = tx - lx, dy = ty - ly, dir = dx < 0 ? -1 : 1;
        const peak = x0 * 0.7 + dx * 0.3;
        frames = [
          { transform: from, opacity: 1 },
          { transform: `translate3d(${peak}px, -54px, 0) rotate(${dir * 6}deg) scale(.8)`, opacity: 1, offset: 0.38 },
          { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${dir * 14}deg) scale(.16)`, opacity: 0.15 },
        ];
        opts = { duration: 680, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' };
      }
      const anim = c.animate(frames, opts);
      c._fly = anim;
      anim.onfinish = () => { c._fly = null; c.classList.remove('is-flying'); c.hidden = true; anim.cancel(); done(); };
    };

    const decide = (choice) => {
      if (pos >= N) return;
      const k = pos, d = data[k], c = cards[k];
      const entry = { k, choice, landed: false };
      history.push(entry);
      pos++;
      beads[k].className = choice === 'yes' ? 'is-yes' : 'is-no';
      let msg;
      if (choice === 'yes') {
        sidesOf(d.side).forEach((s) => { counts[s]++; });
        paintCounts();
        msg = `<span class="cvb-tag cvb-tag-${d.side}">${TAG[d.side]}</span><b>“${esc(d.q)}”</b> ${esc(d.why)}`;
      } else {
        msg = `<span class="cvb-tag cvb-tag-no">${TAG.no}</span><b>“${esc(d.q)}”</b> Set aside. It usually points to ${SIDE[d.side]}.`;
      }
      reason.innerHTML = `<span>${msg}</span>` + nextLine();
      fly(c, choice, d.side, () => {
        if (!history.includes(entry)) return;
        if (choice === 'yes') { land(d.side); entry.landed = true; }
        if (pos >= N && history[history.length - 1] === entry) showResult();
      });
      // the answer keys are about to be disabled: hand focus to Undo first so it never drops to <body>
      if (pos >= N && (document.activeElement === btn.yes || document.activeElement === btn.no)) { btn.undo.disabled = false; btn.undo.focus({ preventScroll: true }); }
      layout();
      if (pos >= N && (still() || !canAnimate)) showResult();
    };

    const undo = () => {
      const entry = history.pop();
      if (!entry) return;
      const { k, choice } = entry, d = data[k], c = cards[k];
      if (c._fly) { c._fly.onfinish = null; c._fly.cancel(); c._fly = null; c.classList.remove('is-flying'); }
      if (choice === 'yes') {
        sidesOf(d.side).forEach((s) => { counts[s]--; });
        paintCounts();
        if (entry.landed) unland(d.side);
      }
      beads[k].className = '';
      pos = k;
      hideResult();
      layout();
      reason.innerHTML = `<span>Back on the deck: <b>“${esc(d.q)}”</b></span>`;
      if (!still() && canAnimate) {
        const to = getComputedStyle(c).transform;
        const start = choice === 'no' ? 'translate3d(-220px, 40px, 0) rotate(-18deg) scale(.9)' : 'translate3d(0, 120px, 0) rotate(6deg) scale(.5)';
        c.animate([{ transform: start, opacity: 0 }, { transform: to, opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    };

    const lean = () => {
      const kept = history.filter((h) => h.choice === 'yes').map((h) => data[h.k]);
      const b = kept.filter((d) => d.side === 'builder').length;
      const c = kept.filter((d) => d.side === 'custom').length;
      const e = kept.filter((d) => d.side === 'both').length;
      let key = 'middle';
      if (!kept.length) key = 'none';
      else if (b && !c) key = 'builder';
      else if (c && !b) key = 'custom';
      else if (b - c >= 2) key = 'builder';
      else if (c - b >= 2) key = 'custom';
      else if (!b && !c) key = 'either';
      return { kept, b, c, e, key };
    };

    const showResult = () => {
      const { kept, b, c, e, key } = lean();
      const n = kept.length;
      const plural = (x, one, many) => (x === 1 ? one : many);
      // only the sides that actually got cards are named (no "0 point to…")
      const parts = [];
      if (b) parts.push(`${b} ${plural(b, 'points', 'point')} to a website builder`);
      if (c) parts.push(`${c} ${plural(c, 'points', 'point')} to a custom website`);
      if (e) parts.push(`${e} ${plural(e, 'works', 'work')} either way`);
      const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
      const sum = !n ? 'You set all ten cards aside.'
        : n === 1 ? `One card sounds like you, and it ${joined.replace(/^1 /, '')}.`
        : parts.length === 1 ? `All ${n} cards that sound like you ${joined.replace(/^\d+ /, '')}.`
        : `Of the ${n} cards that sound like you, ${joined}.`;
      const copy = {
        builder: { t: 'You lean <span>builder.</span>', p: 'Your situation fits what builders do best. Start there, keep your content and domain in your own name, and revisit the decision when the site becomes a main source of business.', a: ['#when-a-builder-wins', 'When a builder wins', '↓'] },
        custom: { t: 'You lean <span>custom.</span>', p: 'Your site has a bigger job than a template is made for, so a custom build is likely worth it. The useful next step is a short list of what the site must do.', a: ['/contact/', 'Talk it through with me', '→'] },
        middle: { t: 'You\'re on <span>the middle path.</span>', p: 'You have good reasons on both sides. An in-between route, like a custom landing page next to a simple site, often fits best.', a: ['#middle-path', 'See the middle path', '↓'] },
        either: { t: 'Either route <span>can work.</span>', p: 'What you kept works with a builder and with a custom site, so the deciding rows are the ones below: who maintains it, what it costs over time and what you want to own.', a: ['#side-by-side', 'Compare them side by side', '↓'] },
        none: { t: 'None of these <span>sound like you.</span>', p: 'That\'s useful too: your situation is its own thing. Tell me what the site has to do and I\'ll give you a straight answer, even if it\'s “use a builder.”', a: ['/contact/', 'Ask me directly', '→'] },
      }[key];
      const LABEL = { builder: 'Points to a builder', custom: 'Points to custom', both: 'Works either way' };
      const col = (s) => {
        const items = kept.filter((d) => d.side === s);
        if (s === 'both' && !items.length) return '';
        const list = items.length
          ? `<ul class="cvb-rc-list">${items.map((d) => `<li><b>“${esc(d.q)}”</b>${esc(d.why)}</li>`).join('')}</ul>`
          : '<p class="cvb-rc-empty">No cards here.</p>';
        return `<div class="cvb-rc cvb-rc-${s}"><p class="cvb-rc-k">${LABEL[s]}</p>${list}</div>`;
      };
      result.className = `cvb-result cvb-lean-${key}`;
      result.innerHTML = '<p class="cvb-result-k">Your result</p>'
        + `<h3 tabindex="-1">${copy.t}</h3>`
        + `<p><strong>${sum}</strong> ${copy.p}</p>`
        + (n ? `<div class="cvb-result-cols">${b || c ? col('builder') + col('custom') : ''}${col('both')}</div>` : '')
        + `<div class="btn-row"><a class="btn btn-orange" href="${copy.a[0]}"><span>${copy.a[1]}</span><b class="btn-ico" aria-hidden="true">${copy.a[2]}</b></a>`
        + '<button class="btn btn-ghost" type="button" data-slm-again><span>Sort again</span><b class="btn-ico" aria-hidden="true">↺</b></button></div>';
      deck.hidden = true;
      result.hidden = false;
      app.classList.add('is-done');
      reason.textContent = DONE_HINT;
      if (!still()) { result.classList.add('is-new'); }
      $('[data-slm-again]', result).addEventListener('click', reset);
      const h = $('h3', result);
      h.focus({ preventScroll: true });
      const r = result.getBoundingClientRect();
      if (r.top < 70 || r.top > innerHeight * 0.6) result.scrollIntoView({ block: 'start', behavior: still() ? 'auto' : 'smooth' });
    };
    const hideResult = () => { result.hidden = true; result.innerHTML = ''; deck.hidden = false; app.classList.remove('is-done'); };

    const deal = () => {
      deck.classList.remove('is-armed');
      if (still() || !canAnimate) return;
      cards.slice(pos, pos + 4).forEach((c, j) => {
        const to = getComputedStyle(c).transform;
        c.animate([{ transform: `translate3d(0, -60px, 0) rotate(${j % 2 ? 8 : -8}deg) scale(.94)`, opacity: 0 }, { transform: to, opacity: 1 }],
          { duration: 760, delay: (3 - j) * 90, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
      });
    };

    function reset() {
      history.length = 0;
      pos = 0;
      counts.builder = counts.custom = 0;
      paintCounts();
      ['builder', 'custom'].forEach((s) => { slivers[s].forEach((i) => i.remove()); slivers[s].length = 0; });
      beads.forEach((b) => { b.className = ''; });
      cards.forEach((c) => { if (c._fly) { c._fly.onfinish = null; c._fly.cancel(); c._fly = null; } c.classList.remove('is-flying'); });
      hideResult();
      layout();
      reason.textContent = 'Fresh deck. Keep the cards that sound like you.';
      deal();
      btn.yes.focus({ preventScroll: true });
    }

    /* drag: horizontal only, so a vertical swipe still scrolls the page (touch-action: pan-y on the deck) */
    let drag = null;
    deck.addEventListener('pointerdown', (e) => {
      const c = cards[pos];
      if (!c || pos >= N || e.button > 0 || !c.contains(e.target)) return;
      drag = { c, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, vx: 0, lx: e.clientX, lt: e.timeStamp, locked: false };
    });
    deck.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.locked) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.locked = true;
        try { drag.c.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        drag.c.classList.add('is-drag');
      }
      e.preventDefault();
      const dt = e.timeStamp - drag.lt;
      if (dt > 0) drag.vx = drag.vx * 0.4 + ((e.clientX - drag.lx) / dt) * 0.6;
      drag.lx = e.clientX; drag.lt = e.timeStamp; drag.dx = dx;
      const t = clamp(dx / 110, -1, 1);
      setVars(drag.c, dx, dx * 0.07, -Math.abs(dx) * 0.06, Math.max(0, t), Math.max(0, -t));
    });
    const endDrag = (e, cancelled) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { c, dx, vx, locked } = drag;
      drag = null;
      if (!locked) return;
      c.classList.remove('is-drag');
      const w = c.offsetWidth || 300;
      if (!cancelled && (dx > w * 0.28 || (vx > 0.55 && dx > 24))) decide('yes');
      else if (!cancelled && (dx < -w * 0.28 || (vx < -0.55 && dx < -24))) decide('no');
      else setVars(c, 0, 0, 0, 0, 0);
    };
    deck.addEventListener('pointerup', (e) => endDrag(e, false));
    deck.addEventListener('pointercancel', (e) => endDrag(e, true));
    // touch pointers start implicitly captured by the inner element: only the card's own capture loss ends a drag
    deck.addEventListener('lostpointercapture', (e) => { if (drag && e.target === drag.c) endDrag(e, false); });

    btn.yes.addEventListener('click', () => decide('yes'));
    btn.no.addEventListener('click', () => decide('no'));
    btn.undo.addEventListener('click', () => { undo(); if (btn.undo.disabled) btn.yes.focus({ preventScroll: true }); });
    const press = (b) => {
      if (still() || !canAnimate || b.disabled) return;
      b.animate([{ transform: 'translateY(3px) scale(.97)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    };
    app.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('a, .cvb-result')) return;
      if (e.key === 'ArrowRight' && pos < N) { e.preventDefault(); press(btn.yes); decide('yes'); }
      else if (e.key === 'ArrowLeft' && pos < N) { e.preventDefault(); press(btn.no); decide('no'); }
    });

    /* mount: the table steps aside, the deck appears and deals itself once it scrolls into view */
    table.hidden = true;
    app.hidden = false;
    slm.classList.add('is-on');
    layout();
    if (hasIO && !still() && canAnimate) {
      // hide the cards until they're dealt, so the resting deck never flashes before it drops in
      if (deck.getBoundingClientRect().top > innerHeight * 0.8) deck.classList.add('is-armed');
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { io.disconnect(); deal(); }
      }, { rootMargin: '0px 0px -20% 0px' });
      io.observe(deck);
    }
  })();

  /* ================================================================ comparison table: edge beads roll to their side */
  arm($('[data-cvb-cmp]'));

  /* phones: the eight criteria become a swipe deck (one big card in front, its neighbours peeking). The card in
     front gets .is-front, so its edge bead rolls from the middle to its side each time it arrives; a keycap pager
     steps through. Table markup is untouched (wider screens and no-JS keep the table / stacked cards). */
  (() => {
    const t = $('[data-cvb-cmp]');
    const wrap = t && t.closest('.cvb-cmp-wrap');
    const body = t && t.tBodies[0];
    if (!wrap || !body) return;
    const rows = [...body.rows];
    const mq = matchMedia('(max-width: 639px)');
    const nav = document.createElement('div');
    nav.className = 'cvb-cmp-nav';
    nav.innerHTML = '<button type="button" class="cvb-cmp-b" data-d="-1" aria-label="Previous criterion"><span aria-hidden="true">←</span></button>'
      + '<div class="cvb-cmp-mid"><p class="cvb-cmp-n"></p><span class="cvb-cmp-pips" aria-hidden="true">' + rows.map(() => '<i></i>').join('') + '</span></div>'
      + '<button type="button" class="cvb-cmp-b" data-d="1" aria-label="Next criterion"><span aria-hidden="true">→</span></button>';
    wrap.after(nav);
    const nOut = $('.cvb-cmp-n', nav), pips = $$('.cvb-cmp-pips i', nav), btns = $$('.cvb-cmp-b', nav);
    let cur = -1;
    const setCur = (i) => {
      if (i === cur) return;
      cur = i;
      nOut.innerHTML = '<b>' + pad(i + 1) + '</b> / ' + pad(rows.length) + ' · swipe';
      rows.forEach((r, k) => r.classList.toggle('is-front', k === i));
      pips.forEach((p, k) => p.classList.toggle('is-on', k === i));
      btns.forEach((b) => { b.disabled = b.dataset.d === '-1' ? i === 0 : i === rows.length - 1; });
    };
    const centerOf = (r) => { const br = body.getBoundingClientRect(), rr = r.getBoundingClientRect(); return body.scrollLeft + (rr.left - br.left) - (body.clientWidth - rr.width) / 2; };
    let raf = 0;
    const track = () => {
      raf = 0;
      if (!mq.matches) return;
      const br = body.getBoundingClientRect(), mid = br.left + br.width / 2;
      let best = 0, bd = Infinity;
      rows.forEach((r, k) => { const rr = r.getBoundingClientRect(); const d = Math.abs(rr.left + rr.width / 2 - mid); if (d < bd) { bd = d; best = k; } });
      setCur(best);
    };
    body.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(track); }, { passive: true });
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('.cvb-cmp-b');
      if (!b || b.disabled) return;
      const i = clamp(cur + Number(b.dataset.d), 0, rows.length - 1);
      body.scrollTo({ left: centerOf(rows[i]), behavior: still() ? 'auto' : 'smooth' });
      setCur(i);
    });
    const sync = () => { if (mq.matches) { cur = -1; track(); } else rows.forEach((r) => r.classList.remove('is-front')); };
    if (mq.addEventListener) mq.addEventListener('change', sync);
    sync();
  })();

  /* the two "who wins" slabs: their chips pop in one by one when the slab arrives */
  $$('.cvb-fit').forEach((el) => arm(el));

  /* ================================================================ hidden costs: two icebergs */
  const berg = $('[data-cvb-berg]');
  if (berg) {
    const tabs = $('[data-berg-tabs]', berg);
    const panels = $$('[data-berg-panel]', berg);
    const seas = $$('.cvb-berg-sea', berg);
    berg.classList.add('is-js');
    if (tabs) {
      tabs.hidden = false;
      const keys = $$('[data-berg]', tabs);
      const show = (side, animate) => {
        keys.forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.berg === side)));
        panels.forEach((p) => {
          const on = p.dataset.bergPanel === side;
          p.classList.toggle('is-on', on);
          p.classList.remove('is-swap');
          if (on && animate && !still()) { void p.offsetWidth; p.classList.add('is-swap'); }
        });
      };
      keys.forEach((k) => k.addEventListener('click', () => { if (k.getAttribute('aria-pressed') !== 'true') show(k.dataset.berg, true); }));
      panels.forEach((p) => p.addEventListener('animationend', () => p.classList.remove('is-swap')));
      show('builder', false);
    }
    arm(berg);
    // the submerged part floats and the waves drift as the figure crosses the screen (scroll-linked, never autoplay)
    let live = false, ticking = false;
    const drift = () => {
      ticking = false;
      if (!live || still()) return;
      const r = berg.getBoundingClientRect();
      const p = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
      const bob = (Math.sin(p * Math.PI * 3) * 7).toFixed(2), wx = (p * 180).toFixed(1);
      seas.forEach((s) => { s.style.setProperty('--bob', bob); s.style.setProperty('--wx', wx); });
    };
    if (hasIO) {
      new IntersectionObserver((entries) => { live = entries.some((e) => e.isIntersecting); if (live) drift(); }).observe(berg);
      addEventListener('scroll', () => { if (live && !ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
    }
  }

  /* ================================================================ middle path: stones drop in, bob when stepped on */
  const river = $('[data-cvb-river]');
  if (river) {
    const stones = $$('.cvb-stone', river);
    let dropped = 0;
    arm(river, () => {
      if (still() || !river.classList.contains('is-armed')) { river.classList.add('is-landed'); return; }
      stones.forEach((s) => s.addEventListener('animationend', function once(ev) {
        if (ev.animationName !== 'cvbDrop') return;
        s.removeEventListener('animationend', once);
        if (++dropped === stones.length) river.classList.add('is-landed');
      }));
    });
    const step = (s) => {
      if (still() || !river.classList.contains('is-landed') || s.classList.contains('is-bob')) return;
      s.classList.add('is-bob', 'is-splash');
    };
    stones.forEach((s) => {
      s.addEventListener('animationend', (ev) => { if (ev.animationName === 'cvbBob') s.classList.remove('is-bob'); if (ev.animationName === 'cvbRipple') s.classList.remove('is-splash'); });
      s.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') step(s); });
      s.addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'mouse') step(s); });
    });
  }
})();
