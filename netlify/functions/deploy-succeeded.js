// Netlify event function: the file name "deploy-succeeded" makes Netlify run it automatically after
// every successful deploy. It reads the live sitemap and submits every URL to IndexNow (Bing, and
// through it ChatGPT Search / Copilot; also Yandex, Seznam, Naver), so new and updated pages are
// crawled within minutes instead of weeks. It never fails the deploy: errors are logged, not thrown.
//
// The key file lives at the site root: /<KEY>.txt (its content is the key itself).
// Event functions are not public endpoints; netlify.toml also 404s /netlify/* as a belt-and-braces rule.
const HOST = 'zstore-ai.com';
const KEY = '5bdacc904efc0c41c22a8e1dfd1c0ccbf3563e2138890eb31a579e48e7e10021';
const ORIGIN = 'https://' + HOST;

exports.handler = async (event) => {
  try {
    // Only the production deploy of the custom domain: skip deploy previews and branch deploys.
    const body = JSON.parse((event && event.body) || '{}');
    const context = body.payload && body.payload.context;
    if (context && context !== 'production') return { statusCode: 200, body: 'skipped: ' + context };

    const res = await fetch(ORIGIN + '/sitemap.xml', { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error('sitemap HTTP ' + res.status);
    const xml = await res.text();
    // <loc> only (not <image:loc>), same host only, de-duplicated; IndexNow accepts up to 10,000 per call.
    const urlList = [...new Set(
      [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
        .map((m) => m[1].replace(/&amp;/g, '&'))
        .filter((u) => u.startsWith(ORIGIN + '/'))
    )].slice(0, 10000);
    if (!urlList.length) return { statusCode: 200, body: 'IndexNow: no URLs in sitemap' };

    const ping = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: ORIGIN + '/' + KEY + '.txt', urlList }),
    });
    // 200 = accepted, 202 = accepted (key validation pending). 4xx = check the key file / host.
    console.log('IndexNow:', ping.status, 'for', urlList.length, 'urls');
    return { statusCode: 200, body: 'IndexNow ' + ping.status + ' for ' + urlList.length + ' urls' };
  } catch (err) {
    console.error('IndexNow failed:', err);
    return { statusCode: 200, body: 'IndexNow error: ' + err.message };
  }
};
