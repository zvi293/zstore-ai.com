/* Status pages (404.html, thank-you.html): a Z you can play with.
   404: "Put the piece back" snaps the missing diagonal into its slot (and takes it out again).
   Thank you: the pieces fly in and build the Z once on arrival; "Build it again" replays it.
   The button is shown only when this runs; Motion off / reduced motion = instant final states. */
(function () {
  'use strict';
  const root = document.documentElement;
  const stage = document.querySelector('[data-st]');
  if (!stage) return;
  const btn = stage.querySelector('[data-st-btn]');
  const quiet = () => root.classList.contains('motion-off');
  if (btn) btn.hidden = false;

  // tapping anywhere on the tray works like the button (thumb-friendly); the button stays the real control
  stage.addEventListener('click', e => { if (btn && !e.target.closest('button, a')) btn.click(); });

  if (stage.dataset.st === 'oops') {
    const sticker = stage.querySelector('[data-st-sticker]');
    const label = stage.querySelector('[data-st-label]');
    const live = stage.querySelector('[data-st-live]');
    btn.addEventListener('click', () => {
      const fixed = !stage.classList.contains('is-fixed');
      stage.classList.toggle('is-fixed', fixed);
      stage.classList.toggle('is-dropped', !fixed);
      btn.setAttribute('aria-pressed', String(fixed));
      label.textContent = fixed ? 'Take it out again' : 'Put the piece back';
      if (sticker) sticker.textContent = fixed ? 'Found it.' : 'Piece missing';
      if (live) live.textContent = fixed ? 'The piece is back in the Z. This page is still missing, though: try one of the links below.' : 'The piece is out again.';
      if (fixed && navigator.vibrate && !quiet()) { try { navigator.vibrate(12); } catch (e) {} }
    });
    return;
  }

  if (stage.dataset.st === 'build') {
    let t = 0;
    const build = () => {
      clearTimeout(t);
      stage.classList.remove('st-build', 'is-built');
      if (quiet()) { stage.classList.add('st-build', 'is-built'); return; }
      void stage.offsetWidth; // restart the CSS animations
      stage.classList.add('st-build');
      t = setTimeout(() => stage.classList.add('is-built'), 1500);
    };
    // the first build runs on arrival (the markup starts with .st-build, so no-JS shows the finished Z)
    if (quiet()) stage.classList.add('is-built'); else t = setTimeout(() => stage.classList.add('is-built'), 1500);
    btn.addEventListener('click', build);
  }
})();
