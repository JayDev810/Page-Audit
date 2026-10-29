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
      return NextResponse.json(
        { ok: false, error: 'Missing target URL' },
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = (process.env.RN_API_KEY || 'rnk_live_ffdcc789ff5c17f02123f00e4ae5916e2db305648be95447').trim();
    const encUrl = encodeURIComponent(targetUrl);
    const rnBase = 'https://www.ranknibbler.com';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const headers = {
      'X-API-Key': apiKey,
      'User-Agent': 'PageAuditChecklist/2.0'
    };

    try {
      const resp = await fetch(`${rnBase}/api/v1/audit?url=${encUrl}`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        return NextResponse.json(
          { ok: false, error: `RankNibbler returned HTTP ${resp.status}` },
          { status: resp.status, headers: corsHeaders }
        );
      }

      const auditData = await resp.json();
      return NextResponse.json(
        {
          ok: true,
          audit: auditData,
          checks: auditData.checks || {}
        },
        { headers: corsHeaders }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout = fetchErr.name === 'AbortError';
      return NextResponse.json(
        {
          ok: false,
          error: isTimeout ? 'RankNibbler request timed out after 12s' : fetchErr.message
        },
        { status: 504, headers: corsHeaders }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

