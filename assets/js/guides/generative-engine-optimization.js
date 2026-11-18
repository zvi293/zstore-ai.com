// Signature component: Quotable or Not — tap the sentences you think an AI could quote on their own, press Check, and the quotable ones fly into an AI answer while the rest bounce back with the reason. On a phone the Check dock rides the bottom of the screen and the result plays in view: verdicts first, then the answer card.
/* /guides/generative-engine-optimization/ page script (prefix .geo-). Vanilla, touches only this page's DOM.
   Also runs the page's smaller living touches: the query fan-out cards deal out of a stack, the seven step keys
   press as you read past them, ceramic × tokens roll onto the tactics to skip, and the audit slaps a "Yes" seal on
   each honest yes and drops a bead into its rail. Two page-scoped holds keep floating controls off the tap targets.
   Everything enhances content that is already readable without JS. Motion off (html.motion-off: the site toggle
   or prefers-reduced-motion, set by boot.js) = final states, no flights, no springs. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const motionOff = () => root.classList.contains('motion-off');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // live text regions get their <b> + <span> once, up front; later updates only swap text. (The accessibility widget
  // re-measures every font size whenever an element with text is added, which at its bigger sizes can jolt the scroll.)
  const prep = (el) => { const b = document.createElement('b'); const t = document.createElement('span'); el.replaceChildren(b, t); };
  const say = (el, strong, rest) => { el.firstChild.textContent = strong; el.lastChild.textContent = strong && rest ? ' ' + rest : (rest || ''); el.classList.toggle('is-blank', !strong && !rest); };
  const io = (els, fn, opts) => {
    if (!('IntersectionObserver' in window)) { els.forEach((el) => fn(el)); return null; }
    const ob = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { fn(e.target); ob.unobserve(e.target); } }), opts);
    els.forEach((el) => ob.observe(el));
    return ob;
  };

  /* ------------------------------------------------------------------ 1. Quotable or Not (signature) */
  const mainEl = $('#main');
  const q = $('[data-geo-q]');
  if (q) {
    const items = $$('.geo-q-item', q);
    const slots = $$('.geo-q-slot', q);
    const ctrl = $('[data-geo-q-ctrl]', q);
    const checkBtn = $('[data-geo-q-check]', q);
    const resetBtn = $('[data-geo-q-reset]', q);
    const count = $('[data-geo-q-count]', q);
    const score = $('[data-geo-q-score]', q);
    const how = $('[data-geo-q-how]', q);
    const side = $('.geo-q-side', q);
    const card = $('.geo-q-card', q);
    // phone layout = the side wrapper is display: contents and the dock is sticky at the bottom of the screen
    const docked = () => getComputedStyle(side).display === 'contents';
    const total = items.filter((li) => li.dataset.ok === '1').length;
    let checked = false;
    let busy = false;

    // build the toggle strips from the static list (the list stays the no-JS version)
    items.forEach((li, i) => {
      const s = $('.geo-q-s', li);
      const v = $('.geo-q-v', li);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'geo-q-strip';
      b.setAttribute('aria-pressed', 'false');
      v.id = 'geo-q-v' + (i + 1);
      li.insertBefore(b, s);
      b.appendChild(s);
      b.addEventListener('click', () => {
        if (checked || busy) return;
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        updateCount();
      });
    });
    slots.forEach((sl) => {
      sl.setAttribute('aria-hidden', 'true');
      const you = document.createElement('span'); // reserved (hidden) up front: landing only reveals it
      you.className = 'geo-q-you'; you.textContent = 'You picked this one';
      sl.appendChild(you);
    });
    prep(score); say(score, '', '');
    q.classList.add('is-live');
    ctrl.hidden = false;
    how.textContent = 'Tap every sentence you think an AI could quote on its own, then press Check.';

    const strips = () => items.map((li) => $('.geo-q-strip', li));
    function updateCount() {
      const n = strips().filter((b) => b.getAttribute('aria-pressed') === 'true').length;
      count.textContent = n + ' picked';
    }

    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

    // verdicts open (or close) under every sentence at once; keep the sentence nearest the middle of the screen
    // exactly where it was, so the strips you just tapped don't slide away from under your thumb
    const holdView = (change) => {
      const mid = innerHeight / 2;
      let anchor = null, best = Infinity;
      strips().forEach((b) => { const r = b.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (r.bottom > 0 && r.top < innerHeight && d < best) { best = d; anchor = b; } });
      const y0 = anchor && anchor.getBoundingClientRect().top;
      change();
      if (anchor) { const dy = anchor.getBoundingClientRect().top - y0; if (Math.abs(dy) > 1) scrollBy({ top: dy, behavior: 'instant' }); }
    };

    async function check() {
      if (checked || busy) return;
      busy = true;
      const still = motionOff();
      let hits = 0, falses = 0, misses = 0;
      holdView(() => items.forEach((li) => {
        const b = $('.geo-q-strip', li);
        const picked = b.getAttribute('aria-pressed') === 'true';
        const ok = li.dataset.ok === '1';
        const state = ok ? (picked ? 'is-hit' : 'is-miss') : (picked ? 'is-false' : 'is-right');
        if (state === 'is-hit') hits++; else if (state === 'is-false') falses++; else if (state === 'is-miss') misses++;
        li.classList.add('is-done', state);
        $('.geo-q-vy', li).textContent = { 'is-hit': '· you picked it', 'is-miss': '· you missed it', 'is-false': '· bounced back', 'is-right': '· rightly skipped' }[state];
        b.setAttribute('aria-disabled', 'true');
        b.setAttribute('aria-describedby', $('.geo-q-v', li).id);
      }));
      checked = true;
      const hadFocus = document.activeElement === checkBtn;
      checkBtn.hidden = true;
      resetBtn.hidden = false;
      if (hadFocus) resetBtn.focus({ preventScroll: true });

      // the answer the AI could build: every quotable sentence lands in its slot
      const landing = items.filter((li) => li.dataset.ok === '1');
      const slotOf = (li) => slots.find((s) => s.dataset.slot === li.dataset.slot);
      // stacked layout: the collapsed answer card springs open to its four slots first (CSS), so the in-view test and
      // the scroll below measure the full card
      const grew = docked() && !q.classList.contains('is-filled');
      q.classList.add('is-filled');
      const navH = parseFloat(getComputedStyle(card).scrollMarginTop) || 90;
      const cr = card.getBoundingClientRect();
      const cardInView = cr.top >= navH - 4 && cr.bottom <= innerHeight - 70;
      if (docked()) {
        // phone: let the verdicts and bounces play where the thumb is, then bring the card up and drop the quotes in
        if (!cardInView) {
          if (!still) await wait(1050);
          card.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
          if (!still) await scrolled();
        }
        // already in view: let the slots finish springing open before the first quote drops in
        const base = cardInView && grew ? 420 : 90;
        landing.forEach((li, i) => { const sl = slotOf(li); if (sl) land(sl, li, still ? 0 : base + i * 230); });
        if (!still) await wait(base + landing.length * 230 + 120);
      } else {
        // side by side: the sentences fly across into the card (brought fully into view first if the page scrolled it off)
        if (!cardInView && (cr.top < navH - 4 || cr.bottom > innerHeight)) {
          card.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
          if (!still) await scrolled();
        }
        landing.forEach((li, i) => {
          const sl = slotOf(li); if (!sl) return;
          if (!still) fly($('.geo-q-s', li), sl, i * 130);
          land(sl, li, still ? 0 : 640 + i * 130);
        });
        if (!still) await wait(640 + landing.length * 130);
      }

      if (hits === total && falses === 0) say(score, 'All ' + total + ' quotable sentences found, with no false picks.', 'That\'s GEO writing in one habit.');
      else {
        const parts = [];
        if (falses) parts.push(plural(falses, 'false pick', 'false picks'));
        if (misses) parts.push(misses + ' missed');
        say(score, hits + ' of ' + total + ' quotable sentences found.', (parts.length ? parts.join(', ') + '. ' : '') + 'Each sentence above now says why.');
      }
      busy = false;
    }

    // resolves when a smooth scroll settles (scrollend where supported, a timeout everywhere else)
    const scrolled = () => new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; removeEventListener('scrollend', fin); res(); } };
      addEventListener('scrollend', fin, { once: true });
      setTimeout(fin, 900);
    });

    function land(slot, li, delay) {
      const picked = $('.geo-q-strip', li).getAttribute('aria-pressed') === 'true';
      const go = () => {
        slot.removeAttribute('aria-hidden');
        slot.classList.add('is-landed');
        const you = $('.geo-q-you', slot);
        you.textContent = picked ? 'You picked this one' : 'You missed this one';
        you.classList.toggle('is-missed', !picked);
        you.classList.add('is-shown');
      };
      delay ? setTimeout(go, delay) : go();
    }

    // a copy of the sentence's text flies from its strip into its slot (Web Animations, transform only)
    function fly(src, slot, delay) {
      const a = src.getBoundingClientRect();
      const t = $('.geo-q-qt', slot).getBoundingClientRect();
      const el = document.createElement('p');
      el.className = 'geo-q-fly';
      el.setAttribute('aria-hidden', 'true');
      el.dataset.t = src.textContent; // drawn by CSS (::after), so adding the flyer never adds text to the page
      el.style.left = a.left + 'px';
      el.style.top = a.top + 'px';
      el.style.width = Math.max(120, a.width) + 'px';
      document.body.appendChild(el);
      const sx = t.width / Math.max(120, a.width);
      const dx = t.left - a.left, dy = t.top - a.top;
      const midY = Math.min(dy, 0) - 60;
      const anim = el.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 0 },
        { transform: 'translate(0,-10px) scale(1.04) rotate(-2deg)', opacity: 1, offset: 0.12 },
        { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.5 + midY) + 'px) scale(' + (1 + sx) / 2 + ') rotate(3deg)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ') rotate(0deg)', opacity: 0.9, offset: 0.9 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ') rotate(0deg)', opacity: 0 }
      ], { duration: 720, delay, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'both' });
      anim.onfinish = () => el.remove();
      anim.oncancel = () => el.remove();
    }

    function reset() {
      if (busy) return;
      checked = false;
      holdView(() => items.forEach((li) => {
        li.classList.remove('is-done', 'is-hit', 'is-miss', 'is-false', 'is-right');
        $('.geo-q-vy', li).textContent = '';
        const b = $('.geo-q-strip', li);
        b.setAttribute('aria-pressed', 'false');
        b.removeAttribute('aria-disabled');
        b.removeAttribute('aria-describedby');
      }));
      q.classList.remove('is-filled');
      slots.forEach((sl) => { sl.classList.remove('is-landed'); sl.setAttribute('aria-hidden', 'true'); $('.geo-q-you', sl).classList.remove('is-shown'); });
      say(score, '', '');
      resetBtn.hidden = true;
      checkBtn.hidden = false;
      updateCount();
      checkBtn.focus();
    }

    checkBtn.addEventListener('click', check);
    resetBtn.addEventListener('click', reset);

    // while the dock owns the bottom of a phone screen, the site's "On this page" pill steps aside (CSS in the page file)
    if (mainEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { mainEl.classList.toggle('geo-q-dock', e.isIntersecting && docked()); }, { rootMargin: '-98% 0px 0px 0px' }).observe($('.geo-q-grid', q));
    }
  }

  /* ------------------------------------------------------------------ 2. Query fan-out: cards deal out of a stack */
  const fan = $('[data-geo-fan]');
  if (fan && !motionOff() && 'IntersectionObserver' in window) {
    const cards = $$('.geo-fan-card', fan);
    const ask = $('.geo-fan-ask', fan);
    const stack = () => {
      const q = ask.getBoundingClientRect();
      const cx = q.left + q.width / 2, cy = q.bottom - 10;
      cards.forEach((c) => {
        c.style.removeProperty('--sx'); c.style.removeProperty('--sy');
        const r = c.getBoundingClientRect();
        c.style.setProperty('--sx', (cx - (r.left + r.width / 2)).toFixed(1) + 'px');
        c.style.setProperty('--sy', (cy - r.top - r.height * 0.3).toFixed(1) + 'px');
      });
      fan.classList.add('is-stacked');
    };
    // only stack while the figure is still below the fold, so nothing that was already visible disappears
    const r0 = fan.getBoundingClientRect();
    if (r0.top > innerHeight) {
      stack();
      io([fan], () => { void fan.offsetWidth; requestAnimationFrame(() => fan.classList.remove('is-stacked')); }, { rootMargin: '0px 0px -22% 0px' });
    }
  }

  /* ------------------------------------------------------------------ 3. Seven steps: each key presses as you read past it */
  const steps = $('[data-geo-steps]');
  if (steps) {
    const lis = $$('.geo-step', steps);
    if (motionOff() || !('IntersectionObserver' in window)) lis.forEach((li) => li.classList.add('is-pressed'));
    else {
      steps.classList.add('is-armed');
      io(lis, (li) => li.classList.add('is-pressed'), { rootMargin: '0px 0px -42% 0px' });
    }
  }

  /* ------------------------------------------------------------------ 4. Tactics to skip: a × token rolls onto each card */
  const skip = $('[data-geo-skip]');
  if (skip && !motionOff() && 'IntersectionObserver' in window && skip.getBoundingClientRect().top > innerHeight) {
    const lis = $$(':scope > li', skip);
    lis.forEach((li, i) => li.style.setProperty('--d', (i * 0.06).toFixed(2) + 's'));
    skip.classList.add('is-armed');
    io(lis, (li) => li.classList.add('is-in'), { rootMargin: '0px 0px -24% 0px' });
  }

  /* ------------------------------------------------------------------ 5. Quick audit: a "Yes" seal per honest yes, and a glazed bead in the rail */
  const au = $('[data-geo-au]');
  if (au) {
    const meter = $('[data-geo-au-meter]');
    const rail = $('.geo-au-rail', meter);
    const res = $('[data-geo-au-res]');
    const cnt = $('[data-geo-au-count]', meter);
    const lis = $$(':scope > li', au);
    const beads = lis.map(() => { const i = document.createElement('i'); rail.appendChild(i); return i; });
    lis.forEach((li, i) => {
      const qEl = $('.geo-au-q', li);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'geo-au-b';
      b.setAttribute('aria-pressed', 'false');
      const n = document.createElement('span');
      n.className = 'geo-au-n'; n.setAttribute('aria-hidden', 'true'); n.textContent = String(i + 1).padStart(2, '0');
      const st = document.createElement('span');
      st.className = 'geo-au-st'; st.setAttribute('aria-hidden', 'true');
      const stQ = document.createElement('span'); stQ.className = 'geo-au-st-q'; stQ.textContent = 'yes?';
      const stS = document.createElement('span'); stS.className = 'geo-au-st-s'; stS.textContent = 'Yes';
      st.append(stQ, stS);
      const tw = document.createElement('span');
      tw.className = 'geo-au-t';
      tw.append(n, qEl);
      b.append(tw, st);
      li.appendChild(b);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (on && !motionOff()) { b.classList.remove('is-thunk'); void b.offsetWidth; b.classList.add('is-thunk'); }
        sync();
      });
      b.addEventListener('animationend', (e) => { if (e.target === b) b.classList.remove('is-thunk'); });
    });
    prep(res); say(res, '', 'Tap each question you can honestly answer yes to.');
    au.classList.add('is-live');
    meter.hidden = false;
    res.hidden = false;
    function sync() {
      const yes = lis.filter((li) => $('.geo-au-b', li).getAttribute('aria-pressed') === 'true').length;
      beads.forEach((bd, i) => bd.classList.toggle('is-on', i < yes));
      let tip;
      if (yes === 0) tip = 'Tap a question you can answer yes to.';
      else if (yes <= 3) tip = 'Start with the foundations: crawler access, indexing and a clear first paragraph.';
      else if (yes <= 7) tip = 'A solid start. Your noes are the to-do list, roughly in order.';
      else if (yes < 10) tip = 'Strong foundations. First-hand content and mentions elsewhere come next.';
      else tip = 'Every foundation in place. Now it\'s about content only you can write.';
      say(res, yes + ' of 10 yes.', tip);
      cnt.textContent = yes + ' of 10 yes';
    }

    // the WhatsApp bead would sit right over the seals on a phone: hold it while the questions fill the lower screen
    if (mainEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { mainEl.classList.toggle('geo-hold-wa', e.isIntersecting); }, { rootMargin: '-75% 0px 0px 0px' }).observe($('.geo-au-panel'));
    }
  }
})();
