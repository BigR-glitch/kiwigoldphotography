// /api/ig-thumb.js
// Given an Instagram reel/post URL, returns its public cover image.
// Deploy this file inside an /api folder at your project root — Vercel will
// automatically turn it into a serverless function at /api/ig-thumb.
//
// Strategy: Instagram's normal post page shows server requests (like this
// one, coming from Vercel's IPs) a login wall instead of the real content —
// that's why the first version of this function returned "no thumbnail
// found". Instagram's /embed/ page, however, is built specifically so other
// websites can show a preview of a public post without logging in, so it
// survives being fetched from a server much better.

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !/^https:\/\/(www\.)?instagram\.com\//.test(url)) {
    return res.status(400).json({ error: 'Provide a valid instagram.com URL' });
  }

  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  };

  // Normalize the URL: drop tracking query params, ensure a trailing slash
  const clean = url.split('?')[0].replace(/\/?$/, '/');

  // Build candidate URLs to try, in order of reliability
  const candidates = [
    clean + 'embed/captioned/',
    clean + 'embed/',
    clean, // last resort: the raw post page
  ];

  async function tryExtract(targetUrl) {
    const r = await fetch(targetUrl, { headers: browserHeaders });
    if (!r.ok) return null;
    const html = await r.text();
    const match =
      html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^"]+)"/) ||
      html.match(/<meta property="og:image" content="([^"]+)"/) ||
      html.match(/"display_url":"([^"]+)"/) ||
      html.match(/"thumbnail_url":"([^"]+)"/);
    if (!match) return null;
    return match[1]
      .replace(/&amp;/g, '&')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/');
  }

  try {
    let thumbnail = null;
    for (const candidate of candidates) {
      thumbnail = await tryExtract(candidate).catch(() => null);
      if (thumbnail) break;
    }

    if (!thumbnail) {
      return res
        .status(404)
        .json({ error: 'No thumbnail found — Instagram may be blocking this request right now' });
    }

    // Cache at the edge for a day so repeat visits don't re-hit Instagram
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ thumbnail });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch Instagram page' });
  }
}
