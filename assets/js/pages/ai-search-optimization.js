// Signature component: Crawler Loupe — drag a glazed loupe across an example page to x-ray what crawlers and AI search can actually read.
/* /services/ai-search-optimization/ page script (prefix .aso-). Also: layer stack drop, sticky deliverable counter,
   allow/block robots.txt board, typed prompt check, hero ring pause. Touches only its own DOM.
   Motion off (html.motion-off) or reduced motion: everything lands in its final state at once. */
(function () {
  'use strict';
  const root = document.documentElement;
  const motionOff = () => root.classList.contains('motion-off');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, '0');
  const hasIO = 'IntersectionObserver' in window;
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };

  /* ============================================================ 1. Crawler Loupe */
  const L = $('[data-aso-loupe]');
  if (L) (function loupe() {
    const stage = $('[data-aso-stage]', L);
    const sheet = $('.aso-sheet', L);
    const page = $('.aso-page', L);
    const lens = $('[data-aso-lens]', L);
    const verBtns = $$('.aso-ver-btn', L);
    const jumpBtns = $$('.aso-jump-btn', L);
    const outStack = $('[data-aso-out]', L), readEl = $('[data-aso-read]', L), cap = $('[data-aso-cap]', L);
    const dots = $$('.aso-out-dots i', L);
    const okEl = $('[data-aso-ok]', L), gapEl = $('[data-aso-gap]', L), say = $('[data-aso-say]', L);
    const report = $('[data-aso-report]', L);
    if (!stage || !sheet || !page || !lens || !outStack || !readEl) return;

    const order = jumpBtns.map((b) => b.dataset.go);
    const names = { head: 'Heading and first sentence', image: 'Images', facts: 'Business facts', faq: 'FAQ', footer: 'Footer and contact details' };
    const short = { head: 'Heading', image: 'Images', facts: 'Facts', faq: 'FAQ', footer: 'Footer' };
    const tags = { head: '<title> · <h1>', image: '<img>', facts: 'JSON-LD', faq: '<h2> · FAQ', footer: '<footer>' };
    // why each region matters: fills the readout under short regions instead of leaving a dead gap
    const why = {
      head: 'AI answers often lift the first clear sentence on a page. If it names who you help and where, that is the line worth quoting.',
      image: 'Most crawlers read a picture through its alt text and file name, not its pixels. Those few words are all it says.',
      facts: 'Structured data states your name, address and services in a format a machine doesn\'t have to guess at.',
      faq: 'Real questions as headings, each with a direct answer under it, are easy to match to what people actually ask.',
      footer: 'The same name, address and phone everywhere help search engines and assistants trust it is one business.'
    };
    const glyph = { head: '<h1>', image: '<img>', facts: '{ }', faq: 'Q&A', footer: '<footer>' };

    // the report tables are the single source: they feed the readout panels, the lens cards and the meters
    const data = {}, counts = {}, rc = {};
    $$('table.aso-tbl', L).forEach((t) => {
      const v = t.dataset.v; data[v] = {}; rc[v] = {};
      $$('tbody tr', t).forEach((tr) => {
        const kv = $('.aso-kv', tr); data[v][tr.dataset.r] = kv;
        rc[v][tr.dataset.r] = { ok: $$('[data-s="ok"]', kv).length, gap: $$('[data-s="gap"]', kv).length };
      });
      counts[v] = { ok: $$('[data-s="ok"]', t).length, gap: $$('[data-s="gap"]', t).length };
    });
    if (!data.strong || !data.weak) return;

    // every state is built once and stacked in one grid cell: the readout keeps the footprint of its tallest
    // state, so moving the loupe never shifts the page (no layout shift, no DOM churn while dragging)
    const panels = {}, cards = {};
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    ['strong', 'weak'].forEach((v) => order.forEach((r, i) => {
      const kv = data[v][r]; if (!kv) return;
      const p = el('div', 'aso-out-st');
      const k = el('p', 'aso-out-k');
      k.append(el('span', '', v === 'strong' ? 'Strong page' : 'Weak page'), el('span', '', pad(i + 1) + ' / ' + pad(order.length)));
      const t = el('h3', 'aso-out-t', names[r]); t.id = 'loupe-out-' + v + '-' + r;
      const b = el('div', 'aso-out-body'); b.append(kv.cloneNode(true));
      const w = el('div', 'aso-out-why');
      const g = el('span', 'aso-out-glyph', glyph[r]); g.setAttribute('aria-hidden', 'true');
      const wp = el('p', 'aso-out-why-t'); wp.append(el('b', '', 'Why it matters'), document.createTextNode(why[r]));
      w.append(g, wp);
      p.append(k, t, b, w); outStack.append(p); panels[v + r] = p;
      // the lens card: what the crawler reads, compact enough to sit inside the glass
      const c = el('div', 'aso-rd'); c.dataset.v = v;
      const ul = el('ul');
      $$('li', kv).forEach((li) => {
        const row = el('li'); row.dataset.s = li.dataset.s;
        const val = $('span', li);
        row.append(el('b', '', $('b', li).textContent), el('span', '', val ? val.textContent : ''), el('i', '', li.dataset.s === 'gap' ? 'Gap' : '✓'));
        ul.append(row);
      });
      c.append(el('p', 'aso-rd-tag', tags[r]), ul);
      readEl.append(c); cards[v + r] = c;
    }));

    const xray = page.cloneNode(true);
    xray.classList.add('is-xray');
    sheet.append(xray);
    if (report) report.open = false;

    let ver = 'strong', region = '', used = false, said = '', wantSay = false;
    let W = 0, H = 0, R = 80, top0 = 0, rects = {};
    let x = 0, y = 0, vx = 0, vy = 0, tx = 0, ty = 0, raf = 0, dragging = false, offX = 0, offY = 0;

    function measure() {
      const s = stage.getBoundingClientRect(), sh = sheet.getBoundingClientRect();
      W = s.width; H = s.height; top0 = sh.top - s.top; R = lens.offsetWidth / 2 || 80;
      rects = {};
      $$('.aso-rg', page).forEach((rg) => { const b = rg.getBoundingClientRect(); rects[rg.dataset.r] = { x: b.left - s.left, y: b.top - s.top, w: b.width, h: b.height }; });
    }
    // the glass stays whole inside the frame left, right and top; at the bottom it may rest over the edge just far
    // enough for its center to reach the footer
    const clampT = () => {
      tx = W > 2 * R ? Math.max(R, Math.min(W - R, tx)) : W / 2;
      const f = rects.footer, yMax = Math.max(H - R, f ? f.y + Math.min(14, f.h / 2) : H - R);
      ty = Math.max(Math.max(R, top0 + R * 0.3), Math.min(yMax, ty));
    };
    function paint() {
      let tr = `translate3d(${(x - R).toFixed(1)}px, ${(y - R).toFixed(1)}px, 0)`;
      if (!motionOff()) {
        const sp = Math.hypot(vx, vy), st = Math.min(sp / 70, 0.12);
        if (st > 0.01) { const a = Math.atan2(vy, vx); tr += ` rotate(${a}rad) scale(${1 + st}, ${1 - st}) rotate(${-a}rad)`; }
      }
      lens.style.transform = tr;
      xray.style.setProperty('--lr', Math.max(0, R - 9) + 'px');
      xray.style.setProperty('--lx', x.toFixed(1) + 'px');
      xray.style.setProperty('--ly', (y - top0).toFixed(1) + 'px');
    }
    function detect() {
      let best = '', bd = Infinity;
      for (const r of order) {
        const b = rects[r]; if (!b) continue;
        const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h));
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = r; }
      }
      if (best && best !== region) setRegion(best);
    }
    function settled() { if (wantSay && !dragging) { wantSay = false; if (region !== said) announce(); } }
    function step() {
      const k = dragging ? 0.3 : 0.14, damp = dragging ? 0.62 : 0.74;
      vx = (vx + (tx - x) * k) * damp; vy = (vy + (ty - y) * k) * damp;
      x += vx; y += vy;
      if (Math.abs(tx - x) < 0.3 && Math.abs(ty - y) < 0.3 && Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) {
        x = tx; y = ty; vx = vy = 0; paint(); detect(); raf = 0; settled(); return;
      }
      paint(); detect();
      raf = requestAnimationFrame(step);
    }
    function go(nx, ny, instant) {
      tx = nx; ty = ny; clampT();
      if (instant || motionOff()) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        x = tx; y = ty; vx = vy = 0; paint(); detect(); settled(); return;
      }
      if (!raf) raf = requestAnimationFrame(step);
    }
    const centerOf = (r) => { const b = rects[r]; return b ? [b.x + b.w / 2, b.y + b.h / 2] : [W / 2, top0 + R]; };
    function markUsed() { if (used) return; used = true; L.classList.add('is-used'); if (intro) { clearTimeout(intro); intro = 0; } }

    // screen readers hear one short line, only after something the visitor did (never from the intro glide)
    function announce() {
      if (!say || !region) return;
      said = region;
      const c = rc[ver][region];
      say.textContent = names[region] + ': ' + (c.gap ? c.gap + (c.gap === 1 ? ' gap, ' : ' gaps, ') + c.ok + ' readable.' : 'all ' + c.ok + ' readable.');
    }
    function show(fresh) {
      const key = ver + region;
      for (const k in panels) { panels[k].classList.toggle('is-on', k === key); cards[k].classList.toggle('is-on', k === key); }
      const i = order.indexOf(region);
      dots.forEach((d, j) => d.classList.toggle('is-on', j === i));
      const c = rc[ver][region];
      if (cap) cap.textContent = short[region] + ' · ' + (c.gap ? c.gap + (c.gap === 1 ? ' gap' : ' gaps') : 'all read');
      lens.setAttribute('aria-describedby', 'loupe-out-' + ver + '-' + region);
      if (fresh && !motionOff()) { const p = panels[key]; p.classList.remove('is-new'); void p.offsetWidth; p.classList.add('is-new'); }
    }
    function setRegion(r) {
      region = r;
      jumpBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === r)));
      show(true);
    }
    let countRaf = 0;
    function setMeters(instant) {
      const c = counts[ver];
      const from = { ok: Number(okEl.textContent) || 0, gap: Number(gapEl.textContent) || 0 };
      if (countRaf) cancelAnimationFrame(countRaf);
      if (instant || motionOff()) { okEl.textContent = c.ok; gapEl.textContent = c.gap; return; }
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - p, 3);
        okEl.textContent = Math.round(from.ok + (c.ok - from.ok) * e);
        gapEl.textContent = Math.round(from.gap + (c.gap - from.gap) * e);
        countRaf = p < 1 ? requestAnimationFrame(tick) : 0;
      };
      countRaf = requestAnimationFrame(tick);
    }
    function setVer(v, quiet) {
      if (v === ver && !quiet) return;
      ver = v;
      L.dataset.ver = v;
      verBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ver === v)));
      page.dataset.v = v; xray.dataset.v = v;
      if (!quiet && !motionOff()) { sheet.classList.remove('is-flip'); void sheet.offsetWidth; sheet.classList.add('is-flip'); }
      setMeters(quiet);
      if (region) show(!quiet);
      if (!quiet && say) {
        const c = counts[v];
        said = region;
        say.textContent = (v === 'strong' ? 'Strong page: ' : 'Weak page: ') + c.ok + (c.ok === 1 ? ' fact' : ' facts') + ' a crawler can read, ' + c.gap + (c.gap === 1 ? ' gap.' : ' gaps.');
      }
    }
    function jumpTo(r) {
      markUsed();
      const c = centerOf(r);
      go(c[0], c[1]);
      if (r !== region) setRegion(r);
      wantSay = false; announce();
    }

    const local = (e) => { const s = stage.getBoundingClientRect(); return { x: e.clientX - s.left, y: e.clientY - s.top }; };
    lens.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      markUsed(); dragging = true;
      try { lens.setPointerCapture(e.pointerId); } catch (err) {}
      const p = local(e);
      if (e.pointerType === 'mouse') { offX = x - p.x; offY = y - p.y; }
      else { offX = 0; offY = -(R + 14); }   // touch: the lens rides above the finger, so the finger never covers it
      go(p.x + offX, p.y + offY);
      e.preventDefault();
    });
    lens.addEventListener('pointermove', (e) => { if (dragging) { const p = local(e); go(p.x + offX, p.y + offY); } });
    const end = () => { if (!dragging) return; dragging = false; wantSay = true; if (!raf) settled(); };
    lens.addEventListener('pointerup', end);
    lens.addEventListener('pointercancel', end);
    lens.addEventListener('lostpointercapture', end);
    // Enter or Space on the focused loupe (a keyboard click has detail 0): hop to the next region
    lens.addEventListener('click', (e) => { if (e.detail === 0) jumpTo(order[(order.indexOf(region) + 1) % order.length]); });
    // tap or click anywhere on the page: the loupe glides there (the page itself keeps normal scrolling)
    stage.addEventListener('click', (e) => {
      if (e.target.closest('[data-aso-lens]')) return;
      markUsed(); wantSay = true;
      const p = local(e);
      go(p.x, p.y);
    });
    lens.addEventListener('keydown', (e) => {
      const d = e.shiftKey ? 64 : 22;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -d; else if (e.key === 'ArrowRight') dx = d;
      else if (e.key === 'ArrowUp') dy = -d; else if (e.key === 'ArrowDown') dy = d;
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); jumpTo(order[e.key === 'Home' ? 0 : order.length - 1]); return; }
      else return;
      e.preventDefault(); markUsed(); wantSay = true;
      go(tx + dx, ty + dy);
    });
    jumpBtns.forEach((b) => b.addEventListener('click', () => jumpTo(b.dataset.go)));
    verBtns.forEach((b) => b.addEventListener('click', () => { markUsed(); setVer(b.dataset.ver); }));

    // first layout, then keep the loupe on its region through resizes, font swaps and text-size changes
    measure();
    setVer('strong', true);
    const c0 = centerOf('head'); x = tx = c0[0]; y = ty = c0[1]; clampT(); x = tx; y = ty;
    paint(); detect();
    if ('ResizeObserver' in window) {
      let rw = 0;
      new ResizeObserver(() => {
        const s = stage.getBoundingClientRect();
        measure();
        if (Math.abs(s.width - rw) > 1 && region) { const c = centerOf(region); go(c[0], c[1], true); }
        else { clampT(); go(tx, ty, true); }
        rw = s.width;
      }).observe(stage);
    }
    document.fonts && document.fonts.ready && document.fonts.ready.then(() => { measure(); const c = centerOf(region || 'head'); go(c[0], c[1], true); });

    // the readout keeps its tallest footprint; where a short region leaves room, its big tag glyph shows
    // (the glyph takes only the slack, so showing or hiding it never changes the card's height)
    const fitWhy = () => { for (const k in panels) { const g = panels[k].querySelector('.aso-out-glyph'); if (g) panels[k].classList.toggle('has-room', g.offsetHeight >= 76); } };
    fitWhy();
    if ('ResizeObserver' in window) { let fr = 0; new ResizeObserver(() => { cancelAnimationFrame(fr); fr = requestAnimationFrame(fitWhy); }).observe(outStack); }
    document.fonts && document.fonts.ready && document.fonts.ready.then(fitWhy);

    // a one-time hint: the loupe glides to the photo and back the first time the stage is on screen
    let intro = 0;
    if (hasIO) {
      const io = new IntersectionObserver((en) => {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        if (used || motionOff()) return;
        intro = setTimeout(() => {
          if (used) return;
          const a = centerOf('image'); go(a[0], a[1]);
          intro = setTimeout(() => { if (!used) { const b = centerOf('head'); go(b[0], b[1]); } intro = 0; }, 1300);
        }, 500);
      }, { threshold: 0.6 });
      io.observe(stage);
    }
    addEventListener('zs:motion', () => { if (motionOff()) { go(tx, ty, true); setMeters(true); } });
  })();

  /* ============================================================ 2. Layer stack: drops onto the foundation */
  const stack = $('[data-aso-stack]');
  if (stack && hasIO && !motionOff() && !inView(stack)) {
    stack.classList.add('is-armed');
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      stack.classList.add('is-in');
    }, { threshold: 0.35 });
    io.observe(stack);
  }

  /* ============================================================ 3. Deliverables: sticky counter follows the brick in focus */
  const bricks = $$('[data-aso-bricks] > li');
  const num = $('[data-aso-num]');
  const bars = $$('.aso-do-meter i');
  if (bricks.length && hasIO) {
    let cur = -1;
    const set = (i) => {
      if (i === cur) return;
      cur = i;
      bricks.forEach((b, j) => b.classList.toggle('is-on', j === i));
      bars.forEach((b, j) => b.classList.toggle('is-on', j <= i));
      if (num) {
        num.textContent = pad(i + 1);
        if (!motionOff()) { num.classList.remove('is-roll'); void num.offsetWidth; num.classList.add('is-roll'); }
      }
    };
    const io = new IntersectionObserver((en) => {
      en.forEach((e) => { if (e.isIntersecting) set(bricks.indexOf(e.target)); });
    }, { rootMargin: '-46% 0px -46% 0px' });
    bricks.forEach((b) => io.observe(b));
  }

  /* ============================================================ 4. Crawler access board: allow / block → live robots.txt */
  const rb = $('[data-aso-robots]');
  if (rb) (function robots() {
    const rows = $$('.aso-rb-row', rb);
    const presets = $$('.aso-rb-pre', rb);
    const code = $('[data-aso-code]', rb);
    const sum = $('[data-aso-sum]', rb);
    if (!rows.length || !code) return;
    const state = {};
    rows.forEach((r) => { state[r.dataset.bot] = $('[data-act="allow"]', r).getAttribute('aria-pressed') === 'true'; });
    let prev = Object.assign({}, state);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    function render(changed) {
      // one block per group (display: block in CSS, so wide screens can flow them into two columns)
      const blocks = ['<span class="b"><span class="c"># Search engines: always welcome</span>\n<span class="k">User-agent:</span> Googlebot\n<span class="k">User-agent:</span> Bingbot\n<span class="k">Allow:</span> /\n</span>'];
      rows.forEach((r) => {
        const bot = r.dataset.bot, ok = state[bot];
        const fresh = changed && prev[bot] !== ok ? ' is-new' : '';
        blocks.push('<span class="b' + fresh + '"><span class="k">User-agent:</span> ' + esc(bot) + '\n<span class="k">' + (ok ? 'Allow:' : 'Disallow:') + '</span> /\n</span>');
      });
      blocks.push('<span class="b b-end"><span class="k">Sitemap:</span> https://example.com/sitemap.xml</span>');
      code.innerHTML = blocks.join('');
      rows.forEach((r) => {
        const ok = state[r.dataset.bot];
        $('[data-act="allow"]', r).setAttribute('aria-pressed', String(ok));
        $('[data-act="block"]', r).setAttribute('aria-pressed', String(!ok));
      });
      const s = rows.filter((r) => r.dataset.kind === 'search'), t = rows.filter((r) => r.dataset.kind === 'train');
      const sOn = s.filter((r) => state[r.dataset.bot]).length, tOn = t.filter((r) => state[r.dataset.bot]).length;
      let msg = 'AI search crawlers allowed: ' + sOn + ' of ' + s.length + '. Training controls allowed: ' + tOn + ' of ' + t.length + '.';
      if (sOn === 0) msg += ' Heads-up: with every search crawler blocked, those tools can’t fetch your pages to cite them.';
      else if (sOn === s.length && tOn === t.length) msg += ' Fully open, the way this site is set up.';
      else if (sOn === s.length && tOn === 0) msg += ' A common split: citable in AI search, out of training data.';
      if (sum) sum.textContent = msg;
      const match = (p) => rows.every((r) => state[r.dataset.bot] === (p === 'all' ? true : p === 'none' ? false : r.dataset.kind === 'search'));
      presets.forEach((b) => b.setAttribute('aria-pressed', String(match(b.dataset.preset))));
      prev = Object.assign({}, state);
    }
    rows.forEach((r) => $$('.aso-rb-keys button', r).forEach((b) => b.addEventListener('click', () => {
      const ok = b.dataset.act === 'allow';
      if (state[r.dataset.bot] === ok) return;
      state[r.dataset.bot] = ok;
      render(true);
    })));
    presets.forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.preset;
      rows.forEach((r) => { state[r.dataset.bot] = p === 'all' ? true : p === 'none' ? false : r.dataset.kind === 'search'; });
      render(true);
    }));
    render(false);
  })();

  /* ============================================================ 5. Prompt check: the question types itself, the answer lands */
  const tw = $('[data-aso-type]');
  if (tw && hasIO && !motionOff() && !inView(tw)) (function typer() {
    const holder = $('[data-aso-tw-text]', tw);
    if (!holder) return;
    const full = holder.textContent;
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = full;
    // a hidden copy of the full question holds the final height, so typing never moves the layout
    const ghost = document.createElement('span'); ghost.className = 'aso-tw-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.textContent = full;
    const live = document.createElement('span'); live.className = 'aso-tw-live'; live.setAttribute('aria-hidden', 'true');
    // the caret is the typed span's own edge (a sibling caret element would count as a layout shift per letter)
    const typed = document.createElement('span'); typed.className = 'aso-tw-typed is-caret';
    live.append(typed);
    holder.replaceChildren(sr, ghost, live);
    tw.classList.add('is-armed');
    let timer = 0;
    const finish = () => { clearTimeout(timer); typed.textContent = full; tw.classList.remove('is-armed'); tw.classList.add('is-done'); setTimeout(() => typed.classList.remove('is-caret'), 1600); };
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      let i = 0;
      const tick = () => {
        if (motionOff()) return finish();
        i += 1; typed.textContent = full.slice(0, i);
        if (i < full.length) timer = setTimeout(tick, full[i - 1] === ' ' ? 55 : 32);
        else timer = setTimeout(finish, 380);
      };
      timer = setTimeout(tick, 400);
    }, { threshold: 0.55 });
    io.observe(tw);
    addEventListener('zs:motion', () => { if (motionOff()) finish(); });
  })();

  /* ============================================================ 6. Hero: signal rings rest while the hero is off screen */
  const hero = $('[data-aso-hero]');
  if (hero && hasIO) new IntersectionObserver((en) => hero.classList.toggle('is-off', !en[0].isIntersecting)).observe(hero);
})();
