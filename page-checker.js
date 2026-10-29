const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runPageCheck(targetUrl, timeoutMs = 30000) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const consoleErrors = [];
  const failedRequests = [];
  const hits = [];

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push({ text: err.message, stack: err.stack });
    });

    page.on('requestfailed', req => {
      failedRequests.push({
        url: req.url(),
        failure: req.failure() ? req.failure().errorText : 'failed'
      });
    });

    page.on('response', resp => {
      if (resp.status() >= 400 && resp.status() !== 404) {
        failedRequests.push({
          url: resp.url(),
          status: resp.status()
        });
      }
    });

    // 1. Initial navigation
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // Allow lazy items and scripts to settle
    await new Promise(r => setTimeout(r, 1500));

    // Scroll through page to trigger lazy loaded images
    await page.evaluate(async () => {
      const distance = 400;
      const totalHeight = document.body.scrollHeight;
      let scrolled = 0;
      while (scrolled < totalHeight) {
        window.scrollBy(0, distance);
        scrolled += distance;
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 1000));

    // Viewports to test
    const viewports = [1440, 1280, 1024, 768, 375];
    const overflowByViewport = {};

    for (const vpWidth of viewports) {
      await page.setViewport({ width: vpWidth, height: 800, isMobile: vpWidth <= 768 });
      await new Promise(r => setTimeout(r, 200));

      const vpData = await page.evaluate((width) => {
        const clientWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const hasOverflow = scrollWidth > clientWidth + 2;

        const overflowing = [];
        if (hasOverflow) {
          document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 2) {
              let sel = el.tagName.toLowerCase();
              if (el.id) sel += '#' + el.id;
              else if (el.className && typeof el.className === 'string') {
                const c = el.className.trim().split(/\s+/).slice(0, 2).join('.');
                if (c) sel += '.' + c;
              }
              const section = el.closest('section, header, footer, .thrv-page-section, main')?.tagName.toLowerCase() || 'content';
              overflowing.push({
                selector: sel,
                right: Math.round(rect.right),
                diff: Math.round(rect.right - clientWidth),
                section: section,
                snippet: (el.innerText || el.getAttribute('alt') || el.tagName).trim().substring(0, 60)
              });
            }
          });
        }

        return {
          width,
          clientWidth,
          scrollWidth,
          hasOverflow,
          overflowing: overflowing.slice(0, 5)
        };
      }, vpWidth);

      overflowByViewport[vpWidth] = vpData;

      if (vpData.hasOverflow) {
        vpData.overflowing.forEach(item => {
          hits.push({
            check: vpWidth <= 480 ? 'Mobile Overflow' : (vpWidth <= 991 ? 'Tablet Overflow' : 'Desktop Overflow'),
            device_width: `${vpWidth}px`,
            selector: item.selector,
            evidence_text: `Canvas overflow ${vpData.scrollWidth}px > ${vpData.clientWidth}px (+${item.diff}px by ${item.selector})`,
            section: item.section
          });
        });
      }
    }

    // Mobile tap targets check at 375px
    await page.setViewport({ width: 375, height: 667, isMobile: true });
    const mobileTapTargets = await page.evaluate(() => {
      const small = [];
      document.querySelectorAll('a, button, input, select').forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
          if (rect.width < 44 || rect.height < 44) {
            let sel = el.tagName.toLowerCase();
            if (el.id) sel += '#' + el.id;
            else if (el.className && typeof el.className === 'string') {
              const c = el.className.trim().split(/\s+/).slice(0, 2).join('.');
              if (c) sel += '.' + c;
            }
            const section = el.closest('section, header, footer, .thrv-page-section, main')?.tagName.toLowerCase() || 'content';
            small.push({
              selector: sel,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              text: el.innerText.trim().substring(0, 30) || el.getAttribute('aria-label') || el.tagName,
              section
            });
          }
        }
      });
      return small;
    });

    mobileTapTargets.slice(0, 8).forEach(t => {
      hits.push({
        check: 'Mobile Tap Target',
        device_width: '375px',
        selector: t.selector,
        evidence_text: `Tap target size ${t.width}x${t.height}px is below minimum 44x44px for "${t.text}"`,
        section: t.section
      });
    });

    // Back to desktop for comprehensive DOM extraction
    await page.setViewport({ width: 1280, height: 900 });

    const domInspection = await page.evaluate(() => {
      // 1. Meta / SEO
      const title = document.querySelector('title')?.innerText?.trim() || '';
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '';

      // 2. Headings
      const headingEls = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const headings = headingEls.map(h => {
        const style = window.getComputedStyle(h);
        const rect = h.getBoundingClientRect();
        return {
          tag: h.tagName.toLowerCase(),
          level: parseInt(h.tagName.substring(1)),
          text: h.innerText.trim(),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          lineHeight: style.lineHeight,
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none'
        };
      });

      // 3. Raw Code / Shortcodes / Tokens in body text
      const bodyText = document.body.innerText || '';
      const shortcodeRegex = /\[\/?([a-z_][a-z0-9_\-]*)(\s+[^\]]*)?\]/gi;
      const rawShortcodes = Array.from(new Set(bodyText.match(shortcodeRegex) || []));
      
      const rawTokens = [];
      const tokenPatterns = [
        { name: 'url_encoded', regex: /(%7B|%22|%3C)/g },
        { name: 'data_css', regex: /data-css=/g },
        { name: 'tcb_form', regex: /__TCB_FORM__/g },
        { name: 'json_string', regex: /\{\s*"[a-zA-Z0-9_\-]+"\s*:/g },
        { name: 'failed_plugin', regex: /There are no [^.]+ to display/gi },
        { name: 'lorem_ipsum', regex: /(lorem ipsum|dolor sit amet|et dolore magna aliqua)/gi }
      ];

      tokenPatterns.forEach(p => {
        const matches = bodyText.match(p.regex);
        if (matches) {
          rawTokens.push({ type: p.name, matches: Array.from(new Set(matches)).slice(0, 3) });
        }
      });

      // 4. Empty containers (>80px tall with no text/media)
      const emptyContainers = [];
      document.querySelectorAll('section, div, article, main').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.height > 80 && rect.width > 120) {
          const hasMedia = el.querySelector('img, svg, video, iframe, canvas');
          const hasText = el.innerText.trim().length > 0;
          if (!hasMedia && !hasText) {
            let sel = el.tagName.toLowerCase();
            if (el.id) sel += '#' + el.id;
            else if (el.className && typeof el.className === 'string') {
              const c = el.className.trim().split(/\s+/).slice(0, 2).join('.');
              if (c) sel += '.' + c;
            }
            emptyContainers.push({
              selector: sel,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              section: el.closest('section, header, footer, main')?.tagName.toLowerCase() || 'body'
            });
          }
        }
      });

      // 5. Images
      const images = Array.from(document.querySelectorAll('img')).map(img => {
        const hasAlt = img.hasAttribute('alt');
        const alt = img.getAttribute('alt') || '';
        const isBroken = img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0);
        return {
          src: (img.getAttribute('src') || img.src || '').substring(0, 100),
          hasAlt,
          alt,
          isBroken,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        };
      });

      // 6. Links
      const links = Array.from(document.querySelectorAll('a')).map(a => {
        const href = a.getAttribute('href');
        const text = a.innerText.trim();
        const isEmptyOrDead = !href || href === '#' || href === 'javascript:void(0)' || href.trim() === '';
        return {
          href: href || '',
          text: text.substring(0, 30),
          isEmptyOrDead
        };
      });

      // 7. Typography & Buttons
      const paragraphs = Array.from(document.querySelectorAll('p')).map(p => {
        const s = window.getComputedStyle(p);
        return {
          text: p.innerText.trim().substring(0, 30),
          fontSize: s.fontSize,
          fontFamily: s.fontFamily,
          color: s.color
        };
      }).filter(p => p.text.length > 0);

      const buttons = Array.from(document.querySelectorAll('button, a.tcb-button-link, a[class*="btn"], a[class*="button"], .tve-btn')).map(b => {
        const s = window.getComputedStyle(b);
        return {
          text: b.innerText.trim().substring(0, 30),
          fontSize: s.fontSize,
          padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
          borderRadius: s.borderRadius,
          fontFamily: s.fontFamily,
          color: s.color,
          backgroundColor: s.backgroundColor
        };
      }).filter(b => b.text.length > 0);

      // Fonts used across all elements
      const fontFamilies = new Set();
      document.querySelectorAll('*').forEach(el => {
        const f = window.getComputedStyle(el).fontFamily;
        if (f) fontFamilies.add(f);
      });

      return {
        title,
        metaDesc,
        canonical,
        headings,
        rawShortcodes,
        rawTokens,
        emptyContainers: emptyContainers.slice(0, 8),
        images,
        links,
        paragraphs: paragraphs.slice(0, 20),
        buttons,
        fontFamilies: Array.from(fontFamilies)
      };
    });

    // Populate hits from DOM inspection
    // A. Headings
    const h1Headings = domInspection.headings.filter(h => h.tag === 'h1' && h.isVisible);
    if (h1Headings.length === 0) {
      hits.push({
        check: 'H1 Count',
        device_width: 'all',
        selector: 'h1',
        evidence_text: 'Zero visible H1 headings found on page',
        section: 'header'
      });
    } else if (h1Headings.length > 1) {
      hits.push({
        check: 'H1 Count',
        device_width: 'all',
        selector: 'h1',
        evidence_text: `Multiple (${h1Headings.length}) visible H1 headings found`,
        section: 'header'
      });
    }

    // Heading hierarchy skips
    for (let i = 0; i < domInspection.headings.length - 1; i++) {
      const cur = domInspection.headings[i];
      const next = domInspection.headings[i + 1];
      if (next.level > cur.level + 1) {
        hits.push({
          check: 'Heading Order',
          device_width: 'all',
          selector: `${cur.tag} + ... + ${next.tag}`,
          evidence_text: `Skipped heading level from ${cur.tag.toUpperCase()} ("${cur.text.substring(0, 25)}") to ${next.tag.toUpperCase()} ("${next.text.substring(0, 25)}")`,
          section: 'content'
        });
      }
    }

    // B. Raw shortcodes & tokens
    domInspection.rawShortcodes.forEach(sc => {
      hits.push({
        check: 'Visible Raw Code',
        device_width: 'all',
        selector: 'body',
        evidence_text: `Unrendered shortcode visible on page: "${sc.substring(0, 80)}"`,
        section: 'content'
      });
    });

    domInspection.rawTokens.forEach(tk => {
      hits.push({
        check: 'Placeholder or Raw Content',
        device_width: 'all',
        selector: 'body',
        evidence_text: `Visible raw token [${tk.type}]: "${tk.matches.join(', ')}"`,
        section: 'content'
      });
    });

    // C. Empty containers
    domInspection.emptyContainers.forEach(ec => {
      hits.push({
        check: 'Empty Container',
        device_width: 'all',
        selector: ec.selector,
        evidence_text: `Empty container block ${ec.width}x${ec.height}px with no text or media`,
        section: ec.section
      });
    });

    // D. Broken images & missing alt
    domInspection.images.filter(img => img.isBroken).forEach(img => {
      hits.push({
        check: 'Broken Image',
        device_width: 'all',
        selector: `img[src*="${img.src.slice(-20)}"]`,
        evidence_text: `Broken image load (natural dimensions 0x0): "${img.src}"`,
        section: 'media'
      });
    });

    // E. Dead links
    const deadLinks = domInspection.links.filter(l => l.isEmptyOrDead);
    if (deadLinks.length > 0) {
      deadLinks.slice(0, 5).forEach(l => {
        hits.push({
          check: 'Links Work',
          device_width: 'all',
          selector: `a[href="${l.href}"]`,
          evidence_text: `Dead link target href="${l.href}" on label "${l.text}"`,
          section: 'links'
        });
      });
    }

    // F. Console errors
    consoleErrors.forEach(err => {
      hits.push({
        check: 'Console Errors',
        device_width: 'all',
        selector: 'script',
        evidence_text: `Unhandled runtime error: ${err.text.substring(0, 100)}`,
        section: 'technical'
      });
    });

    await browser.close();

    return {
      ok: true,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      meta: {
        title: domInspection.title,
        metaDesc: domInspection.metaDesc,
        canonical: domInspection.canonical
      },
      overflowByViewport,
      hits,
      headings: domInspection.headings,
      images: domInspection.images,
      paragraphs: domInspection.paragraphs,
      links: domInspection.links,
      buttons: domInspection.buttons,
      fontFamilies: domInspection.fontFamilies,
      consoleErrorsCount: consoleErrors.length,
      failedRequestsCount: failedRequests.length
    };
  } catch (err) {
    await browser.close();
    return {
      ok: false,
      error: err.message,
      hits
    };
  }
}

if (require.main === module) {
  const targetUrl = process.argv[2] || 'https://elkowirerope.net/';
  runPageCheck(targetUrl).then(res => {
    process.stdout.write(JSON.stringify(res));
  }).catch(err => {
    process.stdout.write(JSON.stringify({ ok: false, error: (err && err.message) || String(err), hits: [] }));
  });
}

module.exports = { runPageCheck };

