// Signature component: Fill-the-Blanks Brief — tap a blank in a one-paragraph brief, pick a suggestion sticker (or write your own) and it stamps into place; fill all ten to copy it or send it to Zvi.
/* /guides/how-to-write-a-website-brief/ page script (prefix .wb-). Vanilla, touches only this page's own DOM.
   1. Fill-the-Blanks Brief (signature): the paragraph's blanks become buttons; a suggestion tray opens through the
      shared Popups stack (window.ZS.Popups: one history entry, BACK / Escape / backdrop close it, focus returns to the
      blank). "Send it to Zvi" carries the text to the contact form via sessionStorage 'zs-brief-prefill' (never the URL).
      "Show an example" fills only the empty blanks (dashed-outline stickers) and can be undone; the READY stamp and
      "Send it to Zvi" wait until no example answer is left.
   2. The nine sections are a file of folders: they stack up as you scroll, every index tab stays readable.
   3. Mistakes: editor's suggestions. Accept one and the vague line is struck while the rewrite settles in.
   4. Template: clamped preview, Copy (with a carbon copy flying off) and a client-side .txt download.
   5. Hero: the laminated clipboard tilts toward the pointer (or a sideways drag), tips back with the scroll and a
      sheen slides across the sheet.
   Motion off (html.motion-off: the site toggle or prefers-reduced-motion) = final states, no springs, no loops.
   Without JS the paragraph reads as a fill-in template and the full template sits below it. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const still = () => root.classList.contains('motion-off');
  const pad = n => String(n).padStart(2, '0');
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  const copyText = text => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr';
      document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove(); ok ? resolve() : reject();
    });
  };

  /* ------------------------------------------------------------ 1. Fill-the-Blanks Brief */
  const SLOTS = {
    business: { q: 'What kind of business do you run?', opts: ['a family bakery', 'an architecture studio', 'a physio clinic', 'a skincare brand', 'a software startup', 'a bike repair shop'] },
    who: { q: 'Who do you serve?', opts: ['local families', 'homeowners planning a remodel', 'runners and weekend athletes', 'small teams that hate admin', 'commuters and weekend riders'] },
    goal: { q: 'What must the new site do?', opts: ['bring in more bookings', 'turn visitors into leads', 'sell without a marketplace', 'answer the questions we get daily', 'look as good as our work'] },
    action: { q: "What's the one action visitors should take?", opts: ['book a visit in a minute', 'request a quote', 'buy without calling us', 'call us in one tap', 'join the waitlist'] },
    doubt: { q: 'What do visitors usually worry about?', opts: ['how soon we can start', "whether it's worth it", "whether we've done this before", 'how long it will take', "who they'll actually deal with"] },
    content: { q: 'What content do you have today?', opts: ['most of the copy and photos', 'a logo, but no photos yet', 'an old site we can reuse', 'nothing written yet'] },
    feel: { q: 'How should it feel, in three words?', opts: ['warm, calm and local', 'precise, quiet and premium', 'bold, playful and quick', 'clear, friendly and trusted'] },
    admire: { q: 'Which site do you admire, and why?', opts: ["the site I'll link below", 'a calm magazine site', 'a good museum website', "my favorite café's site"] },
    date: { q: 'When do you need to be live?', opts: ['the end of next quarter', 'our spring opening', 'a trade show in March', 'the start of busy season', 'our product launch'] },
    reason: { q: 'Why that date?', opts: ['a new location opens then', 'a campaign starts that week', "it's our busiest season", 'our current site is shutting down', "we're pitching to investors"] }
  };
  // the same fictional bike repair shop as the example brief further down the page
  const EXAMPLE = {
    business: 'a bike repair shop', who: 'commuters and weekend riders', goal: 'bring in more booked repairs',
    action: 'book a repair in a minute', doubt: "how long they'll be without a bike", content: 'good photos and old site text',
    feel: 'friendly, quick and local', admire: "my favorite café's site", date: 'the start of spring', reason: "it's our busiest season"
  };
  const TILT = [-1.6, 1.2, -.8, 1.8, -1.4, .9, -1.9, 1.3, -1.1, 1.6];
  const DRAFT_KEY = 'wb-brief-draft', EX_KEY = 'wb-brief-ex';
  // a label with the shared letter roll (app.js rebuilds it into .sr + .roll spans in idle time)
  const setRoll = (el, text) => {
    const sr = $('.sr', el), roll = $('.roll', el);
    if (!sr || !roll) { el.textContent = text; return; }
    sr.textContent = text; roll.textContent = '';
    [...text].forEach((c, i) => { const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c; ch.dataset.c = c; ch.style.setProperty('--i', i); roll.append(ch); });
  };

  const fb = $('[data-wb-fb]');
  const tray = $('#wb-tray');
  const textEl = fb && $('[data-wb-text]', fb);
  if (fb && tray && textEl) {
    const Popups = window.ZS && window.ZS.Popups;
    const countEl = $('[data-wb-count]', fb), beadsEl = $('[data-wb-beads]', fb), statusEl = $('[data-wb-status]', fb);
    const pairDraft = $('[data-wb-pair="draft"]', fb), pairDone = $('[data-wb-pair="done"]', fb);
    const nextBtn = $('[data-wb-next]', fb), exampleBtn = $('[data-wb-example]', fb), resetBtn = $('[data-wb-reset]', fb);
    const copyBtn = $('[data-wb-copy]', fb), sendLink = $('[data-wb-send]', fb), copyLabel = $('.wb-fb-copy-l', fb);
    const trayK = $('[data-wb-tray-k]', tray), trayT = $('[data-wb-tray-t]', tray), optsEl = $('[data-wb-tray-opts]', tray);
    const ownForm = $('[data-wb-tray-form]', tray), ownInput = $('[data-wb-own]', tray), ownErr = $('[data-wb-own-err]', tray);

    let values = {};
    try { const saved = JSON.parse(store.get(DRAFT_KEY) || '{}'); if (saved && typeof saved === 'object') values = saved; } catch (e) {}
    // the blanks that still hold an example answer (not the visitor's own)
    let exKeys = new Set();
    try { const ex = JSON.parse(store.get(EX_KEY) || '[]'); if (Array.isArray(ex)) exKeys = new Set(ex.filter(k => typeof k === 'string')); } catch (e) {}
    const exLabel = $('[data-roll]', exampleBtn);

    // the blanks become real buttons (same words, same place in the sentence)
    const slots = $$('.wb-fb-slot', textEl).map((span, i) => {
      const key = span.dataset.slot;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wb-fb-slot'; b.dataset.slot = key; b.dataset.hint = span.textContent.trim();
      b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', 'wb-tray'); b.setAttribute('aria-expanded', 'false');
      b.style.setProperty('--tilt', TILT[i % TILT.length] + 'deg');
      span.replaceWith(b);
      if (typeof values[key] !== 'string' || !SLOTS[key]) delete values[key];
      return b;
    });
    exKeys.forEach(k => { if (!values[k] || values[k] !== EXAMPLE[k]) exKeys.delete(k); });
    const total = slots.length;
    const beads = slots.map(() => { const i = document.createElement('i'); beadsEl.append(i); return i; });

    const filledCount = () => slots.filter(s => values[s.dataset.slot]).length;
    const compose = () => [...textEl.childNodes].map(n => n.nodeType === 3 ? n.nodeValue : (n.dataset && n.dataset.slot ? (values[n.dataset.slot] || '[' + n.dataset.hint + ']') : n.textContent)).join('').replace(/\s+/g, ' ').trim();
    const save = () => {
      if (Object.keys(values).length) store.set(DRAFT_KEY, JSON.stringify(values)); else store.del(DRAFT_KEY);
      if (exKeys.size) store.set(EX_KEY, JSON.stringify([...exKeys])); else store.del(EX_KEY);
    };
    // short visible line; the full brief rides along for screen readers only (it is already on screen in the card)
    const say = (msg, extra) => {
      statusEl.textContent = '';
      requestAnimationFrame(() => {
        statusEl.textContent = msg;
        if (extra) { const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = ' ' + extra; statusEl.append(sr); }
      });
    };

    const renderSlot = (b, i) => {
      const v = values[b.dataset.slot], ex = exKeys.has(b.dataset.slot);
      b.textContent = v || b.dataset.hint;
      b.classList.toggle('is-filled', !!v);
      b.classList.toggle('is-example', ex);
      b.style.setProperty('--r', v ? b.style.getPropertyValue('--tilt') : '0deg');
      b.setAttribute('aria-label', !v ? `${b.dataset.hint}. Blank ${i + 1} of ${total}, empty. Fill it`
        : ex ? `${v}. Blank ${i + 1} of ${total}, example answer for ${b.dataset.hint}. Make it yours`
        : `${v}. Blank ${i + 1} of ${total}, ${b.dataset.hint}. Change it`);
    };
    let wasDone = false;
    const render = (opts = {}) => {
      const h0 = textEl.offsetHeight;
      slots.forEach(renderSlot);
      const n = filledCount(), done = n === total && !exKeys.size;
      beads.forEach((bd, i) => bd.classList.toggle('is-on', i < n));
      countEl.textContent = !n ? `${total} blanks` : exKeys.size ? `${exKeys.size} example${exKeys.size > 1 ? 's' : ''} left` : `${pad(n)} / ${total} filled`;
      if (exLabel) {
        const want = exKeys.size ? 'Undo the example' : 'Show an example';
        if (exampleBtn.dataset.state !== want) { exampleBtn.dataset.state = want; setRoll(exLabel, want); }
      }
      resetBtn.disabled = n === 0;
      // the two action pairs share one slot, so swapping them never moves the page
      pairDraft.hidden = done; pairDone.hidden = !done;
      fb.classList.toggle('is-done', done);
      if (opts.quiet) fb.classList.toggle('is-instant', done);
      wasDone = done;
      const h1 = textEl.offsetHeight;
      if (!still() && !opts.quiet && Math.abs(h1 - h0) > 2 && textEl.animate) {
        textEl.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 520, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
      }
    };
    const stamp = b => {
      if (still()) return;
      b.classList.remove('is-stamp'); void b.offsetWidth; b.classList.add('is-stamp');
      b.addEventListener('animationend', () => b.classList.remove('is-stamp'), { once: true });
    };

    /* the tray */
    let current = null;
    const trayWide = () => innerWidth >= 768;
    const placeTray = () => {
      if (!current || !tray.open) return;
      if (!trayWide()) { ['--wb-x', '--wb-y'].forEach(p => tray.style.removeProperty(p)); return; }
      const r = current.getBoundingClientRect(), w = tray.offsetWidth, h = tray.offsetHeight, gap = 12;
      let top = r.bottom + gap, below = true;
      if (top + h > innerHeight - gap) { top = r.top - h - gap; below = false; }
      if (top < gap) { top = Math.max(gap, (innerHeight - h) / 2); }
      const left = Math.min(Math.max(gap, r.left + r.width / 2 - w / 2), innerWidth - w - gap);
      tray.style.setProperty('--wb-x', Math.round(left) + 'px');
      tray.style.setProperty('--wb-y', Math.round(top) + 'px');
      tray.style.setProperty('--wb-ox', Math.round(Math.min(w, Math.max(0, r.left + r.width / 2 - left))) + 'px');
      tray.style.setProperty('--wb-oy', below ? '0px' : '100%');
      tray.style.setProperty('--wb-dy', below ? '-12px' : '12px');
    };
    const buildOptions = key => {
      const cur = values[key] || '';
      optsEl.textContent = '';
      SLOTS[key].opts.forEach((o, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'wb-tray-opt'; b.textContent = o;
        b.setAttribute('aria-pressed', String(o === cur));
        b.style.setProperty('--i', i);
        optsEl.append(b);
      });
      ownInput.value = cur && !SLOTS[key].opts.includes(cur) ? cur : '';
      ownErr.hidden = true; ownInput.removeAttribute('aria-invalid'); ownInput.removeAttribute('aria-describedby');
    };
    const openTray = b => {
      if (!b) return;
      const key = b.dataset.slot, idx = slots.indexOf(b);
      // phones: the sheet covers the lower half, so bring the blank into the top third first.
      // Larger screens: the card opens beside the blank; if it fits neither below nor above, make room below.
      trayK.textContent = `Blank ${pad(idx + 1)} / ${total}`;
      trayT.textContent = SLOTS[key].q;
      buildOptions(key);
      const r = b.getBoundingClientRect();
      if (!trayWide()) {
        if (r.top < 80 || r.bottom > innerHeight * 0.4) scrollBy({ top: r.top - innerHeight * 0.18, behavior: 'instant' });
      } else {
        // measure this tray (hidden, same frame, nothing paints), then make room below the blank if it fits nowhere
        tray.style.visibility = 'hidden'; tray.setAttribute('open', '');
        const h = tray.offsetHeight, gap = 12, navH = 96;
        tray.removeAttribute('open'); tray.style.visibility = '';
        if (r.bottom + gap + h > innerHeight - gap && r.top - gap - h < navH) scrollBy({ top: r.top - navH - 8, behavior: 'instant' });
      }
      current = b;
      slots.forEach(s => { s.classList.toggle('is-active', s === b); s.setAttribute('aria-expanded', String(s === b)); });
      if (Popups) Popups.open(tray, b); else if (tray.showModal) tray.showModal(); else tray.setAttribute('open', '');
      placeTray();
      const first = $('.wb-tray-opt[aria-pressed="true"]', optsEl) || (ownInput.value ? ownInput : $('.wb-tray-opt', optsEl));
      if (first) first.focus({ preventScroll: true });
    };
    const closeTray = () => (Popups ? Popups.close(tray) : Promise.resolve(tray.close && tray.close()));
    if (Popups) Popups.wire(tray);
    else {
      tray.addEventListener('click', e => { if (e.target.closest('[data-popup-close]') || e.target === tray) tray.close(); });
    }
    tray.addEventListener('close', () => { slots.forEach(s => { s.classList.remove('is-active'); s.setAttribute('aria-expanded', 'false'); }); });
    addEventListener('resize', placeTray);

    const choose = val => {
      if (!current) return;
      const b = current, key = b.dataset.slot, idx = slots.indexOf(b);
      const before = wasDone;
      values[key] = val; exKeys.delete(key); save();
      render();
      closeTray().then(() => {
        stamp(b);
        const n = filledCount(), left = total - n + exKeys.size;
        if (wasDone && !before) say(`All ${total} blanks are yours. Your brief is ready to copy or send.`, `Your brief: ${compose()}`);
        else if (wasDone) say(`Blank ${idx + 1} changed: ${val}. Your brief is still ready to copy or send.`);
        else if (exKeys.size) say(`Blank ${idx + 1}: ${val}. ${left} to make yours.`);
        else say(`Blank ${idx + 1} filled: ${val}. ${left} to go.`);
      });
    };
    optsEl.addEventListener('click', e => { const o = e.target.closest('.wb-tray-opt'); if (o) choose(o.textContent); });
    optsEl.addEventListener('keydown', e => {
      const opts = $$('.wb-tray-opt', optsEl), i = opts.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % opts.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + opts.length) % opts.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = opts.length - 1;
      if (j >= 0) { e.preventDefault(); opts[j].focus(); }
    });
    ownForm.addEventListener('submit', e => {
      e.preventDefault();
      const v = ownInput.value.replace(/\s+/g, ' ').trim();
      if (v.length < 2) {
        ownErr.hidden = false; ownErr.id = 'wb-own-err';
        ownInput.setAttribute('aria-invalid', 'true'); ownInput.setAttribute('aria-describedby', 'wb-own-err');
        ownInput.focus();
        return;
      }
      choose(v);
    });

    slots.forEach(b => b.addEventListener('click', () => openTray(b)));
    nextBtn.addEventListener('click', () => openTray(slots.find(s => !values[s.dataset.slot]) || slots.find(s => exKeys.has(s.dataset.slot)) || slots[0]));
    // the example only fills the blanks you left empty, and the same button takes it back out (your answers stay)
    exampleBtn.addEventListener('click', () => {
      if (exKeys.size) {
        const gone = slots.filter(s => exKeys.has(s.dataset.slot));
        const undo = () => {
          exKeys.forEach(k => delete values[k]); exKeys.clear(); save();
          gone.forEach(s => s.classList.remove('is-peel'));
          render();
          const n = filledCount();
          say(n ? `Example removed. Your ${n} answer${n > 1 ? 's' : ''} stayed.` : `Example removed. ${total} blanks to fill.`);
        };
        if (still()) { undo(); return; }
        gone.forEach((s, i) => setTimeout(() => s.classList.add('is-peel'), i * 45));
        setTimeout(undo, 420 + gone.length * 45);
        return;
      }
      const empty = slots.filter(s => !values[s.dataset.slot]);
      if (!empty.length) return;
      empty.forEach(s => { values[s.dataset.slot] = EXAMPLE[s.dataset.slot]; exKeys.add(s.dataset.slot); });
      save(); render();
      if (!still()) empty.forEach((b, i) => setTimeout(() => stamp(b), i * 70));
      const own = total - empty.length;
      say(own ? `Example answers fill your ${empty.length} empty blanks; your ${own} stayed. Tap a dashed one to make it yours.`
        : 'Filled with the example for a fictional bike repair shop. Tap each dashed blank to make it yours.', `The brief now reads: ${compose()}`);
    });
    resetBtn.addEventListener('click', () => {
      const filled = slots.filter(s => values[s.dataset.slot]);
      const clear = () => {
        values = {}; exKeys.clear(); save();
        slots.forEach(s => s.classList.remove('is-peel'));
        render();
        say(`Cleared. ${total} blanks to fill.`);
        slots[0].focus({ preventScroll: true });
      };
      if (still() || !filled.length) { clear(); return; }
      filled.forEach((s, i) => setTimeout(() => s.classList.add('is-peel'), i * 45));
      setTimeout(clear, 420 + filled.length * 45);
    });
    copyBtn.addEventListener('click', () => {
      copyText(compose()).then(() => {
        copyLabel.textContent = 'Copied';
        say('Copied. Paste it into an email, a document or the project form.');
        setTimeout(() => { copyLabel.textContent = 'Copy the brief'; }, 2200);
      }, () => say('Copying is blocked in this browser. Select the paragraph above and copy it by hand.'));
    });
    sendLink.addEventListener('click', () => {
      store.set('zs-brief-prefill', JSON.stringify({ source: 'brief-guide', message: `Here's my website brief:\n\n${compose()}\n\n`, at: Date.now() }));
    });

    render({ quiet: true });
    requestAnimationFrame(() => fb.classList.remove('is-instant'));
  }

  /* ------------------------------------------------------------ 2. the nine sections: folders that stack up
     CSS makes each folder sticky a little lower than the last (every index tab stays in view). Here: a folder taller
     than the room under the nav sticks by its bottom edge instead (so it is always read in full before the next one
     covers it), and --wb-p tells each folder how far the next one has slid over it (it sinks back and dims). */
  const fold = $('[data-wb-fold]');
  if (fold && 'IntersectionObserver' in window) {
    const panels = $$('.wb-panel', fold);
    const bodies = panels.map(p => $('.wb-panel-body', p));
    let on = false, inView = false, raf = 0, lastP = [], lastCut = [];
    const layout = () => {
      if (!on) return;
      panels.forEach(p => p.style.removeProperty('--wb-top'));
      const room = innerHeight - 12;
      panels.forEach(p => {
        const top = parseFloat(getComputedStyle(p).top) || 0, h = p.offsetHeight;
        if (top + h > room) p.style.setProperty('--wb-top', Math.round(room - h) + 'px');
      });
      update();
    };
    const update = () => {
      raf = 0;
      if (!on) return;
      const rs = panels.map(p => p.getBoundingClientRect()), gap = parseFloat(getComputedStyle(fold).rowGap) || 0;
      panels.forEach((p, i) => {
        let v = 0;
        if (i < panels.length - 1) {
          const natural = p.offsetHeight + gap;
          const d = rs[i + 1].top - rs[i].top;
          v = Math.max(0, Math.min(1, (natural - d) / Math.max(1, natural - 9)));
        }
        if (Math.abs(v - (lastP[i] || 0)) > 0.004 || (v === 0 && lastP[i])) { p.style.setProperty('--wb-p', v.toFixed(3)); lastP[i] = v; }
        // visible height of this folder's body before the next folder's edge (none while the next one is far away)
        let cut = -1;
        if (i < panels.length - 1 && bodies[i]) {
          const d = rs[i + 1].top - rs[i].top;
          if (d < p.offsetHeight + gap) cut = Math.max(0, Math.round(d - bodies[i].offsetTop));
        }
        if (cut !== (lastCut[i] ?? -1)) {
          if (cut < 0) bodies[i] && bodies[i].style.removeProperty('--wb-cut'); else bodies[i].style.setProperty('--wb-cut', cut + 'px');
          lastCut[i] = cut;
        }
      });
    };
    const queue = () => { if (on && inView && !raf) raf = requestAnimationFrame(update); };
    const arm = () => {
      on = !still();
      fold.classList.toggle('is-stack', on);
      if (!on) { panels.forEach(p => { p.style.removeProperty('--wb-top'); p.style.removeProperty('--wb-p'); }); bodies.forEach(b => b && b.style.removeProperty('--wb-cut')); lastP = []; lastCut = []; return; }
      layout();
    };
    new IntersectionObserver(es => { inView = es[0].isIntersecting; queue(); }, { rootMargin: '100px 0px' }).observe(fold);
    addEventListener('scroll', queue, { passive: true });
    let rt = 0;
    const relayout = () => { clearTimeout(rt); rt = setTimeout(layout, 120); };
    addEventListener('resize', relayout);
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(fold);
    addEventListener('zs:motion', arm);
    arm();
  }

  /* ------------------------------------------------------------ 3. mistakes: editor's suggestions you accept */
  const edits = $('[data-wb-edits]');
  if (edits) {
    const items = $$('.wb-edit', edits), total = items.length;
    const head = document.createElement('div'); head.className = 'wb-edits-head';
    const count = document.createElement('p'); count.className = 'wb-edits-count'; count.setAttribute('aria-live', 'polite');
    const bar = document.createElement('span'); bar.className = 'wb-edits-bar'; bar.setAttribute('aria-hidden', 'true'); bar.append(document.createElement('i'));
    head.append(count, bar); edits.before(head);
    const tally = (quiet) => {
      const n = items.filter(it => it.classList.contains('is-accepted')).length;
      bar.style.setProperty('--wb-done', (n / total).toFixed(3));
      const msg = n === total ? `All ${total} fixed. That's a brief a designer can quote from.` : `${n} of ${total} suggested edits accepted`;
      if (quiet) count.textContent = msg; else { count.textContent = ''; requestAnimationFrame(() => { count.textContent = msg; }); }
    };
    const ICON = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".35"/><path d="M5.2 9.4l2.6 2.5 5-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    items.forEach(it => {
      const h = $('h3', it), title = h.textContent.trim();
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wb-edit-ok'; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = ICON; const l = document.createElement('span'); l.textContent = 'Accept'; b.append(l);
      const label = () => b.setAttribute('aria-label', it.classList.contains('is-accepted') ? `Accepted: the rewrite for "${title}". Press to undo` : `Accept the rewrite for "${title}"`);
      label();
      h.after(b);
      b.addEventListener('click', () => {
        const yes = !it.classList.contains('is-accepted');
        it.classList.toggle('is-accepted', yes);
        b.setAttribute('aria-pressed', String(yes)); l.textContent = yes ? 'Accepted' : 'Accept'; label();
        it.classList.remove('is-settle');
        if (yes && !still()) { void it.offsetWidth; it.classList.add('is-settle'); setTimeout(() => it.classList.remove('is-settle'), 700); }
        tally();
      });
    });
    edits.classList.add('is-armed');
    tally(true);
  }

  /* ------------------------------------------------------------ 4. the template */
  const tpl = $('[data-wb-tpl]');
  if (tpl) {
    const pre = $('[data-wb-tpl-text]', tpl), sheet = $('.wb-tpl-sheet', tpl), more = $('[data-wb-tpl-more]', tpl);
    const status = $('[data-wb-tpl-status]', tpl), copyB = $('[data-wb-tpl-copy]', tpl), copyL = $('.wb-tpl-btn-l', tpl), dl = $('[data-wb-tpl-dl]', tpl);
    const text = () => pre.textContent.replace(/\s+$/, '') + '\n';
    tpl.classList.add('is-clamped'); more.hidden = false;
    more.addEventListener('click', () => {
      const h0 = sheet.offsetHeight;
      tpl.classList.remove('is-clamped');
      more.setAttribute('aria-expanded', 'true'); more.hidden = true;
      if (!still() && sheet.animate) sheet.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: sheet.scrollHeight + 'px', overflow: 'hidden' }], { duration: 700, easing: 'cubic-bezier(.2, .9, .1, 1)' });
      pre.focus({ preventScroll: true });
    });
    const tell = msg => { status.textContent = ''; requestAnimationFrame(() => { status.textContent = msg; }); };
    copyB.addEventListener('click', () => {
      copyText(text()).then(() => {
        tpl.classList.remove('is-copied'); void tpl.offsetWidth; tpl.classList.add('is-copied');
        setTimeout(() => tpl.classList.remove('is-copied'), 1300);
        copyL.textContent = 'Copied ✓';
        setTimeout(() => { copyL.textContent = 'Copy template'; }, 2200);
        tell('Template copied. Paste it into an email or a document and fill it in.');
      }, () => tell('Copying is blocked in this browser. Open the whole template and select it by hand.'));
    });
    dl.addEventListener('click', () => {
      try {
        const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = 'website-brief-template.txt'; a.hidden = true;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        tell('Downloading website-brief-template.txt.');
      } catch (e) { tell('Downloading is blocked in this browser. Use Copy template instead.'); }
    });
  }

  /* ------------------------------------------------------------ 4b. example brief: rows rise in, the READY stamp lands
     (the four 'why' cards near the top use the same lander: they drop onto the page and their keycaps press in) */
  const landers = $$('[data-wb-ex], [data-wb-mag], [data-wb-why]');
  if (landers.length) {
    $$('[data-wb-ex] .wb-ex-list > div').forEach((row, k) => row.style.setProperty('--k', k));
    if ('IntersectionObserver' in window) {
      const lio = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in'); lio.unobserve(e.target);
      }), { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      landers.forEach(el => lio.observe(el));
    } else landers.forEach(el => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------ 4c. wide screens: the draft in the right gutter
     Ten lines ink in as the blanks fill (pale for "Show an example" answers), READY when all ten are yours. It is a
     link to the builder, and steps aside while the builder itself is on screen. */
  const side = $('[data-wb-side]');
  const fbEl = $('[data-wb-fb]'), slotHost = fbEl && $('[data-wb-text]', fbEl);
  if (side && fbEl && slotHost) {
    const lines = $('[data-wb-side-lines]', side), nOut = $('[data-wb-side-n]', side), goOut = $('[data-wb-side-go]', side), arrow = $('.wb-side-go b', side);
    const W = [92, 74, 86, 64, 90, 70, 82, 60, 88, 68];
    const slots = () => $$('.wb-fb-slot', slotHost);
    slots().forEach((x, k) => { const i = document.createElement('i'); i.style.setProperty('--w', (W[k % W.length]) + '%'); lines.append(i); });
    let last = [];
    const sync = () => {
      const st = slots().map(x => x.classList.contains('is-example') ? 'ex' : x.classList.contains('is-filled') ? 'on' : '');
      const bars = $$('i', lines);
      st.forEach((v, k) => {
        const b = bars[k]; if (!b) return;
        b.classList.toggle('is-on', v === 'on'); b.classList.toggle('is-ex', v === 'ex');
        if (v && v !== last[k] && !still()) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
      });
      last = st;
      const mine = st.filter(v => v === 'on').length, done = fbEl.classList.contains('is-done');
      nOut.textContent = `${mine} of ${st.length} in your words`;
      goOut.textContent = done ? 'Copy or send it' : mine ? 'Keep filling' : 'Fill the blanks';
      side.classList.toggle('is-done', done);
    };
    new MutationObserver(sync).observe(fbEl, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    const place = () => { arrow.textContent = fbEl.getBoundingClientRect().top > innerHeight * .5 ? '↓' : '↑'; };
    addEventListener('scroll', place, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => side.classList.toggle('is-away', e.isIntersecting), { rootMargin: '-15% 0px -15% 0px' }).observe(fbEl);
    side.hidden = false;
    sync(); place();
  }

  /* ------------------------------------------------------------ 5. hero: a laminated clipboard you can tilt
     Mouse: the board leans toward the pointer. Touch: drag sideways across it (vertical drags still scroll). Scroll:
     the board tips back as it travels up the screen and the sheen slides across the sheet. One damped spring, only
     while the board is on screen; transforms only. */
  const board = $('[data-wb-board]');
  if (board) {
    let rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0, sx = 0, ox = 0, raf = 0, lastT = 0, inView = true, drag = null;
    const K = 170, D = 17;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const scrollTarget = () => {
      const r = board.getBoundingClientRect(), vh = innerHeight;
      const s = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1); // +1 below the fold, -1 leaving the top
      sx = s;
    };
    const apply = () => {
      board.style.setProperty('--wb-rx', rx.toFixed(2) + 'deg');
      board.style.setProperty('--wb-ry', ry.toFixed(2) + 'deg');
      board.style.setProperty('--wb-sx', (-120 + (1 - sx) * 170 + ox * 40).toFixed(1) + '%');
    };
    const step = now => {
      const dt = lastT ? Math.min(0.034, (now - lastT) / 1000) : 0.016; lastT = now;
      const gx = tx + sx * 5; // the scroll tip adds to the pointer tilt
      vx += (K * (gx - rx) - D * vx) * dt; rx += vx * dt;
      vy += (K * (ty - ry) - D * vy) * dt; ry += vy * dt;
      apply();
      if (Math.abs(gx - rx) < 0.02 && Math.abs(ty - ry) < 0.02 && Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) { rx = gx; ry = ty; apply(); raf = 0; lastT = 0; board.classList.remove('is-live'); return; }
      raf = requestAnimationFrame(step);
    };
    const go = () => { if (still() || !inView) return; board.classList.add('is-live'); if (!raf) raf = requestAnimationFrame(step); };
    const reset = () => { cancelAnimationFrame(raf); raf = 0; lastT = 0; rx = ry = vx = vy = tx = ty = ox = 0; sx = 0; board.classList.remove('is-live', 'is-grab'); ['--wb-rx', '--wb-ry', '--wb-sx'].forEach(p => board.style.removeProperty(p)); };
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) { scrollTarget(); go(); } }).observe(board);
    addEventListener('scroll', () => { if (!inView || still()) return; scrollTarget(); go(); }, { passive: true });
    board.addEventListener('pointermove', e => {
      if (still()) return;
      const r = board.getBoundingClientRect();
      if (e.pointerType === 'mouse') {
        const nx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), ny = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
        ty = nx * 7; tx = -ny * 6; ox = nx; go();
      } else if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.x;
        ty = clamp(dx / 9, -12, 12); ox = clamp(dx / 160, -1, 1); go();
      }
    });
    board.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { tx = ty = ox = 0; go(); } });
    board.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !still()) { drag = { id: e.pointerId, x: e.clientX }; board.classList.add('is-grab'); } });
    const release = e => { if (drag && e.pointerId === drag.id) { drag = null; board.classList.remove('is-grab'); tx = 0; ty = 0; ox = 0; vy += 30; go(); } };
    board.addEventListener('pointerup', release);
    board.addEventListener('pointercancel', release);
    addEventListener('zs:motion', () => { if (still()) reset(); else { scrollTarget(); go(); } });
    if (!still()) { scrollTarget(); apply(); }
  }
})();
