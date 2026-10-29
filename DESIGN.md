# Design System: Manual Page Audit Ledger

## Project Brief
- **Business / Product**: Single-page manual quality assurance inspection ledger for pre-launch verification.
- **Audience**: QA engineers, web developers, and designers manually verifying single-page deliverables prior to deployment.
- **ONE Primary Conversion**: Complete the pre-launch checklist and export an actionable executive PDF sign-off report.
- **Real Materials / Vocabulary**: DOM outline, H1-H3 hierarchy, rel=canonical, WCAG AA contrast ratio, computed font-size/family, console errors, exceptions/waivers, auditor sign-off.
- **Font Pairing**: `Space Grotesk` (Headings & Metric Displays) + `Plus Jakarta Sans` (UI & Body Text) + `JetBrains Mono` (Code & Tabular Numerals).

---

## 1. Color Palette (Tokens)

All colors meet WCAG AA contrast standards. No purple-to-blue gradients, no neon glowing blobs.

### Light Mode
- `--bg-canvas`: `#f4f6f8` (Subtle warm-tinted technical gray)
- `--bg-surface`: `#ffffff` (Crisp white container surfaces)
- `--bg-subtle`: `#f8fafc` (Secondary card fills / subtle rows)
- `--border-subtle`: `#e2e8f0` (Hairline container borders)
- `--border-focus`: `#0f172a` (High-contrast focus ring)
- `--text-main`: `#0f172a` (Deep slate ink, high legibility)
- `--text-muted`: `#475569` (Secondary descriptors & rule guidelines)
- `--text-dim`: `#64748b` (Tertiary metadata & helpers)

### Status Signals
- **Pass (Forest Emerald)**:
  - `--pass-ink`: `#065f46`
  - `--pass-bg`: `#ecfdf5`
  - `--pass-border`: `#10b981`
  - `--pass-solid`: `#059669`
- **Fail (Crimson Coral)**:
  - `--fail-ink`: `#991b1b`
  - `--fail-bg`: `#fef2f2`
  - `--fail-border`: `#ef4444`
  - `--fail-solid`: `#dc2626`
- **Not Verified (Ochre Amber)**:
  - `--warn-ink`: `#92400e`
  - `--warn-bg`: `#fffbeb`
  - `--warn-border`: `#f59e0b`
  - `--warn-solid`: `#d97706`
- **Exception (Indigo / Slate Accent)**:
  - `--exception-ink`: `#1e40af`
  - `--exception-bg`: `#eff6ff`
  - `--exception-border`: `#3b82f6`

### Dark Mode
- `--bg-canvas`: `#090d13`
- `--bg-surface`: `#121822`
- `--bg-subtle`: `#19212e`
- `--border-subtle`: `#263244`
- `--text-main`: `#f1f5f9`
- `--text-muted`: `#94a3b8`
- `--text-dim`: `#64748b`

---

## 2. Typography
- **Headings & Metric Numbers**: `'Space Grotesk', system-ui, sans-serif`
  - Weights: 600 (Semibold), 700 (Bold)
- **UI Labels & Body**: `'Plus Jakarta Sans', system-ui, sans-serif`
  - Weights: 400 (Regular), 500 (Medium), 600 (Semibold)
- **Technical & Code/Data**: `'JetBrains Mono', monospace`
  - Weights: 500 (Medium)

---

## 3. Spacing Scale (8-point grid with 4px half-steps)
- 4px (`--sp-1`), 8px (`--sp-2`), 12px (`--sp-3`), 16px (`--sp-4`), 20px (`--sp-5`), 24px (`--sp-6`), 32px (`--sp-8`), 48px (`--sp-12`).

---

## 4. Radius & Shadows
- `--radius-sm`: `4px` (Tags, sub-badges)
- `--radius-md`: `8px` (Buttons, segmented controls, text inputs)
- `--radius-lg`: `12px` (Cards, groups, sticky dashboard)
- `--radius-circle`: `50%` (Circular check item index badges)
- `--shadow-card`: `0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)`
- `--shadow-sticky`: `0 4px 12px rgba(15, 23, 42, 0.08)`

---

