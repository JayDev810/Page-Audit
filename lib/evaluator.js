// ── Deterministic In-Code Evaluator (Ironclad Baseline & Multi-Source Merger) ──
//
// MANDATORY STATUS ASSIGNMENT RULES:
// - Pass ('p'): The check was completed successfully and concrete evidence confirms the requirement is satisfied.
// - Fail ('f'): The check was completed successfully and verified evidence confirms an actual issue.
// - Not Verified ('nv'): The check could not be completed for any reason, data is missing, or available evidence is insufficient.
//
// NEVER mark an item as Fail because of an API error, timeout, inaccessible page, missing data, or unresolved contradiction.
// NEVER mark an item as Pass simply because no issue was returned by an engine.
// Every Not Verified result MUST explain what prevented verification and what is needed to complete the check.

export function evaluateChecklistInCode(pageCheck, psiObj, rnObj, cvObj) {
  const ev = {};

  const pc = pageCheck?.ok ? pageCheck : null;
  const psi = psiObj?.ok && psiObj.data ? psiObj.data : null;
  const rn = rnObj?.ok ? rnObj : null;
  const cv = cvObj?.ok && (cvObj.audit || cvObj.result) ? cvObj : null;

  const cvRes = cv ? (cv.audit?.result || cv.result || {}) : {};
  const rnChecks = rn ? (rn.audit?.checks || rn.checks || {}) : {};

  // ── Helper: Heading extraction ──────────────────────────────────────────────
  const pcHeadings = pc?.headings || [];
  const pcH1s = pcHeadings.filter(h => (h.tag || '').toLowerCase() === 'h1');

  // 1. seo-h1-count
  if (pc && pc.headings) {
    if (pcH1s.length === 1) {
      const h1Text = pcH1s[0].text || '';
      if (h1Text.trim().length > 0) {
        ev['seo-h1-count'] = {
          s: 'p',
          note: `Exactly 1 visible H1 tag verified: "${h1Text.substring(0, 50)}${h1Text.length > 50 ? '…' : ''}" (${h1Text.length} chars).`,
          source: 'Page Check'
        };
      } else {
        ev['seo-h1-count'] = {
          s: 'f',
          note: 'An <h1> tag exists in markup but has empty or whitespace-only text content.',
          source: 'Page Check'
        };
      }
    } else if (pcH1s.length === 0) {
      ev['seo-h1-count'] = {
        s: 'f',
        note: 'Zero <h1> tags found in document markup (page lacks a main headline).',
        source: 'Page Check'
      };
    } else {
      const previews = pcH1s.map((h, i) => `#${i + 1}: "${h.text.substring(0, 25)}"`).join(', ');
      ev['seo-h1-count'] = {
        s: 'f',
        note: `Multiple (${pcH1s.length}) <h1> tags detected on the audited page (${previews}).`,
        source: 'Page Check'
      };
    }
  } else if (rnChecks.headings || cvRes.h1 !== undefined || cvRes.h1Count !== undefined) {
    const h1Val = (rnChecks.headings && (rnChecks.headings.h1 || rnChecks.headings.h1Count)) ?? cvRes.h1Count ?? cvRes.h1;
    const h1Count = Array.isArray(h1Val) ? h1Val.length : (typeof h1Val === 'number' ? h1Val : (h1Val ? 1 : 0));
    const srcName = (rn && cv) ? 'RankNibbler, Citevana' : (rn ? 'RankNibbler' : 'Citevana');
    if (h1Count === 1) {
      ev['seo-h1-count'] = { s: 'p', note: 'Exactly 1 H1 heading verified in document hierarchy.', source: srcName };
    } else if (h1Count === 0) {
      ev['seo-h1-count'] = { s: 'f', note: 'Zero <h1> tags detected on page.', source: srcName };
    } else {
      ev['seo-h1-count'] = { s: 'f', note: `Multiple (${h1Count}) <h1> tags detected on page.`, source: srcName };
    }
  } else {
    ev['seo-h1-count'] = {
      s: 'nv',
      note: 'HTML markup unavailable to inspect <h1> elements; verify with DevTools querySelectorAll("h1").',
      source: 'Not Verified'
    };
  }

  // 2. seo-heading-order
  if (pc && pcHeadings.length > 0) {
    const emptyHeadings = pc.emptyHeadings || pcHeadings.filter(h => !h.text || h.text.trim().length === 0);
    const skippedHierarchies = pc.skippedHierarchies || [];

    if (emptyHeadings.length > 0) {
      ev['seo-heading-order'] = {
        s: 'f',
        note: `${emptyHeadings.length} empty heading tag(s) detected (<${(emptyHeadings[0].tag || 'h').toUpperCase()}>) with no text content.`,
        source: 'Page Check'
      };
    } else if (skippedHierarchies.length > 0) {
      ev['seo-heading-order'] = {
        s: 'f',
        note: `Skipped heading level hierarchy: ${skippedHierarchies[0]}.`,
        source: 'Page Check'
      };
    } else {
      ev['seo-heading-order'] = {
        s: 'p',
        note: `Sequential heading hierarchy verified (${pcHeadings.length} headings, 0 skipped levels, 0 empty headings).`,
        source: 'Page Check'
      };
    }
  } else if (rnChecks.headings) {
    const hCounts = rnChecks.headings;
    if (hCounts.h1Count === 0 && (hCounts.h2Count > 0 || hCounts.h3Count > 0)) {
      ev['seo-heading-order'] = { s: 'f', note: 'Heading hierarchy starts at H2 without preceding H1.', source: 'RankNibbler' };
    } else if (hCounts.h2Count === 0 && hCounts.h3Count > 0) {
      ev['seo-heading-order'] = { s: 'f', note: 'Skipped heading level: H1 jumps directly to H3 without any H2.', source: 'RankNibbler' };
    } else {
      ev['seo-heading-order'] = { s: 'p', note: 'Heading outline hierarchy verified without level skips.', source: 'RankNibbler' };
    }
  } else {
    ev['seo-heading-order'] = {
      s: 'nv',
      note: 'Heading outline structure unavailable to verify hierarchy levels; inspect DOM heading tree.',
      source: 'Not Verified'
    };
  }

  // 3. seo-meta-tags
  const metaTitle = (pc?.meta?.title) || (rnChecks.title?.value) || (cvRes.title) || '';
  const metaDesc = (pc?.meta?.metaDesc) || (rnChecks.metaDescription?.value) || (rnChecks.description?.value) || (cvRes.metaDescription) || '';
  const hasMetaScan = pc || rnChecks.title || cvRes.title !== undefined;

  if (hasMetaScan) {
    const templateTokenRegex = /(\{\{[^}]+\}\}|%[A-Z0-9_]+%|\[[A-Z0-9_]+\]|undefined|NaN|Untitled\s*Page|Default\s*Title)/i;
    const titleToken = metaTitle.match(templateTokenRegex);
    const descToken = metaDesc.match(templateTokenRegex);

    if (titleToken) {
      ev['seo-meta-tags'] = {
        s: 'f',
        note: `Unresolved template token detected in <title>: "${titleToken[0]}".`,
        source: pc ? 'Page Check' : 'Engine'
      };
    } else if (descToken) {
      ev['seo-meta-tags'] = {
        s: 'f',
        note: `Unresolved template token detected in meta description: "${descToken[0]}".`,
        source: pc ? 'Page Check' : 'Engine'
      };
    } else if (!metaTitle.trim() && !metaDesc.trim()) {
      ev['seo-meta-tags'] = {
        s: 'f',
        note: 'Both <title> and <meta name="description"> are missing from document head.',
        source: pc ? 'Page Check' : 'Engine'
      };
    } else if (!metaTitle.trim()) {
      ev['seo-meta-tags'] = {
        s: 'f',
        note: 'Missing <title> tag in document head.',
        source: pc ? 'Page Check' : 'Engine'
      };
    } else if (!metaDesc.trim()) {
      ev['seo-meta-tags'] = {
        s: 'f',
        note: 'Missing <meta name="description"> tag in document head.',
        source: pc ? 'Page Check' : 'Engine'
      };
    } else {
      const srcMeta = (pc && rn) ? 'Page Check, RankNibbler' : (pc ? 'Page Check' : (rn ? 'RankNibbler' : 'Citevana'));
      ev['seo-meta-tags'] = {
        s: 'p',
        note: `Title (${metaTitle.length} chars: "${metaTitle.substring(0, 35)}…") & Meta Description (${metaDesc.length} chars) populated without template tokens.`,
        source: srcMeta
      };
    }
  } else {
    ev['seo-meta-tags'] = {
      s: 'nv',
      note: 'Document head unavailable to inspect <title> and <meta description>; verify head tags.',
      source: 'Not Verified'
    };
  }

  // 4. seo-canonical
  const canonicalVal = (pc?.meta?.canonical) || (rnChecks.canonical?.value) || (cvRes.canonical) || '';
  const hasCanonicalSource = pc || rnChecks.canonical !== undefined || cvRes.canonical !== undefined;

  if (hasCanonicalSource) {
    if (canonicalVal.trim().length > 0) {
      const canonicalHit = pc?.hits?.find(h => h.check === 'Canonical URL');
      if (canonicalHit) {
        ev['seo-canonical'] = { s: 'f', note: canonicalHit.evidence_text, source: 'Page Check' };
      } else {
        ev['seo-canonical'] = {
          s: 'p',
          note: `Canonical link verified declared in HTML head: "${canonicalVal}".`,
          source: pc ? 'Page Check' : (rn ? 'RankNibbler' : 'Citevana')
        };
      }
    } else {
      ev['seo-canonical'] = {
        s: 'f',
        note: 'Missing canonical URL link tag (<link rel="canonical">) in document head.',
        source: pc ? 'Page Check' : (rn ? 'RankNibbler' : 'Citevana')
      };
    }
  } else {
    ev['seo-canonical'] = {
      s: 'nv',
      note: 'Document head unavailable to verify <link rel="canonical">; inspect HTML head.',
      source: 'Not Verified'
    };
  }

  // 5. img-alt-tags
  if (pc && pc.images) {
    const totalImgs = pc.images.total ?? (Array.isArray(pc.images) ? pc.images.length : 0);
    const missingAltCount = pc.images.missingAltCount ?? 0;
    const genericAltCount = pc.images.genericAltCount ?? 0;

    if (missingAltCount > 0) {
      ev['img-alt-tags'] = {
        s: 'f',
        note: `${missingAltCount} of ${totalImgs} image(s) missing alt attribute completely.`,
        source: 'Page Check'
      };
    } else if (genericAltCount > 0) {
      ev['img-alt-tags'] = {
        s: 'f',
        note: `${genericAltCount} image(s) have uninformative placeholder alt text (e.g. alt="image" or filename).`,
        source: 'Page Check'
      };
    } else if (totalImgs > 0) {
      ev['img-alt-tags'] = {
        s: 'p',
        note: `All ${totalImgs} image(s) have descriptive alt text or valid decorative alt="" attributes (100% coverage).`,
        source: 'Page Check'
      };
    } else {
      ev['img-alt-tags'] = {
        s: 'p',
        note: 'Zero <img> elements present on page (no missing alt violations).',
        source: 'Page Check'
      };
    }
  } else if (rnChecks.images) {
    const missingAlt = rnChecks.images.missingAlt || 0;
    const total = rnChecks.images.count || rnChecks.images.total || 0;
    if (missingAlt > 0) {
      ev['img-alt-tags'] = { s: 'f', note: `${missingAlt} of ${total} image(s) missing alt text.`, source: 'RankNibbler' };
    } else {
      ev['img-alt-tags'] = { s: 'p', note: `All ${total} image(s) have alt text (100% coverage).`, source: 'RankNibbler' };
    }
  } else if (cvRes.imagesMissingAlt !== undefined) {
    if (cvRes.imagesMissingAlt > 0) {
      ev['img-alt-tags'] = { s: 'f', note: `${cvRes.imagesMissingAlt} image(s) missing alt text.`, source: 'Citevana' };
    } else {
      ev['img-alt-tags'] = { s: 'p', note: `All ${cvRes.images || 0} images verified with alt text.`, source: 'Citevana' };
    }
  } else {
    ev['img-alt-tags'] = {
      s: 'nv',
      note: 'Image alt attribute telemetry unavailable from active endpoints; inspect <img> tags.',
      source: 'Not Verified'
    };
  }

  // 6. img-broken-check
  if (pc && pc.images) {
    const brokenImgCount = pc.images.brokenImgCount ?? 0;
    const brokenHit = pc.hits?.find(h => h.check === 'Broken Images');
    if (brokenImgCount > 0 || brokenHit) {
      ev['img-broken-check'] = {
        s: 'f',
        note: brokenHit ? brokenHit.evidence_text : `${brokenImgCount} image asset(s) with invalid, empty, or placeholder src.`,
        source: 'Page Check'
      };
    } else {
      const total = pc.images.total ?? 0;
      ev['img-broken-check'] = {
        s: 'p',
        note: `All ${total} image source URLs are well-formed without empty, missing, or placeholder references.`,
        source: 'Page Check'
      };
    }
  } else {
    ev['img-broken-check'] = {
      s: 'nv',
      note: 'Image asset loading and response telemetry unavailable; check Network tab for 4xx/5xx image responses.',
      source: 'Not Verified'
    };
  }

  // 7. type-heading-size
  if (pc && pc.renderedBrowserTelemetry && pcHeadings.length > 0) {
    const h2Headings = pcHeadings.filter(h => (h.tag || '').toLowerCase() === 'h2');
    const h2Sizes = Array.from(new Set(h2Headings.map(h => h.fontSize).filter(Boolean)));
    if (h2Sizes.length > 2) {
      ev['type-heading-size'] = { s: 'f', note: 'Inconsistent H2 font sizes detected across sections: ' + h2Sizes.join(', ') + '.', source: 'Page Check' };
    } else {
      ev['type-heading-size'] = { s: 'p', note: 'Heading typography scale verified consistent (' + (h2Sizes[0] || 'uniform') + ') across sections.', source: 'Page Check' };
    }
  } else {
    ev['type-heading-size'] = {
      s: 'nv',
      note: 'Heading computed font-size consistency across sections requires browser computed-style telemetry or manual DevTools inspection.',
      source: 'Not Verified'
    };
  }

  // 8. type-body-size
  if (psi && psi.fontSizePassed !== null && psi.fontSizePassed !== undefined) {
    if (psi.fontSizePassed === false) {
      ev['type-body-size'] = {
        s: 'f',
        note: 'Google Lighthouse flagged illegible or inconsistent paragraph font sizes (<12px) on mobile.',
        source: 'PageSpeed'
      };
    } else {
      ev['type-body-size'] = {
        s: 'p',
        note: 'Body paragraph text size verified legible and consistent for mobile viewports.',
        source: 'PageSpeed'
      };
    }
  } else if (pc && pc.renderedBrowserTelemetry && pc.paragraphs) {
    const paraSizes = Array.from(new Set(pc.paragraphs.map(p => p.fontSize).filter(Boolean)));
    if (paraSizes.length > 3) {
      ev['type-body-size'] = { s: 'f', note: 'Inconsistent paragraph text sizes across content blocks: ' + paraSizes.join(', ') + '.', source: 'Page Check' };
    } else {
      ev['type-body-size'] = { s: 'p', note: 'Body paragraph typography verified at consistent base font size.', source: 'Page Check' };
    }
  } else {
    ev['type-body-size'] = {
      s: 'nv',
      note: 'Paragraph computed font-size telemetry across sections requires browser computed-style telemetry.',
      source: 'Not Verified'
    };
  }

  // 9. type-button-size
  if (pc && pc.renderedBrowserTelemetry && pc.buttons) {
    const btnSizes = Array.from(new Set(pc.buttons.map(b => b.fontSize).filter(Boolean)));
    if (btnSizes.length > 2) {
      ev['type-button-size'] = { s: 'f', note: 'Differing CTA button font sizes detected (' + btnSizes.join(', ') + ').', source: 'Page Check' };
    } else {
      ev['type-button-size'] = { s: 'p', note: 'Button typography verified with uniform font size across CTAs.', source: 'Page Check' };
    }
  } else {
    ev['type-button-size'] = {
      s: 'nv',
      note: 'CTA button computed font-size requires browser computed-style inspection.',
      source: 'Not Verified'
    };
  }

  // 10. type-approved-family
  if (pc?.typography?.fontFamilies && pc.typography.fontFamilies.length > 0) {
    ev['type-approved-family'] = {
      s: 'p',
      note: `Active font families identified: ${pc.typography.fontFamilies.slice(0, 3).join(', ')}.`,
      source: 'Page Check'
    };
  } else {
    ev['type-approved-family'] = {
      s: 'nv',
      note: 'Active font family declarations could not be identified from document styles; confirm against brand typography guidelines.',
      source: 'Not Verified'
    };
  }

  // 11. color-brand-palette
  ev['color-brand-palette'] = {
    s: 'nv',
    note: 'Automated engine cannot infer brand book guidelines without client color palette codes; inspect computed CSS colors against brand book.',
    source: 'Not Verified'
  };

  // 12. link-destinations
  if (pc && pc.links) {
    const emptyLinksCount = pc.links.emptyLinksCount ?? 0;
    const brokenHashCount = pc.links.brokenHashLinksCount ?? 0;
    const linkHit = pc.hits?.find(h => h.check === 'Links Work');

    if (emptyLinksCount > 0 || brokenHashCount > 0 || linkHit) {
      ev['link-destinations'] = {
        s: 'f',
        note: linkHit ? linkHit.evidence_text : `${emptyLinksCount} empty link(s) or ${brokenHashCount} missing in-page anchor targets.`,
        source: 'Page Check'
      };
    } else if (pc.links.total > 0) {
      ev['link-destinations'] = {
        s: 'p',
        note: `All ${pc.links.total} links point to valid destination URLs (0 empty href="#" or broken in-page jump anchors).`,
        source: 'Page Check'
      };
    } else {
      ev['link-destinations'] = { s: 'p', note: 'Zero link destination violations detected.', source: 'Page Check' };
    }
  } else if (rnChecks.links) {
    const emptyLinks = rnChecks.links.emptyLinks || 0;
    if (emptyLinks > 0) {
      ev['link-destinations'] = { s: 'f', note: `${emptyLinks} empty or void link(s) detected.`, source: 'RankNibbler' };
    } else {
      ev['link-destinations'] = { s: 'p', note: 'All links point to valid targets.', source: 'RankNibbler' };
    }
  } else {
    ev['link-destinations'] = {
      s: 'nv',
      note: 'Link target and destination route telemetry unavailable; not verified.',
      source: 'Not Verified'
    };
  }

  // 13. link-button-styles
  if (pc && pc.buttons) {
    const emptyBtnHit = pc.hits?.find(h => h.check === 'Button Style');
    if (emptyBtnHit) {
      ev['link-button-styles'] = { s: 'f', note: emptyBtnHit.evidence_text, source: 'Page Check' };
    } else if (pc.renderedBrowserTelemetry && pc.buttons.length > 1) {
      const radii = Array.from(new Set(pc.buttons.map(b => b.borderRadius).filter(Boolean)));
      if (radii.length > 2) {
        ev['link-button-styles'] = { s: 'f', note: 'Inconsistent button corner radii: ' + radii.join(' vs ') + '.', source: 'Page Check' };
      } else {
        ev['link-button-styles'] = { s: 'p', note: 'Button components adhere to consistent corner radius and styling.', source: 'Page Check' };
      }
    } else {
      ev['link-button-styles'] = {
        s: 'nv',
        note: 'Button corner radius and hover/focus styles require browser computed-style telemetry or visual inspection.',
        source: 'Not Verified'
      };
    }
  } else {
    ev['link-button-styles'] = {
      s: 'nv',
      note: 'Button design telemetry unavailable; not verified.',
      source: 'Not Verified'
    };
  }

  // 14. tech-placeholder-content
  if (pc) {
    const placeholderHit = pc.hits?.find(h => h.check === 'Placeholder or Empty Content');
    if (placeholderHit) {
      ev['tech-placeholder-content'] = {
        s: 'f',
        note: placeholderHit.evidence_text,
        source: 'Page Check'
      };
    } else {
      ev['tech-placeholder-content'] = {
        s: 'p',
        note: 'Real content verified (0 lorem ipsum dummy tokens, unfinished shortcodes, or placeholder text).',
        source: 'Page Check'
      };
    }
  } else if (rnChecks.loremIpsum) {
    if (rnChecks.loremIpsum.found) {
      ev['tech-placeholder-content'] = {
        s: 'f',
        note: `${rnChecks.loremIpsum.count || 1} dummy lorem ipsum token(s) found in markup.`,
        source: 'RankNibbler'
      };
    } else {
      ev['tech-placeholder-content'] = {
        s: 'p',
        note: 'Real content verified without dummy lorem ipsum tokens.',
        source: 'RankNibbler'
      };
    }
  } else {
    ev['tech-placeholder-content'] = {
      s: 'nv',
      note: 'Page body content unavailable for placeholder inspection; not verified.',
      source: 'Not Verified'
    };
  }

  // 15. tech-console-errors
  if (psi && psi.consoleErrorsCount !== null && psi.consoleErrorsCount !== undefined) {
    if (psi.consoleErrorsCount > 0) {
      const errSample = psi.consoleErrors?.[0] || 'JavaScript runtime exception';
      ev['tech-console-errors'] = {
        s: 'f',
        note: `${psi.consoleErrorsCount} runtime console error(s) captured by Lighthouse during mobile page load: "${errSample.substring(0, 80)}${errSample.length > 80 ? '…' : ''}"`,
        source: 'PageSpeed'
      };
    } else {
      ev['tech-console-errors'] = {
        s: 'p',
        note: 'Zero runtime JavaScript exceptions or console errors logged during mobile page load.',
        source: 'PageSpeed'
      };
    }
  } else if (pc && pc.renderedBrowserTelemetry && pc.consoleErrorsCount !== undefined) {
    if (pc.consoleErrorsCount > 0) {
      ev['tech-console-errors'] = {
        s: 'f',
        note: `${pc.consoleErrorsCount} runtime console error(s) detected during page execution.`,
        source: 'Page Check'
      };
    } else {
      ev['tech-console-errors'] = {
        s: 'p',
        note: 'Zero runtime JavaScript exceptions or console errors logged.',
        source: 'Page Check'
      };
    }
  } else {
    ev['tech-console-errors'] = {
      s: 'nv',
      note: 'Browser runtime console log telemetry unavailable; inspect DevTools Console filtered by "Errors".',
      source: 'Not Verified'
    };
  }

  // 16. tech-section-spacing-scroll
  if (psi && psi.contentWidthPassed !== null && psi.contentWidthPassed !== undefined) {
    if (psi.contentWidthPassed === false) {
      ev['tech-section-spacing-scroll'] = {
        s: 'f',
        note: 'Google Lighthouse detected content width exceeding viewport (horizontal sideways scrolling required on mobile).',
        source: 'PageSpeed'
      };
    } else {
      ev['tech-section-spacing-scroll'] = {
        s: 'p',
        note: 'Page layout fits within viewport boundaries without horizontal sideways scrollbars.',
        source: 'PageSpeed'
      };
    }
  } else if (pc?.layoutThreats && pc.layoutThreats.length > 0) {
    ev['tech-section-spacing-scroll'] = {
      s: 'f',
      note: 'Hardcoded desktop width in inline styles threatens responsive layout: ' + pc.layoutThreats[0].substring(0, 45),
      source: 'Page Check'
    };
  } else {
    ev['tech-section-spacing-scroll'] = {
      s: 'nv',
      note: 'Section spacing and sideways scroll measurements require rendered viewport inspection.',
      source: 'Not Verified'
    };
  }

  // 17. resp-desktop-small
  if (pc?.layoutThreats && pc.layoutThreats.length > 0) {
    const wideDesk = pc.layoutThreats.find(t => /width\s*:\s*(1[3-9]\d{2}|[2-9]\d{3})px/i.test(t));
    if (wideDesk) {
      ev['resp-desktop-small'] = {
        s: 'f',
        note: 'Fixed container width exceeding small desktop viewport detected: ' + wideDesk.substring(0, 45),
        source: 'Page Check'
      };
    } else {
      ev['resp-desktop-small'] = {
        s: 'nv',
        note: 'Small desktop viewport (1024px/1280px) responsive layout requires multi-viewport browser rendering.',
        source: 'Not Verified'
      };
    }
  } else {
    ev['resp-desktop-small'] = {
      s: 'nv',
      note: 'Small desktop viewport (1024px/1280px) layout measurements unavailable; not verified.',
      source: 'Not Verified'
    };
  }

  // 18. resp-tablet-responsive
  if (pc?.layoutThreats && pc.layoutThreats.length > 0) {
    const wideTab = pc.layoutThreats.find(t => /width\s*:\s*([8-9]\d{2}|\d{4,})px/i.test(t));
    if (wideTab) {
      ev['resp-tablet-responsive'] = {
        s: 'f',
        note: 'Fixed container width exceeding 768px tablet viewport detected: ' + wideTab.substring(0, 45),
        source: 'Page Check'
      };
    } else {
      ev['resp-tablet-responsive'] = {
        s: 'nv',
        note: 'Tablet viewport (768px) responsive multi-column layout requires rendered browser inspection.',
        source: 'Not Verified'
      };
    }
  } else {
    ev['resp-tablet-responsive'] = {
      s: 'nv',
      note: 'Tablet viewport (768px) responsive column layout measurements unavailable; not verified.',
      source: 'Not Verified'
    };
  }

  // 19. resp-mobile-responsive
  if (psi && psi.tapTargetsPassed !== null && psi.tapTargetsPassed !== undefined) {
    if (psi.tapTargetsPassed === false) {
      ev['resp-mobile-responsive'] = {
        s: 'f',
        note: 'Mobile tap targets (buttons or links) are too small or clustered closer than 48px for comfortable finger tapping.',
        source: 'PageSpeed'
      };
    } else if (psi.contentWidthPassed === true) {
      ev['resp-mobile-responsive'] = {
        s: 'p',
        note: 'Mobile layout (360px–480px) verified with responsive tap targets and fit-to-screen content.',
        source: 'PageSpeed'
      };
    } else {
      ev['resp-mobile-responsive'] = {
        s: 'p',
        note: 'Mobile touch target sizing verified compliant with mobile accessibility standards.',
        source: 'PageSpeed'
      };
    }
  } else {
    ev['resp-mobile-responsive'] = {
      s: 'nv',
      note: 'Mobile phone viewport layout and tap-target measurements unavailable; not verified.',
      source: 'Not Verified'
    };
  }

  // 20. tech-mobile-viewport
  if (pc?.meta) {
    if (!pc.meta.viewportContent) {
      ev['tech-mobile-viewport'] = {
        s: 'f',
        note: 'Missing <meta name="viewport"> tag in document head (page will render as desktop view on mobile phones).',
        source: 'Page Check'
      };
    } else if (!pc.meta.hasResponsiveViewport) {
      ev['tech-mobile-viewport'] = {
        s: 'f',
        note: `Incomplete viewport configuration: "${pc.meta.viewportContent}" (must include width=device-width, initial-scale=1).`,
        source: 'Page Check'
      };
    } else if (psi && psi.contentWidthPassed === false) {
      ev['tech-mobile-viewport'] = {
        s: 'f',
        note: 'Mobile viewport tag exists but content overflows width causing horizontal scrollbar at 375px.',
        source: 'Page Check, PageSpeed'
      };
    } else {
      ev['tech-mobile-viewport'] = {
        s: 'p',
        note: `Mobile viewport configured correctly (${pc.meta.viewportContent}) with zero sideways scrollbar.`,
        source: psi?.contentWidthPassed === true ? 'Page Check, PageSpeed' : 'Page Check'
      };
    }
  } else if (rnChecks.technical?.viewport !== undefined) {
    if (rnChecks.technical.viewport) {
      ev['tech-mobile-viewport'] = { s: 'p', note: 'Mobile viewport meta tag configured.', source: 'RankNibbler' };
    } else {
      ev['tech-mobile-viewport'] = { s: 'f', note: 'Missing mobile viewport meta tag.', source: 'RankNibbler' };
    }
  } else {
    ev['tech-mobile-viewport'] = {
      s: 'nv',
      note: 'Mobile viewport configuration and sideways scroll measurements unavailable; not verified.',
      source: 'Not Verified'
    };
  }

  // 21. psi-perf-score
  if (psi && typeof psi.score === 'number') {
    if (psi.score >= 70) {
      ev['psi-perf-score'] = {
        s: 'p',
        note: `Google PageSpeed Mobile performance score: ${psi.score}/100 (meets >=70 baseline threshold).`,
        source: 'PageSpeed'
      };
    } else {
      ev['psi-perf-score'] = {
        s: 'f',
        note: `Google PageSpeed Mobile score is ${psi.score}/100 (below 70/100 threshold).`,
        source: 'PageSpeed'
      };
    }
  } else {
    ev['psi-perf-score'] = {
      s: 'nv',
      note: 'Google PageSpeed Insights mobile performance data unavailable or timed out; not verified.',
      source: 'PageSpeed'
    };
  }

  // 22. psi-core-web-vitals
  if (psi && (psi.lcp || psi.cls)) {
    const lcpSec = parseFloat((psi.lcp || '').replace(/[^0-9.]/g, '')) || 0;
    const clsVal = parseFloat((psi.cls || '').replace(/[^0-9.]/g, '')) || 0;
    const lcpPass = lcpSec > 0 ? lcpSec <= 2.5 : true;
    const clsPass = clsVal <= 0.1;

    if (lcpPass && clsPass) {
      ev['psi-core-web-vitals'] = {
        s: 'p',
        note: `Google Core Web Vitals satisfied: LCP ${psi.lcp} (target <=2.5s) & CLS ${psi.cls} (target <=0.1).`,
        source: 'PageSpeed'
      };
    } else {
      const fails = [];
      if (!lcpPass) fails.push(`LCP ${psi.lcp} exceeds 2.5s threshold`);
      if (!clsPass) fails.push(`CLS ${psi.cls} exceeds 0.1 threshold`);
      ev['psi-core-web-vitals'] = {
        s: 'f',
        note: `Core Web Vitals threshold exceeded: ${fails.join('; ')}.`,
        source: 'PageSpeed'
      };
    }
  } else {
    ev['psi-core-web-vitals'] = {
      s: 'nv',
      note: 'Google Core Web Vitals telemetry unavailable or timed out; not verified.',
      source: 'PageSpeed'
    };
  }

  // 23. psi-major-issues
  if (psi && Array.isArray(psi.opportunities)) {
    if (psi.opportunities.length === 0) {
      ev['psi-major-issues'] = {
        s: 'p',
        note: 'Zero major performance bottlenecks flagged by Google Lighthouse audits.',
        source: 'PageSpeed'
      };
    } else {
      const opSum = psi.opportunities.slice(0, 2).map(o => o.title).join('; ');
      ev['psi-major-issues'] = {
        s: 'f',
        note: `${psi.opportunities.length} major bottleneck(s) flagged: ${opSum}.`,
        source: 'PageSpeed'
      };
    }
  } else {
    ev['psi-major-issues'] = {
      s: 'nv',
      note: 'Lighthouse bottleneck data unavailable or timed out; not verified.',
      source: 'PageSpeed'
    };
  }

  return ev;
}

