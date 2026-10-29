# Vercel Deployment Guide

This project is fully configured for deployment on **Vercel** with native **Serverless API Routes** (`api/`) and client-side failover.

---

## 🚀 How to Deploy on Vercel

### Method 1: Vercel Dashboard via Git (GitHub / GitLab / Bitbucket) — Recommended
1. Push this folder to a GitHub/GitLab repository (`.gitignore` already ignores `node_modules` and `.env`).
2. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... > Project**.
3. Import your repository.
4. Framework Preset: **Other** (or leave default).
5. Build and Output Settings:
   - **Build Command**: *(leave blank)*
   - **Output Directory**: *(leave blank — Vercel serves the root)*
   - **Install Command**: *(leave default `npm install`)*
6. Click **Deploy**.
7. Done! Your site is live with a `*.vercel.app` domain.

### Method 2: Deploy using Vercel CLI
From your terminal inside this folder:
```bash
npx vercel
```
Follow the prompts, and your site will be deployed instantly.

---

## 🛠️ Architecture on Vercel

| Endpoint | Serverless Handler | Role |
| :--- | :--- | :--- |
| `POST /api/citevana/*` | [`api/citevana.js`](file:///d:/Page%20checklist/Single%20Page%20checklist/api/citevana.js) | Proxies Citevana with Bearer key (`cv_live_...`), bypassing browser CORS and 429 rate limits |
| `POST /api/pagespeed` | [`api/pagespeed.js`](file:///d:/Page%20checklist/Single%20Page%20checklist/api/pagespeed.js) | Executes Google PageSpeed Insights with primary/fallback key failover |
| `POST /api/groq` | [`api/groq.js`](file:///d:/Page%20checklist/Single%20Page%20checklist/api/groq.js) | Proxies Groq Qwen AI synthesis |
| `POST /api/page-check` | [`api/page-check.js`](file:///d:/Page%20checklist/Single%20Page%20checklist/api/page-check.js) | Node.js DOM parser for markup, headings, images, and metadata |

### 🛡️ Built-In Resilience & Engine Failover
- **Automatic Engine Failover**: If Citevana returns a rate limit or network glitch, the system automatically queries RankNibbler in real time (and vice-versa).
- **Direct Client Fallback**: Even if an API route is ever unreachable, `index.html` has direct browser fallbacks for PageSpeed, RankNibbler, Groq, and deterministic evaluations.
- **Bot Challenge Handling**: For websites protected by Cloudflare bot challenges (like `spoutsuckers.com.au`), RankNibbler and Citevana crawlers automatically provide authentic DOM data.

---

## 🔑 Optional Vercel Environment Variables

Working default API keys are built-in for zero-config deployment. If you wish to use your own keys in Vercel:
1. Go to your project in Vercel > **Settings** > **Environment Variables**.
2. Add:
   - `PSI_API_KEY_PRIMARY`: Your Google PageSpeed API key
   - `PSI_API_KEY_FALLBACK`: Secondary Google PageSpeed API key
   - `GROQ_API_KEY`: Your Groq API key
   - `CITEVANA_API_KEY`: Your Citevana API key
3. Re-deploy.