## 5. Design Principles
1. **Defect-First Accountability**: Failures and unverified items must never be quiet. An interactive diagnosis box immediately activates with clear guidance prompts.
2. **Tactile Ergonomics**: Big target segmented buttons with instant tactile feedback (clear border + solid color changes), accessible via tab + spacebar.
3. **Transparent Audit Trail**: Every item supports client waiver/exception rationale, timestamps, target URL, and auditor identity for a production-grade sign-off.

---

## 6. Audit Items Specification (21 Checks across 7 Categories)
1. **Page structure and SEO (4)**: H1 Count, Heading Hierarchy, Title & Meta Description, Canonical URL.
2. **Images & Media (2)**: Image Alt Attributes, Broken Images & 404s.
3. **Typography System (5)**: H2 Font Size Consistency, H3 Font Size Consistency, Body Text Scale, Button Font Size, Approved Font Families.
4. **Colors (1)**: Brand Color Fidelity.
5. **Links & Buttons (2)**: Link Destinations & Fragment Anchors, Button Visual Uniformity.
6. **Content & Technical Health (3)**:
   - Placeholder & Empty Content
   - Console Errors & Uncaught Exceptions
   - **Section Spacing & Horizontal Scroll**: Consistent vertical padding rhythm across all page sections (matching top/bottom spacing throughout the whole page) with zero element bleeding or unintended horizontal scrolling.
7. **Responsive Design & Screen Adaptability (4)**:
   - **Desktop Small Screen Responsive**: Layout scales proportionally on small desktop and laptop displays (992px–1366px); no horizontal scrolling, no sidebar collision, and compact readable hierarchy.
   - **Tablet Screen Responsive**: Layout seamlessly reflows for tablet viewports (720px–991px); grid columns adapt cleanly, navigation adapts comfortably, and no awkward dead whitespace.
   - **Mobile Screen Responsive**: Layout cleanly adapts to smartphone screens (360px–480px); touch targets ≥44px, readable text without zooming, and stacked single-column flow.
   - **Mobile Viewport & Overflow**: Zero horizontal scrollbar, text truncation, or overlapping elements at 375px phone width (and 360px–480px range).

---

## 7. Layout Architecture (2-Column Workbench & 7-Tab Navigation)
- **Top Specification Bar Alignment**:
  - Outermost `.top-bar` has `padding: 0;`.
  - `.top-bar-inner` shares identical container bounds with `.layout-workbench` across all screen resolutions (`diffLeft = 0px`, `diffRight = 0px`).
- **Category Tabs Architecture**:
  - 7 discrete workflow tabs (`Structure & SEO`, `Images & Media`, `Typography`, `Colors`, `Links & Buttons`, `Content & Tech`, `Responsive`).
  - Active tab displays category header with `CATEGORY 0X OF 07` indicator, badge counters, and bottom navigation stepper (`Category X of 7` with 7 status dots).
- **Responsive Viewport Tiers**:
  1. **Large Desktop (`≥ 1367px`)**:
     - `440px` sticky sidebar + fluid `1fr` audit content (`gap: 32px; padding: 24px 28px 80px; max-width: 1680px;`).
     - Category tabs bar displays all 7 categories cleanly across the top of the workbench.
  2. **Small Desktop & Laptops (`992px - 1366px`)**:
     - Ergonomic 2-column layout (`360px` sticky sidebar + fluid `1fr` audit content, `gap: 20px; padding: 20px 20px 60px;`).
     - Compact tab bar typography and padding; sidebar controls stay pinned while scrolling check items on MacBook & standard 1280px/1366px displays.
  3. **Tablets Portrait & Landscape (`720px - 991px`)**:
     - Stacks into single-column layout with a 2-column sub-grid for the sidebar (`Target & Auditor Meta` and `Inspection HUD` side-by-side in equal halves).
     - Keeps the dashboard to ~320px height so the checklist and category tabs are immediately visible in the initial viewport.
  4. **Mobile Devices (`≤ 640px` down to `360px`)**:
     - Single-column flow with full-width tactile touch targets (`min-width: 0;` throughout to eliminate horizontal scroll).
     - Full-width segmented Pass / Fail / Not verified control buttons (equal 3-way split).
     - Category pane header with nowrap badges.
     - 2-row workflow stepper (`Category X of 7` + 7 indicator dots on row 1; 50/50 Previous/Next touch buttons on row 2).
     - Horizontal momentum scrolling on category tabs and status filter pills.
