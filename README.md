# Zstore AI — zstore-ai.com

The English-language studio site of **Zvi Moshe** (Zstore AI, Tel Aviv — working with clients worldwide; the Israeli market is served by the separate Hebrew site, zstore-ai.co.il).
Hand-coded HTML, CSS and JavaScript with a hand-written WebGL 1 raymarcher ("Tactile Play" design). No frameworks, no build step, no runtime dependencies, CSP `'self'`.

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
- **Bing / IndexNow**: the root-level `5bdacc…021.txt` file is the site's IndexNow key (key = filename). After content changes deploy, ping `https://api.indexnow.org/indexnow` with the changed URLs — Bing (which also feeds ChatGPT Search/Copilot), Yandex, Seznam and Naver all consume IndexNow. Bing Webmaster Tools itself needs a Microsoft-account login (one-click "Import from Google Search Console") — that step is manual.
- **hreflang**: `index.html` declares `en` + `x-default` (this site) and `he` → https://zstore-ai.co.il/. The pairing only takes effect once the Hebrew site adds the three reciprocal tags (`he` → itself, `en` and `x-default` → zstore-ai.com) — do that in the zstore-ai.co.il repo.

## Structure

| Path | What it is |
|---|---|
| `index.html` | The whole site: hero (WebGL Z), concept studies, services, studio, process, FAQ, contact form. Full `<head>`: CSP, canonical, OG/Twitter (`image/brand/og-share.jpg`), JSON-LD `@graph` (Organization, Person, Services, FAQPage, CreativeWorks), inlined `@font-face`. |
| `tactile.css` | All styling, including the metric-matched `Space Grotesk Fallback` (CLS 0) and the no-JS fallbacks. |
| `app.js` | Interactions: popups with clean back-button history, scroll lock, accordions, tabs, form (production path posts to Google Apps Script; on localhost it never sends). |
| `gl.js` | The WebGL piece engine: SDF raymarcher + FXAA + physics. The shader clips its output to a band with holes over every text box, so the 3D can never cover copy. Adaptive quality (recovers on 60 Hz screens). `window.__zstore` exposes QA state. |
| `privacy-policy.html`, `terms.html` | Legal pages (Tactile design, breadcrumbs JSON-LD). |
| `404.html`, `thank-you.html` | Not-found and post-submit pages (`noindex`). |
| `llms.txt`, `llms-full.txt`, `humans.txt`, `robots.txt`, `sitemap.xml` | AEO/GEO/LLMO + crawler files. Facts confirmed by Zvi: founded 2024; 40+ projects shipped, 98% client retention, ~1.2s average load; replies within one business day. |
| `fonts/` | Self-hosted woff2: Space Grotesk, Fraunces, JetBrains Mono (`@font-face` is inlined in each page's head). |
| `image/brand/` | Logo set, icons, `og-share.jpg` (1200×630 share image supplied by Zvi). |
| `image/studio/` | Concept-study imagery + `-800`/`-1200` srcset variants (regenerate with sharp at quality 82 if the originals change). |

## Domain swap checklist

The domain appears in these places — change all of them together if the domain ever changes:

- `index.html`: canonical, `hreflang` ×2, `og:url`, `og:image`, `twitter:image`, and every `@id`/`url`/`image` inside the JSON-LD block.
- `privacy-policy.html`, `terms.html`: canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD (WebPage + BreadcrumbList).
- `sitemap.xml`: all `<loc>` + `<image:loc>`.
- `robots.txt`: the `Sitemap:` line.
- `llms.txt` and `llms-full.txt`: every absolute link.

(Grep for the old domain to make sure nothing is left: `grep -rn "old-domain" .`)

## Quality bar (measured 14 Sep 2026, local ≈ production conditions)

- Lighthouse desktop: 100 / 100 / 100 / 100 (+ Agentic 100). Mobile: 92 perf / 100 / 100 / 100 / 100, CLS 0, TBT 40ms.
- Full mobile QA suite (8 viewports: popups, back button, scroll lock, form, keyboard, safe areas, no-JS, reduced motion, GL-vs-text): green. The suite lives in the handoff workspace (`Zstore AI - Handoff/tactile-prototype/mobile-check.cjs`), not in this repo.
- GL-vs-text motion probe: 456 samples (load, pushes, scroll-away, re-entry, contact drop-in, build, celebrate, rotation at 390/844×390/1440) — zero 3D pixels over text.

## Editing notes

- The form's production endpoint and anti-spam rules live in `app.js` (`#contact-form`); keep `mode: 'no-cors'`, the honeypot and the localhost guard.
- The portrait `image/20251111_150847.webp` is the approved original — don't re-encode it (the `-800` variant is derived).
- The footer credit badge (`.zstore-badge` → https://zstore-ai.co.il/) keeps its exact markup and computed style.
- Real content only: no invented clients, numbers, reviews or prices; the three projects are always "Concept study · not client work".
