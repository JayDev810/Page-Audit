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
    return res.status(400).json({ ok: false, error: 'Missing target URL' });
  }

  const primaryKey = (process.env.PSI_API_KEY_PRIMARY || 'AIzaSyAL-HWaqHT5oqwzUoznXTM3Yps59Gk0TxQ').trim();
  const fallbackKey = (process.env.PSI_API_KEY_FALLBACK || 'AIzaSyC7DWxwuaj2w91A52sCIW7F1ri6YXJQ-b4').trim();

  let keyUsed = null;
  let failoverReason = null;
  let rawPsi = null;

  async function callPsi(key) {
    const encUrl = encodeURIComponent(targetUrl);
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encUrl}&strategy=mobile&category=performance&key=${key}`;
    const r = await fetch(apiUrl, { headers: { 'User-Agent': 'PageAuditChecklist/2.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  if (primaryKey) {
    try {
      rawPsi = await callPsi(primaryKey);
      keyUsed = 'primary';
    } catch (e) {
      failoverReason = `Primary key failed (${e.message})`;
    }
  }

  if (!rawPsi && fallbackKey) {
    try {
      rawPsi = await callPsi(fallbackKey);
      keyUsed = 'fallback';
    } catch (e) {
      failoverReason = `${failoverReason || 'Primary key failed'}; Fallback key failed (${e.message})`;
    }
  }

  // Keyless attempt
  if (!rawPsi) {
    try {
      const encUrl = encodeURIComponent(targetUrl);
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encUrl}&strategy=mobile&category=performance`;
      const r2 = await fetch(apiUrl, { headers: { 'User-Agent': 'PageAuditChecklist/2.0' } });
      if (r2.ok) {
        rawPsi = await r2.json();
        keyUsed = 'keyless';
      }
    } catch (e) {}
  }

  if (rawPsi && rawPsi.lighthouseResult) {
    const lh = rawPsi.lighthouseResult;
    const perf = lh.categories?.performance || {};
    const audits = lh.audits || {};

    const score = perf.score !== null && perf.score !== undefined ? Math.round(perf.score * 100) : null;
    const fcp = audits['first-contentful-paint']?.displayValue || '—';
    const lcp = audits['largest-contentful-paint']?.displayValue || '—';
    const tbt = audits['total-blocking-time']?.displayValue || '—';
    const cls = audits['cumulative-layout-shift']?.displayValue || '—';
    const si = audits['speed-index']?.displayValue || '—';

    const opportunities = [];
    for (const a of Object.values(audits)) {
      if (a?.details?.type === 'opportunity') {
        const savings = a.details.overallSavingsMs || 0;
        const byteSavings = a.details.overallSavingsBytes || 0;
        if (savings > 100 || byteSavings > 40000) {
          opportunities.push({
            title: a.title,
            displayValue: a.displayValue || '',
            savingsMs: savings,
            savingsBytes: byteSavings
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      keyUsed: keyUsed,
      failoverReason: keyUsed === 'fallback' ? failoverReason : null,
      data: {
        score: score,
        fcp: fcp,
        lcp: lcp,
        tbt: tbt,
        cls: cls,
        speedIndex: si,
        opportunities: opportunities
      }
    });
  }

  return res.status(200).json({
    ok: false,
    error: 'PageSpeed unavailable',
    reason: failoverReason || 'All keys failed',
    keyUsed: null
  });
};
