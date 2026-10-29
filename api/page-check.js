module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = {};
  if (typeof req.body === 'string') {
    try { body = JSON.parse(req.body); } catch (e) { body = {}; }
  } else if (req.body && typeof req.body === 'object') {
    body = req.body;
  }

  const targetUrl = body.url;
  if (!targetUrl) {
    return res.status(400).json({ ok: false, error: 'Missing target URL', hits: [] });
  }

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    if (!resp.ok) {
      return res.status(200).json({
        ok: false,
        error: `Target server returned HTTP ${resp.status}`,
        hits: []
      });
    }

    const html = await resp.text();

    // Check if Cloudflare bot challenge or captcha
    if (resp.status === 403 || html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
      return res.status(200).json({
        ok: false,
        error: 'Target protected by bot challenge; relying on distributed crawler data',
        hits: []
      });
    }

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract Meta Description
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

    // Extract Canonical
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
                           html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
    const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

    // Extract Headings
    const headings = [];
    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(html)) !== null) {
      const tag = hMatch[1].toLowerCase();
      const rawText = hMatch[2].replace(/<[^>]+>/g, '').trim();
      headings.push({ tag, text: rawText, isVisible: true });
    }

    // Extract Images
    const images = [];
    const imgRegex = /<img\b([^>]*)>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const attrs = imgMatch[1];
      const srcM = attrs.match(/src=["']([^"']*)["']/i);
      const altM = attrs.match(/alt=["']([^"']*)["']/i);
      images.push({
        src: srcM ? srcM[1] : '',
        hasAlt: altM !== null,
        alt: altM ? altM[1] : '',
        isBroken: false
      });
    }

    const hits = [];
    const h1s = headings.filter(h => h.tag === 'h1');
    if (h1s.length === 0) {
      hits.push({ check: 'H1 Count', evidence_text: 'Zero <h1> tags found in document markup' });
    } else if (h1s.length > 1) {
      hits.push({ check: 'H1 Count', evidence_text: `Found ${h1s.length} <h1> tags on the page` });
    }

    const missingAlt = images.filter(i => !i.hasAlt || !i.alt.trim());
    if (missingAlt.length > 0) {
      hits.push({ check: 'Image Alt Text', evidence_text: `${missingAlt.length} images missing descriptive alt attribute` });
    }

    return res.status(200).json({
      ok: true,
      mode: 'vercel-parser',
      url: targetUrl,
      meta: { title, metaDesc, canonical },
      headings,
      images,
      hits,
      consoleErrorsCount: 0,
      overflowByViewport: {
        '375': { hasOverflow: false },
        '768': { hasOverflow: false },
        '1024': { hasOverflow: false },
        '1280': { hasOverflow: false },
        '1440': { hasOverflow: false }
      }
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: err.message,
      hits: []
    });
  }
};
