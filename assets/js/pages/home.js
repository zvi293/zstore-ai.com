/* Zstore AI — home page touchpoints (prefix .hm- / data-hm-*). Loaded after app.js; touches only its own DOM.
   1. Study dialog "Read the full study": follows the study on show (app.js fills the dialog), and closes the
      popup through the shared Popups stack before it navigates, so BACK from the study page lands here shut.
   2. Process track link: its four beads and "Step 0X / 04" label mirror the selected process tab.
   3. Arrival moments: the work prints fan out and the guide bookmarks drop in once they scroll into view.
      Anything already on screen, Motion off and no-JS all show the final state. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionOff = () => root.classList.contains('motion-off');
  const plainClick = e => !(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

  /* ------------------------------------------------------------ 1. study dialog → full study page */
  const study = $('#study'), link = $('[data-hm-study-link]'), title = study && $('[data-study-title]', study);
  if (study && link && title) {
    const SLUGS = { 'Atelier Studio': 'atelier-studio', 'Lume': 'lume', 'Meridian': 'meridian' };
    const sync = () => { const slug = SLUGS[title.textContent.trim()]; link.href = slug ? `/work/${slug}/` : '/work/'; };
    new MutationObserver(sync).observe(title, { childList: true, characterData: true, subtree: true });
    sync();
    link.addEventListener('click', e => {
      const P = window.ZS && window.ZS.Popups;
      if (!plainClick(e) || !P || !P.isOpen(study)) return;
      e.preventDefault();
      const href = link.href;
      P.close(study, true).then(() => location.assign(href));
    });
  }

  /* ------------------------------------------------------------ 2. process track mirrors the tabs */
  const track = $('[data-hm-track]'), tabs = $$('[data-step]');
  if (track && tabs.length) {
    const beads = $$('.hm-beads i', track), label = $('[data-hm-track-k]', track);
    const pad = n => String(n).padStart(2, '0');
    const paint = () => {
      const i = Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));
      beads.forEach((b, n) => { b.classList.toggle('on', n <= i); b.classList.toggle('now', n === i); });
      if (label) label.textContent = `Step ${pad(i + 1)} / ${pad(tabs.length)}`;
    };
    const mo = new MutationObserver(paint);
    tabs.forEach(t => mo.observe(t, { attributes: true, attributeFilter: ['aria-selected'] }));
    paint();
  }

  /* ------------------------------------------------------------ 3. arrival moments */
  const arrivals = $$('[data-hm-fan], [data-hm-guides]');
  if (arrivals.length && 'IntersectionObserver' in window) {
    const vh = innerHeight;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.remove('hm-wait'); en.target.classList.add('hm-in'); io.unobserve(en.target);
    }), { rootMargin: '100000px 0px -12% 0px' }); // a huge top margin: anything already scrolled past counts as arrived
    arrivals.forEach(el => {
      const r = el.getBoundingClientRect();
      if (motionOff() || (r.top < vh && r.bottom > 0)) { el.classList.add('hm-in'); return; }
      el.classList.add('hm-wait'); io.observe(el);
    });
    // Motion switched off mid-page: settle everything at once
    addEventListener('zs:motion', () => { if (motionOff()) arrivals.forEach(el => { el.classList.remove('hm-wait'); el.classList.add('hm-in'); io.unobserve(el); }); });
  }
})();
