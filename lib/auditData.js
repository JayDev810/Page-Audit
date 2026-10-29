export const AUDIT_DATA = [
  {
    name: "Page structure and SEO",
    tab: "Structure & SEO",
    items: [
      {
        id: "seo-h1-count",
        title: "H1 Count",
        rule: "Exactly 1 visible H1 on the page, with meaningful descriptive text.",
        how: "Inspect DOM with DevTools & run querySelectorAll('h1')."
      },
      {
        id: "seo-heading-order",
        title: "Heading Order",
        rule: "No skipped heading levels (H1 → H2 → H3) and no empty headings.",
        how: "Check the heading outline in DevTools."
      },
      {
        id: "seo-meta-tags",
        title: "Title & Meta Description",
        rule: "Both <title> and <meta name='description'> exist, are populated, and have no template tokens.",
        how: "Inspect document <head> elements."
      },
      {
        id: "seo-canonical",
        title: "Canonical URL",
        rule: "A canonical link is present and points to this page's URL.",
        how: "Locate <link rel='canonical'> in the HTML head."
      }
    ]
  },
  {
    name: "Images & Media",
    tab: "Images & Media",
    items: [
      {
        id: "img-alt-tags",
        title: "Image Alt Text",
        rule: "Every content image has clear alt text. Decorative images use alt=\"\".",
        how: "Audit all <img> tags in DOM for missing or placeholder alt text."
      },
      {
        id: "img-broken-check",
        title: "Broken Images",
        rule: "No broken images or failed image loads on the page.",
        how: "Check Network tab filtered by 'Img' for any 4xx/5xx responses."
      }
    ]
  },
  {
    name: "Typography",
    tab: "Typography",
    items: [
      {
        id: "type-heading-size",
        title: "Heading Font Size Consistency",
        rule: "All headings of the same level (H2, H3, H4) have the same font size and font weight across all sections.",
        how: "Compare the computed font-size and font-weight of headings in DevTools across sections."
      },
      {
        id: "type-body-size",
        title: "Body Text Size",
        rule: "Paragraph text uses the same font size in similar content blocks.",
        how: "Compare computed paragraph font-size across sections."
      },
      {
        id: "type-button-size",
        title: "Button Font Size",
        rule: "Buttons of the same type (primary or secondary) have the same font size.",
        how: "Inspect computed font-size on all buttons."
      },
      {
        id: "type-approved-family",
        title: "Font Family",
        rule: "Only the approved fonts are used on the page.",
        how: "Check the font-family in DevTools > Elements > Computed."
      }
    ]
  },
  {
    name: "Colors",
    tab: "Colors",
    items: [
      {
        id: "color-brand-palette",
        title: "Brand Colors",
        rule: "No text, border, or background color is outside the approved brand colors.",
        how: "Compare the colors in DevTools with your brand color codes."
      }
    ]
  },
  {
    name: "Links & Buttons",
    tab: "Links & Buttons",
    items: [
      {
        id: "link-destinations",
        title: "Links Work",
        rule: "No empty links (href='#' or href='javascript:void(0)'), and all in-page links go to the right section.",
        how: "Click every link and check it opens the right page or section."
      },
      {
        id: "link-button-styles",
        title: "Button Style",
        rule: "Buttons of the same type have the same padding, corner radius, and hover/focus style.",
        how: "Compare the size, corner radius, and hover look of each button."
      }
    ]
  },
  {
    name: "Content & Technical",
    tab: "Content & Tech",
    items: [
      {
        id: "tech-placeholder-content",
        title: "Placeholder or Empty Content",
        rule: "No lorem ipsum, dummy text, empty sections, or repeated blocks by mistake.",
        how: "Search the page for 'lorem' or 'todo', and look for empty sections."
      },
      {
        id: "tech-console-errors",
        title: "Console Errors",
        rule: "The DevTools Console shows no errors (no JavaScript errors, 404s, or CORS errors).",
        how: "Open the DevTools Console, filter by 'Errors', and reload the page."
      },
      {
        id: "tech-section-spacing-scroll",
        title: "Section Spacing & Sideways Scroll",
        rule: "Top and bottom spacing is the same in all sections, and nothing sticks out or causes sideways scrolling.",
        how: "Check padding-top and padding-bottom of each section in DevTools, and make sure there is no horizontal scrollbar."
      }
    ]
  },
  {
    name: "Responsive Design",
    tab: "Responsive",
    items: [
      {
        id: "resp-desktop-small",
        title: "Small Desktop / Laptop",
        rule: "Layout fits small desktop and laptop screens (992px–1366px) with no sideways scrolling and no overlapping content.",
        how: "Resize the browser to 1024px and 1280px and check the layout, spacing, and menu."
      },
      {
        id: "resp-tablet-responsive",
        title: "Tablet",
        rule: "Layout fits tablet screens (720px–991px). Columns adjust properly, the menu works, and there are no large empty gaps.",
        how: "Test iPad portrait (768px) and landscape (1024px) in DevTools and check the layout, text, and cards."
      },
      {
        id: "resp-mobile-responsive",
        title: "Mobile",
        rule: "Layout fits phone screens (360px–480px). Text is readable without zooming, and content stacks in one column.",
        how: "Use phone sizes in DevTools and check that buttons are easy to tap and nothing is cut off."
      },
      {
        id: "tech-mobile-viewport",
        title: "Mobile Overflow",
        rule: "At 375px width (and 360px–480px), there is no sideways scrollbar, cut-off text, or overlapping elements.",
        how: "Set DevTools to 375px width and check that the page does not scroll sideways."
      }
    ]
  },
  {
    name: "PageSpeed & Core Web Vitals",
    tab: "PageSpeed",
    items: [
      {
        id: "psi-perf-score",
        title: "Mobile Performance Score",
        rule: "Google PageSpeed Insights mobile performance score meets or exceeds 70/100 baseline threshold.",
        how: "Run automated Google PageSpeed Insights audit to evaluate mobile lab score."
      },
      {
        id: "psi-core-web-vitals",
        title: "Core Web Vitals Thresholds (LCP & CLS)",
        rule: "Largest Contentful Paint (LCP) <= 2.5s and Cumulative Layout Shift (CLS) <= 0.1.",
        how: "Verify Google PageSpeed metrics against Google official Web Vitals thresholds."
      },
      {
        id: "psi-major-issues",
        title: "Major Performance Bottlenecks",
        rule: "Zero critical high-impact opportunities (render-blocking assets, unoptimized JS/CSS, server response time).",
        how: "Inspect PageSpeed Opportunities for items with high ms or byte savings."
      }
    ]
  }
];

export const ALL_CHECKLIST_ITEMS = AUDIT_DATA.flatMap((cat, catIdx) =>
  cat.items.map((it, itIdx) => ({
    ...it,
    catIdx,
    catName: cat.name,
    catTab: cat.tab,
    num: itIdx + 1
  }))
);

