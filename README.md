# Zstore AI — zstore-ai.com

The English-language studio site of **Zvi Moshe** (Zstore AI, Tel Aviv — working with clients worldwide; the Israeli market is served by the separate Hebrew site, zstore-ai.co.il).
Hand-coded HTML, CSS and JavaScript with a hand-written WebGL 1 raymarcher on the home page ("Tactile Play" design). No frameworks, no build step, no runtime dependencies; strict CSP (`'self'` + the Cloudflare analytics beacon).

## Run locally

```bash
node serve.cjs
```

→ http://localhost:5173 (gzip enabled, like production; 404.html is served for unknown paths).

## Deploy

Netlify publishes the repository root as-is (`netlify.toml`, `publish = "."`). Push to `main` → deploy.
Headers (cache + security) live in `_headers`. The custom domain is **zstore-ai.com** (DNS on Cloudflare).

### Search engines & AI indexes

- **Google**: verified via the `google-site-verification` meta tag in `index.html` (Search Console).
- **Bing / IndexNow**: the root-level `5bdacc…021.txt` file is the site's IndexNow key (key = filename). `netlify/functions/deploy-succeeded.js` pings `https://api.indexnow.org/indexnow` with every sitemap URL after each production deploy — Bing (which also feeds ChatGPT Search/Copilot), Yandex, Seznam and Naver all consume IndexNow. Bing Webmaster Tools itself needs a Microsoft-account login (one-click "Import from Google Search Console") — that step is manual.
- **hreflang**: `index.html` declares `en` + `x-default` (this site) and `he` → https://zstore-ai.co.il/. The pairing only takes effect once the Hebrew site adds the three reciprocal tags (`he` → itself, `en` and `x-default` → zstore-ai.com) — do that in the zstore-ai.co.il repo.

## Structure

A multi-page static site (since November 2026): home + 27 inner pages, all hand-coded, sharing one design system.

