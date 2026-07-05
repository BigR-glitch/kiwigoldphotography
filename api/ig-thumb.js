// /api/ig-thumb.js
// Given an Instagram post/reel URL, returns its public cover image (og:image).
// Deploy this file inside an /api folder at your project root — Vercel will
// automatically turn it into a serverless function at /api/ig-thumb.

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !/^https:\/\/(www\.)?instagram\.com\//.test(url)) {
    return res.status(400).json({ error: 'Provide a valid instagram.com URL' });
  }

  try {
    const igRes = await fetch(url, {
      headers: {
        // Instagram serves a stripped-down page to non-browser requests,
        // so we ask for it the way a real browser would.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!igRes.ok) {
      return res.status(502).json({ error: `Instagram responded with ${igRes.status}` });
    }

    const html = await igRes.text();

    const match =
      html.match(/<meta property="og:image" content="([^"]+)"/) ||
      html.match(/"display_url":"([^"]+)"/);

    if (!match) {
      return res.status(404).json({ error: 'No thumbnail found on that page' });
    }

    // Unescape HTML entities and JSON escaping (&amp; / \u0026 / \/)
    const thumbnail = match[1]
      .replace(/&amp;/g, '&')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/');

    // Cache at the edge for a day so repeat visits don't re-hit Instagram
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ thumbnail });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch Instagram page' });
  }
}
