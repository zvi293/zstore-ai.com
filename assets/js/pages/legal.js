/* Legal pages (privacy-policy.html, terms.html): cards slide in as slabs, each section's number key lights up
   once you've read past its heading, and a "short version" keycap flashes the card it jumps to.
   Content is never hidden before this runs; Motion off / reduced motion shows everything as-is. */
(function () {
  'use strict';
  const root = document.documentElement;
  const page = document.querySelector('.lg-page');
  if (!page) return;
  const secs = [...page.querySelectorAll('.legal-sec')];
  const quiet = () => root.classList.contains('motion-off');

  /* slide-in: cards already on screen stay put, the rest rise in when they enter */
  let io = null;
  const arm = () => {
    if (quiet() || !('IntersectionObserver' in window)) { root.classList.remove('lg-on'); secs.forEach(s => s.classList.add('is-in')); return; }
    const vh = innerHeight;
    secs.forEach(s => { const r = s.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) s.classList.add('is-in'); });
    root.classList.add('lg-on');
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    secs.forEach(s => { if (!s.classList.contains('is-in')) io.observe(s); });
  };
  arm();
  addEventListener('zs:motion', () => { if (quiet()) { if (io) io.disconnect(); root.classList.remove('lg-on'); secs.forEach(s => s.classList.add('is-in')); } });

  /* any jump inside the page (short-version keys, the contents rail or pill): settle every card first, so the
     target's position is final before app.js measures it and its heading never lands under the nav */
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !root.classList.contains('lg-on')) return;
    if (io) io.disconnect();
    root.classList.add('lg-instant');
    secs.forEach(s => s.classList.add('is-in'));
    void page.offsetHeight;
    requestAnimationFrame(() => root.classList.remove('lg-instant'));
  }, true);

  /* read state: a section's number key turns orange once its heading passes the upper third */
  let tick = false;
  const read = () => {
    tick = false;
    const line = innerHeight * 0.42;
    secs.forEach(s => { const h = s.querySelector('h2'); if (h) s.classList.toggle('is-read', h.getBoundingClientRect().top < line); });
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(read); } }, { passive: true });
  addEventListener('resize', read);
  read();

  /* short-version keys: app.js scrolls + focuses; we flash the card when it lands */
  page.querySelectorAll('.lg-keys a[href^="#"]').forEach(a => a.addEventListener('click', () => {
    const t = document.getElementById(a.hash.slice(1));
    const card = t && t.closest('.legal-sec');
    if (!card) return;
    card.classList.add('is-in');
    card.classList.remove('is-hit');
    setTimeout(() => { if (!quiet()) { void card.offsetWidth; card.classList.add('is-hit'); setTimeout(() => card.classList.remove('is-hit'), 1000); } }, quiet() ? 0 : 520);
  }));
})();
