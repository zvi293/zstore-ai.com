// Signature component: Overlap Clock — pick your city (or drag a time) and two ceramic clocks plus a 24-hour band show the hours we share with Tel Aviv.
/* Contact page (/contact/) behaviour. The brief form itself is run by app.js (same endpoint, honeypot, timing,
   rate limit, no-cors POST and localhost preview guard as the home form); this file only adds page touches:
   1. Overlap Clock (live time-zone overlap, DST-correct via Intl)   2. Copy-email keycap
   3. Prefill the message from sessionStorage 'zs-brief'               4. "Sent" postmark on zs:celebrate
   5. WhatsApp bead steps aside while the form is on screen            6. Postcard stamp + postmark on scroll-in
   Motion off / reduced motion: hands and bands jump to their final positions (CSS drops the transitions). */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOff = () => root.classList.contains('motion-off');

  /* ------------------------------------------------------------ 1. Overlap Clock */
  const oc = $('[data-ct-oc]');
  const live = oc && $('[data-ct-live]', oc);
  if (live && window.Intl && Intl.DateTimeFormat && Intl.DateTimeFormat.prototype.formatToParts) {
    const TLV = 'Asia/Jerusalem';
    const DAY = 1440, START = 9 * 60, END = 18 * 60;               // a standard 9 AM to 6 PM business day
    const mod = (n, m) => ((n % m) + m) % m;
    const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const fmts = {};
    const partsOf = (tz, d) => {
      const f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }));
      const p = {}; f.formatToParts(d).forEach(x => { p[x.type] = x.value; }); return p;
    };
    // minutes this zone is ahead of UTC right now (handles daylight saving on both sides)
    const offsetOf = (tz, d) => {
      if (tz === null) return -d.getTimezoneOffset();
      const p = partsOf(tz, d);
      const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
      return Math.round((asUTC - Math.floor(d.getTime() / 60000) * 60000) / 60000);
    };
    const weekdayOf = (tz, d) => tz === null ? WD[d.getDay()] : partsOf(tz, d).weekday;
    const clock = m => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
    const hoursText = mins => { const h = Math.round(mins / 30) / 2; return h <= 1 ? 'about an hour' : `about ${h} hours`; };

    // the visitor's own zone ("My time zone")
    let localTz = null;
    try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; if (localTz) partsOf(localTz, new Date()); } catch (e) { localTz = null; }
    const isTlv = tz => tz === TLV || tz === 'Asia/Tel_Aviv';
    // the weekend: Friday and Saturday in Tel Aviv, Saturday and Sunday everywhere else on the picker
    const offDay = (i, tz) => isTlv(tz) ? (i === 5 || i === 6) : (i === 6 || i === 0);
    const localName = localTz ? (isTlv(localTz) ? 'Tel Aviv' : localTz.split('/').pop().replace(/_/g, ' ')) : '';
    const mine = $('[data-mine]', live);
    if (mine && localName) mine.textContent = localName;

    const radios = $$('input[name="ct-city"]', live);
    const range = $('[data-range]', live), nowBtn = $('[data-now]', live), say = $('[data-say]', live), sayLive = $('[data-say-live]', live);
    const el = k => $(k, live);
    const hands = { you: { mins: null, h: 0, m: 0 }, tlv: { mins: null, h: 0, m: 0 } };
    const state = { tz: localTz, name: localName || 'your time zone', scrub: null };

    // hands keep a running angle, so they always turn the short way round and can spin with overshoot
    const setHands = (key, mins) => {
      const st = hands[key];
      if (st.mins === null) { st.h = (mins % 720) * 0.5; st.m = (mins % 60) * 6; }
      else {
        const d = mod(mins - st.mins + 720, DAY) - 720;            // shortest way, within ±12 h
        const md = Math.abs(d) > 120 ? Math.sign(d) * (120 + (Math.abs(d) % 60)) : d; // at most two lively turns
        st.h += d * 0.5; st.m += md * 6;
      }
      st.mins = mins;
      el(`[data-hand-h="${key}"]`).style.setProperty('--a', st.h.toFixed(2) + 'deg');
      el(`[data-hand-m="${key}"]`).style.setProperty('--a', st.m.toFixed(2) + 'deg');
    };
    const place = (node, s, w) => { node.style.setProperty('--s', (s / DAY).toFixed(4)); node.style.setProperty('--w', (w / DAY).toFixed(4)); };

    // The visible sentence updates silently (the clock ticks every 15 s); screen readers hear it only after the
    // visitor does something (a city, a dragged time, Back to now), through a separate polite live region.
    let sayTimer = 0, clearTimer = 0;
    const announce = text => {
      clearTimeout(clearTimer);
      sayLive.textContent = text;
      clearTimer = setTimeout(() => { sayLive.textContent = ''; }, 7000);   // so browse mode doesn't read it twice
    };
    const render = (mode = 'quiet') => {
      const now = new Date();
      const offC = offsetOf(state.tz, now), offT = offsetOf(TLV, now), diff = offT - offC;
      const utcMin = mod(Math.floor(now.getTime() / 60000), DAY);
      const cityNow = mod(utcMin + offC, DAY);
      const m = state.scrub === null ? cityNow : state.scrub;
      const raw = m + diff, shift = Math.floor(raw / DAY), t = mod(raw, DAY);
      const cityWd = weekdayOf(state.tz, now);
      const ci = Math.max(0, WD.indexOf(cityWd));
      const ti = mod(ci + shift, 7);                                // Tel Aviv's weekday at the needle
      const tzKey = state.tz === null ? '' : state.tz;

      setHands('you', m); setHands('tlv', t);
      el('[data-city="you"]').textContent = state.name.charAt(0).toUpperCase() + state.name.slice(1);
      el('[data-time="you"]').textContent = clock(m);
      el('[data-time="tlv"]').textContent = clock(t);
      el('[data-day="you"]').textContent = state.scrub === null ? `${WD[ci]} · now` : WD[ci];
      el('[data-day="tlv"]').textContent = state.scrub === null ? `${WD[ti]} · now` : WD[ti];

      // bands in the city's own time: its 9-to-6, and Tel Aviv's 9-to-6 shifted by the difference (may wrap midnight).
      // A band whose day is a weekend there is drawn as "off", and the shared window only counts working days.
      const cityOff = offDay(ci, tzKey);
      const bandYou = el('[data-band="you"]');
      place(bandYou, START, END - START);
      bandYou.classList.toggle('is-off', cityOff);
      const ts = mod(START - diff, DAY), te = ts + (END - START);
      const segs = te <= DAY ? [[ts, te]] : [[ts, DAY], [0, te - DAY]];
      const tlvDayOf = a => mod(ci + Math.floor((a + diff) / DAY), 7);  // Tel Aviv's weekday at city minute a
      ['tlv1', 'tlv2'].forEach((k, i) => {
        const node = el(`[data-band="${k}"]`), sg = segs[i];
        place(node, sg ? sg[0] : 0, sg ? sg[1] - sg[0] : 0);
        node.classList.toggle('is-off', !!sg && offDay(tlvDayOf(sg[0]), TLV));
      });
      let ov = [0, 0], ovOff = false;
      segs.forEach(([a, b]) => { const s = Math.max(a, START), e = Math.min(b, END); if (e > s) { ov = [s, e]; ovOff = cityOff || offDay(tlvDayOf(s), TLV); } });
      const span = ov[1] - ov[0];                                   // hours the two business days overlap on paper
      const shared = ovOff ? 0 : span;                              // ...and on a working day for both
      place(el('[data-overlap]'), ov[0], shared);
      el('[data-overlap]').hidden = shared <= 0;
      el('[data-needle]').style.setProperty('--p', (m / DAY).toFixed(4));
      el('[data-lane-you]').textContent = state.name === 'your time zone' ? 'You' : state.name.replace(/^./, c => c.toUpperCase());
      const chip = el('[data-shared]');
      const sh = Math.round(shared / 30) / 2;
      const needleOffC = cityOff, needleOffT = offDay(ti, TLV);
      const wkWho = needleOffC && needleOffT ? 'both' : needleOffT ? 'tlv' : needleOffC ? 'city' : (ovOff ? 'day' : '');
      chip.textContent = wkWho === 'both' ? 'Weekend for both'
        : wkWho === 'tlv' ? 'Weekend in Tel Aviv'
        : wkWho === 'city' ? `Weekend in ${state.name === 'your time zone' ? 'your city' : state.name}`
        : wkWho === 'day' ? 'Weekend that day'
        : diff === 0 ? 'Same time zone' : shared > 0 ? `${sh} ${sh === 1 ? 'hour' : 'hours'} shared` : 'No shared hours';
      chip.classList.toggle('is-none', (shared <= 0 && diff !== 0) || !!wkWho);
      el('[data-scrub-city]').textContent = `in ${state.name}`;

      if (state.scrub === null) range.value = String(Math.round(m / 15) * 15 % DAY);
      range.setAttribute('aria-valuetext', `${clock(m)} ${WDL[ci]} in ${state.name}, ${clock(t)} ${WDL[ti]} in Tel Aviv`);
      nowBtn.hidden = state.scrub === null;

      // the sentence: plain facts about the two clocks and standard business days, no promises about anyone's hours
      const when = state.scrub === null ? 'now' : 'then';
      const name = state.name;
      let parts;
      if (diff === 0) {
        parts = ["You're on Tel Aviv time too, so it's ", [`${clock(m)} on ${WDL[ci]}`], ' for both of us. '];
        parts.push(needleOffT || needleOffC ? `That's the weekend here, so a message sent ${when} gets a reply within one business day.` : 'Our business days line up completely.');
      } else {
        parts = ["When it's ", [`${clock(m)} on ${WDL[ci]}`], ` in ${name}, it's `, [`${clock(t)} on ${WDL[ti]}`], ' in Tel Aviv. '];
        if (wkWho === 'both') parts.push(`That's the weekend in both cities, so a message sent ${when} gets a reply within one business day.`);
        else if (wkWho === 'tlv') parts.push(`That's the weekend in Tel Aviv, so a message sent ${when} gets a reply within one business day.`);
        else if (wkWho === 'city') parts.push(`That's the weekend in ${name}, so a message sent ${when} gets a reply within one business day.`);
        else if (wkWho === 'day') parts.push(`The hours these two business days share fall on a weekend that day, so the work moves async, with replies within one business day.`);
        else if (shared >= 240) parts.push(`Standard business days in the two cities share ${hoursText(shared)}, so calls land in the hours we share. Everything else moves async.`);
        else if (shared > 0) parts.push(diff > 0
          ? `Mornings in ${name} line up with afternoons in Tel Aviv: ${hoursText(shared)} of business day in common, which is where calls land. Everything else moves async.`
          : `Afternoons in ${name} line up with mornings in Tel Aviv: ${hoursText(shared)} of business day in common, which is where calls land. Everything else moves async.`);
        else parts.push("Standard business days in the two cities don't overlap, so the work moves async, with replies within one business day. For a call, we pick a time that suits us both.");
      }
      say.replaceChildren(...parts.map(p => { if (typeof p === 'string') return p; const b = document.createElement('b'); b.textContent = p[0]; return b; }));
      const text = parts.map(p => typeof p === 'string' ? p : p[0]).join('').trim();
      clearTimeout(sayTimer);
      if (mode === 'later') sayTimer = setTimeout(() => announce(text), 450);   // dragging: only the settled time
      else if (mode === 'now') announce(text);
    };

    const pick = value => {
      if (value === 'local') { state.tz = localTz; state.name = localName || 'your time zone'; }
      else { state.tz = value; state.name = $(`input[value="${value}"] + span`, live).textContent.trim(); }
      state.scrub = null;
      render('now');
    };
    radios.forEach(r => r.addEventListener('change', () => { if (r.checked) pick(r.value); }));
    range.addEventListener('input', () => { state.scrub = +range.value; live.classList.add('is-dragging'); render('later'); });
    const endDrag = () => live.classList.remove('is-dragging');
    // touch: a quick tap on the bar jumps the needle there (mouse clicks already do this natively)
    let tapStart = null;
    range.addEventListener('pointerdown', e => { tapStart = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
    range.addEventListener('pointerup', e => {
      if (!tapStart || Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8 || e.timeStamp - tapStart.t > 600) { tapStart = null; return; }
      tapStart = null;
      const r = range.getBoundingClientRect(), tw = 28;
      const v = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left - tw / 2) / (r.width - tw))) * (DAY - 15) / 15) * 15;
      if (String(v) !== range.value) { range.value = String(v); range.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    range.addEventListener('change', endDrag); range.addEventListener('pointerup', endDrag); range.addEventListener('blur', endDrag);
    nowBtn.addEventListener('click', () => { state.scrub = null; render('now'); range.focus(); });

    // default city: the visitor's own zone ("My time zone"); if the zone can't be read, New York
    if (!localTz) { state.tz = 'America/New_York'; state.name = 'New York'; }
    const def = radios.find(r => r.value === (localTz ? 'local' : 'America/New_York'));
    if (def) def.checked = true;
    render('quiet');
    live.hidden = false;
    const fallback = $('[data-ct-static]', oc); if (fallback) fallback.hidden = true;
    requestAnimationFrame(() => requestAnimationFrame(() => live.classList.add('is-live'))); // transitions only after the first paint

    // tick while visible; never while the visitor is exploring a time
    setInterval(() => { if (!document.hidden && state.scrub === null) render('quiet'); }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.scrub === null) render('quiet'); });
  }

  /* ------------------------------------------------------------ 2. Copy-email keycap */
  const copyStatus = $('[data-ct-copy-status]');
  $$('[data-ct-copy]').forEach(btn => {
    btn.hidden = false;
    const label = $('[data-ct-copy-label]', btn);
    let t = 0;
    btn.addEventListener('click', async () => {
      const value = btn.dataset.ctCopy;
      let ok = false;
      try { await navigator.clipboard.writeText(value); ok = true; } catch (e) {
        try {
          const ta = document.createElement('textarea'); ta.value = value; ta.setAttribute('readonly', ''); ta.className = 'sr';
          document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
        } catch (e2) { ok = false; }
      }
      clearTimeout(t);
      btn.classList.remove('is-copied'); void btn.offsetWidth;
      if (ok) { btn.classList.add('is-copied'); label.textContent = 'Copied'; }
      if (copyStatus) copyStatus.textContent = ok ? `Email address copied: ${value}` : `Copy didn't work here. The address is ${value}`;
      t = setTimeout(() => { btn.classList.remove('is-copied'); label.textContent = 'Copy'; if (copyStatus) copyStatus.textContent = ''; }, 2200);
    });
  });

  /* ------------------------------------------------------------ 3. Prefill from another page (sessionStorage, never the URL)
     Writers store JSON { message, interest?, source? } (or a plain string) under sessionStorage 'zs-brief-prefill'
     (the pricing Scope Scale already does; 'zs-brief' is read too). The visitor can edit or clear the text; the key
     is removed once used, so a later visit starts clean. */
  const form = $('#contact-form');
  const msg = $('#message');
  const note = $('[data-ct-prefill]');
  const SOURCES = { 'pricing-scope-scale': "What you put together on the pricing page's Scope Scale is in the message below.", 'brief-guide': 'The brief you drafted in my website brief guide is in the message below.' };
  if (form && msg && note) {
    let raw = null, key = '';
    try { ['zs-brief-prefill', 'zs-brief'].some(k => { raw = sessionStorage.getItem(k); key = k; return raw; }); } catch (e) {}
    if (raw && !msg.value.trim()) {
      let text = raw, interest = '', source = '';
      try { const o = JSON.parse(raw); if (o && typeof o === 'object') { text = String(o.message || ''); interest = String(o.interest || ''); source = String(o.source || ''); } } catch (e) {}
      text = text.trimStart().slice(0, 3000);   // keep a trailing space: "Here's a bit more about it: " invites typing on
      if (text.trim()) {
        msg.value = text;
        msg.dispatchEvent(new Event('input', { bubbles: true }));   // app.js updates the counter and progress
        if (SOURCES[source]) $('[data-ct-prefill-line]', note).textContent = SOURCES[source];
        note.hidden = false;
        form.addEventListener('reset', () => { note.hidden = true; });   // after a real send app.js clears the form
        $('[data-ct-prefill-clear]', note).addEventListener('click', () => {
          msg.value = ''; msg.dispatchEvent(new Event('input', { bubbles: true }));
          note.hidden = true; msg.focus();
        });
      }
      if (interest) { const chip = $$('[data-select-interest]', form).find(c => c.dataset.selectInterest === interest); if (chip && chip.getAttribute('aria-pressed') !== 'true') chip.click(); }
      try { sessionStorage.removeItem(key); } catch (e) {}
    }
  }

  /* ------------------------------------------------------------ 4. "Sent" postmark */
  if (form) {
    const word = $('[data-ct-sent-word]', form), time = $('[data-ct-sent-time]', form);
    const preview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
    let tlvFmt = null;
    try { tlvFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', minute: '2-digit' }); } catch (e) {}
    addEventListener('zs:celebrate', () => {
      if (word) word.textContent = preview ? 'Valid' : 'Sent';
      if (time && tlvFmt) time.textContent = tlvFmt.format(new Date());
      form.classList.remove('is-sent'); void form.offsetWidth; form.classList.add('is-sent');
    });
    form.addEventListener('input', () => form.classList.remove('is-sent'));
  }

  /* ------------------------------------------------------------ 5. WhatsApp bead steps aside over the form and the clock
     (on phones its corner would sit on the submit button, the time sentence and Back to now) */
  const quietOver = [form, $('#hours') || oc].filter(Boolean);
  if (quietOver.length && 'IntersectionObserver' in window) {
    const inView = new Set();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target); });
      document.body.classList.toggle('ct-quiet', inView.size > 0);
    }, { rootMargin: '0px 0px -10% 0px' });
    quietOver.forEach(t => io.observe(t));
  }

  /* ------------------------------------------------------------ 6. The postcard gets its stamp and postmark when it
     scrolls into view (it lives below the fold now); CSS shows the final state without JS or with motion off */
  const post = $('.ct-post');
  if (post) {
    if ('IntersectionObserver' in window) {
      const pio = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { post.classList.add('is-in'); pio.disconnect(); }
      }, { threshold: 0.35 });
      pio.observe(post);
    } else post.classList.add('is-in');
  }
})();