- **Executive PDF & Print Architecture**:
  - The "Export PDF Report" button triggers a dedicated high-fidelity print stylesheet.
  - The top of the PDF produces the exact side-by-side executive summary header: `TARGET & AUDITOR META` (Target URL, release, auditor, environment, auto-save timestamp) on the left, and `INSPECTION HUD` (Verdict banner, progress bar, 5 metric counters, and status summary) on the right.
  - Automatically unrolls all 7 categories and 21 audit items sequentially, rendering status badges (`PASS`, `FAIL`, `NOT VERIFIED`, `UNCHECKED`) and documented defect logs/client waivers.
  - Web UI controls (tabs bar, steppers, buttons, filters) are completely hidden from the document.
  - Tab state automatically restores on print completion or dismissal.

---

## 8. Diagnostic DOM Blueprint Scanner & Fullscreen Audit Modal
- **Fullscreen Overlay & Background Blur**:
  - Clicking "Run AI Audit & Fill Checklist" immediately mounts a fullscreen fixed modal overlay (`position: fixed; inset: 0; z-index: 99999;`).
  - Darkened backdrop with hardware-accelerated blur (`backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);`) isolates the audit runner from background distractions.
- **Stage 1 (While Auditing)**:
  - Inside the centered, spacious dialog (`max-width: 680px`), the **Tactile DOM Blueprint Radar** runs:
    - **Telemetry Header**: Pulsing emerald beacon dot with radar ping animation, live stage description, and high-precision millisecond stopwatch (`00:00.0s`).
    - **Miniature Browser Blueprint Screen**: Scaled-down browser frame with traffic light controls, URL domain pill, `DOM v2.1` tag, coordinate ruler (`0px`–`360`), `<header>`, `<H1>` title block, image card with `ALT VERIFY`, CSS type scale, and WCAG AA contrast badge (`[AA 4.5:1]`).
    - **Optical Laser Sweep Beam**: 2px emerald line with trailing phosphor gradient sweeping vertically across the wireframe document.
    - **Multi-Stage Audit Stepper**: 4 progressive milestone rows (`Page Structure & SEO`, `Accessibility & Color Contrast`, `Assets, Links & Technical Health`, `Evaluating 23 Quality Standards`) advancing from `WAIT` to `SCAN` to `DONE`/`PASS`.
    - **Live Telemetry Terminal**: Monospace diagnostic command line feed with authentic operation messages and a blinking cursor.
- **Stage 2 (After Audit Completes)**:
  - The modal automatically transitions to the **Audit Result Pop-Up view**:
    - **Executive Score Row**: Large animated circular score dial (conic-gradient score progress), grade tag badge (`A`, `B`, `C`...), and stat pills (`X Passed`, `Y Issues`, `20 Items Audited`).
    - **Auto-Fill Banner**: Confirmation that all 20 verification criteria have been auto-populated with live inspection evidence.
    - **Detected Defect Evidence**: List of API-detected findings and recommendations.
    - **Return Button**: Prominent tactile button: `"See Results in Detail & Open Checklist →"`.
    - Clicking the button (or the `✕` close button, backdrop click, or `Escape` key) smoothly dismisses the modal, un-blurs the background, and smooth-scrolls directly to the workbench checklist.
  - The sidebar preserves the compact result card with a `"View Full Audit Pop-up"` button to re-open the pop-up at any time.
- **Accessibility**:
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modalAuditTitle"`.
  - Supports keyboard navigation (`Escape` to close, tab cycling).
  - Full `@media (prefers-reduced-motion: reduce)` support: disables looping sweeps, maintains clean progressive step indicators.

---

## 9. Google PageSpeed Insights & Core Web Vitals Tab Architecture
- **Dedicated Category 8 (`PageSpeed & Core Web Vitals`)**:
  - Dedicated tab button in the category navigation bar with dynamic counters (`0 / 3 passed`, `✓ 3`, or `X fail`).
  - Contains 3 formalized criteria:
    - `#21 Mobile Performance Score`: Google PageSpeed Mobile score meets or exceeds 70/100 baseline.
    - `#22 Core Web Vitals Thresholds (LCP & CLS)`: Largest Contentful Paint (LCP) ≤ 2.5s and Cumulative Layout Shift (CLS) ≤ 0.1.
    - `#23 Major Performance Bottlenecks`: Zero critical high-impact opportunities (render-blocking assets, unoptimized JS/CSS, server response time).
