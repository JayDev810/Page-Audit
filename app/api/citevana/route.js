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
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('path') || 'page-audit';
    const apiKey = (process.env.CITEVANA_API_KEY || 'cv_live_AuUfx52u9IUYjyQysEvuBin7ArAA0_-mMhYAg-65MPc').trim();
    const targetUrl = `https://citevana.com/api/v1/tools/${endpoint}`;

    const bodyText = await request.text();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PageAuditChecklist/2.0'
      },
      body: bodyText
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, {
      status: 502,
      headers: corsHeaders
    });
  }
}

