module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse target tool endpoint (e.g., page-audit or ai-crawlers)
  let endpoint = 'page-audit';
  const reqUrl = req.url || '';
  const qPath = req.query && (Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path);
  if (reqUrl.includes('ai-crawlers') || (qPath && qPath.includes('ai-crawlers'))) {
    endpoint = 'ai-crawlers';
  } else if (qPath) {
    endpoint = qPath;
  }

  const apiKey = (process.env.CITEVANA_API_KEY || 'cv_live_AuUfx52u9IUYjyQysEvuBin7ArAA0_-mMhYAg-65MPc').trim();
  const targetUrl = `https://citevana.com/api/v1/tools/${endpoint}`;

  let bodyStr = '';
  if (typeof req.body === 'string') {
    bodyStr = req.body;
  } else if (req.body && typeof req.body === 'object') {
    bodyStr = JSON.stringify(req.body);
  } else {
    bodyStr = JSON.stringify({});
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PageAuditChecklist/2.0'
      },
      body: bodyStr
    });

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message });
  }
};