- **Executive PageSpeed Dashboard Card**:
  - Embedded prominently at the top of the PageSpeed category panel (`#psiDashboardCard`).
  - **Header Row**: Official Google Lighthouse engine badge, device strategy pill (`STRATEGY: MOBILE (Moto G Power simulation)`), and live audit timestamp.
  - **Radial Performance Score Gauge**: Large 88px radial dial showing Google mobile performance score (0-100), color-coded dynamically (Green ≥ 90, Amber 50-89, Red < 50), and performance grade badge (`FAST • GOOD`, `AVERAGE • NEEDS WORK`, or `POOR • SLOW`).
  - **5 Core Web Vitals Cards Grid**:
    - **LCP** (Largest Contentful Paint) with threshold chip (`Good ≤ 2.5s`, `Needs Work 2.5s–4.0s`, `Poor > 4.0s`).
    - **FCP** (First Contentful Paint) with threshold chip (`Good ≤ 1.8s`, `Needs Work 1.8s–3.0s`, `Poor > 3.0s`).
    - **CLS** (Cumulative Layout Shift) with threshold chip (`Good ≤ 0.1`, `Needs Work 0.1–0.25`, `Poor > 0.25`).
    - **TBT** (Total Blocking Time) with threshold chip (`Good ≤ 200ms`, `Needs Work 200ms–600ms`, `Poor > 600ms`).
    - **Speed Index** (Visual Completion) with threshold chip (`Good ≤ 3.4s`, `Needs Work 3.4s–5.8s`, `Poor > 5.8s`).
- **Major Bottlenecks Only Filter**:
  - Google PageSpeed audits are filtered strictly for **high-impact opportunities**: audits where `score < 0.8` and estimated savings exceed `100ms` or `15 KB` (`overallSavingsMs >= 100 || overallSavingsBytes >= 15000`).
  - Minor notices, low-impact savings, and informational diagnostics are omitted to keep the view clean and actionable.
  - Renders title, actionable Lighthouse guidance, and estimated savings badge (e.g. `Est. 1.2s savings` or `Est savings of 177 KiB`).
  - If no major bottlenecks exist: displays a green verified banner: `"✓ Zero major performance bottlenecks detected. The page satisfies Google Core Web Vitals speed thresholds."`
- **Fullscreen Result Modal Integration**:
  - Displays a dedicated `⚡ PageSpeed: X/100` pill in the executive score row alongside passed/failed counts.

---

## 10. Groq AI Sentinel Watchdog System
- **Role & Boundary**:
  - Operates strictly as an **integrity and reliability watchdog**, not a checklist auditor.
  - Monitors the end-to-end telemetry pipeline, validates API payload sanity, prevents race conditions, and guards against infinite or breaking loops.
- **Top-Bar Sentinel Badge (`#groqSentinelBadge`)**:
  - Sleek monospace status pill in the header next to the theme toggle.
  - Emerald pulsing radar dot during normal operation (`Groq Sentinel: Active` / `Verified (0 loops, 0 errors)`).
  - Amber pulsing dot when diagnosing (`Groq Sentinel: Diagnosing Incident…`).
  - Red static dot on alert (`Groq Sentinel: Alert Logged`).
- **Infinite Loop & Breaking Loop Prevention**:
  1. **Concurrency Lock (`isAuditing`)**: Guarantees that duplicate clicks or concurrent API triggers are completely blocked until the current run finishes.
  2. **Hard Timeout AbortControllers**:
     - RankNibbler API calls enforce a strict 20-second timeout via `AbortController`.
     - Google PageSpeed Insights enforces a 24-second dedicated timeout via `AbortController`.
     - Groq AI diagnosis requests enforce a 6-second timeout via `AbortController`.
  3. **Hard Sentinel Watchdog Deadline**: A 30-second failsafe timer ensures that regardless of network conditions or unhandled promise rejections, the loader is halted, buttons are re-enabled, and a recovery state is applied.
  4. **No Recursive Loops**: All fetches execute in a single parallel pass without recursive retries.
- **Self-Healing Incident Diagnosis (`#groqIncidentBox`)**:
  - If any API throws an error (DNS resolution failure, CORS issue, target host firewall, or timeout), Groq AI (`qwen/qwen3.8-27b`) is queried in the background.
  - Returns a concise, 2-sentence non-technical root cause diagnosis and 1 actionable safe recovery recommendation.
  - Displays directly below the error message in the sidebar, providing clarity without locking up the user interface.

