/* Zstore AI: render-blocking boot for every page except home (home inlines the same logic, hashed in the CSP).
   Load it in <head>, before the stylesheets finish, WITHOUT defer/async:
     <script src="/assets/js/boot.js"></script>
   It sets two classes on <html> before first paint, so nothing flashes:
     .js          script runs (no-JS fallbacks in tactile.css/site.css key off its absence)
     .motion-off  the visitor turned Motion off (saved in localStorage 'zs-motion'),
                  or has no saved choice and prefers reduced motion */
(function () {
  var r = document.documentElement, off = false, mq = false;
  try { mq = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { var s = localStorage.getItem('zs-motion'); off = s ? s === 'off' : mq; } catch (e) { off = mq; }
  if (off) r.classList.add('motion-off');
  r.classList.add('js');
})();
