/* /accessibility/ — the live switchboard, the measured contrast meter, self-drawing ticks and copy-email.
   The switches don't keep state of their own: they call window.ZSA11y (the site-wide panel in /assets/js/a11y.js)
   and redraw from its 'zs:a11y' events, so the board, the panel and the Motion toggles always agree. */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const motionOff = () => root.classList.contains('motion-off');

  /* ------------------------------------------------------------ switchboard */
  const board = $('[data-ac-board]');
  const api = window.ZSA11y;
  const SIZES = ['100%', '125%', '150%', '200%'];
  const range = $('[data-ac-size]');
  const sizeOut = $('[data-ac-size-v]');
  const isOn = (s, k) => (k === 'dark' || k === 'contrast' ? s.theme === k : !!s[k]);

  // contrast of the specimen text against what is really behind it (alpha-composited up the tree)
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
  const backdrop = el => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const meter = () => {
    const sample = $('[data-ac-sample]'); if (!sample) return;
    const fg = parse(getComputedStyle(sample).color); if (!fg) return;
    const bg = backdrop(sample);
    const L1 = lum(fg[3] < 1 ? over(fg, bg) : fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const shown = (Math.floor(ratio * 10) / 10).toFixed(1);
    $('[data-ac-ratio]').textContent = shown + ' : 1';
    $('[data-ac-verdict]').textContent = ratio >= 7 ? 'passes AA (4.5 : 1) and AAA (7 : 1)' : ratio >= 4.5 ? 'passes AA (4.5 : 1)' : 'below AA for body text';
    const bead = $('[data-ac-bead]');
    if (bead) bead.style.setProperty('--pos', Math.min(1, Math.max(0, Math.log(ratio) / Math.log(21))).toFixed(3));
  };

  const draw = s => {
    $$('[data-ac]', board).forEach(b => b.setAttribute('aria-checked', String(isOn(s, b.dataset.ac))));
    if (range) {
      range.value = String(s.text);
      range.setAttribute('aria-valuetext', SIZES[s.text]);
      range.style.setProperty('--p', (s.text / 3).toFixed(3));
      if (sizeOut) sizeOut.textContent = SIZES[s.text];
    }
    const out = k => $(`[data-ac-out="${k}"]`);
    if (out('text')) out('text').textContent = SIZES[s.text] + (s.font ? ', system font' : '');
    if (out('theme')) out('theme').textContent = s.theme === 'dark' ? 'Dark' : s.theme === 'contrast' ? 'High contrast' : s.filter === 'gray' ? 'Grayscale' : s.filter === 'lowsat' ? 'Low saturation' : 'Default';
    if (out('motion')) out('motion').textContent = s.motion ? 'Paused' : 'On';
    // measure after the new classes and text sizes have been applied
    requestAnimationFrame(() => requestAnimationFrame(meter));
  };

  if (board) {
    if (!api) board.classList.add('is-off');
    else {
      board.addEventListener('click', e => {
        const b = e.target.closest('[data-ac]'); if (!b) return;
        const k = b.dataset.ac;
        api.set(k, b.getAttribute('aria-checked') !== 'true');
      });
      if (range) range.addEventListener('input', () => api.set('text', Number(range.value)));
      addEventListener('zs:a11y', e => draw(e.detail));
      draw(api.get());
      addEventListener('load', meter);
    }
  }

  /* ------------------------------------------------------------ ticks that draw themselves */
  /* each check ticks itself as its row reaches you; the limitation rows slide in as slabs; the assessment's
     check keys pop in turn. Things already on screen stay put; Motion off / no IO = everything shown and drawn. */
  const checks = $('[data-ac-checks]');
  const limits = $('[data-ac-limits]');
  const ran = $('[data-ac-ran]');
  const items = [...(checks ? checks.children : []), ...(limits ? limits.children : [])];
  const showAll = () => { if (checks) checks.classList.add('is-drawn'); items.forEach(li => li.classList.add('is-in')); if (ran) ran.classList.add('is-in'); root.classList.remove('ac-live'); };
  if (motionOff() || !('IntersectionObserver' in window)) showAll();
  else {
    const vh = innerHeight;
    const onScreen = el => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; };
    items.forEach(li => { if (onScreen(li)) li.classList.add('is-in'); });
    if (ran && onScreen(ran)) ran.classList.add('is-in');
    root.classList.add('ac-live');
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -12% 0px' });
    items.forEach(li => { if (!li.classList.contains('is-in')) io.observe(li); });
    if (ran && !ran.classList.contains('is-in')) io.observe(ran);
    addEventListener('zs:motion', () => { if (motionOff()) { io.disconnect(); showAll(); } });
  }

  /* ------------------------------------------------------------ copy the email address */
  const status = $('[data-ac-copy-status]');
  $$('[data-ac-copy]').forEach(btn => {
    let t = 0;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.acCopy;
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
      if (!ok) {
        // fallback: select the address so the visitor can copy it themselves
        const link = btn.parentElement.querySelector('.ac-line-v');
        if (link) { const r = document.createRange(); r.selectNodeContents(link); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      }
      if (status) { status.textContent = ''; setTimeout(() => { status.textContent = ok ? 'Email address copied.' : 'The email address is selected. Copy it with your keyboard or menu.'; }, 30); }
      if (ok) { btn.classList.add('is-copied'); clearTimeout(t); t = setTimeout(() => btn.classList.remove('is-copied'), 1600); }
    });
  });
})();