## Multi-Engine Architecture & Citevana Integration

### Primary vs. Secondary Providers
- **Primary Engine**: RankNibbler Core API (`https://www.ranknibbler.com/api/v1/...`).
- **Secondary / Backup Engine**: Citevana AI Engine (`https://citevana.com/api/v1/tools/page-audit` + `/tools/ai-crawlers`).
- **Engine Selection Dropdown**:
  - `Auto`: RankNibbler Primary with Groq Sentinel Automated Failover to Citevana.
  - `Citevana AI Engine`: Direct execution for benchmarking accuracy and AI crawler compatibility.
  - `RankNibbler Engine Only`: Strict primary audit without failover.

### Groq Sentinel Decision & Autonomous Failover
- When in `Auto` mode, if RankNibbler exhausts its daily usage quota (HTTP 429), returns rate limit errors, or experiences provider outages:
  1. Groq Sentinel intercepts the rejection before it can break the UI.
  2. Evaluates the incident and logs an autonomous routing decision: `[GROQ SENTINEL] Quota/Limit reached. Executing failover decision to Citevana AI...`
  3. Updates the live telemetry UI: status badge shows `Groq Sentinel: Decision → Failover to Citevana`.
  4. Automatically switches the audit pipeline to Citevana AI without requiring user intervention.
  5. Evaluates all 23 checklist items across all 8 categories (including PageSpeed Core Web Vitals).
  6. Tags the resulting audit ledger and modal popup with `Provider: Citevana AI (Groq Failover)`.
- **Zero Loop Guarantee**: Failover is strictly a single-hop state transition with concurrency lock enforcement. No recursive cycles or infinite retry loops are possible.

### Front-End Visibility Guard & Session Termination
- **Anti-Blind-Audit Principle**:
  - Target sites that have no front-end visibility or preview capability (e.g. 404 dead links, 401/403 password barriers, 5xx backend crashes, bot challenge barriers, non-HTML API endpoints, or private/localhost addresses) have no inspectable DOM or renderable user interface.
  - Auditing these targets blindly wastes tokens, exhausts third-party API quotas (PageSpeed and Groq), and generates meaningless checklist evaluations.
- **Pre-Flight Interception**:
  - `isPrivateOrLocalUrl(url)` intercepts `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, `*.local`, `*.internal`, `192.168.*`, `10.*`, and `172.16-31.*` before ANY network requests are dispatched.
  - Zero API calls made, 0 tokens consumed, session terminated immediately.
- **In-Flight Visibility Interception**:
  - `checkFrontEndVisibility(auditData, httpStatus, rawError)` inspects HTTP status codes and error payloads:
    - `HTTP 404`: Page Not Found / deleted or unpublished draft link.
    - `HTTP 401 / 403`: Password protection, HTTP Basic Auth, or IP restriction.
    - `HTTP 5xx`: Server crash, 502 Bad Gateway, 503 Service Unavailable, 504 Timeout.
    - `isHtml === false`: Raw JSON/XML API feed or binary asset.
    - `blocked_by_bot_protection`: Cloudflare Under Attack mode or captcha challenge.
    - `fetch_failed`: Host unreachable, DNS failure, or connection refused.
    - Empty Document: 0 words, no title, and 0 headings.
- **Immediate Session Termination (`terminateNoVisibilitySession`)**:
  1. Aborts in-flight `psiController` (halts Google PageSpeed Lighthouse audit immediately).
  2. Aborts primary/secondary audit engine controllers.
  3. Halts animated blueprint scanners, progress timers, and closes the modal popup.
  4. Never executes secondary engine failover (dead/protected targets will fail on Citevana as well).
  5. Never populates checklist items with blind/fake data.
  6. Displays `#rnNoVisibilityBox` with high-contrast badge `SESSION TERMINATED • Tokens & Quota Preserved`, specific failure reason, actionable remediation advice, and a 1-click `Dismiss & Update URL` button.

## 9. Two-Step Architecture & Direct PDF Dossier Engine

### Two-Step Sequential Flow
The application is structured into two clean, non-overwhelming steps to provide maximum focus during setup and deep clarity during inspection:

