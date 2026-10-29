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

function normalizeUrl(urlStr) {
  try {
    let u = urlStr.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      u = 'https://' + u;
    }
    return new URL(u).toString();
  } catch (e) {
    return urlStr;
  }
}

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };

  try {
    const body = await request.json();
    const rawTargetUrl = body.url;
    if (!rawTargetUrl) {
      return NextResponse.json({ ok: false, error: 'Missing target URL', hits: [] }, { status: 400, headers: corsHeaders });
    }

    const targetUrl = normalizeUrl(rawTargetUrl);
    const targetUrlObj = new URL(targetUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return NextResponse.json({
        ok: false,
        error: `Target server returned HTTP ${resp.status}`,
        hits: []
      }, { headers: corsHeaders });
    }

    const html = await resp.text();

    // Check if Cloudflare bot challenge or captcha
    if (resp.status === 403 || html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
      return NextResponse.json({
        ok: false,
        error: 'Target protected by bot challenge; relying on distributed crawler data',
        hits: []
      }, { headers: corsHeaders });
    }

    const hits = [];

    // ── 1. Document Title & Meta Tags ──────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

    // Canonical link
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
                           html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
    const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

    // Viewport meta
    const viewportMatch = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']viewport["']/i);
    const viewportContent = viewportMatch ? viewportMatch[1].trim() : '';
    const hasResponsiveViewport = /width=device-width/i.test(viewportContent) && /initial-scale=1/i.test(viewportContent);

    // Favicon
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i) ||
                         html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
    const hasFavicon = !!faviconMatch;

    // Open Graph
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
    const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']*)["']/i);

    // Template tokens in title / meta
    const templateTokenRegex = /(\{\{[^}]+\}\}|%[A-Z0-9_]+%|\[[A-Z0-9_]+\]|undefined|NaN|Untitled\s*Page|Default\s*Title)/i;
    if (templateTokenRegex.test(title)) {
      hits.push({ check: 'Title & Meta Description', evidence_text: `Unresolved template token detected in <title>: "${title}"` });
    }
    if (templateTokenRegex.test(metaDesc)) {
      hits.push({ check: 'Title & Meta Description', evidence_text: `Unresolved template token detected in meta description: "${metaDesc}"` });
    }

    // Canonical match verification
    if (canonical) {
      try {
        const canUrl = new URL(canonical, targetUrl);
        if (canUrl.hostname.toLowerCase() !== targetUrlObj.hostname.toLowerCase()) {
          hits.push({
            check: 'Canonical URL',
            evidence_text: `Canonical URL points to different domain (${canUrl.hostname}) than target (${targetUrlObj.hostname})`
          });
        }
      } catch (e) {
        hits.push({ check: 'Canonical URL', evidence_text: `Malformed canonical href: "${canonical}"` });
      }
    }

    // ── 2. Headings Analysis (H1–H6) ──────────────────────────────────────────
    const headings = [];
    const headingRegex = /<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(html)) !== null) {
      const tag = hMatch[1].toLowerCase();
      const attrs = hMatch[2];
      const rawInner = hMatch[3].replace(/<[^>]+>/g, '').trim();
      const level = parseInt(tag[1], 10);
      headings.push({ tag, level, text: rawInner, isVisible: !attrs.includes('display: none') && !attrs.includes('hidden') });
    }

    const h1s = headings.filter(h => h.tag === 'h1');
    if (h1s.length === 0) {
      hits.push({ check: 'H1 Count', evidence_text: 'Zero <h1> tags found in document markup' });
    } else if (h1s.length > 1) {
      const previews = h1s.map((h, idx) => `#${idx + 1}: "${h.text.substring(0, 30)}"`).join(', ');
      hits.push({ check: 'H1 Count', evidence_text: `Found ${h1s.length} <h1> tags on the page (${previews})` });
    }

    // Heading Order & Empty Headings
    const emptyHeadings = headings.filter(h => !h.text || h.text.trim().length === 0);
    if (emptyHeadings.length > 0) {
      hits.push({
        check: 'Heading Order',
        evidence_text: `${emptyHeadings.length} empty heading tag(s) with no text content detected (<${emptyHeadings[0].tag.toUpperCase()}>)`
      });
    }

    // Check for skipped levels (e.g. h1 -> h3 skipping h2, h2 -> h4 skipping h3)
    let previousLevel = 0;
    const skippedHierarchies = [];
    for (const h of headings) {
      if (previousLevel > 0 && h.level > previousLevel + 1) {
        skippedHierarchies.push(`H${previousLevel} jumped to H${h.level} ("${h.text.substring(0, 30)}")`);
      }
      previousLevel = h.level;
    }
    if (skippedHierarchies.length > 0) {
      hits.push({
        check: 'Heading Order',
        evidence_text: `Skipped heading level detected: ${skippedHierarchies[0]}`
      });
    }

    // ── 3. Images & Media ──────────────────────────────────────────────────────
    const images = [];
    const imgRegex = /<img\b([^>]*)>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const attrs = imgMatch[1];
      const srcM = attrs.match(/src=["']([^"']*)["']/i);
      const altM = attrs.match(/alt=["']([^"']*)["']/i);
      const widthM = attrs.match(/width=["']([^"']*)["']/i);
      const heightM = attrs.match(/height=["']([^"']*)["']/i);
      const src = srcM ? srcM[1].trim() : '';
      const hasAlt = altM !== null;
      const alt = altM ? altM[1].trim() : '';
      const isDecorative = hasAlt && alt === '';
      const isPlaceholderSrc = /placeholder\.com|via\.placeholder|dummyimage\.com/i.test(src);
      const isBrokenSrc = !src || src === '#' || src === 'about:blank';

      images.push({
        src,
        hasAlt,
        alt,
        isDecorative,
        isBroken: isBrokenSrc || isPlaceholderSrc,
        width: widthM ? widthM[1] : null,
        height: heightM ? heightM[1] : null
      });
    }

    const missingAltList = images.filter(i => !i.hasAlt);
    const genericAltList = images.filter(i => i.hasAlt && !i.isDecorative && /^(image|photo|picture|img|graphic|icon|banner|logo\.[a-z0-9]+|IMG_\d+)$/i.test(i.alt));
    const brokenImgList = images.filter(i => i.isBroken);

    if (missingAltList.length > 0) {
      hits.push({
        check: 'Image Alt Text',
        evidence_text: `${missingAltList.length} of ${images.length} image(s) missing alt attribute completely`
      });
    }
    if (genericAltList.length > 0) {
      hits.push({
        check: 'Image Alt Text',
        evidence_text: `${genericAltList.length} image(s) have uninformative placeholder alt text (e.g. alt="${genericAltList[0].alt}")`
      });
    }
    if (brokenImgList.length > 0) {
      hits.push({
        check: 'Broken Images',
        evidence_text: `${brokenImgList.length} image asset(s) with invalid or placeholder src attribute (${brokenImgList[0].src || 'empty src'})`
      });
    }

    // ── 4. Placeholder & Unfinished Content ───────────────────────────────────
    // Strip scripts, styles, svgs, comments
    const strippedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    const plainText = strippedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Check for lorem ipsum
    const loremMatch = plainText.match(/\b(lorem\s+ipsum|dolor\s+sit\s+amet|consectetur\s+adipiscing|vestibulum\s+ante|sed\s+do\s+eiusmod)\b/i);
    if (loremMatch) {
      hits.push({
        check: 'Placeholder or Empty Content',
        evidence_text: `Lorem ipsum dummy text detected in content: "${loremMatch[0]}"`
      });
    }

    // Check for unfinished developer / editorial placeholders
    const placeholderMatch = plainText.match(/\b(\[TODO\]|TODO:|TBD|COMING\s+SOON|INSERT\s+HERE|ADD\s+CONTENT\s+HERE|SAMPLE\s+TEXT|DRAFT\s+ONLY|PLACEHOLDER\s+TEXT)\b/i);
    if (placeholderMatch) {
      hits.push({
        check: 'Placeholder or Empty Content',
        evidence_text: `Unfinished content placeholder detected: "${placeholderMatch[0]}"`
      });
    }

    // Check for unrendered shortcodes or template tags
    const shortcodeMatch = plainText.match(/(\[contact-form-7[^\]]*\]|\[gravityform[^\]]*\]|\{\{[^}]+\}\}|\[elementor-template[^\]]*\])/i);
    if (shortcodeMatch) {
      hits.push({
        check: 'Placeholder or Empty Content',
        evidence_text: `Unrendered shortcode or template tag detected in visible text: "${shortcodeMatch[0]}"`
      });
    }

    // ── 5. Links & Buttons Analysis ───────────────────────────────────────────
    const links = [];
    const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let lMatch;
    while ((lMatch = linkRegex.exec(html)) !== null) {
      const attrs = lMatch[1];
      const linkText = lMatch[2].replace(/<[^>]+>/g, '').trim();
      const hrefM = attrs.match(/href=["']([^"']*)["']/i);
      const href = hrefM ? hrefM[1].trim() : '';
      links.push({ href, text: linkText });
    }

    // Empty links
    const emptyLinks = links.filter(l => !l.href || l.href === '#' || l.href === 'javascript:void(0)' || l.href === 'javascript:;' || l.href === 'about:blank');
    if (emptyLinks.length > 0) {
      const sample = emptyLinks[0];
      hits.push({
        check: 'Links Work',
        evidence_text: `${emptyLinks.length} empty or void link(s) detected (e.g. href="${sample.href}" on "${sample.text || 'unlabeled link'}")`
      });
    }

    // In-page hash jump links (#services, #contact, etc.)
    const inPageHashLinks = links.filter(l => l.href.startsWith('#') && l.href.length > 1);
    const brokenHashLinks = [];
    for (const hl of inPageHashLinks) {
      const targetId = hl.href.substring(1);
      // Check if element with id="targetId" or name="targetId" exists in html
      const idRegex = new RegExp(`\\b(?:id|name)=["']${targetId}["']`, 'i');
      if (!idRegex.test(html)) {
        brokenHashLinks.push(hl);
      }
    }
    if (brokenHashLinks.length > 0) {
      hits.push({
        check: 'Links Work',
        evidence_text: `In-page jump link target missing: href="${brokenHashLinks[0].href}" has no matching id="${brokenHashLinks[0].href.slice(1)}" in DOM`
      });
    }

    // Buttons
    const buttons = [];
    const btnRegex = /<(?:button\b([^>]*)>([\s\S]*?)<\/button>|input\b([^>]*type=["'](?:button|submit)["'][^>]*)>)/gi;
    let bMatch;
    while ((bMatch = btnRegex.exec(html)) !== null) {
      const attrs = bMatch[1] || bMatch[3] || '';
      const inner = (bMatch[2] || '').replace(/<[^>]+>/g, '').trim();
      const valM = attrs.match(/value=["']([^"']*)["']/i);
      const ariaM = attrs.match(/aria-label=["']([^"']*)["']/i);
      const label = inner || (valM ? valM[1] : '') || (ariaM ? ariaM[1] : '');
      buttons.push({ label, hasLabel: !!label.trim() });
    }

    const emptyButtons = buttons.filter(b => !b.hasLabel);
    if (emptyButtons.length > 0) {
      hits.push({
        check: 'Button Style',
        evidence_text: `${emptyButtons.length} button element(s) missing accessible text label or value`
      });
    }

    // ── 6. Fonts and Typography Clues ─────────────────────────────────────────
    const fontFamilies = [];
    const googleFontLinks = [];
    const gFontRegex = /href=["'](https?:\/\/fonts\.googleapis\.com\/css2?[^"']*)["']/gi;
    let gfMatch;
    while ((gfMatch = gFontRegex.exec(html)) !== null) {
      googleFontLinks.push(gfMatch[1]);
      const familyM = gfMatch[1].match(/family=([^&:]+)/g);
      if (familyM) {
        familyM.forEach(f => {
          const cleanF = decodeURIComponent(f.replace('family=', '')).replace(/\+/g, ' ');
          if (!fontFamilies.includes(cleanF)) fontFamilies.push(cleanF);
        });
      }
    }

    // Scan inline style font-family declarations
    const fontFamStyleRegex = /font-family\s*:\s*([^;"]+)/gi;
    let ffMatch;
    while ((ffMatch = fontFamStyleRegex.exec(html)) !== null) {
      const famName = ffMatch[1].split(',')[0].replace(/['"]/g, '').trim();
      if (famName && !fontFamilies.includes(famName) && !['inherit', 'initial', 'sans-serif', 'serif', 'monospace'].includes(famName.toLowerCase())) {
        fontFamilies.push(famName);
      }
    }

    // ── 7. Fixed Widths That Threaten Mobile Layout ───────────────────────────
    const fixedWidthThreats = [];
    const fixedWidthRegex = /style=["'][^"']*(?:min-width|width)\s*:\s*([6-9]\d{2,}|\d{4,})px[^"']*["']/gi;
    let fwMatch;
    while ((fwMatch = fixedWidthRegex.exec(html)) !== null) {
      fixedWidthThreats.push(fwMatch[0]);
    }
    if (fixedWidthThreats.length > 0) {
      hits.push({
        check: 'Mobile Overflow',
        evidence_text: `Hardcoded desktop width in inline styles threatens mobile layout: ${fixedWidthThreats[0].substring(0, 50)}`
      });
    }

    return NextResponse.json({
      ok: true,
      mode: 'direct-html-parser',
      url: targetUrl,
      meta: {
        title,
        titleLength: title.length,
        metaDesc,
        metaDescLength: metaDesc.length,
        canonical,
        viewportContent,
        hasResponsiveViewport,
        hasFavicon,
        openGraph: {
          title: ogTitleMatch ? ogTitleMatch[1] : null,
          description: ogDescMatch ? ogDescMatch[1] : null,
          image: ogImageMatch ? ogImageMatch[1] : null,
          url: ogUrlMatch ? ogUrlMatch[1] : null
        }
      },
      headings,
      h1s,
      emptyHeadings,
      skippedHierarchies,
      images: {
        total: images.length,
        items: images.slice(0, 50),
        missingAltCount: missingAltList.length,
        genericAltCount: genericAltList.length,
        decorativeAltCount: images.filter(i => i.isDecorative).length,
        brokenImgCount: brokenImgList.length
      },
      links: {
        total: links.length,
        emptyLinksCount: emptyLinks.length,
        brokenHashLinksCount: brokenHashLinks.length
      },
      buttons: {
        total: buttons.length,
        emptyButtonsCount: emptyButtons.length
      },
      typography: {
        fontFamilies,
        googleFontLinks
      },
      layoutThreats: fixedWidthThreats,
      hits,
      // Clear distinction: this is static HTML parsing, not rendered browser execution
      renderedBrowserTelemetry: false
    }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      hits: []
    }, { headers: corsHeaders });
  }
}
