module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const groqKey = (process.env.GROQ_API_KEY || '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').trim();
  let authHeader = req.headers['authorization'] || '';
  if (!authHeader && groqKey) {
    authHeader = `Bearer ${groqKey}`;
  }

  const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  try {
    const targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

