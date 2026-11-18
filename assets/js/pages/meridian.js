// Signature component: Look First — pin the card you'd check first, then press "Meridian it" and eight equally loud cards spring into one answer, two reasons and a rail.
/* /work/meridian/ page script. Also runs the page's smaller living touches: the hero squint test, principle diagrams
   that put themselves in order, the parallax plate, the scroll-driven subtraction and the magnetic study cards.
   Touches only .mr-* / .mrl-* DOM. Motion off (html.motion-off: the site toggle or reduced motion) = final states. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const still = () => root.classList.contains('motion-off');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;

  // A damped spring (k 210, c 19: about 7% overshoot) sampled into a CSS linear() easing; older browsers get the site curve.
  const SPRING = (() => {
    try {
      if (!CSS.supports('transition-timing-function', 'linear(0, 1)')) throw 0;
      const N = 56, D = .82, sub = 6, pts = [];
      let x = 0, v = 0;
      for (let i = 0; i <= N; i++) {
        pts.push(i === N ? 1 : +x.toFixed(4));
        for (let s = 0; s < sub; s++) { const a = -210 * (x - 1) - 19 * v; v += a * D / N / sub; x += v * D / N / sub; }
      }
      return 'linear(' + pts.join(', ') + ')';
    } catch (e) { return 'cubic-bezier(.34, 1.56, .64, 1)'; }
  })();

  /* ------------------------------------------------------------ Look First */
  const grid = $('[data-mrl-grid]');
  if (grid) {
    const say = $('[data-mrl-say]'), key = $('[data-mrl-key]'), keyT = $('[data-mrl-key-t]');
    const cap = $('.mrl-cap'), cmps = $$('.mrl-cmp'), verb = $('[data-mrl-verb]');
    const cards = $$('.mrl-card', grid);
    if (verb && fine) verb.textContent = 'Click';

    // upgrade each static card to a real button (the no-JS page keeps plain, readable cards)
    const hits = cards.map(li => {
      const d = $('.mrl-hit', li), b = document.createElement('button');
      b.type = 'button'; b.className = d.className; b.dataset.k = d.dataset.k; b.setAttribute('aria-pressed', 'false');
      while (d.firstChild) b.append(d.firstChild);
      const pin = document.createElement('span'); pin.className = 'mrl-pin'; pin.setAttribute('aria-hidden', 'true');
      b.append(pin); d.replaceWith(b);
      return b;
    });

    const NAME = { balance: 'Balance', expenses: 'Expenses', invoices: 'Invoices', cashflow: 'Cash flow', tax: 'Tax', transactions: 'Activity', payroll: 'Payroll', alerts: 'Alerts' };
    const BEFORE = {
      balance: ['Balance first.', ' The most common pick, and it feels right. But it shows what’s in the bank, not what’s already promised: payroll, tax and supplier bills still come out of it.'],
      expenses: ['Expenses first.', ' Close. The 9,870.00 still due to suppliers hides in its small print, but you’d still need the balance, payroll and tax to know if it’s covered.'],
      invoices: ['Invoices first.', ' Useful, but that’s money you hope to receive. You can’t pay a supplier with an invoice that hasn’t been paid yet.'],
      cashflow: ['Cash flow first.', ' A chart shows the trend, not today’s answer. You’d read seven bars and still have to do the math.'],
      tax: ['Tax first.', ' A real bill, but only one of three that leave the account before month end.'],
      transactions: ['Transactions first.', ' That’s the history of what already happened. The question is about what’s coming.'],
      payroll: ['Payroll first.', ' The biggest bill, but still one of three. You’d need the balance and the other bills too.'],
      alerts: ['Alerts first.', ' Badges pull the eye, which is exactly the problem: the loudest card isn’t the one with the answer.']
    };
    const AFTER = {
      balance: ['The answer.', ' 21,680.00 left after everything due this month, so yes: suppliers are covered. One number, no math.'],
      expenses: ['Reason one.', ' Everything due before month end, itemized: suppliers, payroll and tax. It’s what the answer subtracts.'],
      invoices: ['Reason two.', ' Money on its way. It isn’t counted in the answer, because it hasn’t arrived yet.']
    };
    const afterMsg = k => AFTER[k] || [NAME[k] + ' is in the rail.', ' Still one tap away, just no longer competing for your first look.'];
    const NUDGE = ' No single card answers it. Press “Meridian it”.';

    let state = 'before', pick = null;
    const speak = (lead, text) => { const b = document.createElement('b'); b.textContent = lead; say.replaceChildren(b, text); };
    // the JS copy goes in before the region becomes live, so nothing is announced on load
    speak('Your move.', ' ' + (fine ? 'Click' : 'Tap') + ' the card you’d check first. Then press “Meridian it” to rearrange the same sample data around one answer.');
    say.setAttribute('aria-live', 'polite');

    hits.forEach(b => b.addEventListener('click', () => {
      // a real toggle: pressing the pinned card again lifts the pin
      pick = pick === b.dataset.k ? null : b.dataset.k;
      hits.forEach(h => h.setAttribute('aria-pressed', String(h.dataset.k === pick)));
      if (!pick) { speak('Pin lifted.', ' ' + (fine ? 'Click' : 'Tap') + ' any card to choose your first look again.'); return; }
      if (state === 'before') { const m = BEFORE[pick]; speak(m[0], m[1] + NUDGE); }
      else { const m = afterMsg(pick); speak(m[0], m[1]); }
    }));

    const morph = next => {
      const first = cards.map(c => c.getBoundingClientRect());
      const h0 = grid.getBoundingClientRect().height;
      grid.dataset.state = state = next;
      if (still() || typeof grid.animate !== 'function') return;
      const h1 = grid.getBoundingClientRect().height;
      cards.forEach((c, i) => {
        const a = first[i], b = c.getBoundingClientRect();
        if (!b.width || !b.height) return;
        const delay = i * 26;
        c.animate([
          { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
          { transform: 'none' }
        ], { duration: 820, delay, easing: SPRING, fill: 'backwards' });
        // the content waits until the card has nearly landed, so text is never seen stretched
        $$('.mrl-v', hits[i]).forEach(v => v.animate([
          { opacity: 0, transform: 'translateY(8px)' }, { opacity: 0, transform: 'translateY(8px)', offset: .42 }, { opacity: 1, transform: 'none' }
        ], { duration: 680, delay, easing: 'cubic-bezier(.2, .9, .1, 1)', fill: 'backwards' }));
      });
      grid.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 560, easing: 'cubic-bezier(.2, .9, .1, 1)' });
    };

    key.addEventListener('click', () => {
      const next = state === 'before' ? 'after' : 'before';
      // on a short phone the top of the cards can be above the screen when the key is pressed: bring them back first
      const bar = $('.nav-bar'), navH = Math.max(bar ? bar.getBoundingClientRect().bottom : 0, 60) + 12;
      const gTop = grid.getBoundingClientRect().top;
      if (gTop < navH) scrollTo({ top: scrollY + gTop - navH, behavior: still() ? 'auto' : 'smooth' });
      morph(next);
      keyT.textContent = next === 'after' ? 'Back to before' : 'Meridian it';
      cap.textContent = next === 'after'
        ? 'After: the Meridian layout. Same sample data, one answer first. Concept study.'
        : 'Before: eight cards, all equally loud. Concept study, sample data.';
      cmps.forEach(c => c.classList.toggle('is-on', c.dataset.cmp === next));
      if (next === 'after') {
        let mine = '';
        if (pick === 'balance') mine = ' Your first look became the answer itself.';
        else if (AFTER[pick]) mine = ' Your first look became one of the two reasons.';
        else if (pick) mine = ' Your first look, ' + NAME[pick] + ', now waits one tap away in the rail.';
        speak('Meridian layout.', ' One answer, 21,680.00 available after bills, with the two reasons beside it and five cards one tap away.' + mine);
      } else {
        speak('Back to before.', ' Eight cards, all equally loud. Try a different first look, or press the key again.');
      }
    });
    // keyboard press depth on the keycap (pointer presses use :active)
    key.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') key.classList.add('is-down'); });
    ['keyup', 'blur'].forEach(t => key.addEventListener(t, () => key.classList.remove('is-down')));

    // page-scoped: keep the shared WhatsApp bead out of the stage while it is on screen
    const slab = grid.closest('.mrl');
    if (slab && hasIO) new IntersectionObserver(es => root.classList.toggle('mr-wa-hold', es[0].isIntersecting)).observe(slab);

    // the five-second beads count down once, the first time the stage is properly in view
    // ("Time’s up" is only written if the stage is still on screen, so nobody hears it from elsewhere on the page)
    const timer = $('.mrl-timer'), stage = $('.mrl-stage');
    if (timer && stage && hasIO) {
      let seen = false, inView = false;
      new IntersectionObserver(es => {
        inView = es[0].isIntersecting;
        if (seen || es[0].intersectionRatio < .55) return;
        seen = true;
        if (still()) return;
        timer.classList.add('is-ticking');
        setTimeout(() => { if (inView && !pick && state === 'before') speak('Time’s up.', ' Where did your eyes go first? ' + (fine ? 'Click' : 'Tap') + ' that card.'); }, 5300);
      }, { threshold: [0, .55] }).observe(stage);
    }
  }

  /* ------------------------------------------------------------ hero squint test: blur what a squinting eye loses */
  const sq = $('[data-mr-squint]');
  if (sq) {
    const plate = $('.mr-plate'), live = $('[data-mr-squint-live]');
    sq.addEventListener('click', () => {
      const on = sq.getAttribute('aria-pressed') !== 'true';
      sq.setAttribute('aria-pressed', String(on));
      plate.classList.toggle('is-squint', on);
      sq.parentElement.classList.toggle('is-on', on);
      live.textContent = on ? 'Squint view on: the glowing key and 21,680.00 still stand out, everything else blurs.' : 'Squint view off.';
    });
  }

  /* ------------------------------------------------------------ principle diagrams put themselves in order on arrival */
  const org = $('[data-mr-org]');
  if (org && hasIO && !still()) {
    const items = $$('.mr-pr-item', org), vh = innerHeight;
    const later = items.filter(it => it.getBoundingClientRect().top > vh * .9);
    if (later.length) {
      items.forEach(it => { if (!later.includes(it)) it.classList.add('is-set'); });
      org.classList.add('mr-org-armed');
      const oio = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-set'); oio.unobserve(e.target);
      }), { rootMargin: '0px 0px -18% 0px' });
      later.forEach(it => oio.observe(it));
    }
  }

  /* ------------------------------------------------------------ scroll-tied helper (work only while on screen) */
  const whileVisible = (el, fn) => {
    let on = false, raf = 0;
    const tick = () => { raf = 0; fn(); };
    const kick = () => { if (on && !raf) raf = requestAnimationFrame(tick); };
    if (hasIO) new IntersectionObserver(es => { on = es[0].isIntersecting; kick(); }).observe(el);
    else on = true;
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick, { passive: true });
    return () => { const was = on; on = true; kick(); on = was; };
  };

  /* ------------------------------------------------------------ rules deck (phones): a pinned card sinks back as the
     next one covers it. --mr-cv is 0 while the card is whole on screen, so text at rest is never scaled. */
  if (org) {
    const deck = matchMedia('(max-width: 767px) and (min-height: 640px)');
    const cards = $$('.mr-pr-item', org);
    let had = false;
    const clear = () => { if (had) { cards.forEach(c => c.style.removeProperty('--mr-cv')); had = false; } };
    whileVisible(org, () => {
      if (still() || !deck.matches || /\ba11y-t[23]\b/.test(root.className)) { clear(); return; }
      const rs = cards.map(c => c.getBoundingClientRect());
      cards.forEach((c, i) => {
        const nx = rs[i + 1];
        const h = c.offsetHeight, v = nx ? Math.max(0, Math.min(1, (rs[i].top + h - nx.top) / h)) : 0;
        if (v > 0) { c.style.setProperty('--mr-cv', v.toFixed(3)); had = true; } else c.style.removeProperty('--mr-cv');
      });
    });
  }

  /* ------------------------------------------------------------ parallax plate: the art floats over its backing slab */
  const depth = $('[data-mr-depth]');
  if (depth) {
    whileVisible(depth, () => {
      if (still()) { depth.style.setProperty('--mr-dy', '0'); return; }
      const r = depth.getBoundingClientRect();
      const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      depth.style.setProperty('--mr-dy', (Math.max(-1, Math.min(1, c)) * -22).toFixed(2));
    });
  }

  /* ------------------------------------------------------------ hierarchy is subtraction: ten things fall, one answer stays */
  const track = $('[data-mr-sub]');
  if (track) {
    const sec = track.closest('.mr-sub'), stick = $('.mr-sub-stick', track);
    const words = $$('.mr-sub-pile span', track), one = $('.mr-sub-one', track), count = $('[data-mr-sub-count]', track);
    words.forEach((w, i) => w.style.setProperty('--r', ((i % 2 ? 1 : -1) * (5 + (i * 7) % 13)) + 'deg'));
    const pile = $('.mr-sub-pile', track);
    let last = '';
    // the words that stay re-flow into the gaps with a spring (FLIP), so the pile stays a tidy, centred block
    const flip = mutate => {
      const keep = words.filter(x => !x.classList.contains('is-out') && !x.classList.contains('is-gone'));
      const first = keep.map(x => x.getBoundingClientRect());
      mutate();
      keep.forEach((x, i) => {
        const r = x.getBoundingClientRect(), dx = first[i].left - r.left, dy = first[i].top - r.top;
        if (x._a) x._a.cancel();
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
        x._a = x.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      });
    };
    const measure = () => {
      if (!sec.classList.contains('is-live')) { pile.style.removeProperty('--mr-pile-h'); return; }
      const outs = words.filter(w => w.classList.contains('is-out'));
      outs.forEach(w => w.classList.remove('is-out'));
      const g = pile.style.getPropertyValue('--mr-gain');
      pile.style.removeProperty('--mr-pile-h'); pile.style.removeProperty('--mr-gain');
      const h = pile.offsetHeight;
      if (g) pile.style.setProperty('--mr-gain', g);
      outs.forEach(w => w.classList.add('is-out'));
      pile.style.setProperty('--mr-pile-h', h + 'px');
    };
    const setGone = (w, gone) => {
      if (!!w._g === gone) return;
      w._g = gone;
      clearTimeout(w._t);
      if (gone) {
        w.classList.add('is-gone');
        w._t = setTimeout(() => flip(() => w.classList.add('is-out')), 520);
      } else {
        if (w.classList.contains('is-out')) flip(() => w.classList.remove('is-out'));
        requestAnimationFrame(() => { if (!w._g) w.classList.remove('is-gone'); });
      }
    };
    const update = () => {
      if (!sec.classList.contains('is-live')) return;
      const r = track.getBoundingClientRect(), top = parseFloat(getComputedStyle(stick).top) || 0;
      const run = r.height - stick.offsetHeight;
      const p = run > 0 ? Math.max(0, Math.min(1, (top - r.top) / run)) : 1;
      let left = 0;
      words.forEach((w, i) => { const gone = p > .1 + i * .068; setGone(w, gone); if (!gone) left++; });
      // the last few get louder as the crowd thins: what's left takes the room the others gave up
      pile.style.setProperty('--mr-gain', left <= 4 ? (1 + (5 - left) * .15).toFixed(2) : '1');
      const fin = left === 0; // the answer lands as the last word falls: no empty beat
      one.classList.toggle('is-on', fin);
      const n = fin ? '1' : String(left);
      if (n !== last) { count.textContent = n; last = n; }
    };
    const kick = whileVisible(track, update);
    const setLive = () => {
      const live = !still();
      sec.classList.toggle('is-live', live);
      if (!live) { words.forEach(w => { clearTimeout(w._t); w._g = false; if (w._a) w._a.cancel(); w.classList.remove('is-gone', 'is-out'); }); one.classList.remove('is-on'); pile.style.removeProperty('--mr-gain'); count.textContent = '10 → 1'; last = ''; }
      measure();
      if (live) kick();
    };
    if ('ResizeObserver' in window) { let w0 = 0; new ResizeObserver(() => { if (track.offsetWidth !== w0) { w0 = track.offsetWidth; measure(); } }).observe(track); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    setLive();
    addEventListener('zs:motion', setLive);
  }

  /* ------------------------------------------------------------ magnetic next / previous study cards (fine pointers) */
  if (fine) $$('[data-mr-magnet]').forEach(el => {
    let raf = 0, mx = 0, my = 0;
    const apply = () => { raf = 0; el.style.setProperty('--mx', mx.toFixed(3)); el.style.setProperty('--my', my.toFixed(3)); };
    el.addEventListener('pointermove', e => {
      if (still()) return;
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - .5) * 2; my = ((e.clientY - r.top) / r.height - .5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('pointerleave', () => { mx = my = 0; if (!raf) raf = requestAnimationFrame(apply); });
  });
})();