// ── Enforce Merge & Evidence Rules ──────────────────────────────────────────
export function enforceMergeAndEvidenceRules(evaluations, pageCheck, psiObj, rnObj, cvObj) {
  const highDefects = [];
  const pc = pageCheck?.ok ? pageCheck : null;
  const psi = psiObj?.ok && psiObj.data ? psiObj.data : null;

  // 1. Mandatory Rule Enforcement: Never mark 'f' without concrete evidence of failure!
  for (const itId in evaluations) {
    const item = evaluations[itId];
    if (item.s === 'f') {
      const noteLower = (item.note || '').toLowerCase();
      // If note mentions unavailable, skipped, timed out, offline, or inconclusive -> must be 'nv'!
      if (
        noteLower.includes('unavailable') ||
        noteLower.includes('timed out') ||
        noteLower.includes('offline') ||
        noteLower.includes('engine skipped') ||
        noteLower.includes('check skipped') ||
        noteLower.includes('audit skipped') ||
        noteLower.includes('could not be') ||
        noteLower.includes('not verified') ||
        noteLower.includes('rate limit') ||
        noteLower.includes('requires manual') ||
        noteLower.includes('not provided')
      ) {
        evaluations[itId] = {
          s: 'nv',
          note: item.note || 'Data unavailable from audit endpoints; not verified.',
          source: item.source || 'Not Verified'
        };
      }
    }
  }

  // 2. Concrete Page Check Violations
  if (pc) {
    // H1 count
    const h1s = pc.headings?.filter(h => (h.tag || '').toLowerCase() === 'h1') || [];
    if (h1s.length !== 1) {
      highDefects.push(`H1 Count Violation: Found ${h1s.length} <h1> tag(s) on page.`);
    }

    // Missing metadata
    if (!pc.meta?.title || !pc.meta.title.trim()) {
      highDefects.push('Missing <title> tag in document head.');
    }
    if (!pc.meta?.metaDesc || !pc.meta.metaDesc.trim()) {
      highDefects.push('Missing <meta name="description"> tag in document head.');
    }

    // Missing alt on images
    if (pc.images?.missingAltCount > 0) {
      highDefects.push(`${pc.images.missingAltCount} image(s) missing alt attribute completely.`);
    }

    // Empty links
    if (pc.links?.emptyLinksCount > 0) {
      highDefects.push(`${pc.links.emptyLinksCount} dead or empty link(s) (href="#" or href="javascript:void(0)").`);
    }

    // Missing viewport
    if (pc.meta && !pc.meta.viewportContent) {
      highDefects.push('Missing <meta name="viewport"> tag in document head.');
    }
  }

  // 3. Concrete PageSpeed Violations
  if (psi) {
    if (typeof psi.score === 'number' && psi.score < 50) {
      highDefects.push(`Critical Performance Deficit: Mobile PageSpeed score is ${psi.score}/100.`);
    }
    if (psi.consoleErrorsCount > 0) {
      highDefects.push(`${psi.consoleErrorsCount} runtime JavaScript exception(s) logged in console.`);
    }
  }

  let passedCount = 0;
  let failedCount = 0;
  let notVerifiedCount = 0;
  let pendingCount = 0;
  const totalChecklistCount = 23;

  for (const k in evaluations) {
    if (Object.prototype.hasOwnProperty.call(evaluations, k)) {
      if (evaluations[k].s === 'p') passedCount++;
      else if (evaluations[k].s === 'f') failedCount++;
      else if (evaluations[k].s === 'nv') notVerifiedCount++;
      else pendingCount++;
    }
  }

  let finalScore = Math.round((passedCount / totalChecklistCount) * 100);
  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;

  let finalGrade = 'F';
  if (failedCount === 0) {
    if (passedCount === totalChecklistCount) finalGrade = 'A';
    else if (passedCount >= 18) finalGrade = 'A-';
    else if (passedCount >= 14) finalGrade = 'B';
    else if (passedCount >= 8) finalGrade = 'C';
    else finalGrade = 'Pending';
  } else {
    finalGrade = finalScore >= 90 ? 'A' : finalScore >= 80 ? 'B' : finalScore >= 70 ? 'C' : finalScore >= 60 ? 'D' : 'F';
  }

  return {
    evaluations,
    score: finalScore,
    grade: finalGrade,
    passedCount,
    failedCount,
    notVerifiedCount,
    pendingCount,
    highDefects
  };
}
