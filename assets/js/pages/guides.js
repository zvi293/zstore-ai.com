// Signature component: Guide Shelf — pull a guide's spine off the shelf to open its card; keycaps on the shelf edge sort it by topic.
/* Zstore AI — /guides/ hub. Page-scoped (.gd-), no libraries. Also runs the page's living touches:
   the archive drawer in the hero (springs open and follows the scroll), the self-drawing trails, the glossary
   ticker (runs only while on screen) and the dog-eared corner of the author card (peel it back).
   Motion off (site toggle) or prefers-reduced-motion: every final state at once, nothing moves. */
(() => {
  'use strict';
  const root = document.documentElement;
  const motionOff = () => root.classList.contains('motion-off');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hasIO = 'IntersectionObserver' in window;
  const onMotion = [];
  addEventListener('zs:motion', () => onMotion.forEach(fn => fn(motionOff())));

  /* ------------------------------------------------------------ Guide Shelf */
  const shelf = $('[data-gd-shelf]');
  if (shelf) {
    const row = $('[data-gd-row]', shelf);
    const spines = $$('.gd-spine', row);
    const cards = $$('.gd-card', shelf);
    const keysBox = $('[data-gd-keys]', shelf);
    const status = $('[data-gd-status]', shelf);
    const spineFor = card => spines.find(s => s.getAttribute('aria-controls') === card.id);
    const cardFor = spine => document.getElementById(spine.getAttribute('aria-controls'));
    const isPinned = card => card.hasAttribute('data-pinned');
    let current = cards.find(c => c.classList.contains('is-open')) || cards[0];
    let filter = 'all';

    // keycaps are built from the cards: one per category that holds a guide, with its count
    const cats = [];
    cards.forEach(c => {
      if (isPinned(c)) return;
      let cat = cats.find(x => x.key === c.dataset.category);
      if (!cat) cats.push(cat = { key: c.dataset.category, label: c.dataset.categoryLabel || c.dataset.category, n: 0 });
      cat.n++;
    });
    const guideCount = cards.filter(c => !isPinned(c)).length;
    const pinnedCard = cards.find(isPinned);
    const plural = n => n + (n === 1 ? ' guide' : ' guides');
    const makeKey = (key, label, n, unit) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gd-key'; b.dataset.key = key;
      b.setAttribute('aria-pressed', key === 'all' ? 'true' : 'false');
      const l = document.createElement('span'); l.textContent = label;
      const count = document.createElement('b'); count.textContent = n;
      const sr = document.createElement('span'); sr.className = 'gd-sr'; sr.textContent = ' ' + unit;
      count.append(sr); b.append(l, count);
      return b;
    };
    const keys = [makeKey('all', 'All', cards.length, 'on the shelf')].concat(cats.map(c => makeKey(c.key, c.label, c.n, c.n === 1 ? 'guide' : 'guides')));
    keysBox.replaceChildren(...keys);

    const allText = plural(guideCount) + (pinnedCard ? ' and the glossary on the shelf' : ' on the shelf');
    const say = text => { if (status) status.textContent = text; };
    say(allText);

    const setRoving = target => spines.forEach(s => { s.tabIndex = s === target ? 0 : -1; });
    setRoving(spineFor(current));

    // warm a cover image before its card opens (hover, focus or touch on the spine)
    const warm = card => {
      if (!card || card.dataset.warm) return;
      card.dataset.warm = '1';
      const img = $('.gd-cover img', card);
      if (!img) return;
      const pre = new Image();
      pre.sizes = img.sizes; pre.srcset = img.srcset; pre.src = img.src;
    };

    const open = card => {
      if (!card || card === current) return;
      const prev = current;
      current = card;
      const spine = spineFor(card);
      spines.forEach(s => s.setAttribute('aria-expanded', String(s === spine)));
      prev.classList.remove('is-open');
      card.classList.add('is-open');
      // when the stand sits under the shelf (phones, tablets, laptops), lift the opened card into view:
      // its foot (title, summary, "Read the guide") reaches the screen, its top never slides under the nav
      const lift = () => {
        const r = card.getBoundingClientRect();
        const over = r.bottom - (innerHeight - 14);
        if (over <= 8) return;
        const nav = document.querySelector('[data-nav]');
        const room = r.top - ((nav ? nav.getBoundingClientRect().bottom : 70) + 12);
        const dy = Math.min(over, room);
        if (dy > 8) scrollBy({ top: dy, behavior: motionOff() ? 'auto' : 'smooth' });
      };
      if (motionOff() || !card.animate) { lift(); return; }

      // the card that was out slides back down behind the new one
      prev.classList.add('is-leaving');
      const out = prev.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translateY(22px) rotate(1.6deg) scale(.96)', opacity: 0 }],
        { duration: 260, easing: 'cubic-bezier(.4, 0, .7, .2)' });
      const done = () => prev.classList.remove('is-leaving');
      out.onfinish = done; out.oncancel = done;

      lift();
      // the book flies out of its spine and opens into the card (FLIP from the spine's box)
      const s = spine.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const sx = Math.max(.08, s.width / c.width), sy = Math.max(.2, s.height / c.height);
      card.animate([
        { transform: `translate(${s.left - c.left}px, ${s.top - c.top}px) scale(${sx}, ${sy})`, transformOrigin: '0 0', opacity: .35, offset: 0 },
        { opacity: 1, offset: .3 },
        { transform: 'none', transformOrigin: '0 0', opacity: 1, offset: 1 }
      ], { duration: 760, easing: 'cubic-bezier(.2, 1.18, .36, 1)' });
      const copy = $('.gd-card-copy', card);
      if (copy) copy.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 300, easing: 'cubic-bezier(.2, .9, .3, 1)', fill: 'backwards' });
      const img = $('.gd-cover img', card);
      if (img) img.animate([{ transform: 'scale(.92) rotate(-2deg)' }, { transform: 'none' }], { duration: 820, delay: 120, easing: 'cubic-bezier(.34, 1.56, .64, 1)', fill: 'backwards' });
    };

    const setFilter = key => {
      filter = key;
      keys.forEach(k => k.setAttribute('aria-pressed', String(k.dataset.key === key)));
      shelf.classList.toggle('is-filtered', key !== 'all');
      cards.forEach(c => {
        const s = spineFor(c);
        const match = key === 'all' || isPinned(c) || c.dataset.category === key;
        s.classList.toggle('is-dim', !match);
        s.classList.toggle('is-match', match && key !== 'all' && !isPinned(c));
      });
      if (key === 'all') { say(allText); return; }
      const cat = cats.find(x => x.key === key);
      say(cat.label + ': ' + plural(cat.n) + (pinnedCard ? ', plus the glossary' : ''));
      // if the open book isn't in this topic, pull out the first one that is
      if (!isPinned(current) && current.dataset.category !== key) {
        const first = cards.find(c => c.dataset.category === key);
        if (first) { open(first); setRoving(spineFor(first)); }
      }
    };

    spines.forEach(s => {
      const card = cardFor(s);
      s.addEventListener('click', () => {
        if (s.classList.contains('is-dim')) setFilter('all');
        open(card);
        setRoving(s);
      });
      s.addEventListener('pointerenter', () => warm(card));
      s.addEventListener('focus', () => warm(card));
      s.addEventListener('touchstart', () => warm(card), { passive: true });
    });
    keys.forEach(k => k.addEventListener('click', () => setFilter(k.dataset.key)));

    // keyboard: one tab stop for the whole shelf; arrows move along the books that are in the current topic
    row.addEventListener('keydown', e => {
      const i = spines.indexOf(document.activeElement);
      if (i < 0) return;
      const live = spines.filter(s => !s.classList.contains('is-dim'));
      let j = live.indexOf(spines[i]);
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': j = j < 0 ? 0 : (j + 1) % live.length; break;
        case 'ArrowLeft': case 'ArrowUp': j = j < 0 ? 0 : (j - 1 + live.length) % live.length; break;
        case 'Home': j = 0; break;
        case 'End': j = live.length - 1; break;
        default: return;
      }
      e.preventDefault();
      const next = live[j];
      setRoving(next);
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: motionOff() ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------ archive drawer (hero) */
  const drawer = $('[data-gd-drawer]');
  if (drawer) {
    const REST = .35;
    let x = 0, v = 0, target = REST, raf = 0, last = 0, inView = true;
    const set = n => drawer.style.setProperty('--gd-open', n.toFixed(4));
    const aim = () => {
      const r = drawer.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - (r.top + r.height / 2) / innerHeight));
      return REST + p * (1 - REST);
    };
    const step = now => {
      const dt = Math.min(.032, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const a = 150 * (target - x) - 17 * v;        // a soft spring: a little overshoot, then rest
      v += a * dt; x += v * dt;
      set(x);
      if (Math.abs(v) < .0006 && Math.abs(target - x) < .0006) { x = target; set(x); raf = 0; last = 0; return; }
      raf = requestAnimationFrame(step);
    };
    const kick = () => { if (!raf && !motionOff()) { last = 0; raf = requestAnimationFrame(step); } };
    const still = () => { cancelAnimationFrame(raf); raf = 0; drawer.style.removeProperty('--gd-open'); };

    if (motionOff()) still();
    else { set(0); target = aim(); }
    drawer.classList.add('is-live');
    if (!motionOff()) setTimeout(kick, 180);

    addEventListener('scroll', () => { if (inView && !motionOff()) { target = aim(); kick(); } }, { passive: true });
    if (hasIO) new IntersectionObserver(es => { inView = es[0].isIntersecting; }).observe(drawer);
    onMotion.push(off => { if (off) still(); else { x = REST; set(x); target = aim(); kick(); } });
  }

  /* ------------------------------------------------------------ trails draw themselves (Where should I start?) */
  const trails = $('[data-gd-trails]');
  if (trails && hasIO && !motionOff()) {
    trails.classList.add('gd-armed');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-drawn'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -16% 0px' });
    $$('.gd-trail', trails).forEach(t => io.observe(t));
    onMotion.push(off => { if (off) trails.classList.remove('gd-armed'); });
  }

  /* ------------------------------------------------------------ glossary ticker: runs only while it is on screen */
  const ticker = $('[data-gd-ticker]');
  if (ticker && hasIO) {
    new IntersectionObserver(es => ticker.classList.toggle('is-live', es[0].isIntersecting)).observe(ticker);
  }

  /* ------------------------------------------------------------ dog-eared corner of the author card */
  // The corner of the card is folded over. Drag it (mouse, pen or finger) and the fold follows your hand; let go
  // and the paper springs back flat. A tap peels it open to show the endpaper ("Checked, Nov 17, 2026", the same
  // date the card states) and it falls back by itself. The first time the card scrolls into view the corner lifts once.
  // Decorative and aria-hidden: everything it shows is already in the card as text.
  const peel = $('[data-gd-peel]');
  const card = peel && peel.closest('.gd-card-author');
  if (peel && card) {
    let s = 0, v = 0, target = 0, raf = 0, last = 0, held = null, closeT = 0;
    const rest = () => parseFloat(getComputedStyle(card).getPropertyValue('--peel-rest')) || 52;
    const openSize = () => card.clientWidth < 520 ? 108 : Math.min(168, Math.max(120, card.clientWidth * .42));   // phones: a smaller fold that peels over the card's empty corner, not its spec line
    const paint = () => {
      peel.style.setProperty('--peel', s.toFixed(2) + 'px');
      peel.style.setProperty('--pk', Math.min(1, Math.max(0, (s - rest() - 34) / 46)).toFixed(3));
    };
    const step = now => {
      const dt = Math.min(.032, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const k = held ? 900 : 260, c = held ? 60 : 15;   // stiff while held (follows the hand), a floppy settle on release
      v += (k * (target - s) - c * v) * dt; s += v * dt;
      if (s < 0) { s = 0; v = 0; }
      paint();
      if (!held && Math.abs(v) < .05 && Math.abs(target - s) < .05) { s = target; paint(); raf = 0; last = 0; return; }
      raf = requestAnimationFrame(step);
    };
    const go = t => {
      target = t;
      if (motionOff()) { s = t; v = 0; paint(); return; }
      if (!raf) { last = 0; raf = requestAnimationFrame(step); }
    };
    const settle = () => { clearTimeout(closeT); go(rest()); };
    s = target = rest(); paint();

    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    peel.addEventListener('pointerenter', () => { if (fine.matches && !held && target <= rest() + 1) go(rest() + 16); });
    peel.addEventListener('pointerleave', () => { if (fine.matches && !held && target <= rest() + 17) go(rest()); });
    const sizeAt = e => {
      const r = card.getBoundingClientRect();
      // the flap's tip sits as far from the corner on both axes, so take the average of the two distances
      return Math.min(openSize() + 24, Math.max(rest(), ((r.right - e.clientX) + (e.clientY - r.top)) / 2));
    };
    peel.addEventListener('pointerdown', e => {
      if (e.button) return;
      clearTimeout(closeT);
      held = { x: e.clientX, y: e.clientY, moved: false, was: target };
      peel.classList.add('is-held');
      try { peel.setPointerCapture(e.pointerId); } catch {}
    });
    peel.addEventListener('pointermove', e => {
      if (!held) return;
      if (!held.moved && Math.hypot(e.clientX - held.x, e.clientY - held.y) < 6) return;
      held.moved = true;
      go(sizeAt(e));
    });
    const release = e => {
      if (!held) return;
      const h = held; held = null;
      peel.classList.remove('is-held');
      if (e.type === 'pointercancel') { settle(); return; }
      if (h.moved) { settle(); return; }                // let go: it springs back flat
      if (h.was > rest() + 20) { settle(); return; }    // tap on an open corner closes it
      go(openSize());                                   // tap: peel it open, then it falls back by itself
      closeT = setTimeout(settle, 2600);
    };
    peel.addEventListener('pointerup', release);
    peel.addEventListener('pointercancel', release);

    // arrival: the corner lifts once, as if a draft caught it
    if (hasIO && !motionOff()) {
      const io = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        closeT = setTimeout(() => { if (!held && !motionOff()) { go(rest() + 42); closeT = setTimeout(settle, 420); } }, 250);
      }, { threshold: .5 });
      io.observe(card);
    }
    onMotion.push(off => { if (off) { cancelAnimationFrame(raf); raf = 0; s = target; v = 0; paint(); } });
    addEventListener('resize', () => { if (!held && target <= rest() + 17) { s = target = rest(); v = 0; paint(); } }, { passive: true });
  }
})();
