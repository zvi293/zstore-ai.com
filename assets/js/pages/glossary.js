// Signature component: Easily Confused — six hanging plates on a ceramic pin; flip one (tap, button or mouse drag) and it swings on a damped spring to its partner term, with the difference in one line.
/* Zstore AI — /guides/glossary/ (page prefix .gl-). Vanilla, no dependencies; touches only this page's own DOM.
   Also: tap-to-translate jargon terms (one at a time, or all in a cascade), live search with highlighted matches, the sticky letter keys (the key
   for the letter you're reading stays pressed), permalink keys that copy a term's link, and an arrival stamp on the
   term you jump to. Everything enhances content that is already readable without JS. Motion off / reduced motion:
   flips and swaps land instantly, nothing animates. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const still = () => root.classList.contains('motion-off') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const main = $('#main');
  if (!main) return;

  // one polite live region for the page's own announcements
  const live = document.createElement('p');
  live.className = 'gl-sr'; live.setAttribute('aria-live', 'polite');
  main.appendChild(live);
  const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 60); };

  /* ============================================================ 1. Easily Confused */
  const deck = $('[data-gl-cf]');
  const cards = deck ? $$('[data-gl-card]', deck).map((el, i) => {
    const faces = { a: $('[data-gl-face="a"]', el), b: $('[data-gl-face="b"]', el) };
    const name = f => $('.gl-cf-t', faces[f]).textContent.trim();
    return { el, i, faces, names: { a: name('a'), b: name('b') }, stage: $('[data-gl-stage]', el), rotor: $('[data-gl-rotor]', el),
      btn: $('[data-gl-flip]', el), label: $('[data-gl-flip-label]', el), angle: 0, vel: 0, target: 0, raf: 0, last: 0 };
  }) : [];

  const paint = c => {
    c.rotor.style.setProperty('--gl-ry', c.angle.toFixed(2) + 'deg');
    const s = Math.abs(Math.cos(c.angle * Math.PI / 180));
    c.stage.style.setProperty('--gl-sx', (0.38 + s * 0.62).toFixed(3));
  };
  // damped spring (k 120, c 10: one generous swing past the face, then it settles, like a sign on a pin)
  const step = c => now => {
    const dt = Math.min(0.032, (now - (c.last || now)) / 1000 || 0.016); c.last = now;
    for (let k = 0; k < 2; k++) { const h = dt / 2; const a = -120 * (c.angle - c.target) - 10 * c.vel; c.vel += a * h; c.angle += c.vel * h; }
    if (Math.abs(c.angle - c.target) < 0.05 && Math.abs(c.vel) < 0.5) { c.angle = c.target; c.vel = 0; c.raf = 0; c.last = 0; paint(c); return; }
    paint(c); c.raf = requestAnimationFrame(step(c));
  };
  const run = c => { if (still()) { cancelAnimationFrame(c.raf); c.raf = 0; c.angle = c.target; c.vel = 0; paint(c); return; } if (!c.raf) { c.last = 0; c.raf = requestAnimationFrame(step(c)); } };
  const setSide = (c, toB, announce) => {
    c.target = toB ? 180 : 0;
    const on = toB ? 'b' : 'a', off = toB ? 'a' : 'b';
    c.faces[on].removeAttribute('aria-hidden'); c.faces[on].inert = false;
    c.faces[off].setAttribute('aria-hidden', 'true'); c.faces[off].inert = true;
    c.el.classList.toggle('is-b', toB);
    c.label.textContent = 'Flip to ' + c.names[off];
    if (dots[c.i]) dots[c.i].classList.toggle('is-b', toB);
    if (announce) say('Now showing ' + c.names[on] + '. ' + $('.gl-cf-d', c.faces[on]).textContent.trim());
    run(c);
  };
  const flip = (c, announce = true) => setSide(c, c.target < 90, announce);

  // dots for the swipe row on phones (hidden from 768px, where all six cards show)
  const dots = [];
  const dotBox = $('[data-gl-dots]');
  if (deck && dotBox) {
    dotBox.setAttribute('role', 'group'); dotBox.setAttribute('aria-label', 'Choose a pair');
    cards.forEach(c => {
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'gl-cf-dot';
      d.setAttribute('aria-label', 'Pair ' + (c.i + 1) + ': ' + c.names.a + ' and ' + c.names.b);
      d.addEventListener('click', () => {
        deck.scrollTo({ left: c.el.offsetLeft - cards[0].el.offsetLeft, behavior: still() ? 'instant' : 'smooth' });
      });
      dotBox.appendChild(d); dots.push(d);
    });
    let dRaf = 0;
    const syncDots = () => {
      dRaf = 0;
      const mid = deck.scrollLeft + deck.clientWidth * 0.35;
      let cur = 0;
      cards.forEach((c, i) => { if (c.el.offsetLeft - cards[0].el.offsetLeft <= mid) cur = i; });
      if (deck.scrollLeft + deck.clientWidth >= deck.scrollWidth - 4) cur = cards.length - 1;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === cur)));
    };
    deck.addEventListener('scroll', () => { if (!dRaf) dRaf = requestAnimationFrame(syncDots); }, { passive: true });
    syncDots();
  }

  cards.forEach(c => {
    setSide(c, false, false);
    c.btn.addEventListener('click', () => flip(c));
    // tap / click the plate itself (links on it still navigate)
    let dragged = false;
    c.stage.addEventListener('click', e => { if (e.target.closest('a')) return; if (dragged) { dragged = false; return; } flip(c); });
    // mouse and pen: grab the plate and turn it by hand; let go and it swings to the nearest face
    let x0 = 0, a0 = 0, lx = 0, lt = 0, v = 0, down = false;
    c.stage.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button || e.target.closest('a') || still()) return;
      down = true; dragged = false; x0 = lx = e.clientX; lt = e.timeStamp; a0 = c.angle; v = 0;
      cancelAnimationFrame(c.raf); c.raf = 0;
      c.stage.setPointerCapture(e.pointerId);
    });
    c.stage.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - x0;
      if (!dragged && Math.abs(dx) < 5) return;
      dragged = true; c.stage.classList.add('is-drag');
      c.angle = Math.max(-50, Math.min(230, a0 + dx * 0.75));
      const dt = Math.max(1, e.timeStamp - lt); v = (e.clientX - lx) * 0.75 / dt * 1000; lx = e.clientX; lt = e.timeStamp;
      paint(c);
    });
    const release = () => {
      if (!down) return; down = false; c.stage.classList.remove('is-drag');
      if (!dragged) return;
      c.vel = Math.max(-900, Math.min(900, v));
      const toB = c.angle + c.vel * 0.12 > 90;
      if (toB !== (c.target === 180)) setSide(c, toB, true); else run(c);
    };
    c.stage.addEventListener('pointerup', release);
    c.stage.addEventListener('pointercancel', release);
  });

  const allBtn = $('[data-gl-all]');
  if (allBtn && cards.length) allBtn.addEventListener('click', () => {
    const toB = cards.some(c => c.target === 0);
    cards.forEach((c, i) => setTimeout(() => setSide(c, toB, false), still() ? 0 : i * 90));
    say(toB ? 'All six cards flipped to the second term of each pair.' : 'All six cards flipped back to the first term of each pair.');
  });
  addEventListener('zs:motion', () => cards.forEach(run));

  /* ============================================================ 2. Jargon → plain English, one term at a time
     Each underlined term becomes its own tap target: tap it and the term turns into its plain-English phrase right
     where it stands (the words rise in, a sage highlight draws under them); tap again for the jargon. "Translate
     everything" cascades through all of them. The printed plain-English sentence stays in the bubble's grid cell,
     invisible, so the bubble keeps its tallest height and nothing below moves. */
  const tr = $('.gl-tr');
  if (tr) {
    const words = [];
    const split = (el, text) => text.split(/\s+/).forEach((t, k, arr) => {
      const w = document.createElement('i'); w.textContent = t; w.style.setProperty('--d', k); el.append(w);
      if (k < arr.length - 1) el.append(' ');
    });
    $$('[data-gl-say]', tr).forEach((box, si) => {
      const pj = $('.gl-say-j', box), pp = $('.gl-say-p', box);
      const J = $$('a.gl-ch', pj), P = $$('mark.gl-ch', pp);
      if (!J.length || J.length !== P.length) return; // keep the printed pair if the markup ever drifts
      pp.setAttribute('aria-hidden', 'true');
      box.classList.add('is-live');
      J.forEach((a, i) => {
        const jt = a.textContent.trim(), pt = P[i].textContent.trim();
        const el = document.createElement('span');
        el.className = 'gl-w'; el.setAttribute('role', 'button'); el.tabIndex = 0;
        const j = document.createElement('span'); j.className = 'gl-w-j'; split(j, jt);
        const pl = document.createElement('span'); pl.className = 'gl-w-p'; split(pl, pt);
        el.append(j, pl);
        a.replaceWith(el);
        words.push({ el, jt, pt, si, on: false });
      });
    });
    const beads = $('[data-gl-beads]', tr), nOut = $('[data-gl-tr-n]', tr);
    const allBtn = $('[data-gl-tr-all]', tr), allLbl = $('[data-gl-tr-all-label]', tr);
    const beadEls = words.map((o, i) => {
      const b = document.createElement('i');
      if (i && words[i - 1].si !== o.si) b.className = 'gl-gap';
      if (beads) beads.append(b);
      return b;
    });
    const meter = () => {
      const n = words.filter(o => o.on).length;
      if (nOut) nOut.textContent = n + ' of ' + words.length + ' translated';
      beadEls.forEach((b, i) => b.classList.toggle('is-on', words[i].on));
      if (allLbl) allLbl.textContent = n === words.length ? 'Back to jargon' : 'Translate everything';
    };
    const setWord = (o, on, announce) => {
      if (o.on === on) return;
      o.on = on;
      o.el.classList.toggle('is-p', on);
      o.el.classList.remove('is-anim');
      if (!still()) { void o.el.offsetWidth; o.el.classList.add('is-anim'); }
      if (announce) say(on ? o.jt + ' means: ' + o.pt + '.' : 'Back to ' + o.jt + '.');
      meter();
    };
    words.forEach(o => {
      o.el.addEventListener('click', () => setWord(o, !o.on, true));
      o.el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) setWord(o, !o.on, true); }
      });
    });
    let cascade = [];
    if (allBtn && words.length) allBtn.addEventListener('click', () => {
      cascade.forEach(clearTimeout); cascade = [];
      const to = words.some(o => !o.on);
      words.filter(o => o.on !== to).forEach((o, i) => {
        if (still()) setWord(o, to, false); else cascade.push(setTimeout(() => setWord(o, to, false), i * 75));
      });
      say(to ? 'All ' + words.length + ' terms are now in plain English.' : 'All ' + words.length + ' terms are back to jargon.');
    });
    if (words.length) meter();
  }

  /* ============================================================ 3. Search, letter keys, permalinks */
  const az = $('.gl-az');
  if (!az) return;
  const input = $('#gl-q'), box = $('.gl-q'), clearBtn = $('[data-gl-clear]'), count = $('[data-gl-count]');
  const empty = $('[data-gl-empty]'), emptyQ = $('[data-gl-empty-q]'), rail = $('[data-gl-rail]'), keysBox = $('.gl-keys', rail);
  const groups = $$('[data-gl-group]', az).map(g => ({ el: g, L: g.dataset.glGroup, n: $('.gl-letter-n', g) }));
  const keys = new Map($$('[data-gl-key]', az).map(k => [k.dataset.glKey, k]));
  // phones: every entry folds to its headword and first sentence (the rest and its related links stay in the page,
  // one tap away), so the A to Z list reads like an index instead of 22 screens of text. Built before the search
  // snapshots each entry, so search, highlights and jumps keep working on the full text.
  const foldMQ = matchMedia('(max-width: 767px)');
  $$('.gl-term', az).forEach(el => {
    const def = $('.gl-def', el), dd = $('dd', el), dt = $('dt', el), name = $('.gl-dt', el);
    if (!def || !dd || !dt || !name) return;
    const m = /^[\s\S]+?[.?!](?=\s+[A-Z“"(0-9])/.exec(def.textContent);
    if (m) {
      let at = m[0].length, n = null;
      const w = document.createTreeWalker(def, NodeFilter.SHOW_TEXT);
      while ((n = w.nextNode())) { if (at <= n.nodeValue.length) break; at -= n.nodeValue.length; }
      if (n) {
        const r = document.createRange(); r.setStart(n, at); r.setEnd(def, def.childNodes.length);
        const more = document.createElement('span'); more.className = 'gl-def-more';
        more.appendChild(r.extractContents()); def.appendChild(more);
      }
    }
    if (!dd.id) dd.id = el.id + '-def';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gl-fold';
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', dd.id);
    b.setAttribute('aria-label', 'More on ' + name.textContent.trim());
    b.innerHTML = '<span aria-hidden="true"></span>';
    dt.insertBefore(b, $('.gl-perma', dt));
    el.classList.add('is-folded');
  });
  const setFold = (el, open, animate) => {
    const b = $('.gl-fold', el);
    if (!b || open === !el.classList.contains('is-folded')) return;
    const dd = $('dd', el), h0 = dd.offsetHeight;
    el.classList.toggle('is-folded', !open);
    b.setAttribute('aria-expanded', String(open));
    if (!animate || still() || !foldMQ.matches || !dd.animate) return;
    const h1 = dd.offsetHeight;
    dd.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { duration: 560, easing: 'cubic-bezier(.34, 1.36, .64, 1)' });
    if (open) $$('.gl-def-more, .gl-rel', el).forEach((p, i) => p.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 90 + i * 80, easing: 'cubic-bezier(.2, .9, .3, 1)', fill: 'backwards' }));
  };
  az.addEventListener('click', e => {
    if (!foldMQ.matches) return;
    const el = e.target.closest('.gl-term');
    if (!el || !$('.gl-fold', el) || az.classList.contains('is-searching')) return;
    const fb = e.target.closest('.gl-fold');
    if (!fb && e.target.closest('a, button, input, label')) return;
    if (!fb && String(window.getSelection ? getSelection() : '').trim()) return;   // selecting text never toggles
    setFold(el, el.classList.contains('is-folded'), true);
  });

  const fold = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const terms = $$('.gl-term', az).map(el => {
    const dt = $('.gl-dt', el), def = $('.gl-def', el);
    return { el, g: el.closest('[data-gl-group]'), dt, def, dtHTML: dt.innerHTML, defHTML: def.innerHTML,
      name: dt.textContent.trim(), hay: fold(dt.textContent + ' ' + def.textContent + ' ' + (el.dataset.alias || '')) };
  });
  const TOTAL = terms.length;

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = (node, re) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(t => {
      const src = t.nodeValue, f = fold(src);
      if (f.length !== src.length) return; // keep it simple if folding changed the length
      re.lastIndex = 0; let m, last = 0; const frag = document.createDocumentFragment(); let hit = false;
      while ((m = re.exec(f))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        hit = true;
        frag.append(src.slice(last, m.index));
        const mk = document.createElement('mark'); mk.className = 'gl-hl'; mk.textContent = src.slice(m.index, m.index + m[0].length);
        frag.append(mk); last = m.index + m[0].length;
      }
      if (!hit) return;
      frag.append(src.slice(last)); t.replaceWith(frag);
    });
  };

  let lastKey = '';
  const filter = () => {
    const raw = input.value.trim();
    const q = fold(raw).replace(/\s+/g, ' ');
    const toks = q ? q.split(' ').filter(Boolean) : [];
    box.classList.toggle('has-q', !!raw);
    az.classList.toggle('is-searching', toks.length > 0);   // matches show whole: a hit can sit in the folded part
    clearBtn.hidden = !raw;
    const re = toks.length ? new RegExp(toks.map(esc).sort((a, b) => b.length - a.length).join('|'), 'g') : null;
    let hits = 0; const per = new Map();
    const shown = [];
    terms.forEach(t => {
      const ok = !toks.length || toks.every(k => t.hay.includes(k));
      t.el.hidden = !ok;
      t.dt.innerHTML = t.dtHTML; t.def.innerHTML = t.defHTML;
      if (ok) { hits++; per.set(t.g, (per.get(t.g) || 0) + 1); shown.push(t); if (re) { highlight(t.dt, re); highlight(t.def, re); } }
    });
    groups.forEach(g => {
      const n = per.get(g.el) || 0, all = $$('.gl-term', g.el).length;
      g.el.hidden = n === 0;
      g.n.textContent = toks.length ? n + ' of ' + all + (all === 1 ? ' term' : ' terms') : all + (all === 1 ? ' term' : ' terms');
      const k = keys.get(g.L);
      if (k) { if (n === 0) { k.setAttribute('aria-disabled', 'true'); k.tabIndex = -1; } else { k.removeAttribute('aria-disabled'); k.removeAttribute('tabindex'); } }
    });
    empty.hidden = hits > 0; emptyQ.textContent = raw;
    count.innerHTML = '';
    if (!toks.length) count.textContent = TOTAL + ' terms';
    else if (!hits) count.textContent = 'No matches';
    else { const b = document.createElement('b'); b.textContent = hits; count.append(b, ' of ' + TOTAL + ' terms match “' + raw + '”'); }
    // matching rows spring in (only when the set of matches changes)
    const key = shown.map(t => t.el.id).join(',');
    if (key !== lastKey && toks.length && !still()) {
      shown.slice(0, 14).forEach((t, i) => { t.el.classList.remove('is-hit'); t.el.style.setProperty('--h', i); void t.el.offsetWidth; t.el.classList.add('is-hit'); });
    }
    if (!toks.length) terms.forEach(t => t.el.classList.remove('is-hit'));
    lastKey = key;
    spy();
  };
  let fRaf = 0;
  input.addEventListener('input', () => { if (!fRaf) fRaf = requestAnimationFrame(() => { fRaf = 0; filter(); }); });
  const clear = focus => { input.value = ''; filter(); if (focus) input.focus(); };
  clearBtn.addEventListener('click', () => clear(true));
  $('[data-gl-reset]', az).addEventListener('click', () => clear(true));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); clear(true); }
    if (e.key === 'Enter') {
      const first = terms.find(t => !t.el.hidden);
      if (first && input.value.trim()) { e.preventDefault(); input.blur(); first.el.scrollIntoView({ behavior: still() ? 'instant' : 'smooth', block: 'start' }); }
    }
  });
  // "/" focuses the search from anywhere on the page (not while typing somewhere else)
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const t = e.target; if (t.closest && (t.closest('input, textarea, select, [contenteditable="true"], dialog[open]'))) return;
    e.preventDefault();
    $('.gl-find', az).scrollIntoView({ behavior: still() ? 'instant' : 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  });

  // a search key at the start of the sticky strip (phones and tablets): back to the search field from anywhere
  if (keysBox) {
    const li = document.createElement('li'); li.className = 'gl-key-wrap-q';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gl-key gl-key-q'; b.setAttribute('aria-label', 'Search the glossary');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4" /><path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>';
    b.addEventListener('click', () => { $('.gl-find', az).scrollIntoView({ behavior: still() ? 'instant' : 'smooth', block: 'center' }); input.focus({ preventScroll: true }); });
    li.appendChild(b); keysBox.prepend(li);
  }
  rail && rail.addEventListener('click', e => { const k = e.target.closest('[aria-disabled="true"]'); if (k) e.preventDefault(); });

  // scroll-spy: the key for the letter you're reading stays pressed
  let onKey = null, spyRaf = 0, inView = false;
  const spy = () => {
    spyRaf = 0;
    const desk = innerWidth >= 1100;
    // phones/tablets: once the key strip docks under the nav, its frosted glass reaches up behind the nav pill
    rail.classList.toggle('is-stuck', !desk && rail.getBoundingClientRect().top <= (parseFloat(getComputedStyle(rail).top) || 0) + 1);
    const line = (desk ? 0 : rail.getBoundingClientRect().bottom) + (desk ? innerHeight * 0.3 : 24);
    let cur = null;
    groups.forEach(g => { if (!g.el.hidden && g.el.getBoundingClientRect().top <= line) cur = g; });
    if (!cur) cur = groups.find(g => !g.el.hidden) || null;
    const k = cur && inView ? keys.get(cur.L) : null;
    if (k === onKey) { paintNow(); return; }
    if (onKey) onKey.classList.remove('is-on');
    onKey = k;
    paintNow();
    if (k) {
      k.classList.add('is-on');
      if (!desk && keysBox.scrollWidth > keysBox.clientWidth) {
        const li = k.parentElement;
        keysBox.scrollTo({ left: li.offsetLeft - keysBox.clientWidth / 2 + li.offsetWidth / 2, behavior: still() ? 'instant' : 'smooth' });
      }
    }
  };
  const groupsBox = $('[data-gl-groups]', az);

  // desktop: the rail's empty foot carries a "now reading" keycap (letter, count, and a bead riding a rail through
  // the whole list). Decorative: the pressed letter key above says the same thing to assistive tech.
  const tools = $('.gl-tools', az);
  const now = document.createElement('div');
  now.className = 'gl-now'; now.setAttribute('aria-hidden', 'true');
  now.innerHTML = '<span class="gl-now-k"></span><span class="gl-now-t"><b>Now reading</b><i></i></span><span class="gl-now-bar"><i></i></span>';
  if (tools) tools.appendChild(now);
  const nowK = $('.gl-now-k', now), nowN = $('.gl-now-t i', now);
  let nowL = '';
  function paintNow() {
    if (innerWidth < 1100 || !groupsBox) return;
    const r = groupsBox.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * .3 - r.top) / Math.max(1, r.height - innerHeight * .5)));
    now.style.setProperty('--p', p.toFixed(4));
    const first = groups.find(g => !g.el.hidden);
    const L = onKey ? onKey.dataset.glKey : first ? first.L : '';
    const g = groups.find(x => x.L === L);
    nowN.textContent = g ? g.n.textContent : '';
    if (!L || L === nowL) return;
    nowL = L;
    nowK.textContent = L === '0' ? '0–9' : L;
    now.classList.toggle('is-num', L === '0');
    if (!still() && nowK.animate) nowK.animate([{ transform: 'translateY(-12px) rotate(-10deg) scale(.9)', opacity: .3 }, { transform: 'rotate(-3deg)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
  }

  // the three moments between letters (a pairs sticker, a reading trail, an "ask me" card) settle in once, on arrival
  const mos = $$('[data-gl-mo]', az);
  const moAll = () => mos.forEach(m => m.classList.add('is-in'));
  if ('IntersectionObserver' in window && !still()) {
    const mio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); mio.unobserve(e.target); } }), { threshold: .3 });
    mos.forEach(m => mio.observe(m));
  } else moAll();
  addEventListener('zs:motion', () => { if (still()) moAll(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(en => { inView = en[0].isIntersecting; root.classList.toggle('gl-reading', inView); spy(); }).observe(groupsBox);
  } else inView = true;
  addEventListener('scroll', () => { if (inView && !spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });
  addEventListener('resize', () => { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });

  // arrival stamp: the term you jump to (a related link, a card, a translated word, or a shared link)
  let stamped = null;
  const stamp = el => {
    if (stamped && stamped !== el) stamped.classList.remove('is-target');
    if (!el) return;
    setFold(el, true, false);
    el.classList.remove('is-target'); void el.offsetWidth; el.classList.add('is-target'); stamped = el;
  };
  const termFromHash = h => { if (!h || h.indexOf('#term-') !== 0) return null; try { return document.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { return null; } };
  // runs before app.js's document-level smooth scroll: un-hide a filtered-out term first, so the jump lands
  main.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#term-"]');
    if (!a || a.hasAttribute('data-gl-perma')) return;
    const t = termFromHash(a.hash);
    if (!t) return;
    if (t.hidden) clear(false);
    stamp(t);
  });

  // permalink keys: copy the term's address (and put it in the address bar), with a little tag that says so
  az.addEventListener('click', e => {
    const p = e.target.closest('[data-gl-perma]');
    if (!p) return;
    e.preventDefault();
    const t = p.closest('.gl-term'), url = location.origin + location.pathname + p.hash;
    try { history.replaceState(history.state, '', p.hash); } catch (err) {}
    stamp(t);
    const done = ok => {
      const old = $('.gl-tag', t); if (old) old.remove();
      const tag = document.createElement('span'); tag.className = 'gl-tag'; tag.setAttribute('aria-hidden', 'true');
      tag.textContent = ok ? 'Link copied' : 'Link is in the address bar';
      t.appendChild(tag); setTimeout(() => tag.remove(), 1700);
      p.classList.add('is-copied'); setTimeout(() => p.classList.remove('is-copied'), 900);
      say(ok ? 'Link to ' + p.getAttribute('aria-label').replace(/^Link to /, '') + ' copied.' : 'The link to this term is now in the address bar.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
    else done(false);
  });

  const fromHash = () => { const t = termFromHash(location.hash); if (t) { if (t.hidden) clear(false); stamp(t); } };
  addEventListener('hashchange', fromHash);
  fromHash();
  filter();
})();
