/* Zstore AI: accessibility settings, applied before first paint (render-blocking, keep it tiny).
   Loaded in <head> right after the stylesheets, WITHOUT defer/async:
     <script src="/assets/js/a11y-boot.js"></script>
   Reads the visitor's saved panel choices (localStorage 'zstore-com-a11y', written by /assets/js/a11y.js) and sets
   the matching html classes, so a dark, high-contrast or bigger-text page never flashes in its default look.
   Motion is NOT stored here: it is the site's one Motion state ('zs-motion', boot.js / home inline boot). */
(function () {
  var r = document.documentElement, s = null;
  try { s = JSON.parse(localStorage.getItem('zstore-com-a11y') || 'null'); } catch (e) { s = null; }
  if (!s || typeof s !== 'object') return;
  var c = [], k;
  var flags = ['lh', 'sp', 'font', 'links', 'heads', 'cursor', 'guide', 'mask', 'focus', 'noimg', 'noauto'];
  for (k = 0; k < flags.length; k++) if (s[flags[k]] === true) c.push('a11y-' + flags[k]);
  if (s.theme === 'dark' || s.theme === 'contrast') c.push('a11y-' + s.theme);
  if (s.filter === 'gray' || s.filter === 'lowsat') c.push('a11y-' + s.filter);
  // bigger text: a11y.js sizes the text right after parsing; until then the page stays hidden for these visitors
  // only (a11y.css reveals it on its own after 1.2s, so a failed script can never leave it blank)
  if (s.text === 1 || s.text === 2 || s.text === 3) c.push('a11y-t' + s.text, 'a11y-tpending');
  if (!c.length) return;
  r.className += (r.className ? ' ' : '') + c.join(' ');
  if (s.theme === 'dark') {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#121216');
  }
})();
