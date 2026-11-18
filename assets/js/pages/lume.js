// Signature component: Re-glaze — tip a glazed jar to pour a new palette, type pairing and photo treatment over a live Lume product page, with an honest WCAG contrast meter.
/* Also on this page (all page-scoped, .lu-*): pressure stickers that peel off the product card and fall into a
   "left out" tray, a botanical stem that grows along the product-page checklist, and loose words that settle
   into one precise line. Everything works without JS (native radios + CSS :has, static lists) and shows its
   final state with Motion off / reduced motion (html.motion-off, set by boot.js and the Motion toggle). */
(() => {
  const root = document.documentElement;
  const still = () => root.classList.contains('motion-off');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const canAnimate = typeof Element !== 'undefined' && 'animate' in Element.prototype;
  const belowFold = el => el.getBoundingClientRect().top > innerHeight * .9;

  /* ------------------------------------------------------------ Re-glaze */
  const stage = $('[data-lu-reglaze]');
  if (stage) {
    const screen = $('.lu-screen', stage);
    const pour = $('.lu-pour', stage);
    const live = $('[data-lu-live]', stage);
    const notes = $$('.lu-note', stage);
    const inputs = $$('.lu-jar-in', stage);
    const NAMES = { sage: 'Sage', clay: 'Clay', night: 'Night', bloom: 'Bloom' };
    let current = (inputs.find(i => i.checked) || inputs[0]).value;
    let anims = [];

    // WCAG 2.x relative luminance + contrast ratio, from the mockup's real computed colors
    const rgb = c => (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    const lum = c => {
      const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const floor1 = v => Math.floor(v * 10) / 10; // never round up: 4.49 must not read as 4.5
    const fmt = v => floor1(v).toFixed(1);
    const measure = () => {
      const cs = el => getComputedStyle(el);
      const bg = cs(screen).backgroundColor;
      const btn = $('.lu-m-btn', stage);
      return [
        ratio(cs($('.lu-m-desc', stage)).color, bg),
        ratio(cs($('.lu-m-foot', stage)).color, bg),
        ratio(cs(btn).color, cs(btn).backgroundColor),
      ];
    };
    const report = (key, announce) => {
      const values = measure();
      const note = notes.find(n => n.dataset.note === key);
      if (note) $$('.lu-meter > div', note).forEach((row, i) => {
        const v = values[i], ok = floor1(v) >= 4.5;
        $('.lu-v', row).textContent = fmt(v) + ':1';
        const bar = $('.lu-bar', row);
        bar.classList.toggle('is-low', !ok);
        $('i', bar).style.setProperty('--v', Math.min(v / 15, 1).toFixed(3));
        const verdict = $('.lu-ok, .lu-bad', row);
        verdict.className = ok ? 'lu-ok' : 'lu-bad';
        verdict.textContent = ok ? 'Pass' : 'Fail';
      });
      if (announce && live) {
        const fails = values.filter(v => floor1(v) < 4.5).length;
        live.textContent = `${NAMES[key]} glaze. Body text contrast ${fmt(values[0])} to 1: ` +
          (fails ? `fails WCAG AA in ${fails} of 3 checks.` : 'passes WCAG AA in all 3 checks.');
      }
    };
    const apply = (key, announce) => {
      stage.dataset.glaze = key;
      notes.forEach(n => n.classList.toggle('is-on', n.dataset.note === key));
      report(key, announce);
    };
    const stop = () => { anims.forEach(a => a.cancel()); anims = []; };
    const potOf = input => $('.lu-pot', input.nextElementSibling);

    // the jar tips toward the phone, wobbles, and rights itself
    const TIP = [
      { transform: 'translate(0, 0) rotate(0deg)' },
      { transform: 'translate(0, -10px) rotate(-6deg)', offset: .16 },
      { transform: 'translate(-6px, -14px) rotate(-46deg)', offset: .42 },
      { transform: 'translate(-6px, -14px) rotate(-48deg)', offset: .62 },
      { transform: 'translate(0, -2px) rotate(9deg)', offset: .8 },
      { transform: 'translate(0, 0) rotate(-4deg)', offset: .9 },
      { transform: 'translate(0, 0) rotate(0deg)' },
    ];
    const WOBBLE = [
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)', offset: .25 }, { transform: 'rotate(7deg)', offset: .5 },
      { transform: 'rotate(-3deg)', offset: .75 }, { transform: 'rotate(0deg)' },
    ];

    const pourTo = (input) => {
      const key = input.value;
      stop();
      current = key;
      if (still() || !canAnimate) { apply(key, true); return; }
      pour.style.setProperty('--c', getComputedStyle(input.nextElementSibling).getPropertyValue('--lu-pour').trim());
      anims.push(potOf(input).animate(TIP, { duration: 1050, easing: 'ease-in-out' }));
      const fall = pour.animate([{ transform: 'translateY(-125%)' }, { transform: 'translateY(0)' }],
        { duration: 520, delay: 300, easing: 'cubic-bezier(.55, 0, .85, .45)', fill: 'forwards' });
      anims.push(fall);
      fall.onfinish = () => {
        apply(key, true);
        // the glaze lands: the screen squashes a touch, then the wet layer clears
        anims.push(screen.animate([{ transform: 'scale(1, .985)' }, { transform: 'scale(1, 1.004)', offset: .55 }, { transform: 'none' }],
          { duration: 420, easing: 'ease-out' }));
        const clear = pour.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(4%)', opacity: 0 }],
          { duration: 420, easing: 'ease-out', fill: 'forwards' });
        anims.push(clear);
        clear.onfinish = () => { fall.cancel(); clear.cancel(); };
      };
    };

    inputs.forEach(input => {
      // tapping the jar that's already poured: a little wobble, nothing changes
      input.addEventListener('click', () => {
        if (input.value === current && input.checked && !still() && canAnimate) potOf(input).animate(WOBBLE, { duration: 520, easing: 'ease-out' });
      });
      input.addEventListener('change', () => { if (input.checked) pourTo(input); });
    });
    addEventListener('zs:motion', () => { if (still()) { stop(); apply(current, false); } });
    apply(current, false);
  }

  /* ------------------------------------------------------------ the noise falls away */
  const hush = $('[data-lu-hush]');
  if (hush) {
    const card = $('.lu-hush-card', hush);
    const stickers = $$('.lu-st', hush);
    const anchors = $$('.lu-anchor', hush);
    const toggle = $('[data-lu-hush-toggle]', hush);
    const live = $('[data-lu-hush-live]', hush);
    const ROT = [-9, 7, -5, 10];
    let onCard = false, anims = [];

    // transform that moves a sticker from its tray slot onto its anchor on the card
    const cardTransform = (s, i) => {
      const prev = s.style.transform; s.style.transform = 'none';
      const a = anchors[i].getBoundingClientRect(), b = s.getBoundingClientRect();
      s.style.transform = prev;
      const dx = a.left - (b.left + b.width / 2), dy = a.top - (b.top + b.height / 2);
      return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${ROT[i]}deg) scale(1.08)`;
    };
    const place = (toCard, animate) => {
      anims.forEach(a => a.cancel()); anims = [];
      const targets = stickers.map((s, i) => toCard ? cardTransform(s, i) : 'none');
      stickers.forEach((s, i) => {
        const from = s.style.transform || 'none', to = targets[i];
        s.style.transform = to === 'none' ? '' : to;
        if (!animate || still() || !canAnimate || from === (to === 'none' ? 'none' : to)) return;
        const lift = from === 'none' ? to : from;
        const frames = toCard
          ? [{ transform: from }, { transform: to.replace('scale(1.08)', 'scale(1.2)'), offset: .7 }, { transform: to }]
          : [{ transform: from }, { transform: lift.replace(/translate\(([-\d.]+)px, ([-\d.]+)px\)/, (m, x, y) => `translate(${x}px, ${(+y - 16).toFixed(1)}px)`).replace(/rotate\(([-\d.]+)deg\)/, (m, r) => `rotate(${+r + 14}deg)`), offset: .2, easing: 'cubic-bezier(.5, 0, .9, .5)' },
             { transform: 'translate(0px, 0px) rotate(-4deg)', offset: .76 }, { transform: 'translate(0px, -12px) rotate(2deg)', offset: .87 }, { transform: 'none' }];
        anims.push(s.animate(frames, { duration: toCard ? 700 : 1100, delay: i * (toCard ? 70 : 150), easing: toCard ? 'cubic-bezier(.34, 1.56, .64, 1)' : 'linear', fill: 'backwards' }));
      });
      if (!toCard && animate && !still() && canAnimate) {
        // the card breathes out once the last sticker has gone
        anims.push(card.animate([{ transform: 'none' }, { transform: 'scale(1.018)', offset: .5 }, { transform: 'none' }],
          { duration: 700, delay: 3 * 150 + 820, easing: 'ease-in-out' }));
      }
      onCard = toCard;
      if (toggle) toggle.setAttribute('aria-pressed', String(toCard));
    };
    const say = () => { if (live) live.textContent = onCard ? 'The loud version: four pressure tactics are stuck on the product card.' : 'The quiet version: the four pressure tactics are left out.'; };

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => { place(!onCard, true); say(); });
    }
    // a teaser: if the section starts off-screen with motion on, the noise waits on the card, then falls once seen
    if (!still() && canAnimate && 'IntersectionObserver' in window && belowFold(hush)) {
      place(true, false);
      const io = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        io.disconnect();
        setTimeout(() => { if (onCard) place(false, true); }, 350);
      }, { threshold: .55 });
      io.observe(card);
      // fonts can move the tray slots after first layout: re-aim the stickers once they're in
      if (document.fonts) document.fonts.ready.then(() => { if (onCard && !anims.length) place(true, false); });
    }
    let rw = innerWidth;
    addEventListener('resize', () => { if (innerWidth !== rw) { rw = innerWidth; if (onCard) place(true, false); } }, { passive: true });
    addEventListener('zs:motion', () => { if (still()) { anims.forEach(a => a.cancel()); anims = []; } });
  }

  /* ------------------------------------------------------------ the stem grows along the checklist */
  const stem = $('[data-lu-stem]');
  if (stem && !still() && 'IntersectionObserver' in window) {
    const items = $$('.lu-stem-list > li', stem);
    let grown = -1;
    const grow = i => {
      if (i <= grown) return;
      for (let k = grown + 1; k <= i; k++) items[k].classList.add('is-grown');
      grown = i;
      stem.style.setProperty('--lu-grow', ((i + 1) / items.length).toFixed(3));
    };
    stem.classList.add('is-armed');
    // anything already scrolled past stays grown
    const pre = items.reduce((m, li, i) => li.getBoundingClientRect().top < innerHeight * .75 ? i : m, -1);
    if (pre >= 0) grow(pre);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { grow(items.indexOf(e.target)); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -25% 0px' });
    items.forEach((li, i) => { if (i > grown) io.observe(li); });
    addEventListener('zs:motion', () => { if (still()) { io.disconnect(); stem.classList.remove('is-armed'); } });
  }

  /* ------------------------------------------------------------ loose words settle into one line */
  const settle = $('[data-lu-settle]');
  if (settle && !still() && 'IntersectionObserver' in window && belowFold(settle)) {
    settle.classList.add('is-armed');
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      settle.classList.add('is-set');
    }, { threshold: .6 });
    io.observe(settle);
    addEventListener('zs:motion', () => { if (still()) { io.disconnect(); settle.classList.add('is-set'); } });
  }
})();