1. **Step 1: Intake & Mission Control (`#step1Container`)**
   - **Form Fields (Left Card)**:
     - `Project Name`: Formal client or repository name (e.g. "Acme Corp Web Redesign").
     - `Your Name / Auditor`: QA engineer or team identity (e.g. "Alex Chen (QA Lead)").
     - `Audit Report Title`: Official document title embedded into header and PDF.
     - `Page URL`: Valid public HTTP/HTTPS endpoint.
     - `Audit Engine`: Dropdown with Auto Failover, Citevana direct, or RankNibbler only.
     - `Launch AI Audit & Proceed to Step 2`: Primary action button.
   - **Diagnostic Mission Control Widget (Right Card)**:
     - **Live Dynamic Dossier Preview**: Automatically updates in real time as the user types in Project Name, Auditor Name, Report Title, and URL. Displays live date and status chips.
     - **Interactive Radar Scope**: Circular radar viewport with sweeping laser gradient, crosshairs, range rings, and 4 orbiting diagnostic engine nodes (`#nodeRn`, `#nodePsi`, `#nodeCv`, `#nodeGroq`).
     - **Telemetry Status Ticker**: Hovering or clicking on any radar node displays the active engine heuristics in `#radarStatusMsg`.
     - **Capability Badges**: 4 technical capability indicators (WCAG AA Contrast Matrix, Core Web Vitals Telemetry, 23 Quality Standards, Direct PDF Download).
   - **Diagnostic Popup Modal**:
     - Clicking "Launch AI Audit & Proceed to Step 2" opens the full-screen modal with blurred canvas backdrop.
     - Runs the animated blueprint scanner, laser sweep, and real-time millisecond stopwatch.
     - Upon completion, transitions to the modal result view displaying overall score dial, grade, passed/failed badges, PageSpeed indicator, and defect evidence list.
     - User clicks `"See Results in Detail & Open Checklist →"` to close the popup and advance to Step 2.

2. **Step 2: Quality Ledger & Direct PDF Export (`#step2Container`)**
   - **Executive Top Ribbon Bar (`#step2RibbonBar`)**:
     - Sticky or top-anchored banner summarizing Project Name, Grade Badge, Auditor Name, Target URL, and Audit Date.
     - Action buttons:
       - `← Edit Setup (Step 1)`: Returns smoothly to Step 1 with all form states preserved.
       - `Download PDF Report`: Directly generates and downloads an A4 PDF document without cutoff.
   - **Full Checklist & HUD**:
     - Left HUD with pass/fail counts, progress bar, verdict badge, and quick pop-up reopener.
     - 8 Category Tabs with horizontal scroll, live category badges, and all 23 criterion cards.
     - Dedicated Google PageSpeed Insights executive dashboard tab with Core Web Vitals (LCP, CLS, TBT, Speed Index) and major bottleneck filtering.

### Direct PDF Report Engine (`exportAuditReportAsPdf`)
- **Local Dependency**: `html2pdf.bundle.min.js` bundled locally in project root (zero external CDN network dependency or CORS latency).
- **Data Completeness Guarantee**:
  - The live DOM checklist hides inactive tabs with `display: none`. Standard browser printing skips hidden tabs.
  - The PDF engine compiles an off-screen, print-optimized A4 dossier (`#pdfExportDossier`) containing:
    - Formal header block with Report Title, Subheading, Grade Badge, Score, and Verdict.
    - Two-column project metadata table (Project Name, Auditor Name, Target URL, Audit Timestamp).
    - Summary stat bar (Total Standards, Passed Checks, Issues Flagged, Pending Action).
    - PageSpeed Mobile Telemetry callout (LCP, CLS, TBT, Speed Index).
    - **All 8 Categories and all 23 Checklist Items** rendered in sequence.
    - Every detected defect evidence note and client waiver exception.
- **Zero Cutoff & Page Break Protection**:
  - All category cards (`.pdf-category-section`) and checklist item rows (`.pdf-item-row`) enforce CSS `break-inside: avoid;` and `page-break-inside: avoid;`.
  - Headings and content blocks are prevented from splitting awkwardly across A4 page margins.
  - Generates a file named `Audit-Report-[ProjectName].pdf` and triggers direct browser download, accompanied by a confirmation toast. Fallback to `window.print()` is built in if the browser canvas engine encounters permission locks.
