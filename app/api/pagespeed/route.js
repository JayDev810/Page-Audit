import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    }
  });
}

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };

  try {
    const body = await request.json();
    const targetUrl = body.url;
    if (!targetUrl) {
      return NextResponse.json({ ok: false, error: 'Missing target URL' }, { status: 400, headers: corsHeaders });
    }

    const primaryKey = (process.env.PSI_API_KEY_PRIMARY || 'AIzaSyAL-HWaqHT5oqwzUoznXTM3Yps59Gk0TxQ').trim();
    const fallbackKey = (process.env.PSI_API_KEY_FALLBACK || 'AIzaSyC7DWxwuaj2w91A52sCIW7F1ri6YXJQ-b4').trim();

    let keyUsed = null;
    let failoverReason = null;
    let rawPsi = null;

    async function callPsi(key) {
      const encUrl = encodeURIComponent(targetUrl);
      const keyParam = key ? `&key=${key}` : '';
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encUrl}&strategy=mobile&category=performance&category=best-practices&category=accessibility&category=seo${keyParam}`;
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
        rawPsi = await callPsi(null);
        keyUsed = 'keyless';
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

      // Extract real browser telemetry from Lighthouse
      const consoleAudit = audits['errors-in-console'];
      const consoleErrors = [];
      if (consoleAudit && consoleAudit.details?.items) {
        consoleAudit.details.items.forEach(it => {
          const msg = it.description || it.source || it.url || '';
          if (msg) consoleErrors.push(msg);
        });
      }
      const consoleErrorsCount = consoleAudit
        ? (consoleAudit.score === 1 ? 0 : (consoleErrors.length || 1))
        : null;

      const viewportAudit = audits['viewport'];
      const viewportPassed = viewportAudit ? viewportAudit.score === 1 : null;

      const contentWidthAudit = audits['content-width'];
      const contentWidthPassed = contentWidthAudit ? contentWidthAudit.score === 1 : null;

      const tapTargetsAudit = audits['tap-targets'];
      const tapTargetsPassed = tapTargetsAudit ? tapTargetsAudit.score === 1 : null;

      const fontSizeAudit = audits['font-size'];
      const fontSizePassed = fontSizeAudit ? fontSizeAudit.score === 1 : null;

      const crawlableAnchorsAudit = audits['crawlable-anchors'];
      const crawlableAnchorsPassed = crawlableAnchorsAudit ? crawlableAnchorsAudit.score === 1 : null;

      return NextResponse.json({
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
          opportunities: opportunities,
          consoleErrorsCount: consoleErrorsCount,
          consoleErrors: consoleErrors,
          viewportPassed: viewportPassed,
          contentWidthPassed: contentWidthPassed,
          tapTargetsPassed: tapTargetsPassed,
          fontSizePassed: fontSizePassed,
          crawlableAnchorsPassed: crawlableAnchorsPassed
        }
      }, { headers: corsHeaders });
    }

    return NextResponse.json({
      ok: false,
      error: 'PageSpeed unavailable',
      reason: failoverReason || 'All keys failed',
      keyUsed: null
    }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

