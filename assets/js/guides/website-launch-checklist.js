// Signature component: Launch Console — lift a guarded cover, flip the switch; nine pre-launch checks lift the glass off a LAUNCH key that unlocks launch day, then the first 30 days.
/* /guides/website-launch-checklist/ (prefix .lc-). Also: the test-card TV knobs turn with the scroll, a split-flap
   "where" column flips in row by row on the launch-day board, a tear-off 30-day desk calendar (button or swipe),
   "print only the checklist", and the WhatsApp bead steps off the console. Everything here enhances content that
   is already readable without JS; Motion off / reduced motion = final states, no movement. Touches only .lc- DOM. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOff = () => root.classList.contains('motion-off');
  const hasIO = 'IntersectionObserver' in window;
  const later = (fn, ms) => (motionOff() ? fn() : setTimeout(fn, ms));

  /* ============================================================ Launch Console */
  const con = $('[data-lc-console]');
  if (con) {
    const KEY = 'zs-launch-console-v1';
    const rows = { before: $('[data-lc-row="before"]', con), day: $('[data-lc-row="day"]', con), after: $('[data-lc-row="after"]', con) };
    const NAMES = { before: 'Before launch', day: 'Launch day', after: 'First 30 days' };
    const bay = $('[data-lc-bay]', con), key = $('[data-lc-key]', con), keyHint = $('[data-lc-key-hint]', con);
    const ship = $('.lc-ship', con), status = $('[data-lc-status]', con), resetBtn = $('[data-lc-reset]', con);
    const inputs = $$('.lc-in', con);
    const rowOf = el => el.closest('[data-lc-row]').dataset.lcRow;
    const nameOf = input => $('.lc-name', input.closest('.lc-sw')).textContent.trim();
    const noteOf = input => $('.lc-note', input.closest('.lc-sw')).textContent.trim();
    const ins = r => $$('.lc-in', rows[r]);
    const onCount = r => ins(r).filter(i => i.checked).length;
    const full = r => onCount(r) === ins(r).length;
    let launched = false, afterOpen = false;

    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify({ on: inputs.filter(i => i.checked).map(i => i.id), launched, afterOpen })); } catch (e) { /* private mode: progress just isn't kept */ }
    };
    const load = () => {
      try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.on)) return s; } catch (e) { /* ignore */ }
      return null;
    };

    // readout line under each row: what the last switch means (visual twin of the aria-describedby note)
    const readOut = (r, text) => {
      const line = $('[data-lc-read]', rows[r]); if (!line) return;
      $('.lc-read-t', line).textContent = text;
      line.classList.remove('is-new'); void line.offsetWidth; line.classList.add('is-new');
    };

    // the switch in hand: on phones its note slides out right under it (CSS), and stays in view
    const phone = matchMedia('(max-width: 599px)');
    const setCur = li => {
      $$('.lc-sw.is-cur', con).forEach(o => { if (o !== li) o.classList.remove('is-cur'); });
      if (li.classList.contains('is-cur')) return;
      li.classList.add('is-cur');
      if (!phone.matches) return;
      const t = $('.lc-note-t', li), lab = $('.lc-lab', li);
      const over = lab.getBoundingClientRect().bottom + t.offsetHeight + 16 - innerHeight;
      if (over > 0) scrollBy({ top: over, behavior: motionOff() ? 'auto' : 'smooth' });
    };

    // covers: open on keyboard focus or on a first tap/click; a second tap flips the switch
    const sw = input => input.closest('.lc-sw');
    const openCover = li => {
      $$('.lc-sw.is-open', con).forEach(o => { if (o !== li && !$('.lc-in', o).checked && !o.contains(document.activeElement)) o.classList.remove('is-open'); });
      li.classList.add('is-open');
      setCur(li);
    };
    const closeCover = li => { if (!$('.lc-in', li).checked) li.classList.remove('is-open'); };

    let fromMini = false;
    inputs.forEach(input => {
      const li = sw(input), lab = $('.lc-lab', li);
      let pointerGate = false, touch = null, handled = 0;
      const liftCover = () => { openCover(li); readOut(rowOf(input), `Cover up: ${nameOf(input)}. Tap again to flip it.`); };
      lab.addEventListener('pointerdown', e => {
        pointerGate = !li.classList.contains('is-open');
        touch = e.pointerType === 'mouse' ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
      });
      lab.addEventListener('pointercancel', () => { touch = null; });
      lab.addEventListener('pointerup', e => {
        const t = touch; touch = null;
        if (!t || e.pointerId !== t.id || input.disabled) return;
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12 || e.timeStamp - t.t > 700) return;
        handled = e.timeStamp;
        if (!li.classList.contains('is-open')) { liftCover(); return; }
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      lab.addEventListener('click', e => {
        if (handled && e.timeStamp - handled < 900) { handled = 0; e.preventDefault(); return; }   // already done on pointerup
        if (input.disabled) return;
        if (pointerGate) {               // first click lifts the cover; the switch stays as it was
          pointerGate = false; e.preventDefault(); liftCover();
        }
      });
      // keyboard: the cover lifts and the readout already says what the check means, before you decide to flip it
      input.addEventListener('focus', () => {
        if (!input.matches(':focus-visible')) return;
        openCover(li);
        readOut(rowOf(input), `${nameOf(input)}: ${noteOf(input)}`);
      });
      input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) closeCover(li); }, 900));
      input.addEventListener('change', () => {
        const r = rowOf(input);
        if (!fromMini) setCur(li);
        if (input.checked) openCover(li); else later(() => { if (document.activeElement !== input) closeCover(li); }, 700);
        readOut(r, `${nameOf(input)}: ${noteOf(input)}`);
        update(true);
        status.textContent = `${nameOf(input)} ${input.checked ? 'on' : 'off'}. ${progressLine()}`;
        save();
      });
    });

    const progressLine = () => {
      if (!launched) return `Before launch: ${onCount('before')} of ${ins('before').length} checks on.${full('before') ? ' LAUNCH is armed.' : ''}`;
      if (!afterOpen) return `Launch day: ${onCount('day')} of ${ins('day').length} steps on.`;
      const all = inputs.every(i => i.checked);
      return all ? 'All 23 checks on. Launched and settled.' : `First 30 days: ${onCount('after')} of ${ins('after').length} on.`;
    };

    const setRow = (r, open) => {
      rows[r].disabled = !open;
      rows[r].classList.toggle('is-unlocked', open);
    };
    const unlockFx = r => {
      if (motionOff()) return;
      rows[r].classList.remove('is-unlocking'); void rows[r].offsetWidth; rows[r].classList.add('is-unlocking');
      setTimeout(() => rows[r].classList.remove('is-unlocking'), 950);
    };

    const areas = $$('[data-lc-for]').map(area => {
      const input = document.getElementById(area.dataset.lcFor);
      if (!input) return null;
      const name = nameOf(input), h = $('h3', area);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lc-mini'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', 'false');
      b.setAttribute('aria-label', `${name} check done`);
      b.innerHTML = '<span class="lc-mini-tr" aria-hidden="true"></span><span class="lc-mini-l" aria-hidden="true"></span>';
      (h || area.firstElementChild).after(b);
      area.classList.add('has-mini');
      b.addEventListener('click', () => {
        if (input.disabled) return;
        fromMini = true;
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        fromMini = false;
        if (input.checked) openCover(sw(input));
        if (!motionOff()) { area.classList.remove('is-flip'); void area.offsetWidth; area.classList.add('is-flip'); }
      });
      return { area, input, b };
    }).filter(Boolean);
    const side = $('[data-lc-side]');
    const sideList = side && $('[data-lc-side-list]', side), sideN = side && $('[data-lc-side-n]', side), sideKey = side && $('[data-lc-side-key]', side);
    const sideLinks = [];
    if (side && sideList) {
      areas.forEach(({ area, input }, k) => {
        if (!area.id) area.id = 'check-' + input.id.replace(/^lc-b-/, '');
        const li = document.createElement('li'), a = document.createElement('a');
        a.href = '#' + area.id;
        a.innerHTML = '<span class="lc-side-lamp" aria-hidden="true"></span><span></span>';
        a.lastChild.textContent = nameOf(input);
        a.addEventListener('click', () => { if (motionOff()) return; area.classList.remove('is-ping'); void area.offsetWidth; area.classList.add('is-ping'); setTimeout(() => area.classList.remove('is-ping'), 1500); });
        li.append(a); sideList.append(li); sideLinks.push(a);
      });
      side.hidden = false;
      if (hasIO) {
        const here = new Set();
        const sio = new IntersectionObserver(es => {
          es.forEach(en => { if (en.isIntersecting) here.add(en.target); else here.delete(en.target); });
          areas.forEach(({ area }, k) => sideLinks[k].classList.toggle('is-here', here.has(area)));
        }, { rootMargin: '-35% 0px -55% 0px' });
        areas.forEach(({ area }) => sio.observe(area));
      }
    }
    const mirror = () => {
      areas.forEach(({ area, input, b }, k) => {
        const on = input.checked;
        b.setAttribute('aria-checked', String(on));
        area.classList.toggle('is-on', on);
        if (sideLinks[k]) { sideLinks[k].classList.toggle('is-on', on); sideLinks[k].setAttribute('aria-label', `${nameOf(input)}: ${on ? 'on' : 'off'}`); }
      });
      if (side) {
        const armed = !launched && full('before');
        sideN.textContent = `${onCount('before')}/${ins('before').length}`;
        sideKey.textContent = launched ? 'Launched' : armed ? 'LAUNCH armed' : 'LAUNCH locked';
        side.classList.toggle('is-armed', armed);
        side.classList.toggle('is-launched', launched);
      }
    };

    function update(fromUser) {
      Object.keys(rows).forEach(r => {
        const n = onCount(r), t = ins(r).length, c = $('[data-lc-count]', rows[r]);
        c.textContent = `${n}/${t}`; c.style.setProperty('--p', (n / t).toFixed(3));
      });
      const armed = !launched && full('before');
      bay.classList.toggle('is-armed', armed);
      bay.classList.toggle('is-launched', launched);
      con.classList.toggle('is-armed', armed);
      con.classList.toggle('is-launched', launched);
      key.disabled = !armed;
      $('.lc-key-t', key).textContent = launched ? 'Launched' : 'Launch';
      keyHint.textContent = launched ? 'Launched. Work through launch day, in order.'
        : armed ? 'Glass up. Press LAUNCH when you are ready.'
        : `The glass lifts when all nine pre-launch checks are on (${onCount('before')} of 9 so far).`;
      setRow('before', true);
      setRow('day', launched);
      if (launched && full('day') && !afterOpen) { afterOpen = true; if (fromUser) { unlockFx('after'); readOut('after', 'Open now. Six habits for the first month.'); } }
      setRow('after', afterOpen);
      con.classList.toggle('is-done', inputs.every(i => i.checked));
      ship.classList.toggle('zkit-loose', !launched);
      mirror();
    }

    key.addEventListener('click', () => {
      if (launched || !full('before')) return;
      const viaKeyboard = key.matches(':focus-visible');
      launched = true; save();
      if (!motionOff()) {
        ship.classList.add('zkit-loose');
        bay.classList.remove('is-lifting'); void bay.offsetWidth; bay.classList.add('is-lifting');
        setTimeout(() => ship.classList.remove('zkit-loose'), 1300);
        setTimeout(() => bay.classList.remove('is-lifting'), 1950);
        con.classList.remove('is-boom'); void con.offsetWidth; con.classList.add('is-boom');
        setTimeout(() => con.classList.remove('is-boom'), 2000);
        if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) { try { navigator.vibrate([10, 40, 18]); } catch (e) { /* not supported */ } }
      }
      update(true);
      if (!motionOff()) ship.classList.add('zkit-loose');   // keep loose until the ship re-docks
      unlockFx('day');
      readOut('day', 'Open now. Eight steps, in this order.');
      status.textContent = 'Launched. Launch day is open: eight steps, in order.';
      // the key is now disabled, so move focus to the first launch-day switch instead of losing it
      const first = ins('day')[0];
      first.focus({ preventScroll: true });
      if (viaKeyboard) openCover(sw(first));
      later(() => {
        const r = rows.day.getBoundingClientRect();
        if (r.top > innerHeight * .62) scrollBy({ top: r.top - innerHeight * .3, behavior: motionOff() ? 'auto' : 'smooth' });
      }, 1500);
    });

    // reset: two taps (the first asks), so a stray tap never wipes a real launch's progress
    let resetTimer = 0;
    resetBtn.addEventListener('click', () => {
      const label = $('span', resetBtn);
      if (!resetBtn.classList.contains('is-confirm')) {
        resetBtn.classList.add('is-confirm'); label.textContent = 'Tap again to clear every switch';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { resetBtn.classList.remove('is-confirm'); label.textContent = 'Reset console'; }, 3500);
        return;
      }
      clearTimeout(resetTimer); resetBtn.classList.remove('is-confirm'); label.textContent = 'Reset console';
      inputs.forEach(i => { i.checked = false; sw(i).classList.remove('is-open', 'is-cur'); });
      launched = false; afterOpen = false;
      update(false); save();
      readOut('before', 'Lift a cover to start.'); readOut('day', 'Waiting for LAUNCH.'); readOut('after', 'Waiting for launch day.');
      status.textContent = 'Console reset. ' + progressLine();
    });

    // restore a saved launch (or a back-navigation form restore), then paint without announcing
    const saved = load();
    if (saved) {
      inputs.forEach(i => { i.checked = saved.on.includes(i.id); });
      launched = !!saved.launched && full('before');
      afterOpen = !!saved.afterOpen && launched;
    } else inputs.forEach(i => { i.checked = false; });
    inputs.forEach(i => { if (i.checked) sw(i).classList.add('is-open'); });
    update(false);
    status.textContent = progressLine();
    const lastOn = r => ins(r).filter(i => i.checked).pop();
    Object.keys(rows).forEach(r => { const i = lastOn(r); if (i) $('.lc-read-t', rows[r]).textContent = `${nameOf(i)}: ${noteOf(i)}`; });
    if (launched) $('.lc-read-t', rows.before).textContent = 'All nine on. Launched.';
  }

  /* ============================================================ keep the WhatsApp bead off the console + CTA pair */
  const mainEl = $('#main');
  const holdEls = [$('[data-lc-console]'), $('.lc-crew .btn-row')].filter(Boolean);
  if (mainEl && holdEls.length && hasIO) {
    const holding = new Set();
    const hio = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) holding.add(en.target); else holding.delete(en.target); });
      mainEl.classList.toggle('lc-hold-wa', holding.size > 0);
    }, { rootMargin: '-80% 0px 0px 0px' });
    holdEls.forEach(el => hio.observe(el));
  }

  /* ============================================================ TV knobs turn with the scroll (only while the hero shows) */
  const tv = $('[data-lc-tv]'), hero = $('[data-lc-hero]');
  if (tv && hero && hasIO) {
    let inView = true, raf = 0;
    const turn = () => { raf = 0; if (!motionOff()) tv.style.setProperty('--lc-k', (scrollY * .32).toFixed(1) + 'deg'); };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(hero);
    addEventListener('scroll', () => { if (inView && !raf) raf = requestAnimationFrame(turn); }, { passive: true });
  }

  /* ============================================================ split-flap "where" column on the launch-day board */
  const board = $('[data-lc-board]');
  if (board) {
    const GLYPHS = 'ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789';
    const rowsB = $$('.lc-board-list > li', board);
    const flaps = rowsB.map(li => {
      const el = $('[data-flap]', li), text = el.textContent.trim();
      el.textContent = '';
      const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text;
      const cells = document.createElement('span'); cells.setAttribute('aria-hidden', 'true'); cells.className = 'lc-fl-row';
      const list = [...text.toUpperCase()].map(ch => {
        const c = document.createElement('span'); c.className = ch === ' ' ? 'lc-fl is-sp' : 'lc-fl'; c.textContent = motionOff() ? ch : ' '; cells.append(c); return { c, ch };
      });
      el.classList.add('is-flap'); el.append(sr, cells);
      return { li, list, done: false };
    });
    const flip = f => {
      if (f.done) return; f.done = true; f.li.classList.add('is-go');
      if (motionOff()) { f.list.forEach(({ c, ch }) => { c.textContent = ch; }); return; }
      f.list.forEach(({ c, ch }, i) => {
        let n = 3 + i + Math.floor(Math.random() * 3), alt = false;
        const tick = () => {
          alt = !alt; c.classList.remove('is-a', 'is-b'); void c.offsetWidth; c.classList.add(alt ? 'is-a' : 'is-b');
          if (--n <= 0 || ch === ' ') { c.textContent = ch === ' ' ? ' ' : ch; return; }
          c.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          setTimeout(tick, 58);
        };
        setTimeout(tick, i * 26);
      });
    };
    if (hasIO && !motionOff()) {
      const bio = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        const f = flaps.find(x => x.li === en.target); if (f) flip(f); bio.unobserve(en.target);
      }), { rootMargin: '0px 0px -18% 0px' });
      flaps.forEach(f => bio.observe(f.li));
    } else flaps.forEach(flip);
    // Motion switched off midway: settle every row
    new MutationObserver(() => { if (motionOff()) flaps.forEach(f => { f.done = false; f.li.classList.add('is-go'); f.list.forEach(({ c, ch }) => { c.textContent = ch === ' ' ? ' ' : ch; }); f.done = true; }); })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  /* ============================================================ the 30-day desk calendar: tear off (button or swipe) */
  const cal = $('[data-lc-cal]');
  if (cal) {
    const pad = $('[data-lc-cal-pad]', cal), pages = $$('.lc-page', pad);
    const btn = $('[data-lc-cal-next]', cal), btnT = $('span', btn), count = $('[data-lc-cal-n]', cal);
    let cur = 0;
    const label = p => `${$('.lc-page-k', p).textContent} ${$('.lc-page-n', p).textContent}`;
    const paint = announce => {
      pages.forEach((p, i) => {
        const d = i - cur;
        p.classList.toggle('is-top', d === 0);
        p.classList.toggle('is-torn', d < 0);
        p.style.setProperty('--d', Math.max(0, Math.min(d, 3)));
        p.style.setProperty('--i', i);
      });
      const last = cur === pages.length - 1;
      btnT.textContent = last ? 'Start the month again' : 'Tear off this page';
      count.textContent = `Page ${cur + 1} of ${pages.length} · ${label(pages[cur])}`;
      // screen readers hear the whole page that is now on top; the visible line stays short
      if (announce) { const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = `. ${$('.lc-page-t', pages[cur]).textContent.trim()}`; count.append(sr); }
    };
    const tear = (dir = -1) => {
      if (cur >= pages.length - 1) {          // back to day 1: the pad restacks
        cur = 0; pages.forEach(p => p.classList.remove('is-tearing'));
        if (!motionOff()) { pad.classList.remove('is-restack'); void pad.offsetWidth; pad.classList.add('is-restack'); setTimeout(() => pad.classList.remove('is-restack'), 900); }
        paint(true); return;
      }
      const p = pages[cur];
      p.style.setProperty('--tx', dir < 0 ? '-30%' : '30%');
      p.style.setProperty('--tr', dir < 0 ? '-22deg' : '22deg');
      cur += 1;
      if (!motionOff()) {
        p.classList.add('is-tearing'); setTimeout(() => p.classList.remove('is-tearing'), 800);
        const next = pages[cur]; next.classList.add('is-fresh'); setTimeout(() => next.classList.remove('is-fresh'), 380);
      }
      paint(true);
    };
    btn.addEventListener('click', () => tear(-1));

    // swipe the top page sideways to tear it (vertical scrolling stays native: touch-action: pan-y)
    let drag = null;
    pad.addEventListener('pointerdown', e => {
      const p = pages[cur]; if (!p.contains(e.target) || e.button > 0) return;
      drag = { p, x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId };
    });
    pad.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      if (Math.abs(drag.dx) < 6 || Math.abs(e.clientY - drag.y) > Math.abs(drag.dx) * 1.2) return;
      if (!drag.p.classList.contains('is-drag')) { drag.p.classList.add('is-drag'); try { pad.setPointerCapture(drag.id); } catch (err) { /* ignore */ } }
      if (!motionOff()) drag.p.style.transform = `translateX(${drag.dx * .6}px) rotate(${drag.dx * .04}deg)`;
    });
    const endDrag = () => {
      if (!drag) return;
      const { p, dx } = drag; drag = null;
      p.classList.remove('is-drag'); p.style.transform = '';
      if (Math.abs(dx) > 70) tear(dx < 0 ? -1 : 1);
    };
    pad.addEventListener('pointerup', endDrag);
    pad.addEventListener('pointercancel', () => { if (drag) { drag.p.classList.remove('is-drag'); drag.p.style.transform = ''; drag = null; } });
    paint(false);
  }

  /* ============================================================ landers: the launch-day ticket stubs deal in, the "30" flaps flip */
  const landers = $$('[data-lc-memos], [data-lc-land]');
  if (landers.length) {
    if (hasIO) {
      const lio = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in'); lio.unobserve(e.target);
      }), { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
      landers.forEach(el => lio.observe(el));
    } else landers.forEach(el => el.classList.add('is-in'));
  }

  /* ============================================================ relaunch steps: the ring hops to the step you are reading
     (the last key above 60% of the screen); keys it has reached light up and the rail fills behind it */
  const hop = $('[data-lc-hop]');
  if (hop) {
    const items = $$('.lc-hop-list > li', hop);
    let cs = [], act = -2, raf = 0, near = false;
    const keyMid = li => li.offsetTop + (parseFloat(getComputedStyle(li, '::before').height) || 38) / 2;
    const measure = () => {
      cs = items.map(keyMid);
      if (!cs.length) return;
      hop.style.setProperty('--y0', cs[0] + 'px');
      hop.style.setProperty('--h', (cs[cs.length - 1] - cs[0]) + 'px');
    };
    const update = () => {
      raf = 0;
      const line = innerHeight * 0.6, top = hop.getBoundingClientRect().top;
      let a = -1;
      cs.forEach((c, i) => { if (top + c < line) a = i; });
      if (a === act) return;
      act = a;
      items.forEach((li, i) => li.classList.toggle('is-on', i <= a));
      if (a < 0) { hop.style.setProperty('--ro', '0'); hop.style.setProperty('--f', '0'); return; }
      const span = cs[cs.length - 1] - cs[0];
      hop.style.setProperty('--ya', cs[a] + 'px');
      hop.style.setProperty('--ro', '1');
      hop.style.setProperty('--f', span > 0 ? ((cs[a] - cs[0]) / span).toFixed(3) : '1');
    };
    const queue = () => { if (near && !raf) raf = requestAnimationFrame(update); };
    measure();
    if (hasIO) new IntersectionObserver(([e]) => { near = e.isIntersecting; queue(); }, { rootMargin: '30% 0px 30% 0px' }).observe(hop);
    else { near = true; }
    addEventListener('scroll', queue, { passive: true });
    let rt = 0;
    const relayout = () => { clearTimeout(rt); rt = setTimeout(() => { measure(); act = -2; queue(); }, 120); };
    addEventListener('resize', relayout);
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(hop);
    queue();
  }

  /* ============================================================ print only the checklist */
  const printBtn = $('[data-lc-print]');
  if (printBtn && typeof window.print === 'function') {
    const done = () => root.classList.remove('lc-print-only');
    addEventListener('afterprint', done);
    printBtn.addEventListener('click', () => { root.classList.add('lc-print-only'); window.print(); setTimeout(done, 400); });
  }
})();
