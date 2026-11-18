/* Zstore AI — accessibility panel (one file for every page; markup contract: tools/a11y-snippet.html).
   Renders the settings panel into <dialog id="a11y-panel">, opened from .a11y-btn (nav capsule ≥1024px), .menu-a11y
   (mobile menu) and any other [data-a11y-open] button, or with Alt+Shift+A. The dialog goes through app.js's Popups
   stack (window.ZS.Popups): one history entry, the phone's BACK closes it, focus returns to the opener.
   Settings persist in localStorage 'zstore-com-a11y' and are applied before first paint by a11y-boot.js (classes on
   <html>, styled in /assets/css/a11y.css). "Pause animations" IS the site's Motion state (ZS.setMotion), not a copy.
   Public API for page scripts: window.ZSA11y.get() / .set(key, value) / .open(opener) / .reset(); every change
   dispatches 'zs:a11y' on window with the full state in event.detail. */
(() => {
  'use strict';
  const KEY = 'zstore-com-a11y';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const ZS = window.ZS || {};
  const Popups = ZS.Popups || null;
  const panel = document.getElementById('a11y-panel');
  const finePointer = matchMedia('(any-pointer: fine)').matches;
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const motionOff = () => root.classList.contains('motion-off');

  /* ------------------------------------------------------------ state */
  const DEF = { text: 0, lh: false, sp: false, font: false, theme: '', filter: '', links: false, heads: false, cursor: false, guide: false, mask: false, focus: false, noimg: false, noauto: false };
  const FLAGS = ['lh', 'sp', 'font', 'links', 'heads', 'cursor', 'guide', 'mask', 'focus', 'noimg', 'noauto'];
  const clean = raw => {
    const s = Object.assign({}, DEF);
    if (!raw || typeof raw !== 'object') return s;
    if ([0, 1, 2, 3].includes(raw.text)) s.text = raw.text;
    if (raw.theme === 'dark' || raw.theme === 'contrast') s.theme = raw.theme;
    if (raw.filter === 'gray' || raw.filter === 'lowsat') s.filter = raw.filter;
    FLAGS.forEach(f => { s[f] = raw[f] === true; });
    if (s.guide && s.mask) s.mask = false;
    return s;
  };
  let S = (() => { try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return clean(null); } })();
  const save = () => {
    const out = {}; let n = 0;
    Object.keys(DEF).forEach(k => { if (S[k] !== DEF[k]) { out[k] = S[k]; n++; } });
    try { if (n) localStorage.setItem(KEY, JSON.stringify(out)); else localStorage.removeItem(KEY); } catch (e) {}
  };
  const activeCount = () => Object.keys(DEF).reduce((n, k) => n + (S[k] !== DEF[k] ? 1 : 0), 0) + (motionOff() ? 1 : 0);
  const snapshot = () => Object.assign({}, S, { motion: motionOff() });

  /* ------------------------------------------------------------ html classes (mirrors a11y-boot.js) */
  const applyClasses = () => {
    const on = c => root.classList.add(c), off = c => root.classList.remove(c);
    FLAGS.forEach(f => (S[f] ? on : off)('a11y-' + f));
    ['dark', 'contrast'].forEach(t => (S.theme === t ? on : off)('a11y-' + t));
    ['gray', 'lowsat'].forEach(t => (S.filter === t ? on : off)('a11y-' + t));
    [1, 2, 3].forEach(t => (S.text === t ? on : off)('a11y-t' + t));
    (activeCount() ? on : off)('a11y-on');
    const meta = $('meta[name="theme-color"]');
    if (meta) {
      if (!meta.dataset.a11yBase) meta.dataset.a11yBase = meta.getAttribute('content') === '#121216' ? '#ECEDEF' : meta.getAttribute('content');
      meta.setAttribute('content', S.theme === 'dark' ? '#121216' : meta.dataset.a11yBase);
    }
  };

  /* ------------------------------------------------------------ text size
     The site sets most type in px and vw, so a root font-size change would do nothing. Instead every element's own
     computed size is read once (all reads before any write, so em-relative children stay in proportion) and grown:
     body text by the full step, display type progressively less (a 48px+ headline grows ~15% of the step), and never
     past ~14% of the viewport width, so headlines rewrap instead of overflowing on a 390px phone. Re-run on width
     changes and when new content is added. The nav capsule, the panel and fixed beads keep their size. */
  const STEP = [1, 1.25, 1.5, 2];
  const SKIP = '.nav, .a11y-panel, .a11y-reader, .wa-fab, .mail-fab, .toc-pill, .cursor, .zstore-badge, svg, script, style, noscript, template, canvas, video, iframe, .sprite';
  let sized = [];
  const grow = (px, F) => {
    if (F === 1 || px < 4) return px;
    const t = Math.min(1, Math.max(0, (px - 18) / 30));
    const g = px * (1 + (F - 1) * (1 - t * 0.85));
    return Math.max(px, Math.min(g, Math.max(px, innerWidth * 0.14)));
  };
  const walkSizable = cb => {
    if (!document.body) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => (n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    cb(document.body);
    for (let n = w.nextNode(); n; n = w.nextNode()) cb(n);
  };
  const sizeText = () => {
    for (const el of sized) el.style.removeProperty('font-size');
    sized = [];
    const F = STEP[S.text] || 1;
    if (F !== 1) {
      const list = [];
      walkSizable(el => { list.push(el); });
      const base = list.map(el => parseFloat(getComputedStyle(el).fontSize) || 0);
      list.forEach((el, i) => {
        const px = base[i]; if (!px) return;
        el.style.setProperty('font-size', grow(px, F).toFixed(2) + 'px');
        sized.push(el);
      });
    }
    root.classList.remove('a11y-tpending');
  };
  /* reflow guard: after the text grows (or spreads, or swaps typeface), any box still running past the screen edge is
     tagged .a11y-wrap so its lines may break inside long words; a few passes, since one fix can reveal the next.
     Boxes inside horizontal scrollers (carousels, tables) and fixed pieces are left alone. */
  const WRAP = 'a11y-wrap';
  let wrapped = [];
  const reflowGuard = () => {
    wrapped.forEach(el => el.classList.remove(WRAP)); wrapped = [];
    if (!(S.text || S.sp || S.font || S.lh) || !document.body) return;
    const W = document.documentElement.clientWidth;
    const okCache = new Map();
    const free = el => { // not inside a scroller, a fixed layer or an svg
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (okCache.has(n)) return okCache.get(n);
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || /(auto|scroll)/.test(cs.overflowX) || n.matches('svg, .a11y-panel, .a11y-reader, .nav')) { okCache.set(n, false); return false; }
      }
      return true;
    };
    for (let pass = 0; pass < 3; pass++) {
      const hits = $$('main *, footer *, .menu-sheet *').filter(el => {
        if (el.classList.contains(WRAP) || el.closest('svg')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > W + 1 && r.left < W && (el.textContent || '').trim() && free(el);
      });
      if (!hits.length) break;
      hits.forEach(el => { el.classList.add(WRAP); wrapped.push(el); });
    }
  };
  let lastW = innerWidth, resizeT = 0;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return; // phone URL bar showing/hiding changes only the height
    lastW = innerWidth; clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (S.text) { sizeText(); } reflowGuard(); if (S.theme) tagSurfaces(); }, 180);
  });

  /* ------------------------------------------------------------ surface tagging (dark + high contrast)
     a11y.css restyles every shared surface by class before first paint. Components a page invents for itself are
     caught here, by what they actually look like: in dark mode an "ink" surface (whose ink token has turned light) is
     re-darkened and an orange, pastel or white object keeps its light design as an island; in high contrast every
     dark surface forces white text and every light/orange object inside it forces ink text. */
  const INK_DARK = 'rgb(237, 237, 241)'; // the dark-mode --ink value (#EDEDF1): only a former ink surface has it as background
  const rgba = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const isOrange = c => c && c.a >= 0.5 && c.r >= 215 && c.g >= 40 && c.g <= 150 && c.b <= 110 && c.r - c.b > 140;
  const gradStops = (img, size) => {
    if (!img || img === 'none' || img.indexOf('gradient') < 0) return [];
    // a gradient drawn at zero size (a tape or fill that grows in when picked) paints nothing yet
    if (size && size.split(',').every(l => /(^|\s)0(px|%)?(\s|$)/.test(l.trim()))) return [];
    return (img.match(/rgba?\([^)]+\)/g) || []).map(rgba).filter(Boolean);
  };
  const TAGS = ['a11y-s-ink', 'a11y-s-isle', 'a11y-s-dark', 'a11y-s-glass'];
  const CONTROL = 'a, button, label, summary, input, select, textarea, li, span, p, [role="button"], [role="tab"], [role="radio"], [role="switch"]';
  let tagged = [];
  // scope: re-read only one section (after a click or a state change inside it); the whole page otherwise
  const tagSurfaces = scope => {
    const sc = scope && scope !== document.body && scope.isConnected && document.body.contains(scope) ? scope : null;
    const inScope = el => !sc || sc.contains(el);
    // transitions off while measuring: a tag that is removed and re-added must not be read mid-transition
    root.classList.add('a11y-notrans');
    tagged = tagged.filter(el => { if (!inScope(el)) return true; el.classList.remove(...TAGS); return false; });
    fgTagged = fgTagged.filter(el => { if (!inScope(el)) return true; el.classList.remove(...FG); return false; });
    if (!S.theme || !document.body) { root.classList.remove('a11y-notrans'); return; }
    const add = (el, c) => { el.classList.add(c); tagged.push(el); };
    const SKIPS = '.nav, .a11y-panel, .a11y-reader, .a11y-ruler, .a11y-shade, svg, script, style, img, picture, video, canvas, .sprite, .zstore-badge';
    const w = document.createTreeWalker(sc || document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => (n.matches(SKIPS) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    for (let el = sc && !sc.matches(SKIPS) ? sc : w.nextNode(); el; el = w.nextNode()) {
      const cs = getComputedStyle(el);
      // gradient-filled text (background-clip: text) paints letters, not a surface
      if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') continue;
      const bg = rgba(cs.backgroundColor); const stops = gradStops(cs.backgroundImage, cs.backgroundSize);
      const solid = bg && bg.a >= 0.5 ? bg : null;
      const orange = isOrange(solid) || stops.some(isOrange);
      const grad = stops.length ? stops.reduce((m, c) => m + lum(c), 0) / stops.length : null;
      const L = solid ? lum(solid) : grad;
      if (L === null && !orange) continue;
      if (S.theme === 'dark') {
        // a former ink surface: re-darken it only if it carries light text (an ink key with chalk text simply reads as
        // a porcelain key in dark mode and is left alone)
        const fg = rgba(cs.color), lightText = !!fg && lum(fg) > 0.4;
        if (cs.backgroundColor === INK_DARK) { if (lightText) add(el, 'a11y-s-ink'); }
        else if (orange) add(el, 'a11y-s-isle');
        // a light surface whose text follows the theme (now light) becomes dark glass; one with its own dark text
        // (a pastel tile, a mockup screen) stays a light island
        else if (L >= 0.42) add(el, lightText && el.matches(CONTROL) ? 'a11y-s-glass' : 'a11y-s-isle');
      } else {
        if (orange || L >= 0.42) add(el, 'a11y-s-isle');
        else if (L <= 0.06) add(el, 'a11y-s-dark');
      }
    }
    fixText(sc); fixText(sc); // twice: a forced colour is inherited, so a child can only be judged after its parent
    root.classList.remove('a11y-notrans');
  };

  /* text the surface pass can't reach (a colour a page hard-codes, text over a pseudo-element or a tinted card):
     every visible text block is measured against the colour actually behind it, and one that falls under WCAG AA
     (4.5:1, large type 3:1; 4.5:1 for all text in high contrast) is switched to ink or white, whichever reads better
     there. Text over a photo, canvas or video is left alone, since the colour behind it can't be known. */
  const FG = ['a11y-fg-d', 'a11y-fg-l'];
  let fgTagged = [];
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const INK_C = { r: 17, g: 17, b: 20, a: 1 }, WHITE_C = { r: 255, g: 255, b: 255, a: 1 }, CHALK_C = { r: 243, g: 243, b: 245, a: 1 };
  const clipsText = cs => cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text';
  function fixText(sc) {
    if (!S.theme || !document.body) return;
    const memo = new Map();
    const htmlBg = rgba(getComputedStyle(root).backgroundColor) || WHITE_C;
    const under = n => {
      if (!n || n === root) return htmlBg;
      if (memo.has(n)) return memo.get(n);
      const cs = getComputedStyle(n);
      const img = cs.backgroundImage || 'none';
      let res = null;
      if (clipsText(cs) || img.indexOf('url(') < 0) {
        let base = under(n.parentElement);
        if (base && !clipsText(cs)) {
          // a gradient may be a band, a pill or a dotted rule rather than a full fill: its solid stops are kept as
          // alternatives, and text that reads against any of them is left alone
          let alt = base.alt || [];
          const c = rgba(cs.backgroundColor); if (c && c.a > 0) { base = over(c, base); if (c.a >= 0.95) alt = []; }
          const stops = gradStops(img, cs.backgroundSize).filter(s => s.a >= 0.5);
          if (stops.length) {
            const solid = stops.map(s => over(s, base));
            base = solid.reduce((m, s) => ({ r: m.r + s.r / solid.length, g: m.g + s.g / solid.length, b: m.b + s.b / solid.length, a: 1 }), { r: 0, g: 0, b: 0, a: 1 });
            alt = alt.concat(solid);
          }
          base = Object.assign({}, base, { alt });
          // a surface drawn by ::before (tape, highlighter, sticker backs)
          const pb = getComputedStyle(n, '::before'), pc = rgba(pb.backgroundColor);
          if (pb.content && pb.content !== 'none' && pc && pc.a >= 0.9 && pb.position === 'absolute' && parseFloat(pb.width) >= n.offsetWidth * 0.8 && parseFloat(pb.height) >= n.offsetHeight * 0.5) base = over(pc, base);
        }
        res = base;
      }
      memo.set(n, res); return res;
    };
    let media = null;
    const overMedia = r => {
      if (!media) media = $$('img, picture, video, canvas, iframe').map(m => m.getBoundingClientRect()).filter(q => q.width > 8 && q.height > 8);
      return media.some(q => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
    };
    const seen = new Set(), fix = [];
    const w = document.createTreeWalker(sc || document.body, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.nodeValue.trim()) continue;
      seen.add(el);
      if (el.closest('.nav, .a11y-panel, .a11y-reader, svg, script, style, noscript, template, dialog:not([open]), .sr-only, .sr, [hidden], :disabled, [aria-disabled="true"]')) continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || clipsText(cs) || (cs.position === 'absolute' && cs.clip !== 'auto')) continue;
      const fill = rgba(cs.webkitTextFillColor);
      const fg = fill && fill.a > 0 ? fill : rgba(cs.color);
      if (!fg || fg.a < 0.05) continue;
      const bg = under(el); if (!bg) continue;
      const size = parseFloat(cs.fontSize) || 16, bold = (parseInt(cs.fontWeight, 10) || 400) >= 600;
      const need = S.theme === 'contrast' ? 4.5 : (size >= 24 || (bold && size >= 18.66) ? 3 : 4.5);
      if (ratio(fg.a < 1 ? over(fg, bg) : fg, bg) >= need) continue;
      if (bg.alt && bg.alt.some(a => ratio(fg.a < 1 ? over(fg, a) : fg, a) >= need)) continue;
      if (overMedia(r)) continue;
      const lightC = S.theme === 'contrast' ? WHITE_C : CHALK_C;
      fix.push([el, ratio(INK_C, bg) >= ratio(lightC, bg) ? 'a11y-fg-d' : 'a11y-fg-l']);
    }
    fix.forEach(([el, c]) => { el.classList.add(c); fgTagged.push(el); });
  }

  /* ------------------------------------------------------------ hide images: each image with alt text leaves a label */
  const altTags = () => {
    $$('.a11y-alt').forEach(n => n.remove());
    if (!S.noimg) return;
    $$('img').forEach(img => {
      if (img.closest('.a11y-panel, .zstore-badge, .nav, [aria-hidden="true"]')) return;
      const alt = (img.getAttribute('alt') || '').trim(); if (!alt) return;
      const host = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : img;
      const tag = document.createElement('span');
      tag.className = 'a11y-alt'; tag.textContent = alt;
      host.before(tag);
    });
  };

  /* ------------------------------------------------------------ stop autoplay: pause any playing video/audio */
  const stopAutoplay = () => {
    if (!S.noauto) return;
    $$('video, audio').forEach(m => { try { if (m.autoplay) { m.autoplay = false; m.dataset.a11yAuto = '1'; } m.pause(); } catch (e) {} });
  };
  const resumeAutoplay = () => {
    $$('[data-a11y-auto]').forEach(m => { m.autoplay = true; delete m.dataset.a11yAuto; if (!motionOff()) { try { const p = m.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } });
  };

  /* ------------------------------------------------------------ reading guide / reading mask (follow pointer, touch, focus) */
  let guideEl = null, maskEl = null, gy = Math.round(innerHeight * 0.45), gRaf = 0;
  const paintGuide = () => { gRaf = 0; [guideEl, maskEl].forEach(el => { if (el) el.style.setProperty('--y', gy + 'px'); }); };
  const moveGuide = y => { gy = Math.max(0, Math.min(innerHeight, y)); if (!gRaf) gRaf = requestAnimationFrame(paintGuide); };
  const onPointer = e => moveGuide(e.clientY);
  const onTouch = e => { if (e.touches && e.touches[0]) moveGuide(e.touches[0].clientY); };
  const onFocus = e => { const t = e.target; if (!t || !t.getBoundingClientRect || t === document.body) return; const r = t.getBoundingClientRect(); if (r.height) moveGuide(r.top + r.height / 2); };
  const syncGuide = () => {
    const want = S.guide || S.mask;
    if (S.guide && !guideEl) { guideEl = document.createElement('div'); guideEl.className = 'a11y-ruler'; guideEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(guideEl); }
    if (!S.guide && guideEl) { guideEl.remove(); guideEl = null; }
    if (S.mask && !maskEl) { maskEl = document.createElement('div'); maskEl.className = 'a11y-shade'; maskEl.setAttribute('aria-hidden', 'true'); maskEl.innerHTML = '<i></i><i></i>'; document.body.appendChild(maskEl); }
    if (!S.mask && maskEl) { maskEl.remove(); maskEl = null; }
    if (want && !syncGuide.on) {
      addEventListener('pointermove', onPointer, { passive: true }); addEventListener('pointerdown', onPointer, { passive: true });
      addEventListener('touchmove', onTouch, { passive: true }); addEventListener('touchstart', onTouch, { passive: true });
      document.addEventListener('focusin', onFocus); syncGuide.on = true;
    } else if (!want && syncGuide.on) {
      removeEventListener('pointermove', onPointer); removeEventListener('pointerdown', onPointer);
      removeEventListener('touchmove', onTouch); removeEventListener('touchstart', onTouch);
      document.removeEventListener('focusin', onFocus); syncGuide.on = false;
    }
    if (want) paintGuide();
  };

  /* ------------------------------------------------------------ read aloud (Web Speech API)
     Reads the visible text of <main>, block by block (headings, paragraphs, list items, table cells…), skipping
     anything hidden or aria-hidden. Each block is short enough for every engine (long ones are cut at sentences);
     pause = remember the block, resume = say it again. The block being read is highlighted and kept in view. */
  const Say = { blocks: [], i: 0, state: 'idle', utter: null, gen: 0 };
  const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, dt, dd, summary, figcaption, blockquote, caption, th, td, label, .a11y-alt';
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const textOf = el => {
    let out = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest('[aria-hidden="true"], script, style, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) out += n.nodeValue + ' ';
    return out.replace(/\s+/g, ' ').trim();
  };
  const collect = () => {
    const scope = $('main') || document.body;
    const items = [];
    $$(BLOCKS, scope).forEach(el => {
      if (el.parentElement && el.parentElement.closest(BLOCKS) && scope.contains(el.parentElement.closest(BLOCKS))) return;
      if (el.closest('[aria-hidden="true"], [hidden], nav, .a11y-panel, .a11y-alt') && !el.matches('.a11y-alt') || !visible(el)) return;
      const t = textOf(el); if (!t) return;
      const parts = t.length > 240 ? (t.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [t]) : [t];
      let buf = '';
      parts.forEach(p => { if ((buf + p).length > 240 && buf) { items.push({ el, t: buf.trim() }); buf = ''; } buf += p; });
      if (buf.trim()) items.push({ el, t: buf.trim() });
    });
    return items;
  };
  const pickVoice = () => {
    const vs = speechSynthesis.getVoices() || [];
    return vs.find(v => /^en[-_]US/i.test(v.lang) && v.localService) || vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  };
  const mark = el => { $$('.a11y-reading').forEach(n => n.classList.remove('a11y-reading')); if (el) el.classList.add('a11y-reading'); };
  const keepInView = el => {
    if (!el || (Popups && Popups.depth)) return;
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.12 || r.bottom > innerHeight * 0.88) el.scrollIntoView({ block: 'center', behavior: motionOff() ? 'instant' : 'smooth' });
  };
  const sayNext = () => {
    const gen = Say.gen;
    const b = Say.blocks[Say.i];
    if (!b) { stopSpeech(true); return; }
    const u = new SpeechSynthesisUtterance(b.t);
    const v = pickVoice(); if (v) u.voice = v;
    u.lang = (v && v.lang) || 'en-US'; u.rate = 1; u.pitch = 1;
    u.onstart = () => { Say.fails = 0; };
    u.onend = () => { if (gen !== Say.gen || Say.state !== 'playing') return; Say.i++; setTimeout(sayNext, 0); };
    u.onerror = e => {
      if (gen !== Say.gen || Say.state !== 'playing') return;
      if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
      // no voice installed, or the engine refused: stop after two failures in a row instead of racing through the page
      Say.fails = (Say.fails || 0) + 1;
      if (Say.fails >= 2) { const msg = e && e.error === 'not-allowed' ? 'Your browser blocked reading aloud. Press Read this page again.' : 'Reading aloud isn\'t available here: this browser has no voice to read with.'; stopSpeech(false, msg); status(msg); return; }
      Say.i++; setTimeout(sayNext, 0);
    };
    Say.utter = u;
    mark(b.el); keepInView(b.el);
    speechSynthesis.speak(u);
    syncSay();
  };
  const playSpeech = () => {
    if (!canSpeak) return;
    if (Say.state === 'playing') { // pause
      Say.state = 'paused'; Say.gen++; speechSynthesis.cancel(); syncSay(); return;
    }
    if (Say.state === 'idle') { Say.blocks = collect(); Say.i = 0; }
    if (!Say.blocks.length) { status('There is no text to read on this page.'); return; }
    Say.state = 'playing'; Say.gen++; Say.fails = 0;
    speechSynthesis.cancel();
    // Chrome needs a beat between cancel() and speak()
    setTimeout(sayNext, 60);
  };
  function stopSpeech(done, note) {
    Say.gen++; Say.state = 'idle'; Say.i = 0; Say.blocks = []; Say.note = note || '';
    try { speechSynthesis.cancel(); } catch (e) {}
    mark(null); syncSay();
    if (done === true) status('Finished reading the page.');
  }
  if (canSpeak) addEventListener('pagehide', () => { try { speechSynthesis.cancel(); } catch (e) {} });

  // a small reader bar while the page is being read and the panel is closed (play/pause + stop)
  let reader = null;
  const syncReader = () => {
    const show = Say.state !== 'idle' && !(panel && panel.open);
    if (show && !reader) {
      reader = document.createElement('div');
      reader.className = 'a11y-reader'; reader.setAttribute('role', 'region'); reader.setAttribute('aria-label', 'Read aloud');
      reader.innerHTML = '<span class="a11y-reader-dot" aria-hidden="true"></span><span class="a11y-reader-t" data-say-label></span>' +
        '<button type="button" class="a11y-reader-b" data-say="play"></button>' +
        '<button type="button" class="a11y-reader-b" data-say="stop" aria-label="Stop reading">' + ico('stop') + '</button>';
      reader.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (!b) return; if (b.dataset.say === 'stop') stopSpeech(); else playSpeech(); });
      document.body.appendChild(reader);
    }
    if (!show && reader) { const had = reader.contains(document.activeElement); reader.remove(); reader = null; if (had) { const o = visibleOpener(); if (o) o.focus({ preventScroll: true }); } }
    if (reader) {
      $('[data-say-label]', reader).textContent = Say.state === 'paused' ? 'Paused' : 'Reading aloud';
      const pb = $('[data-say="play"]', reader);
      pb.innerHTML = ico(Say.state === 'playing' ? 'pause' : 'play');
      pb.setAttribute('aria-label', Say.state === 'playing' ? 'Pause reading' : 'Resume reading');
      reader.classList.toggle('is-paused', Say.state === 'paused');
    }
  };

  /* ------------------------------------------------------------ icons (24px, stroke = currentColor) */
  const P = {
    text: '<path d="M3 19 8.4 5h1.2L15 19M5 14.5h8"/><path d="M15.6 19l2.9-7.5h.9L22.3 19M16.7 16.3h4.6"/>',
    lh: '<path d="M10 6h11M10 12h11M10 18h11M5 4.5v15M2.8 6.7 5 4.5l2.2 2.2M2.8 17.3 5 19.5l2.2-2.2"/>',
    sp: '<path d="M7 5.5v13M17 5.5v13"/><path d="M10 12h4M3.5 9.5 1.5 12l2 2.5M20.5 9.5l2 2.5-2 2.5"/>',
    font: '<path d="M2.5 18.5 7 5.5h.9l4.6 13M4.2 14h7.4"/><circle cx="17.4" cy="15.2" r="3.1"/><path d="M20.5 11.7v6.8"/>',
    dark: '<path d="M19.8 14.6A8.2 8.2 0 1 1 9.4 4.2a6.6 6.6 0 0 0 10.4 10.4Z"/>',
    contrast: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2a8.6 8.6 0 0 0 0-17.2Z" fill="currentColor"/>',
    gray: '<path d="M12 3.4s6.2 6.6 6.2 10.8a6.2 6.2 0 0 1-12.4 0C5.8 10 12 3.4 12 3.4Z"/><path d="M4 20.5 20 3.5"/>',
    lowsat: '<path d="M12 3.4s6.2 6.6 6.2 10.8a6.2 6.2 0 0 1-12.4 0C5.8 10 12 3.4 12 3.4Z"/><path d="M5.9 14.4c2 .9 4.1.9 6.1 0s4.1-.9 6.1 0"/>',
    links: '<path d="M10 14.2a4.1 4.1 0 0 0 5.8 0l3-3a4.1 4.1 0 1 0-5.8-5.8l-1.1 1.1"/><path d="M14 9.8a4.1 4.1 0 0 0-5.8 0l-3 3a4.1 4.1 0 1 0 5.8 5.8l1.1-1.1"/>',
    heads: '<path d="M4.5 5v14M13.5 5v14M4.5 12h9"/><path d="M17.5 10.2 20 9v10"/>',
    guide: '<path d="M2.5 13h19"/><path d="M5 9h9M5 17h12" opacity=".45"/><circle cx="20" cy="13" r="1.6" fill="currentColor"/>',
    mask: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M3 14.5h18"/><path d="M5.5 6.5h13M5.5 17.5h13" opacity=".45"/>',
    cursor: '<path d="M5.5 3.2 19 10.4l-6 1.7-2.9 5.8L5.5 3.2Z"/><path d="m13.2 12.3 4.5 6.2"/>',
    focus: '<path d="M4 9V5.2C4 4.5 4.5 4 5.2 4H9M15 4h3.8c.7 0 1.2.5 1.2 1.2V9M20 15v3.8c0 .7-.5 1.2-1.2 1.2H15M9 20H5.2C4.5 20 4 19.5 4 18.8V15"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.6"/>',
    noimg: '<rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="m3.5 16.5 4.8-4.8 3.6 3.6 2.6-2.6 5.5 5.5"/><path d="M3.2 3.2l17.6 17.6"/>',
    motion: '<rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/>',
    noauto: '<path d="M2.5 8h11M2.5 12h7M2.5 16h11"/><rect x="15.5" y="8.5" width="6" height="7" rx="1.4"/><path d="M17.6 10.6v2.8M19.4 10.6v2.8"/>',
    speak: '<path d="M3.5 9.4h3.6L12 5.6v12.8l-4.9-3.8H3.5z"/><path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.3 6.4a8 8 0 0 1 0 11.2"/>',
    play: '<path d="M8 5.6v12.8l10.4-6.4z" fill="currentColor"/>',
    pause: '<rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.2 3.8v4.4h4.4"/>',
    minus: '<path d="M6 12h12"/>', plus: '<path d="M6 12h12M12 6v12"/>'
  };
  function ico(name) { return '<svg class="a11y-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>'; }

  /* ------------------------------------------------------------ panel markup */
  const KEYS = [
    { g: 'text', k: 'lh', l: 'Line height', d: 'More room between lines' },
    { g: 'text', k: 'sp', l: 'Text spacing', d: 'Wider letters and words' },
    { g: 'text', k: 'font', l: 'Readable font', d: 'A plain system typeface' },
    { g: 'color', k: 'dark', l: 'Dark mode', d: 'Light text on dark' },
    { g: 'color', k: 'contrast', l: 'High contrast', d: 'Stronger text and edges' },
    { g: 'color', k: 'gray', l: 'Grayscale', d: 'Remove all color' },
    { g: 'color', k: 'lowsat', l: 'Low saturation', d: 'Softer, calmer color' },
    { g: 'read', k: 'links', l: 'Highlight links', d: 'Outline every link' },
    { g: 'read', k: 'heads', l: 'Highlight headings', d: 'Mark the page structure' },
    { g: 'read', k: 'guide', l: 'Reading guide', d: 'A line that follows you' },
    { g: 'read', k: 'mask', l: 'Reading mask', d: 'Dim all but one band' },
    { g: 'read', k: 'focus', l: 'Focus outline', d: 'Bold keyboard focus' },
    { g: 'read', k: 'cursor', l: 'Big cursor', d: 'A larger mouse pointer', fine: true },
    { g: 'read', k: 'noimg', l: 'Hide images', d: 'Show their descriptions' },
    { g: 'motion', k: 'motion', l: 'Pause animations', d: 'Same as the Motion switch' },
    { g: 'motion', k: 'noauto', l: 'Stop autoplay', d: 'Freeze loops and marquees' }
  ];
  const GROUPS = [['text', 'Text'], ['color', 'Color'], ['read', 'Reading'], ['motion', 'Motion']];
  const keyOn = k => k === 'dark' || k === 'contrast' ? S.theme === k : k === 'gray' || k === 'lowsat' ? S.filter === k : k === 'motion' ? motionOff() : !!S[k];
  const keyHTML = o => '<button type="button" class="a11y-key" data-a11y-key="' + o.k + '" aria-pressed="false" aria-describedby="a11y-d-' + o.k + '">' +
    '<span class="a11y-cap">' + ico(o.k) +
    '<span class="a11y-led" aria-hidden="true"><i></i><b class="a11y-led-on">On</b><b class="a11y-led-off">Off</b></span>' +
    '<span class="a11y-kl">' + o.l + '</span><span class="a11y-kd" id="a11y-d-' + o.k + '">' + o.d + '</span></span></button>';
  let built = false;
  const build = () => {
    if (built || !panel) return;
    built = true;
    let n = 0;
    const groups = GROUPS.map(([g, name]) => {
      const keys = KEYS.filter(o => o.g === g && (!o.fine || finePointer)).map(keyHTML).join('');
      n++;
      const step = g === 'text' ? '<div class="a11y-step" role="group" aria-labelledby="a11y-step-l">' +
        '<p class="a11y-step-l" id="a11y-step-l">' + ico('text') + '<span>Text size</span></p>' +
        '<div class="a11y-step-row">' +
        '<button type="button" class="a11y-step-b" data-a11y-text="-1" aria-label="Smaller text">' + ico('minus') + '</button>' +
        '<div class="a11y-rail" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
        '<output class="a11y-step-v" data-a11y-text-v aria-live="polite"><span class="sr-only">Text size </span><span data-v>100%</span></output>' +
        '<button type="button" class="a11y-step-b" data-a11y-text="1" aria-label="Larger text">' + ico('plus') + '</button>' +
        '</div></div>' : '';
      return '<section class="a11y-g" aria-labelledby="a11y-g-' + g + '"><h3 class="a11y-gh" id="a11y-g-' + g + '"><b>0' + n + '</b>' + name + '</h3>' + step + '<div class="a11y-keys">' + keys + '</div></section>';
    }).join('');
    const say = canSpeak ? '<section class="a11y-g a11y-g-say" aria-labelledby="a11y-g-say"><h3 class="a11y-gh" id="a11y-g-say"><b>05</b>Read aloud</h3>' +
      '<div class="a11y-say"><button type="button" class="a11y-say-b a11y-say-play" data-say="play" aria-describedby="a11y-say-s">' + ico('play') + '<span data-say-l>Read this page</span></button>' +
      '<button type="button" class="a11y-say-b a11y-say-stop" data-say="stop" aria-label="Stop reading">' + ico('stop') + '</button></div>' +
      '<p class="a11y-say-s" id="a11y-say-s" aria-live="polite">Reads the main content with your device\'s voice.</p></section>' : '';
    panel.innerHTML =
      '<div class="a11y-sheet">' +
        '<div class="a11y-grab" data-a11y-grab aria-hidden="true"><i></i></div>' +
        '<header class="a11y-head" data-a11y-grab>' +
          '<div class="a11y-head-t"><p class="a11y-kicker">Saved on this device</p>' +
          '<div class="a11y-title-row"><h2 class="a11y-title" id="a11y-title" tabindex="-1">Accessibility</h2><p class="a11y-count" data-a11y-count></p></div></div>' +
          '<button type="button" class="a11y-x" data-popup-close data-a11y-close aria-label="Close accessibility settings"><span aria-hidden="true">×</span></button>' +
        '</header>' +
        '<div class="a11y-body">' + groups + say + '</div>' +
        '<footer class="a11y-foot">' +
          '<button type="button" class="a11y-reset" data-a11y-reset>' + ico('reset') + '<span>Reset all</span></button>' +
          '<a class="a11y-link" href="/accessibility/">Accessibility statement <b aria-hidden="true">→</b></a>' +
          '<p class="a11y-kbd">Shortcut <kbd>Alt</kbd><span aria-hidden="true">+</span><kbd>Shift</kbd><span aria-hidden="true">+</span><kbd>A</kbd></p>' +
        '</footer>' +
        '<p class="sr-only" data-a11y-status role="status" aria-live="polite"></p>' +
      '</div>';
    panel.addEventListener('click', onPanelClick);
    wireDrag();
  };

  /* ------------------------------------------------------------ panel sync */
  let statusT = 0;
  function status(msg) {
    const s = panel && $('[data-a11y-status]', panel); if (!s) return;
    s.textContent = ''; clearTimeout(statusT);
    statusT = setTimeout(() => { s.textContent = msg; }, 40);
  }
  const syncSay = () => {
    syncReader();
    if (!built) return;
    const b = $('[data-say="play"]', panel); if (!b) return;
    const st = Say.state;
    b.innerHTML = ico(st === 'playing' ? 'pause' : 'play') + '<span data-say-l>' + (st === 'playing' ? 'Pause' : st === 'paused' ? 'Resume' : 'Read this page') + '</span>';
    b.setAttribute('aria-pressed', String(st === 'playing'));
    b.classList.toggle('is-on', st !== 'idle');
    const stop = $('[data-say="stop"]', panel); stop.setAttribute('aria-disabled', String(st === 'idle'));
    const s = $('.a11y-say-s', panel);
    s.textContent = st === 'idle' ? (Say.note || 'Reads the main content with your device\'s voice.') : (st === 'paused' ? 'Paused at ' : 'Reading ') + (Say.i + 1) + ' of ' + Say.blocks.length + '.';
  };
  const sync = () => {
    applyClasses();
    $$('[data-a11y-open]').forEach(b => b.classList.toggle('has-on', activeCount() > 0));
    if (!built) return;
    $$('[data-a11y-key]', panel).forEach(b => b.setAttribute('aria-pressed', String(keyOn(b.dataset.a11yKey))));
    const pct = Math.round(STEP[S.text] * 100) + '%';
    $('[data-a11y-text-v] [data-v]', panel).textContent = pct;
    $$('.a11y-rail i', panel).forEach((i, n) => i.classList.toggle('is-on', n <= S.text));
    $('[data-a11y-text="-1"]', panel).setAttribute('aria-disabled', String(S.text === 0));
    $('[data-a11y-text="1"]', panel).setAttribute('aria-disabled', String(S.text === 3));
    const c = activeCount();
    const cnt = $('[data-a11y-count]', panel);
    cnt.innerHTML = c ? c + ' on<span class="sr-only"> (' + (c === 1 ? 'one setting is' : c + ' settings are') + ' changed)</span>' : 'Default';
    cnt.classList.toggle('is-on', c > 0);
    $('[data-a11y-reset]', panel).setAttribute('aria-disabled', String(!c));
    syncSay();
  };

  /* ------------------------------------------------------------ apply one change */
  const LABEL = Object.fromEntries(KEYS.map(o => [o.k, o.l]));
  const emit = () => dispatchEvent(new CustomEvent('zs:a11y', { detail: snapshot() }));
  const effects = (changed) => {
    if (changed.has('text')) { sizeText(); requestAnimationFrame(() => dispatchEvent(new Event('resize'))); lastW = innerWidth; }
    if (changed.has('theme') || changed.has('text')) requestAnimationFrame(tagSurfaces);
    if (changed.has('noimg')) { altTags(); if (S.text) sizeText(); }
    if (['text', 'sp', 'font', 'lh', 'noimg'].some(k => changed.has(k))) requestAnimationFrame(() => requestAnimationFrame(reflowGuard));
    if (changed.has('guide') || changed.has('mask')) syncGuide();
    if (changed.has('noauto')) { if (S.noauto) stopAutoplay(); else resumeAutoplay(); }
  };
  const set = (key, value) => {
    const changed = new Set(); const notes = [];
    const was = snapshot();
    if (key === 'motion') {
      const off = !!value;
      if (off !== motionOff()) {
        if (ZS.setMotion) ZS.setMotion(off);
        else { root.classList.toggle('motion-off', off); try { localStorage.setItem('zs-motion', off ? 'off' : 'on'); } catch (e) {} dispatchEvent(new CustomEvent('zs:motion')); }
      }
      notes.push('Animations ' + (off ? 'paused' : 'on') + '.');
    } else if (key === 'text') {
      const v = Math.max(0, Math.min(3, value | 0)); if (v !== S.text) { S.text = v; changed.add('text'); }
    } else if (key === 'dark' || key === 'contrast') {
      const v = value ? key : ''; if (S.theme !== v) { if (v && S.theme) notes.push(LABEL[S.theme] + ' turned off.'); S.theme = v; changed.add('theme'); }
      notes.unshift(LABEL[key] + (value ? ' on.' : ' off.'));
    } else if (key === 'gray' || key === 'lowsat') {
      const v = value ? key : ''; if (S.filter !== v) { if (v && S.filter) notes.push(LABEL[S.filter] + ' turned off.'); S.filter = v; changed.add('filter'); }
      notes.unshift(LABEL[key] + (value ? ' on.' : ' off.'));
    } else if (key === 'theme' || key === 'filter') {
      return set(value || (key === 'theme' ? S.theme || 'dark' : S.filter || 'gray'), !!value);
    } else if (FLAGS.includes(key)) {
      const v = !!value;
      if (S[key] !== v) {
        S[key] = v; changed.add(key);
        if (v && key === 'guide' && S.mask) { S.mask = false; changed.add('mask'); notes.push('Reading mask turned off.'); }
        if (v && key === 'mask' && S.guide) { S.guide = false; changed.add('guide'); notes.push('Reading guide turned off.'); }
      }
      notes.unshift(LABEL[key] + (v ? ' on.' : ' off.'));
    } else return snapshot();
    save(); sync(); effects(changed);
    if (notes.length && key !== 'text') status(notes.join(' '));
    if (JSON.stringify(was) !== JSON.stringify(snapshot())) emit();
    return snapshot();
  };
  const reset = () => {
    const prev = S; S = clean(null);
    const changed = new Set(Object.keys(DEF).filter(k => prev[k] !== S[k]).map(k => (k === 'filter' ? 'filter' : k)));
    if (motionOff()) { if (ZS.setMotion) ZS.setMotion(false); else { root.classList.remove('motion-off'); try { localStorage.setItem('zs-motion', 'on'); } catch (e) {} } }
    stopSpeech();
    save(); sync(); effects(changed);
    status('All accessibility settings are back to default.');
    emit();
  };

  /* ------------------------------------------------------------ panel events */
  function onPanelClick(e) {
    const key = e.target.closest('[data-a11y-key]');
    if (key) { set(key.dataset.a11yKey, !keyOn(key.dataset.a11yKey)); return; }
    const st = e.target.closest('[data-a11y-text]');
    if (st) {
      if (st.getAttribute('aria-disabled') === 'true') { status(S.text === 3 ? 'Text is at its largest size.' : 'Text is at its default size.'); return; }
      set('text', S.text + Number(st.dataset.a11yText)); return;
    }
    if (e.target.closest('[data-a11y-reset]')) { if (activeCount()) reset(); else status('Everything is already at default.'); return; }
    const say = e.target.closest('[data-say]');
    if (say) { if (say.dataset.say === 'stop') { if (Say.state !== 'idle') { stopSpeech(); status('Stopped reading.'); } } else playSpeech(); }
  }

  /* ------------------------------------------------------------ open / close */
  const openers = () => $$('[data-a11y-open]');
  const shown = el => el && el.isConnected && el.getClientRects().length > 0 && !el.closest('dialog:not([open])');
  function visibleOpener() { return openers().find(shown) || $('[data-menu-open]') || $('.nav .logo'); }
  const setExpanded = v => openers().forEach(b => b.setAttribute('aria-expanded', String(v)));
  const desktopMQ = matchMedia('(min-width: 1024px)');
  const place = opener => {
    if (!panel) return;
    const navBar = $('.nav-bar');
    let top = 84, right = 16;
    if (navBar) top = Math.round(navBar.getBoundingClientRect().bottom + 12);
    if (opener && shown(opener) && desktopMQ.matches) {
      const r = opener.getBoundingClientRect();
      right = Math.max(12, Math.round(document.documentElement.clientWidth - r.right - 18));
      panel.style.setProperty('--a11y-tail', Math.max(26, Math.round(document.documentElement.clientWidth - right - (r.left + r.width / 2))) + 'px');
    } else panel.style.removeProperty('--a11y-tail');
    panel.style.setProperty('--a11y-top', top + 'px');
    panel.style.setProperty('--a11y-right', right + 'px');
  };
  const isOpen = () => !!(panel && panel.open);
  function openPanel(opener) {
    if (!panel || isOpen()) return;
    build(); sync();
    const menu = document.getElementById('menu');
    // opened from the mobile menu: focus comes back to the menu button the visitor started from (the menu item
    // itself is gone with the menu), never to some other opener further down the page
    const fromMenu = !!(opener && menu && menu.contains(opener));
    const go = () => {
      const menuBtn = $('[data-menu-open]');
      const back = fromMenu && shown(menuBtn) ? menuBtn : null;
      const op = opener && shown(opener) ? opener : back || visibleOpener();
      place(op);
      if (Popups) Popups.open(panel, op, back || visibleOpener());
      else if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
      setExpanded(true); syncReader();
      [$('.a11y-body', panel), $('.a11y-sheet', panel)].forEach(n => { if (n) n.scrollTop = 0; });
      const t = $('#a11y-title', panel); if (t) t.focus({ preventScroll: true });
    };
    if (menu && menu.open) {
      if (Popups && Popups.isOpen(menu)) Popups.close(menu, true).then(() => requestAnimationFrame(go));
      else { menu.close(); go(); }
    } else go();
  }
  function closePanel() {
    if (!isOpen()) return;
    if (Popups && Popups.isOpen(panel)) Popups.close(panel); else panel.close();
  }
  if (panel) {
    if (Popups) Popups.wire(panel);
    else {
      panel.addEventListener('cancel', e => { e.preventDefault(); panel.close(); });
      panel.addEventListener('click', e => {
        if (e.target.closest('[data-popup-close]')) { panel.close(); return; }
        if (e.target !== panel) return;
        const r = panel.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) panel.close();
      });
    }
    panel.addEventListener('close', () => {
      setExpanded(false); syncReader();
      const sheet = $('.a11y-sheet', panel); if (sheet) sheet.style.removeProperty('transform');
      if (!Popups) { const o = visibleOpener(); if (o) o.focus({ preventScroll: true }); }
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-a11y-open]');
      if (!b || (panel.contains(b))) return;
      e.preventDefault();
      if (isOpen()) closePanel(); else openPanel(b);
    });
    addEventListener('resize', () => { if (isOpen()) place(visibleOpener()); });
    // Alt+Shift+A (Option+Shift+A on a Mac: matched by the physical key, not the typed character)
    document.addEventListener('keydown', e => {
      if (!(e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA')) return;
      const t = e.target;
      if (!isOpen() && t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      if (isOpen()) closePanel(); else openPanel(document.activeElement && document.activeElement.matches('[data-a11y-open]') ? document.activeElement : null);
    });
  }

  /* drag the grab handle / header down to dismiss the bottom sheet (phones and tablets) */
  function wireDrag() {
    const sheet = $('.a11y-sheet', panel);
    let y0 = 0, dy = 0, t0 = 0, id = null;
    const sheetMode = () => !desktopMQ.matches;
    const down = e => {
      if (!sheetMode() || e.button > 0 || e.target.closest('button, a')) return;
      id = e.pointerId; y0 = e.clientY; dy = 0; t0 = performance.now();
      sheet.classList.add('is-drag');
      try { e.currentTarget.setPointerCapture(id); } catch (err) {}
    };
    const move = e => {
      if (e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = 'translateY(' + (dy < 0 ? 0 : dy) + 'px)';
    };
    const up = e => {
      if (e.pointerId !== id) return;
      id = null; sheet.classList.remove('is-drag');
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 110 || (dy > 40 && v > 0.6)) { sheet.style.transform = 'translateY(110%)'; setTimeout(closePanel, motionOff() ? 0 : 160); }
      else sheet.style.removeProperty('transform');
    };
    $$('[data-a11y-grab]', panel).forEach(h => {
      h.addEventListener('pointerdown', down); h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  }

  /* ------------------------------------------------------------ keep in sync with the Motion toggles and new content */
  addEventListener('zs:motion', () => { sync(); emit(); });
  let moT = 0;
  const onMut = list => {
    if (!S.text && !S.theme && !S.noimg && !S.sp && !S.font && !S.lh) return;
    const relevant = list.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !(n.classList && [...n.classList].some(c => c.indexOf('a11y-') === 0)) && !n.closest('.a11y-panel, .a11y-reader') && (n.textContent || '').trim()));
    if (!relevant || moT) return;
    moT = setTimeout(() => {
      moT = 0;
      if (S.noimg) altTags();
      if (S.text) sizeText();
      reflowGuard();
      if (S.theme) tagSurfaces();
    }, 260);
  };
  if ('MutationObserver' in window && document.body) new MutationObserver(onMut).observe(document.body, { childList: true, subtree: true });
  // a surface can change look with its state (a chip gets picked, a tab gets selected, a drawer opens): re-read
  // the surfaces after any click or state attribute change, once per frame at most (dark / high contrast only)
  let reTag = 0, attrT = 0;
  const scopes = new Set();
  const sectionOf = n => (n && n.nodeType === 1 && n.closest('main > *, footer, .menu-sheet, dialog[open]:not(.a11y-panel)')) || document.body;
  const queueTag = scope => {
    if (!S.theme) return;
    scopes.add(scope || document.body);
    if (reTag) return;
    reTag = requestAnimationFrame(() => {
      reTag = 0;
      const list = [...scopes]; scopes.clear();
      if (list.includes(document.body)) tagSurfaces();
      else list.filter(a => !list.some(b => b !== a && b.contains(a))).forEach(tagSurfaces);
    });
  };
  // after the click's own spring/colour transitions have settled (re-reading pauses transitions for a moment)
  document.addEventListener('click', e => { if (S.theme && !(panel && panel.contains(e.target))) { const sc = sectionOf(e.target); setTimeout(() => queueTag(sc), 650); } }, true);
  if ('MutationObserver' in window && document.body) new MutationObserver(list => {
    if (!S.theme) return;
    const hits = list.filter(m => !m.target.closest('.a11y-panel')); if (!hits.length) return;
    clearTimeout(attrT); const scs = hits.map(m => sectionOf(m.target));
    attrT = setTimeout(() => scs.forEach(queueTag), 650);
  })
    .observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'open', 'checked', 'data-state', 'data-level'] });

  /* ------------------------------------------------------------ boot */
  applyClasses();
  if (S.noimg) altTags();
  if (S.text) { sizeText(); requestAnimationFrame(() => dispatchEvent(new Event('resize'))); } else root.classList.remove('a11y-tpending');
  if (S.theme) tagSurfaces();
  if (S.guide || S.mask) syncGuide();
  if (S.noauto) { stopAutoplay(); addEventListener('load', stopAutoplay); }
  // fonts and late images can change what a surface looks like; one more pass once everything has loaded
  addEventListener('load', () => { reflowGuard(); if (S.theme) tagSurfaces(); });
  if (S.text || S.sp || S.font || S.lh) requestAnimationFrame(() => requestAnimationFrame(reflowGuard));
  $$('[data-a11y-open]').forEach(b => b.classList.toggle('has-on', activeCount() > 0));

  window.ZSA11y = { get: snapshot, set, reset, open: o => openPanel(o || null), close: closePanel, canSpeak };
})();