| Path | What it is |
|---|---|
| `index.html` | Home: hero (WebGL Z), selected work + concept studies, services, studio, process, from-the-guides shelf, FAQ, contact form. Full `<head>`: canonical, hreflang, OG/Twitter (`image/brand/og-share.jpg`), JSON-LD `@graph` (`#organization`, `#zvi-moshe`, `#website`, Services, FAQPage, CreativeWorks), inlined `@font-face`, and the ONE inline boot `<script>` (allowed by its sha256 in `_headers`). |
| `services/` | Services hub + `custom-website-design/`, `ecommerce-websites/`, `landing-pages/`, `ai-search-optimization/`, `website-redesign/` (each `index.html`). |
| `work/` | Work hub (real website screenshots without client names + concept studies) and `atelier-studio/`, `lume/`, `meridian/` (self-initiated concept studies, never client work). |
| `process/`, `pricing/`, `about/`, `contact/` | Studio pages. Pricing has no numbers (fixed project price by scope or a monthly plan, 30 days of care, optional Care plan). Contact holds the brief form. |
| `guides/` | Guides hub, `glossary/` (62 terms, `#term-<slug>` ids) and the guides `generative-engine-optimization/`, `custom-website-vs-website-builder/`, `how-to-write-a-website-brief/`, `website-launch-checklist/`, `website-accessibility-ada/`, `core-web-vitals/`. New guides follow SITE-PLAYBOOK §7. |
| `accessibility/` | Accessibility statement (WCAG 2.2 AA target) with a live switchboard for the site-wide accessibility widget. |
| `privacy-policy.html`, `terms.html` | Legal pages at their `.html` URLs (canonical). The privacy policy covers the contact form and the cookieless Cloudflare Web Analytics. |
| `404.html`, `thank-you.html` | Not-found and post-submit pages (`noindex`, not in the sitemap). |
| `tactile.css` | Tokens, base, buttons, site chrome (nav capsule, Services panel, menu dialog, mega footer, WhatsApp bead), stickers/tape/keycaps, FAQ pills, Z kit, legal layout, home sections. |
| `app.js` | ONE behaviour file for every page: popups with clean back-button history, menu, Services panel, Motion toggle, letter-roll, accordions, reveal, TOC, WhatsApp bead (never over copy; `[data-wa-hold]` / `zs:wa-hold` hooks), contact form (production posts to Google Apps Script; on localhost it never sends). |
| `gl.js` | The WebGL piece engine (home only): SDF raymarcher + FXAA + physics; clips itself around every text box. `window.__zstore` exposes QA state. |
| `assets/css/site.css` | Inner-page building blocks (heroes, sections, tiles, tables, steps, CTA slab, "Keep reading", article layout + TOC). |
| `assets/css/pages/<slug>.css`, `assets/js/pages/<slug>.js` | Each page's own signature component and living touches (class prefix unique to the page). Guides: `assets/css/guides/`, `assets/js/guides/`. |
| `assets/js/boot.js` | Render-blocking boot for inner pages (`html.js`, `html.motion-off`). |
| `assets/css/a11y.css`, `assets/js/a11y-boot.js`, `assets/js/a11y.js` | The accessibility widget (nav-capsule button ≥1024px, menu item below; settings in `localStorage 'zstore-com-a11y'`). |
| `llms.txt`, `llms-full.txt`, `humans.txt`, `robots.txt`, `sitemap.xml` | AEO/GEO/LLMO + crawler files. `llms-full.txt` carries every page FAQ verbatim; `sitemap.xml` lists all 26 indexable URLs with hero images. |
| `netlify/functions/deploy-succeeded.js` | IndexNow: after every successful production deploy it reads the live sitemap and submits all URLs (Bing → ChatGPT Search/Copilot, Yandex, Seznam, Naver). Key file: the root-level `5bdacc…021.txt`. |
| `apps-script/` | Server code of the contact form (Google Apps Script), versioned only; `netlify.toml` 404s it. |
| `fonts/` | Self-hosted woff2: Space Grotesk, Fraunces, JetBrains Mono (`@font-face` is inlined in each page's head). |
| `image/art/` | The owner's images made for this site (3:2, `-800`/`-1200`/`-1536` WebP). They carry baked-in English headlines: never crop them with `object-fit: cover` on phones. Assignments: `tools/IMAGES.md`. |
| `image/work/`, `image/stock/`, `image/studio/` | Genuine website screenshots (no client names), supporting imagery, concept-study imagery. |
| `image/brand/` | Logo set, icons, `og-share.jpg` (1200×630 share image). |
| `serve.cjs` | Local preview server (mirrors the `_headers` CSP). |

**Outside this repo** (next to it, never published): `../SITE-PLAYBOOK.md` (binding rules), `../tools/` (`COMPONENTS.md`, `CONTENT-MAP.md`, `IMAGES.md`, `page-template.html`, `a11y-snippet.html`, `site-qa.py` static QA, `shoot.mjs` headless screenshots). Run QA before any push: `python3 -I ../tools/site-qa.py .` must print NO PROBLEMS.

### Analytics

Cloudflare Web Analytics (cookieless, aggregate only) via the manual JS beacon, the last line before `</body>` on every page. Its two origins are allowed in the `_headers` CSP (`script-src https://static.cloudflareinsights.com`, `connect-src https://cloudflareinsights.com`). There is no meta CSP on any page: the header is the single source of truth. On localhost the beacon's report is refused by CORS; that is expected.

## Domain swap checklist

The domain appears in these places — change all of them together if the domain ever changes:

- Every `*.html` page (home, all inner pages, legal, 404, thank-you): canonical, `og:url`, `og:image`, `twitter:image`, and every `@id`/`url`/`image`/`item` inside its JSON-LD `@graph`; `index.html` also has `hreflang` ×2.
- `tools/page-template.html` (outside the repo), so new pages start with the right domain.
- `sitemap.xml`: all `<loc>` + `<image:loc>`.
- `robots.txt`: the `Sitemap:` line.
- `llms.txt`, `llms-full.txt`, `humans.txt`: every absolute link.
- `netlify/functions/deploy-succeeded.js`: `HOST` (IndexNow), and generate a new key file for the new host.
- `netlify.toml`: the Netlify-subdomain → custom-domain redirect target.
- Cloudflare Web Analytics: add the new hostname to the site (or create a new site + token) and update the beacon token on every page.
- Google Search Console and Bing Webmaster Tools: add and verify the new property, submit the sitemap; use Google's Change of Address tool.

(Grep for the old domain to make sure nothing is left: `grep -rn "old-domain" . ../tools`)

## Quality bar (measured 14 Sep 2026, local ≈ production conditions)

- Lighthouse desktop: 100 / 100 / 100 / 100 (+ Agentic 100). Mobile: 92 perf / 100 / 100 / 100 / 100, CLS 0, TBT 40ms.
- Full mobile QA suite (8 viewports: popups, back button, scroll lock, form, keyboard, safe areas, no-JS, reduced motion, GL-vs-text): green. The suite lives in the handoff workspace (`Zstore AI - Handoff/tactile-prototype/mobile-check.cjs`), not in this repo.
- GL-vs-text motion probe: 456 samples (load, pushes, scroll-away, re-entry, contact drop-in, build, celebrate, rotation at 390/844×390/1440) — zero 3D pixels over text.

## Editing notes

- The form's production endpoint and anti-spam rules live in `app.js` (`#contact-form`); keep `mode: 'no-cors'`, the honeypot and the localhost guard.
- The portrait `image/20251111_150847.webp` is the approved original — don't re-encode it (the `-800` variant is derived).
- The footer credit badge (`.zstore-badge` → https://zstore-ai.co.il/) keeps its exact markup and computed style.
- Real content only: no invented clients, numbers, reviews or prices; the three projects are always "Concept study · not client work".
