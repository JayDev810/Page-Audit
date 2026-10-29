# 🚀 Page Audit Checklist — Pre-Launch Quality & SEO Verifier

A professional, high-precision web quality assurance and pre-launch auditing tool built with **Next.js (App Router)** and **React 19**.

This application evaluates single web pages against **23 strict technical criteria across 8 categories**, combining real-time DOM measurements, multi-viewport inspection, Google PageSpeed Insights & Core Web Vitals, and dual-engine AI synthesis (RankNibbler + Citevana via Groq AI).

---

## 🌟 Key Features

- **2-Step Audit Workflow:**
  - **Step 1:** Intake setup (Project Name, Auditor, URL, Engine Selection) with real-time Pre-Flight Safeguards, front-end visibility verification, and live interactive telemetry monitor.
  - **Step 2:** Interactive 23-standard Quality Ledger, responsive category navigation, instant Pass/Fail toggles, evidence inspector with quoted DOM snippets, client exceptions notes, and PageSpeed metrics dashboard.
- **Dual-Engine Automated Failover:**
  - Concurrent querying of RankNibbler and Citevana with automated bidirectional failover if an engine hits rate limits or latency spikes.
- **Zero Local Server Dependency:**
  - Full serverless architecture via Next.js App Router Route Handlers (`app/api/*`). Works 100% in the cloud on Vercel without requiring local Python servers, Puppeteer, or background daemons.
- **Google PageSpeed Insights & Web Vitals:**
  - Measures Mobile Performance score, LCP, FCP, CLS, TBT, and Speed Index, automatically flagging high-impact Lighthouse optimization opportunities. Includes dual-key rotation and direct client fallback.
- **Groq AI Merge & Ironclad Rule Enforcement:**
  - Merges multi-source evidence into a unified assessment with zero hallucinations, deterministic rule guardrails, and automated scoring (0–100 and A–F letter grades).
- **Client-Ready PDF Dossier Export:**
  - Generates zero-cutoff, formatted A4 PDF reports featuring complete project metadata, summary scorecards, PageSpeed telemetry, and item-by-item verified findings.

---

## 📁 Project Structure

```text
├── app/
│   ├── api/
│   │   ├── citevana/
│   │   │   ├── [...path]/route.js   # Dynamic proxy to Citevana API endpoints
│   │   │   └── route.js
│   │   ├── groq/route.js            # Serverless proxy to Groq LLM API
│   │   ├── page-check/route.js      # Server-side HTML/DOM inspector & metadata extractor
│   │   └── pagespeed/route.js       # Google PageSpeed API handler with dual-key rotation
│   ├── globals.css                  # Comprehensive design tokens, light/dark theme, layout styling
│   ├── layout.jsx                   # Root layout, Google Fonts, metadata, html2pdf script
│   └── page.jsx                     # Interactive client component (Step 1, Step 2, Modals, PDF Export)
├── lib/
│   ├── auditData.js                 # 23 checklist criteria definitions across 8 categories
│   └── evaluator.js                 # Deterministic baseline evaluator & Groq post-merge enforcement
├── public/
│   └── html2pdf.bundle.min.js       # Bundled client-side PDF rendering engine
├── .env                             # Local environment variables
├── .env.example                     # Environment variables template for deployment
├── .gitignore                       # Git ignore rules for Next.js, Node.js, and environments
├── next.config.js                   # Next.js configuration
├── package.json                     # NPM dependencies and build scripts
└── README.md                        # Documentation and deployment instructions
```

---

## ⚙️ Environment Variables

Configure these environment variables in your local `.env` file or in the **Vercel Project Settings > Environment Variables**:

| Variable | Description | Default / Fallback |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | Groq Cloud API Key (`qwen/qwen3.8-27b`) for synthesis | Configured with fallback |
| `CITEVANA_API_KEY` | Citevana AI Crawler & Structured Data API Key | Configured with fallback |
| `RN_API_KEY` | RankNibbler Core Audit & Accessibility API Key | Configured with fallback |
| `PSI_API_KEY_PRIMARY` | Google PageSpeed Insights API Key (Primary) | Configured with fallback |
| `PSI_API_KEY_FALLBACK` | Google PageSpeed Insights API Key (Secondary/Failover) | Configured with fallback |

*(See `.env.example` for reference).*

---

## 🚢 Deploying to Vercel

### Step 1: Push Code to GitHub

Open your terminal or command prompt in this directory and execute:

```bash
# 1. Initialize git if not already initialized
git init

# 2. Add remote repository
git remote add origin https://github.com/JayDev810/Page-Audit.git
# (or verify existing remote: git remote -v)

# 3. Stage all files
git add .

# 4. Commit changes
git commit -m "Convert Page Audit Checklist to Next.js App Router for Vercel deployment"

# 5. Push to GitHub
git branch -M main
git push -u origin main --force
```

### Step 2: Import into Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New…** > **Project**.
3. Select your GitHub repository: `JayDev810/Page-Audit`.
4. Vercel will automatically detect:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./`
   - **Build Command:** `next build`
   - **Output Directory:** `.next`
5. *(Optional)* Expand **Environment Variables** and add your keys from `.env.example`.
6. Click **Deploy**.
7. In ~60 seconds, your site is live with a global CDN and automatic serverless routes!

---

## 💻 Local Development

To run the Next.js development server locally:

```bash
# Install dependencies
npm install

# Start local Next.js dev server (with Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

To build and run the production bundle locally:

```bash
# Build production bundle
npm run build

# Start production server
npm run start
```

---

## 📋 The 23 Quality Standards

1. **Page Structure & SEO:** H1 Count, Heading Order, Title & Meta Description, Canonical URL.
2. **Images & Media:** Image Alt Text, Broken Images.
3. **Typography:** Heading Font Size Consistency, Body Text Size, Button Font Size, Font Family.
4. **Colors:** Brand Colors & WCAG AA Contrast.
5. **Links & Buttons:** Links Work, Button Style Uniformity.
6. **Content & Tech:** Placeholder Content, Console Errors, Section Spacing & Sideways Scroll.
7. **Responsive Design:** Small Desktop / Laptop (1024px/1280px), Tablet (768px), Mobile (375px), Mobile Overflow.
8. **PageSpeed & Web Vitals:** Mobile Performance Score (>=70), Core Web Vitals (LCP <= 2.5s, CLS <= 0.1), Major Bottlenecks.

---

## 📄 License

MIT License. Designed for professional web agencies, QA engineers, and developers.

