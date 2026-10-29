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
    const groqKey = (process.env.GROQ_API_KEY || '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').trim();
    let authHeader = request.headers.get('authorization') || '';
    if (!authHeader && groqKey) {
      authHeader = `Bearer ${groqKey}`;
    }

    const bodyText = await request.text();
    const targetUrl = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    return NextResponse.json({ ok: false, error: err.message }, { status: 502, headers: corsHeaders });
  }
}

