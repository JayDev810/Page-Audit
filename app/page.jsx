'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AUDIT_DATA, ALL_CHECKLIST_ITEMS } from '../lib/auditData';
import { evaluateChecklistInCode, enforceMergeAndEvidenceRules } from '../lib/evaluator';

function isPrivateOrLocalUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.test') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return true;
    }
    const ipParts = host.split('.').map(Number);
    if (ipParts.length === 4 && ipParts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
      if (ipParts[0] === 10) return true;
      if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true;
      if (ipParts[0] === 192 && ipParts[1] === 168) return true;
      if (ipParts[0] === 169 && ipParts[1] === 254) return true;
      if (ipParts[0] === 127) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function scoreColor(score) {
  if (score >= 90) return '#059669';
  if (score >= 70) return '#d97706';
  return '#dc2626';
}

export default function PageAuditApp() {
  // ── Form State ──────────────────────────────────────────────────────────
  const [workflowStep, setWorkflowStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedEngine, setSelectedEngine] = useState('full');
  const [theme, setTheme] = useState('light');

  // ── Audit & Checklist State ─────────────────────────────────────────────
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [evaluations, setEvaluations] = useState(() => {
    const initial = {};
    ALL_CHECKLIST_ITEMS.forEach(it => {
      initial[it.id] = { s: 'u', note: '', source: '', exception: '' };
    });
    return initial;
  });
  const [synthesizedAudit, setSynthesizedAudit] = useState(null);
  const [pageSpeedData, setPageSpeedData] = useState(null);
  const [sourcesStatus, setSourcesStatus] = useState({
    pageCheck: 'Ready',
    pagespeed: 'Ready',
    ranknibbler: 'Ready',
    citevana: 'Ready'
  });
  const [sourcesBarVisible, setSourcesBarVisible] = useState(false);
  const [lastSaved, setLastSaved] = useState('Auto-saved locally');

  // ── Modal & Telemetry State ─────────────────────────────────────────────
  const [modalState, setModalState] = useState('none'); // 'none' | 'audit' | 'result'
  const [isAuditing, setIsAuditing] = useState(false);
  const [loaderStep, setLoaderStep] = useState(1);
  const [loaderSub, setLoaderSub] = useState('Connecting diagnostic endpoints…');
  const [loaderElapsed, setLoaderElapsed] = useState('00:00.0');
  const [terminalText, setTerminalText] = useState('Initializing telemetry connection…');
  const [markerState, setMarkerState] = useState('ALT VERIFY');
  const [openNotes, setOpenNotes] = useState({});

  const toggleNote = (id) => {
    setOpenNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Safeguards & Error State ────────────────────────────────────────────
  const [errorMessage, setErrorMessage] = useState(null);
  const [noVisSession, setNoVisSession] = useState(null);
  const [groqIncident, setGroqIncident] = useState(null);
  const [groqSentinelStatus, setGroqSentinelStatus] = useState({ state: 'active', label: 'Groq Sentinel: Active' });
  const [radarStatusMsg, setRadarStatusMsg] = useState('4 Diagnostic Engines Ready • Awaiting Target URL');
  const [toastMessage, setToastMessage] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const groqWatchdogRef = useRef(null);

  // ── Theme Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem('page_audit_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('page_audit_theme', next);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // ── Computed Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let notVerified = 0;
    let pending = 0;
    ALL_CHECKLIST_ITEMS.forEach(it => {
      const ev = evaluations[it.id];
      if (!ev || ev.s === 'u') pending++;
      else if (ev.s === 'p') passed++;
      else if (ev.s === 'f') failed++;
      else if (ev.s === 'nv') notVerified++;
    });
    const total = ALL_CHECKLIST_ITEMS.length;
    const evaluated = passed + failed + notVerified;
    const pct = Math.round((evaluated / total) * 100);
    return { total, passed, failed, notVerified, pending, pct };
  }, [evaluations]);

  // Category counts (Passed, Failed, Not Verified, Pending)
  const categoryCounts = useMemo(() => {
    return AUDIT_DATA.map(cat => {
      let failed = 0;
      let notVerified = 0;
      let passed = 0;
      let pending = 0;
      cat.items.forEach(it => {
        const s = evaluations[it.id]?.s;
        if (s === 'f') failed++;
        else if (s === 'nv') notVerified++;
        else if (s === 'p') passed++;
        else pending++;
      });
      return { failed, notVerified, passed, pending, total: cat.items.length };
    });
  }, [evaluations]);

  // Overall verdict
  const verdictInfo = useMemo(() => {
    if (stats.failed > 0) {
      return {
        cls: 'verdict-fail',
        badge: `FAILED • ${stats.failed} ${stats.failed === 1 ? 'ISSUE' : 'ISSUES'}`,
        sub: `${stats.failed} issues need attention before sign-off.`
      };
    }
    if (stats.passed === stats.total) {
      return {
        cls: 'verdict-pass',
        badge: 'ALL PASSED • 23/23',
        sub: 'All technical standards verified and ready for client sign-off.'
      };
    }
    if (stats.notVerified > 0 && stats.failed === 0) {
      return {
        cls: 'verdict-warn',
        badge: `NOT VERIFIED • ${stats.notVerified} ${stats.notVerified === 1 ? 'CHECK' : 'CHECKS'}`,
        sub: `${stats.notVerified} checks could not be fully verified due to missing telemetry or endpoint limits.`
      };
    }
    return {
      cls: '',
      badge: 'NOT STARTED',
      sub: 'Verify all standards before sharing with the client.'
    };
  }, [stats]);

  // ── Checklist Actions ───────────────────────────────────────────────────
  const setItemStatus = (id, s) => {
    setEvaluations(prev => {
      const existing = prev[id] || { s: 'u', note: '', source: '', exception: '' };
      const updated = {
        ...prev,
        [id]: {
          ...existing,
          s: existing.s === s ? 'u' : s
        }
      };
      setLastSaved(`Auto-saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      return updated;
    });
  };

  const setItemException = (id, exceptionText) => {
    setEvaluations(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { s: 'u', note: '', source: '' }),
        exception: exceptionText
      }
    }));
  };

  const handleClearChecklist = () => {
    if (confirm('Are you sure you want to clear all evaluated items?')) {
      const reset = {};
      ALL_CHECKLIST_ITEMS.forEach(it => {
        reset[it.id] = { s: 'u', note: '', source: '', exception: '' };
      });
      setEvaluations(reset);
      setSynthesizedAudit(null);
      setPageSpeedData(null);
      showToast('Checklist reset to initial state.');
    }
  };

  // ── Telemetry Timer & Animation ─────────────────────────────────────────
  const startAuditTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const diff = Date.now() - startTimeRef.current;
      const mm = String(Math.floor(diff / 60000)).padStart(2, '0');
      const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      const ms = String(Math.floor((diff % 1000) / 100));
      setLoaderElapsed(`${mm}:${ss}.${ms}`);
    }, 100);
  };

  const stopAuditTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── API Fetchers ────────────────────────────────────────────────────────
  async function fetchPageCheck(pageUrl, signal) {
    try {
      const r = await fetch('/api/page-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
        signal
      });
      if (!r.ok) return { ok: false, skipped: true, error: 'Local Page Check headless runner not active' };
      return await r.json();
    } catch (e) {
      return { ok: false, skipped: true, error: e.message };
    }
  }

  // ── API Fetchers (Strict Server-Side Proxying & Security) ────────────────
  async function fetchPageCheck(pageUrl, signal) {
    try {
      const r = await fetch('/api/page-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
        signal
      });
      if (!r.ok) return { ok: false, error: `Page Check returned HTTP ${r.status}` };
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function fetchPageSpeed(pageUrl, signal) {
    try {
      const r = await fetch('/api/pagespeed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
        signal
      });
      if (!r.ok) return { ok: false, error: `PageSpeed returned HTTP ${r.status}` };
      const res = await r.json();
      if (res && res.ok && res.data) {
        setPageSpeedData(res.data);
      }
      return res;
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  async function fetchRankNibblerAll(pageUrl, signal) {
    try {
      const r = await fetch('/api/ranknibbler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
        signal
      });
      if (!r.ok) return { ok: false, error: `RankNibbler returned HTTP ${r.status}` };
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  async function fetchCitevanaData(pageUrl, signal) {
    try {
      const r = await fetch('/api/citevana?path=page-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl }),
        signal
      });
      if (!r.ok) return { ok: false, error: `Citevana returned HTTP ${r.status}` };
      const data = await r.json();
      return { ok: true, audit: data, result: data.result || data };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  async function callGroqMerge(payload, signal) {
    const bodyStr = JSON.stringify(payload);
    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      signal
    });
    if (!res.ok) throw new Error(`Groq endpoint returned HTTP ${res.status}`);
    return await res.json();
  }

  // ── Main Audit Execution ────────────────────────────────────────────────
  const handleRunAudit = async () => {
    if (isAuditing) return;
    setErrorMessage(null);
    setNoVisSession(null);
    setGroqIncident(null);

    let cleanUrl = targetUrl.trim();
    if (!cleanUrl) {
      setErrorMessage('Please enter a target web page URL to audit.');
      return;
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
      setTargetUrl(cleanUrl);
    }

    if (isPrivateOrLocalUrl(cleanUrl)) {
      setNoVisSession({
        title: 'Target Has No Front-End Visibility',
        reason: 'Local / Private Address (No Public Front-End Visibility)',
        text: 'Remote audit engines and Google PageSpeed cannot connect to your private machine or local development port. 0 external API requests were sent.',
        action: 'Expose your local development port via a secure public tunnel (e.g., ngrok or Cloudflare Tunnel) or deploy to a public staging URL.'
      });
      return;
    }

    setIsAuditing(true);
    setModalState('audit');
    setLoaderStep(1);
    setLoaderSub('Calling Diagnostic Engines…');
    setTerminalText('Initializing telemetry connection…');
    startAuditTimer();

    // Sentinel Watchdog
    setGroqSentinelStatus({ state: 'active', label: 'Groq Sentinel: Monitoring Pipeline' });
    if (groqWatchdogRef.current) clearTimeout(groqWatchdogRef.current);
    groqWatchdogRef.current = setTimeout(() => {
      stopAuditTimer();
      setIsAuditing(false);
      setModalState('none');
      setErrorMessage('Audit operation timed out after 60 seconds.');
      setGroqSentinelStatus({ state: 'alert', label: 'Groq Sentinel: Loop Break Enforced' });
    }, 60000);

    const pcController = new AbortController();
    const psiController = new AbortController();
    const rnController = new AbortController();
    const cvController = new AbortController();

    const tStep2 = setTimeout(() => {
      setLoaderStep(2);
      setLoaderSub('Executing Page Check & SEO Diagnostics');
      setTerminalText('[PAGE CHECK] Inspecting viewport layouts and metadata…');
      setMarkerState('DOM VERIFY');
    }, 800);

    const tStep3 = setTimeout(() => {
      setLoaderStep(3);
      setLoaderSub('Measuring PageSpeed & Technical Vitals');
      setTerminalText('[TEST] Running mobile Lighthouse audit & gathering metrics…');
    }, 1600);

    try {
      const pPageCheck = fetchPageCheck(cleanUrl, pcController.signal);
      const pPageSpeed = fetchPageSpeed(cleanUrl, psiController.signal);
      const pRankNibbler = (selectedEngine === 'full' || selectedEngine === 'ranknibbler')
        ? fetchRankNibblerAll(cleanUrl, rnController.signal)
        : Promise.resolve({ ok: false, skipped: true });
      const pCitevana = (selectedEngine === 'full' || selectedEngine === 'citevana')
        ? fetchCitevanaData(cleanUrl, cvController.signal)
        : Promise.resolve({ ok: false, skipped: true });

      const settled = await Promise.allSettled([pPageCheck, pPageSpeed, pRankNibbler, pCitevana]);

      clearTimeout(tStep2);
      clearTimeout(tStep3);
      if (groqWatchdogRef.current) clearTimeout(groqWatchdogRef.current);

      let pcRes = settled[0].status === 'fulfilled' ? settled[0].value : { ok: false };
      let psiRes = settled[1].status === 'fulfilled' ? settled[1].value : { ok: false };
      let rnRes = settled[2].status === 'fulfilled' ? settled[2].value : { ok: false };
      let cvRes = settled[3].status === 'fulfilled' ? settled[3].value : { ok: false };

      // Engine Failover if needed
      if ((!cvRes || !cvRes.ok) && selectedEngine === 'citevana' && (!rnRes || !rnRes.ok)) {
        try {
          setLoaderSub('Citevana busy — Failing over to RankNibbler…');
          rnRes = await fetchRankNibblerAll(cleanUrl);
        } catch (e) {}
      }
      if ((!rnRes || !rnRes.ok) && selectedEngine === 'ranknibbler' && (!cvRes || !cvRes.ok)) {
        try {
          setLoaderSub('RankNibbler unavailable — Failing over to Citevana…');
          cvRes = await fetchCitevanaData(cleanUrl);
        } catch (e) {}
      }

      // Check Front-End Visibility
      const primaryData = rnRes?.audit || cvRes?.audit || null;
      if (primaryData && (primaryData.statusCode === 404 || primaryData.statusCode === 500)) {
        stopAuditTimer();
        setIsAuditing(false);
        setModalState('none');
        setNoVisSession({
          title: `Server Error HTTP ${primaryData.statusCode}`,
          reason: 'Target returned an error status code',
          text: `Target page returned HTTP ${primaryData.statusCode}. The audit was halted to avoid recording invalid telemetry.`,
          action: 'Ensure the server is operational and public before auditing.'
        });
        return;
      }

      // Determine Sources State
      const currentSources = {
        pageCheck: pcRes?.ok ? 'Cloud Mode (Engine Merged)' : (pcRes?.skipped ? 'Skipped (Cloud Mode)' : 'Offline'),
        pagespeed: psiRes?.ok ? `Available (${psiRes.keyUsed === 'fallback' ? 'Fallback' : 'Primary'} Key)` : 'Unavailable',
        ranknibbler: rnRes?.skipped ? 'Skipped (Quick Check)' : (rnRes?.ok ? 'Available' : 'Unavailable'),
        citevana: cvRes?.skipped ? 'Skipped (Quick Check)' : (cvRes?.ok ? 'Available' : 'Unavailable')
      };
      setSourcesStatus(currentSources);
      setSourcesBarVisible(true);

      // PageSpeed formatted
      if (psiRes && psiRes.ok && psiRes.data) {
        setPageSpeedData({
          score: psiRes.data.score,
          fcp: psiRes.data.fcp || '—',
          lcp: psiRes.data.lcp || '—',
          tbt: psiRes.data.tbt || '—',
          cls: psiRes.data.cls || '—',
          si: psiRes.data.speedIndex || '—',
          majorOps: (psiRes.data.opportunities || []).map(op => ({
            title: op.title,
            displayValue: op.displayValue || '',
            savingsMs: op.savingsMs || 0,
            savingsBytes: op.savingsBytes || 0
          }))
        });
      }

      setLoaderStep(4);
      setLoaderSub('Synthesizing Findings via Groq AI & Rules');
      setTerminalText('[GROQ MERGE] Synthesizing multi-source evidence into 23 checklist criteria…');

      // Baseline deterministic in-code evaluations
      const baselineEvaluations = evaluateChecklistInCode(pcRes, psiRes, rnRes, cvRes);
      let finalEvaluations = { ...baselineEvaluations };

      // Groq AI Merge attempt
      try {
        const groqController = new AbortController();
        const groqTimeout = setTimeout(() => groqController.abort(), 14000);

        const promptData = {
          url: cleanUrl,
          engineMode: selectedEngine,
          sourcesAvailable: currentSources,
          checklistItems: ALL_CHECKLIST_ITEMS.map(i => ({ id: i.id, title: i.title, rule: i.rule })),
          pageCheckSummary: pcRes?.ok ? {
            meta: pcRes.meta || {},
            headingsCount: pcRes.headings?.length || 0,
            h1s: pcRes.h1s || [],
            emptyHeadings: pcRes.emptyHeadings || [],
            skippedHierarchies: pcRes.skippedHierarchies || [],
            images: pcRes.images || {},
            links: pcRes.links || {},
            buttons: pcRes.buttons || {},
            typography: pcRes.typography || {},
            hits: pcRes.hits || []
          } : 'Page Check offline',
          pageSpeedSummary: psiRes?.ok && psiRes.data ? {
            score: psiRes.data.score,
            lcp: psiRes.data.lcp,
            cls: psiRes.data.cls,
            tbt: psiRes.data.tbt,
            speedIndex: psiRes.data.speedIndex,
            consoleErrorsCount: psiRes.data.consoleErrorsCount,
            consoleErrors: psiRes.data.consoleErrors || [],
            viewportPassed: psiRes.data.viewportPassed,
            contentWidthPassed: psiRes.data.contentWidthPassed,
            tapTargetsPassed: psiRes.data.tapTargetsPassed,
            fontSizePassed: psiRes.data.fontSizePassed,
            opportunities: (psiRes.data.opportunities || []).map(o => o.title)
          } : 'PageSpeed offline',
          rankNibblerSummary: rnRes?.ok ? (rnRes.audit?.checks || rnRes.checks) : 'RankNibbler offline',
          citevanaSummary: cvRes?.ok ? (cvRes.audit?.result || cvRes.result) : 'Citevana offline'
        };

        const groqPayload = {
          model: 'qwen/qwen3.8-27b',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are an expert QA technical auditor. Evaluate the 23 checklist items by interpreting the real multi-source telemetry provided. Return a JSON object {"evaluations": { [itemId]: { "s": "p"|"f"|"nv", "note": string, "source": string } }}.\n\nSTRICT COMPLIANCE RULES:\n1. Do NOT hallucinate or invent missing data, errors, or elements. Base every evaluation strictly on the collected telemetry.\n2. PASS ("p"): Mark ONLY when collected evidence confirms the requirement is satisfied.\n3. FAIL ("f"): Mark ONLY when verified evidence confirms an actual issue or non-compliance. Include specific count or element details in the note.\n4. NOT VERIFIED ("nv"): If a check cannot be completed, if an API timed out or is unavailable, or if telemetry is missing, select "nv". Never mark "f" without concrete evidence of an actual issue.\n5. In notes for "nv", state what was missing or why verification was incomplete.'
            },
            {
              role: 'user',
              content: JSON.stringify(promptData)
            }
          ]
        };

        const groqRes = await callGroqMerge(groqPayload, groqController.signal);
        clearTimeout(groqTimeout);

        if (groqRes && groqRes.choices && groqRes.choices[0]?.message) {
          const content = groqRes.choices[0].message.content;
          const parsed = JSON.parse(content);
          const aiEvals = parsed.evaluations || parsed;
          if (typeof aiEvals === 'object') {
            for (const itKey in baselineEvaluations) {
              if (aiEvals[itKey] && (aiEvals[itKey].s === 'p' || aiEvals[itKey].s === 'f' || aiEvals[itKey].s === 'nv')) {
                // 1. If measured Page Check found a defect, keep the defect
                if (baselineEvaluations[itKey].s === 'f' && baselineEvaluations[itKey].source === 'Page Check' && aiEvals[itKey].s !== 'f') {
                  continue;
                }
                // 2. Prevent AI hallucinations from marking unmeasured visual checks as Pass
                if (baselineEvaluations[itKey].s === 'nv' && aiEvals[itKey].s === 'p') {
                  const unmeasuredVisuals = [
                    'type-heading-size',
                    'type-button-size',
                    'color-brand-palette',
                    'link-button-styles',
                    'resp-desktop-small',
                    'resp-tablet-responsive'
                  ];
                  if (unmeasuredVisuals.includes(itKey)) {
                    continue;
                  }
                }
                finalEvaluations[itKey] = {
                  s: aiEvals[itKey].s,
                  note: aiEvals[itKey].note || baselineEvaluations[itKey].note,
                  source: aiEvals[itKey].source || baselineEvaluations[itKey].source,
                  exception: ''
                };
              }
            }
          }
        }
      } catch (gErr) {
        console.warn('Groq AI fallback to deterministic merger:', gErr);
      }

      // Enforce merge & evidence rules
      const enforced = enforceMergeAndEvidenceRules(finalEvaluations, pcRes, psiRes, rnRes, cvRes);

      // Assemble issues list and unverified list
      const issuesList = [];
      const unverifiedList = [];
      if (enforced.highDefects?.length > 0) {
        enforced.highDefects.forEach(hd => issuesList.push(`[HIGH PRIORITY] ${hd}`));
      }
      for (const cId in enforced.evaluations) {
        const itEval = enforced.evaluations[cId];
        if (itEval.s === 'f') {
          const cleanNote = itEval.note;
          const src = itEval.source || 'Issue';
          if (!issuesList.some(i => i.includes(cleanNote.substring(0, 30)))) {
            issuesList.push(`[${src}] ${cleanNote}`);
          }
        } else if (itEval.s === 'nv') {
          const cleanNote = itEval.note;
          const src = itEval.source || 'Unverified';
          unverifiedList.push(`[${src}] ${cleanNote}`);
        }
      }

      setSynthesizedAudit({
        score: enforced.score,
        grade: enforced.grade,
        passedCount: enforced.passedCount,
        failedCount: enforced.failedCount,
        notVerifiedCount: enforced.notVerifiedCount,
        issues: issuesList,
        unverified: unverifiedList,
        provider: selectedEngine === 'full' ? 'Multi-Engine Merged' : (selectedEngine === 'citevana' ? 'Citevana AI Engine (Quick Check)' : 'RankNibbler Core (Quick Check)')
      });

      setEvaluations(enforced.evaluations);
      stopAuditTimer();
      setIsAuditing(false);
      setModalState('result');
      setLastSaved(`Auto-saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setGroqSentinelStatus({ state: 'active', label: 'Groq Sentinel: Multi-Source Audit Verified (0 loops)' });
    } catch (err) {
      stopAuditTimer();
      setIsAuditing(false);
      setModalState('none');
      const errText = err?.message || 'Audit execution encountered an unexpected error.';
      setErrorMessage(errText);
      setGroqIncident({
        title: '🛡 Groq AI Sentinel Diagnosis',
        text: `Pipeline interrupted while communicating with diagnostic endpoints: ${errText}`,
        recovery: 'Safe Recovery: Check internet connectivity and verify the target page is online.'
      });
    }
  };

  // ── HTML Escaper for Safe PDF Export ─────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── PDF Export ──────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    setIsGeneratingPdf(true);
    const safeProject = projectName.trim() || 'Single Page Audit';
    const safeAuditor = auditorName.trim() || 'QA Lead';
    const safeTitle = reportTitle.trim() || 'Pre-Launch Single Page Audit Report';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const scoreVal = synthesizedAudit ? synthesizedAudit.score : stats.pct;
    const gradeVal = synthesizedAudit ? synthesizedAudit.grade : (stats.failed === 0 ? 'A' : 'B');
    const isPass = stats.failed === 0;

    let psiHtml = '';
    if (pageSpeedData && typeof pageSpeedData.score === 'number') {
      psiHtml = `
        <div class="pdf-psi-box" style="margin-bottom:14px; padding:12px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; font-size:12px; line-height:1.5; page-break-inside:avoid; break-inside:avoid;">
          <div style="font-weight:700; color:#1e40af; margin-bottom:4px;">Google PageSpeed Mobile Telemetry: Score ${escapeHtml(pageSpeedData.score)}/100</div>
          <div><strong>LCP:</strong> ${escapeHtml(pageSpeedData.lcp)} &bull; <strong>CLS:</strong> ${escapeHtml(pageSpeedData.cls)} &bull; <strong>TBT:</strong> ${escapeHtml(pageSpeedData.tbt)} &bull; <strong>Speed Index:</strong> ${escapeHtml(pageSpeedData.si)}</div>
        </div>
      `;
    }

    let categoriesHtml = '';
    AUDIT_DATA.forEach((group, gi) => {
      let groupPass = 0;
      let groupFail = 0;
      let groupNotVerified = 0;
      let itemsHtml = '';

      group.items.forEach((it, iIdx) => {
        const ev = evaluations[it.id] || { s: 'u', note: '', source: '', exception: '' };
        if (ev.s === 'p') groupPass++;
        else if (ev.s === 'f') groupFail++;
        else if (ev.s === 'nv') groupNotVerified++;

        const stClass = ev.s === 'p' ? 'p' : (ev.s === 'f' ? 'f' : (ev.s === 'nv' ? 'nv' : 'u'));
        const stText = ev.s === 'p' ? 'PASS' : (ev.s === 'f' ? 'FAIL' : (ev.s === 'nv' ? 'NOT VERIFIED' : 'PENDING'));

        let evHtml = '';
        if (ev.note) {
          const srcPrefix = ev.source ? `<span style="font-weight:700; color:#334155; text-transform:uppercase; font-size:10.5px; margin-right:4px;">[${escapeHtml(ev.source)}]</span> ` : '';
          const evBoxClass = ev.s === 'p' ? 'pass' : (ev.s === 'f' ? 'fail' : 'nv');
          evHtml = `<div class="pdf-item-evidence ${evBoxClass}"><strong>Evidence:</strong> ${srcPrefix}${escapeHtml(ev.note)}</div>`;
        }
        let exHtml = '';
        if (ev.exception) {
          exHtml = `<div class="pdf-item-evidence" style="border-left-color:#3b82f6; background:#eff6ff; color:#1e40af;"><strong>Client Exception:</strong> ${escapeHtml(ev.exception)}</div>`;
        }

        itemsHtml += `
          <div class="pdf-item-row">
            <div class="pdf-item-top">
              <span class="pdf-item-title">${iIdx + 1}. ${escapeHtml(it.title)}</span>
              <span class="pdf-status-pill ${stClass}">${stText}</span>
            </div>
            <div class="pdf-item-rule">${escapeHtml(it.rule)}</div>
            ${evHtml}
            ${exHtml}
          </div>
        `;
      });

      const catBadgeClass = groupFail > 0 ? 'fail' : (groupNotVerified > 0 ? 'nv' : 'pass');
      const catBadgeText = groupFail > 0
        ? `${groupFail} issue(s)`
        : (groupNotVerified > 0 ? `${groupNotVerified} unverified` : `${groupPass}/${group.items.length} passed`);

      categoriesHtml += `
        <div class="pdf-category-section">
          <div class="pdf-cat-header">
            <span class="pdf-cat-title">Category 0${gi + 1} &bull; ${escapeHtml(group.name)}</span>
            <span class="pdf-cat-badge ${catBadgeClass}">${escapeHtml(catBadgeText)}</span>
          </div>
          ${itemsHtml}
        </div>
      `;
    });

    const fullDossierHtml = `
      <div class="pdf-header-block">
        <div class="pdf-title-group">
          <h1>${escapeHtml(safeTitle)}</h1>
        </div>
        <div class="pdf-badge-group">
          <div class="pdf-score-badge">Score: ${escapeHtml(scoreVal)}/100 (${escapeHtml(gradeVal)})</div>
          <div class="pdf-verdict-tag ${isPass ? 'pass' : 'fail'}">${escapeHtml(verdictInfo.badge)}</div>
        </div>
      </div>
      <table class="pdf-meta-table">
        <tr>
          <td class="k">Project Name</td><td class="v">${escapeHtml(safeProject)}</td>
          <td class="k">Auditor / Lead</td><td class="v">${escapeHtml(safeAuditor)}</td>
        </tr>
        <tr>
          <td class="k">Target URL</td><td class="v" style="font-family:monospace; word-break:break-all;">${escapeHtml(targetUrl)}</td>
          <td class="k">Audit Timestamp</td><td class="v">${escapeHtml(dateStr)}</td>
        </tr>
      </table>
      <div class="pdf-summary-bar">
        <div class="pdf-summary-stat"><span class="num">${stats.total}</span><span class="lbl">Total Standards</span></div>
        <div class="pdf-summary-stat"><span class="num" style="color:#059669;">${stats.passed}</span><span class="lbl">Passed Checks</span></div>
        <div class="pdf-summary-stat"><span class="num" style="color:#d97706;">${stats.notVerified}</span><span class="lbl">Not Verified</span></div>
        <div class="pdf-summary-stat"><span class="num" style="color:#dc2626;">${stats.failed}</span><span class="lbl">Issues Flagged</span></div>
        <div class="pdf-summary-stat"><span class="num" style="color:#64748b;">${stats.pending}</span><span class="lbl">Pending Action</span></div>
      </div>
      ${psiHtml}
      <div style="margin-top:14px;">${categoriesHtml}</div>
      <div style="margin-top:16px; padding-top:10px; border-top:1px solid #cbd5e1; font-size:11px; color:#64748b; display:flex; justify-content:space-between; page-break-inside:avoid; break-inside:avoid;">
        <span>Generated via Antigravity Page Audit Checklist</span>
        <span>Verified Single-Page Pre-Launch Report</span>
      </div>
    `;

    const tempWrapper = document.createElement('div');
    tempWrapper.className = 'pdf-export-wrapper';
    tempWrapper.style.position = 'fixed';
    tempWrapper.style.left = '-9999px';
    tempWrapper.style.top = '0';
    tempWrapper.style.width = '794px';
    tempWrapper.style.zIndex = '-9999';
    tempWrapper.style.padding = '20px';
    tempWrapper.style.background = '#ffffff';
    tempWrapper.style.color = '#0f172a';
    tempWrapper.style.boxSizing = 'border-box';
    tempWrapper.innerHTML = fullDossierHtml;
    document.body.appendChild(tempWrapper);

    const safeFilename = `Audit-Report-${safeProject.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 32)}.pdf`;

    const cleanup = () => {
      if (tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      setIsGeneratingPdf(false);
    };

    if (typeof window !== 'undefined' && window.html2pdf) {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: safeFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          scrollY: 0,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['.pdf-item-row', '.pdf-cat-header', '.pdf-meta-table', '.pdf-summary-bar', '.pdf-header-block', '.pdf-psi-box']
        }
      };

      window.html2pdf().set(opt).from(tempWrapper).save().then(() => {
        cleanup();
        showToast('✓ PDF Report downloaded successfully!');
      }).catch(err => {
        console.error('PDF error, using print fallback:', err);
        cleanup();
        window.print();
      });
    } else {
      cleanup();
      window.print();
    }
  };

  // ── Render Helpers ──────────────────────────────────────────────────────
  const activeCategory = AUDIT_DATA[activeCategoryIndex] || AUDIT_DATA[0];

  return (
    <>
      {/* Top Specification Bar */}
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="brand-badge">
            <span className="brand-indicator"></span>
            <span>Page Audit &bull; Before Launch</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              className={`groq-sentinel-badge state-${groqSentinelStatus.state}`}
              id="groqSentinelBadge"
              title="Groq AI Sentinel: Monitoring telemetry health, schema validation & failover protection"
              role="status"
            >
              <span className="groq-sentinel-dot"></span>
              <span className="groq-sentinel-label" id="groqSentinelLabel">{groqSentinelStatus.label}</span>
            </div>
            <button
              className="theme-btn"
              onClick={toggleTheme}
              aria-label="Toggle color mode"
              title="Toggle color mode"
            >
              <span className="theme-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="theme-svg">
                  <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
                  <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
                </svg>
              </span>
              <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Two-Step Progress Navigation Header */}
      <nav className="step-nav-bar" id="stepNavBar" aria-label="Audit Step Progress">
        <div className="step-nav-inner">
          <button
            type="button"
            className={`step-nav-item ${workflowStep === 1 ? 'active' : 'done'}`}
            onClick={() => setWorkflowStep(1)}
          >
            <span className="step-nav-num">1</span>
            <span className="step-nav-info">
              <span className="step-nav-title">Step 1: Project Setup &amp; AI Audit</span>
              <span className="step-nav-sub">Configure details &amp; scan target URL</span>
            </span>
          </button>
          <div className="step-nav-divider">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <button
            type="button"
            className={`step-nav-item ${workflowStep === 2 ? 'active' : ''}`}
            onClick={() => setWorkflowStep(2)}
          >
            <span className="step-nav-num">2</span>
            <span className="step-nav-info">
              <span className="step-nav-title">Step 2: Quality Checklist &amp; PDF Report</span>
              <span className="step-nav-sub">Review 23 checks &amp; download PDF report</span>
            </span>
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1: Intake & Mission Control Screen                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {workflowStep === 1 && (
        <section className="step1-container" id="step1Container">
          <div className="step1-grid">
            {/* Left Column: Setup Intake Form */}
            <div className="step1-card step1-form-card">
              <div className="step1-card-header">
                <div className="step1-card-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h2 className="step1-card-title">Pre-Launch Audit Setup</h2>
                  <p className="step1-card-desc">Enter project details and target page URL. These will be included in your final PDF audit report.</p>
                </div>
              </div>

              <form id="step1Form" className="step1-form" onSubmit={(e) => { e.preventDefault(); handleRunAudit(); }}>
                <div className="step1-fields-row">
                  <div className="field">
                    <label htmlFor="stepProjectName">Project Name <span className="required-star">*</span></label>
                    <input
                      type="text"
                      id="stepProjectName"
                      placeholder="e.g. Acme Corp Web Redesign"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="stepAuditorName">Your Name / Auditor <span className="required-star">*</span></label>
                    <input
                      type="text"
                      id="stepAuditorName"
                      placeholder="e.g. Alex Chen (QA Lead)"
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="stepReportTitle">Audit Report Title</label>
                  <input
                    type="text"
                    id="stepReportTitle"
                    placeholder="e.g. Single Page Quality & SEO Audit Report"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="rnUrlInput">Page URL to audit <span className="required-star">*</span></label>
                  <input
                    type="url"
                    id="rnUrlInput"
                    placeholder="https://example.com/page-to-test"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="auditEngineSelect">Audit Engine</label>
                  <select
                    id="auditEngineSelect"
                    className="audit-engine-select"
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value)}
                  >
                    <option value="full">Full Audit: RankNibbler + Citevana + Page Check, merged by Groq (default, recommended)</option>
                    <option value="ranknibbler">RankNibbler only (quick check)</option>
                    <option value="citevana">Citevana only (quick check)</option>
                  </select>
                  {selectedEngine !== 'full' && (
                    <div className="quick-check-note" style={{ display: 'block', fontSize: '12.5px', color: 'var(--warn-ink, #b45309)', background: 'var(--warn-bg, #fffbeb)', border: '1px solid var(--warn-border, #fcd34d)', padding: '8px 12px', borderRadius: '6px', marginTop: '8px', lineHeight: 1.4 }}>
                      ⚠️ Partial audit. Layout and merged checks may be incomplete.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-step1-submit"
                  id="btnRunAudit"
                  disabled={isAuditing}
                >
                  {isAuditing ? (
                    <>
                      <span className="btn-spinner" style={{ borderTopColor: '#fff', marginRight: '8px' }}></span>
                      Auditing Target URL…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Launch AI Audit &amp; Proceed to Step 2
                    </>
                  )}
                </button>

                {/* Pre-Flight Pipeline & Diagnostic Scope */}
                <div className="step1-preflight-panel">
                  <div className="preflight-header">
                    <span className="preflight-title">Pre-Flight Audit Safeguards</span>
                    <span className="preflight-pill">Automatic Verification</span>
                  </div>
                  <div className="preflight-grid">
                    <div className="preflight-item">
                      <div className="preflight-item-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                      <div className="preflight-item-content">
                        <div className="preflight-item-name">Front-End Visibility Guard</div>
                        <div className="preflight-item-desc">Pre-verifies public access before consuming AI quota.</div>
                      </div>
                    </div>
                    <div className="preflight-item">
                      <div className="preflight-item-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                      <div className="preflight-item-content">
                        <div className="preflight-item-name">Groq AI Failover Protection</div>
                        <div className="preflight-item-desc">Auto-routes to Citevana if primary engine stalls.</div>
                      </div>
                    </div>
                    <div className="preflight-item">
                      <div className="preflight-item-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 11 12 14 22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                      </div>
                      <div className="preflight-item-content">
                        <div className="preflight-item-name">23 Technical Quality Checks</div>
                        <div className="preflight-item-desc">Structure, contrast, typography rhythm &amp; vitals.</div>
                      </div>
                    </div>
                    <div className="preflight-item">
                      <div className="preflight-item-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <line x1="9" y1="15" x2="12" y2="18" />
                          <line x1="15" y1="15" x2="12" y2="18" />
                        </svg>
                      </div>
                      <div className="preflight-item-content">
                        <div className="preflight-item-name">Direct PDF Report Export</div>
                        <div className="preflight-item-desc">Zero-cutoff client report generated in Step 2.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="rn-error-msg" style={{ display: 'block' }}>
                    {errorMessage}
                  </div>
                )}

                {noVisSession && (
                  <div className="rn-no-visibility-box visible" id="rnNoVisibilityBox">
                    <div className="rn-no-vis-header">
                      <span className="rn-no-vis-badge">SESSION TERMINATED</span>
                      <span className="rn-no-vis-tag">Tokens &amp; Quota Preserved</span>
                    </div>
                    <div className="rn-no-vis-title">{noVisSession.title}</div>
                    <div className="rn-no-vis-reason">{noVisSession.reason}</div>
                    <p className="rn-no-vis-text">{noVisSession.text}</p>
                    <div className="rn-no-vis-action">
                      <strong>Action required:</strong> {noVisSession.action}
                    </div>
                    <div className="rn-no-vis-footer">
                      <button
                        type="button"
                        className="btn-dismiss-novis"
                        onClick={() => setNoVisSession(null)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                        Dismiss &amp; Update URL
                      </button>
                    </div>
                  </div>
                )}

                {groqIncident && (
                  <div className="groq-incident-box visible" id="groqIncidentBox">
                    <div className="groq-incident-header">
                      <span>{groqIncident.title}</span>
                      <span className="groq-incident-tag">Reliability Guard</span>
                    </div>
                    <div className="groq-incident-text">{groqIncident.text}</div>
                    <div className="groq-incident-recovery">{groqIncident.recovery}</div>
                  </div>
                )}
              </form>
            </div>

            {/* Right Column: Live Audit Monitor Widget */}
            <div className="step1-card step1-widget-card" id="step1MissionWidget">
              <div className="mission-widget-header">
                <div className="mission-badge">
                  <span className="mission-dot"></span>
                  <span>LIVE AUDIT MONITOR</span>
                </div>
                <span className="mission-tag">DOM Telemetry v2.4</span>
              </div>

              {/* Dynamic Dossier Card */}
              <div className="live-dossier-card">
                <div className="live-dossier-top">
                  <div className="live-dossier-chip">REPORT PREVIEW</div>
                  <div className="live-dossier-date">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                  </div>
                </div>
                <div className="live-dossier-title">{reportTitle || 'Audit Report Preview'}</div>
                <div className="live-dossier-meta-grid">
                  <div className="live-meta-item">
                    <span className="live-meta-k">PROJECT</span>
                    <span className="live-meta-v">{projectName || '—'}</span>
                  </div>
                  <div className="live-meta-item">
                    <span className="live-meta-k">AUDITOR</span>
                    <span className="live-meta-v">{auditorName || '—'}</span>
                  </div>
                  <div className="live-meta-item full-width">
                    <span className="live-meta-k">TARGET ENDPOINT</span>
                    <span className="live-meta-v mono">{targetUrl || 'Awaiting URL input…'}</span>
                  </div>
                </div>
              </div>

              {/* Radar Scanner Widget */}
              <div className="radar-viewport">
                <div className="radar-scope" id="radarScope">
                  <div className="radar-grid-ring r1"></div>
                  <div className="radar-grid-ring r2"></div>
                  <div className="radar-grid-ring r3"></div>
                  <div className="radar-crosshair-h"></div>
                  <div className="radar-crosshair-v"></div>
                  <div className="radar-sweep-beam"></div>

                  <div
                    className="radar-node node-rn"
                    onMouseEnter={() => setRadarStatusMsg('RankNibbler Core: 23 technical checks for SEO & structure')}
                    title="RankNibbler Core"
                  >
                    <span className="node-dot"></span>
                    <span className="node-label">RankNibbler</span>
                  </div>
                  <div
                    className="radar-node node-psi"
                    onMouseEnter={() => setRadarStatusMsg('Google PageSpeed: Mobile Lighthouse performance & Core Web Vitals')}
                    title="Google PageSpeed"
                  >
                    <span className="node-dot"></span>
                    <span className="node-label">PageSpeed</span>
                  </div>
                  <div
                    className="radar-node node-cv"
                    onMouseEnter={() => setRadarStatusMsg('Citevana AI: AI crawler access (GPTBot, ClaudeBot) & schemas')}
                    title="Citevana AI"
                  >
                    <span className="node-dot"></span>
                    <span className="node-label">Citevana AI</span>
                  </div>
                  <div
                    className="radar-node node-groq"
                    onMouseEnter={() => setRadarStatusMsg('Groq AI Sentinel: Reliability monitor & failover watchdog')}
                    title="Groq AI Sentinel"
                  >
                    <span className="node-dot"></span>
                    <span className="node-label">Groq AI</span>
                  </div>
                </div>
                <div className="radar-telemetry-text">
                  <span className="telemetry-prompt">RADAR STATUS:</span>
                  <span className="telemetry-stat" id="radarStatusMsg">{radarStatusMsg}</span>
                </div>
              </div>

              {/* System Capabilities Matrix */}
              <div className="step1-capabilities-grid">
                <div className="cap-item">
                  <span className="cap-check">✓</span>
                  <span>WCAG AA Contrast Standards</span>
                </div>
                <div className="cap-item">
                  <span className="cap-check">✓</span>
                  <span>Core Web Vitals Metrics</span>
                </div>
                <div className="cap-item">
                  <span className="cap-check">✓</span>
                  <span>23 Quality Standards</span>
                </div>
                <div className="cap-item">
                  <span className="cap-check">✓</span>
                  <span>Direct PDF Download</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2: Quality Ledger & PDF Report Screen                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {workflowStep === 2 && (
        <section className="step2-container" id="step2Container">
          {/* Step 2 Top Ribbon Bar */}
          <div className="step2-ribbon-container">
            <div className="step2-ribbon-bar">
              <div className="ribbon-meta">
                <div className="ribbon-project-title">
                  <span>Project: {projectName || 'Pre-Launch Audit'}</span>
                  {synthesizedAudit && (
                    <span className={`rn-grade-badge rn-grade-${String(synthesizedAudit.grade || 'F').replace(/[^a-zA-Z]/g, '')}`} style={{ display: 'inline-block', marginLeft: '8px' }}>
                      {synthesizedAudit.grade}
                    </span>
                  )}
                </div>
                <div className="ribbon-sub-info">
                  <span>Auditor: <strong>{auditorName || '—'}</strong></span>
                  <span className="ribbon-sep">&bull;</span>
                  <span>Target: <strong className="mono">{targetUrl || '—'}</strong></span>
                  <span className="ribbon-sep">&bull;</span>
                  <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="ribbon-actions">
                <button
                  type="button"
                  className="btn-step-back"
                  onClick={() => setWorkflowStep(1)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Edit Setup (Step 1)</span>
                </button>
                <button
                  type="button"
                  className="btn-export-pdf"
                  onClick={handleExportPdf}
                  disabled={isGeneratingPdf}
                >
                  {isGeneratingPdf ? (
                    <>
                      <span className="btn-spinner" style={{ borderTopColor: '#fff', marginRight: '6px' }}></span>
                      Generating PDF…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="12" y2="18" />
                        <line x1="15" y1="15" x2="12" y2="18" />
                      </svg>
                      Download PDF Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Workbench Layout */}
          <main className="layout-workbench">
            {/* Left Control Sidebar */}
            <aside className="workbench-sidebar">
              <header className="page-header">
                <div className="page-header-row">
                  <h1 className="page-title">Page Audit Checklist</h1>
                  <span className="save-status">{lastSaved}</span>
                </div>
                <p className="page-subtitle">Verify all technical standards before sharing with the client.</p>
              </header>

              {/* Inspector HUD Card */}
              <div className="hud-card">
                <div className="verdict-banner">
                  <div className={`verdict-badge ${verdictInfo.cls}`} id="overallVerdict">
                    {verdictInfo.badge}
                  </div>
                  <p className="verdict-subtext">{verdictInfo.sub}</p>
                </div>

                {/* Progress Gauge */}
                <div className="progress-section">
                  <div className="progress-header">
                    <span className="progress-label">Audit Progress</span>
                    <span className="progress-value">{stats.pct}% Complete</span>
                  </div>
                  <div className="progress-meter" aria-hidden="true">
                    <div
                      className="meter-seg meter-pass"
                      style={{ width: `${(stats.passed / stats.total) * 100}%` }}
                    ></div>
                    <div
                      className="meter-seg meter-nv"
                      style={{ width: `${(stats.notVerified / stats.total) * 100}%` }}
                    ></div>
                    <div
                      className="meter-seg meter-fail"
                      style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="progress-meta-text">
                    {stats.pending > 0
                      ? `${stats.pending} checks remaining`
                      : `${stats.passed} passed • ${stats.failed} failed • ${stats.notVerified} unverified`}
                  </div>
                </div>

                {/* Scorecard Grid */}
                <div className="hud-scorecard">
                  <div className="stat-cards-duo">
                    <div className="stat-card stat-total">
                      <span className="stat-card-label"><span className="stat-dot dot-all"></span> Total</span>
                      <span className="stat-card-value">{stats.total}</span>
                    </div>
                    <div className="stat-card stat-pending">
                      <span className="stat-card-label"><span className="stat-dot dot-pending"></span> Pending</span>
                      <span className="stat-card-value">{stats.pending}</span>
                    </div>
                  </div>
                  <div className="stat-cards-duo">
                    <div className="stat-card stat-pass">
                      <span className="stat-card-label"><span className="stat-dot dot-pass"></span> Passed</span>
                      <span className="stat-card-value">{stats.passed}</span>
                    </div>
                    <div className="stat-card stat-fail">
                      <span className="stat-card-label"><span className="stat-dot dot-fail"></span> Failed</span>
                      <span className="stat-card-value">{stats.failed}</span>
                    </div>
                  </div>
                  <div className="stat-cards-duo" style={{ marginTop: '8px' }}>
                    <div className="stat-card stat-nv" style={{ width: '100%' }}>
                      <span className="stat-card-label"><span className="stat-dot dot-nv"></span> Not Verified</span>
                      <span className="stat-card-value">{stats.notVerified}</span>
                    </div>
                  </div>
                </div>

                <div className="hud-actions" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-reopen-modal"
                    onClick={() => setModalState('result')}
                    style={{ margin: 0 }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="9" y1="3" x2="9" y2="21"></line>
                    </svg>
                    View Full Audit Pop-up
                  </button>
                  <button
                    type="button"
                    className="btn-clear-checklist"
                    onClick={handleClearChecklist}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Clear Checklist
                  </button>
                </div>
              </div>
            </aside>

            {/* Right Column: Verification Checklist */}
            <section className="workbench-content">
              {/* Category Tabs */}
              <nav className="category-tabs-bar" role="tablist" aria-label="Audit Categories">
                {AUDIT_DATA.map((cat, idx) => {
                  const counts = categoryCounts[idx];
                  return (
                    <button
                      key={cat.tab}
                      type="button"
                      className={`cat-tab ${activeCategoryIndex === idx ? 'active' : ''}`}
                      onClick={() => setActiveCategoryIndex(idx)}
                    >
                      <span>{cat.tab}</span>
                      {counts.failed > 0 ? (
                        <span className="cat-tab-badge badge-fail">{counts.failed} fail</span>
                      ) : counts.notVerified > 0 ? (
                        <span className="cat-tab-badge badge-nv">{counts.notVerified} unverified</span>
                      ) : counts.passed === counts.total ? (
                        <span className="cat-tab-badge badge-clean">✓</span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>

              {/* Diagnostic Sources Status Bar */}
              {sourcesBarVisible && (
                <div className="sources-status-bar" style={{ display: 'flex' }}>
                  <span className="sources-status-title">AUDIT SOURCES:</span>
                  <div className="source-status-item">
                    <span className="source-status-dot available"></span>
                    <span className="source-name">Page Check:</span>
                    <span className="source-state">{sourcesStatus.pageCheck}</span>
                  </div>
                  <div className="source-status-item">
                    <span className={`source-status-dot ${sourcesStatus.ranknibbler.includes('Available') ? 'available' : 'skipped'}`}></span>
                    <span className="source-name">RankNibbler:</span>
                    <span className="source-state">{sourcesStatus.ranknibbler}</span>
                  </div>
                  <div className="source-status-item">
                    <span className={`source-status-dot ${sourcesStatus.citevana.includes('Available') ? 'available' : 'unavailable'}`}></span>
                    <span className="source-name">Citevana:</span>
                    <span className="source-state">{sourcesStatus.citevana}</span>
                  </div>
                  <div className="source-status-item">
                    <span className={`source-status-dot ${sourcesStatus.pagespeed.includes('Available') ? 'available' : 'unavailable'}`}></span>
                    <span className="source-name">PageSpeed:</span>
                    <span className="source-state">{sourcesStatus.pagespeed}</span>
                  </div>
                </div>
              )}

              {/* Special Category 8: PageSpeed Interactive Dashboard */}
              {activeCategoryIndex === 7 && (
                <div className="psi-dashboard-card" style={{ marginBottom: '20px' }}>
                  {pageSpeedData ? (
                    <>
                      <div className="psi-header-row">
                        <div className="psi-brand-wrap">
                          <div className="psi-logo-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                          <div>
                            <div className="psi-title">Google PageSpeed Insights &amp; Web Vitals</div>
                            <div className="psi-sub">Official Google Lighthouse mobile engine analysis</div>
                          </div>
                        </div>
                        <div className="psi-meta-chips">
                          <span className="psi-chip">STRATEGY: MOBILE (Moto G Power)</span>
                          <span className="psi-chip psi-chip-verified">LIVE AUDIT COMPLETE</span>
                        </div>
                      </div>

                      <div className="psi-summary-grid">
                        <div className="psi-dial-wrap">
                          <div
                            className="psi-dial"
                            style={{
                              '--score-pct': pageSpeedData.score,
                              '--score-color': scoreColor(pageSpeedData.score)
                            }}
                          >
                            <span className="psi-dial-score">{pageSpeedData.score}</span>
                          </div>
                          <span className={`psi-dial-grade ${pageSpeedData.score >= 90 ? 'tag-good' : pageSpeedData.score >= 50 ? 'tag-warn' : 'tag-poor'}`}>
                            {pageSpeedData.score >= 90 ? 'FAST • GOOD' : pageSpeedData.score >= 50 ? 'AVERAGE • NEEDS WORK' : 'POOR • SLOW'}
                          </span>
                          <span className="psi-dial-label">PERFORMANCE / 100</span>
                        </div>

                        <div className="psi-vitals-grid">
                          <div className="psi-vital-card">
                            <div className="psi-vital-head">
                              <span className="psi-vital-name">LCP</span>
                              <span className={`psi-vital-tag ${parseFloat(pageSpeedData.lcp) <= 2.5 ? 'tag-good' : parseFloat(pageSpeedData.lcp) <= 4.0 ? 'tag-warn' : 'tag-poor'}`}>
                                {parseFloat(pageSpeedData.lcp) <= 2.5 ? 'Good' : parseFloat(pageSpeedData.lcp) <= 4.0 ? 'Needs Work' : 'Poor'}
                              </span>
                            </div>
                            <div className="psi-vital-val">{pageSpeedData.lcp}</div>
                            <div className="psi-vital-bench">Largest Contentful Paint (&le; 2.5s)</div>
                          </div>
                          <div className="psi-vital-card">
                            <div className="psi-vital-head">
                              <span className="psi-vital-name">FCP</span>
                              <span className={`psi-vital-tag ${parseFloat(pageSpeedData.fcp) <= 1.8 ? 'tag-good' : 'tag-warn'}`}>
                                {parseFloat(pageSpeedData.fcp) <= 1.8 ? 'Good' : 'Needs Work'}
                              </span>
                            </div>
                            <div className="psi-vital-val">{pageSpeedData.fcp}</div>
                            <div className="psi-vital-bench">First Contentful Paint (&le; 1.8s)</div>
                          </div>
                          <div className="psi-vital-card">
                            <div className="psi-vital-head">
                              <span className="psi-vital-name">CLS</span>
                              <span className={`psi-vital-tag ${parseFloat(pageSpeedData.cls) <= 0.1 ? 'tag-good' : 'tag-warn'}`}>
                                {parseFloat(pageSpeedData.cls) <= 0.1 ? 'Good' : 'Needs Work'}
                              </span>
                            </div>
                            <div className="psi-vital-val">{pageSpeedData.cls}</div>
                            <div className="psi-vital-bench">Cumulative Layout Shift (&le; 0.1)</div>
                          </div>
                          <div className="psi-vital-card">
                            <div className="psi-vital-head">
                              <span className="psi-vital-name">TBT</span>
                              <span className={`psi-vital-tag ${parseInt(pageSpeedData.tbt, 10) <= 200 ? 'tag-good' : 'tag-poor'}`}>
                                {parseInt(pageSpeedData.tbt, 10) <= 200 ? 'Good' : 'Poor'}
                              </span>
                            </div>
                            <div className="psi-vital-val">{pageSpeedData.tbt}</div>
                            <div className="psi-vital-bench">Total Blocking Time (&le; 200ms)</div>
                          </div>
                          <div className="psi-vital-card">
                            <div className="psi-vital-head">
                              <span className="psi-vital-name">Speed Index</span>
                              <span className={`psi-vital-tag ${parseFloat(pageSpeedData.si) <= 3.4 ? 'tag-good' : 'tag-poor'}`}>
                                {parseFloat(pageSpeedData.si) <= 3.4 ? 'Good' : 'Poor'}
                              </span>
                            </div>
                            <div className="psi-vital-val">{pageSpeedData.si}</div>
                            <div className="psi-vital-bench">Visual Completion (&le; 3.4s)</div>
                          </div>
                        </div>
                      </div>

                      {/* Bottlenecks list */}
                      <div className="psi-issues-section">
                        <div className="psi-issues-head">
                          <div className="psi-issues-title-row">
                            <span className="psi-issues-title">Major Bottlenecks &amp; High-Impact Opportunities</span>
                            <span className={`psi-issues-count-pill ${pageSpeedData.majorOps.length === 0 ? 'pill-clean' : 'pill-warn'}`}>
                              {pageSpeedData.majorOps.length} {pageSpeedData.majorOps.length === 1 ? 'Major Issue' : 'Major Issues'}
                            </span>
                          </div>
                          <span className="psi-issues-sub">Filtered strictly for critical bottlenecks with notable savings</span>
                        </div>
                        {pageSpeedData.majorOps.length === 0 ? (
                          <div className="psi-no-major-issues">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                            <span>Zero major performance bottlenecks detected. The page satisfies Google Core Web Vitals speed thresholds.</span>
                          </div>
                        ) : (
                          <div className="psi-issues-list">
                            {pageSpeedData.majorOps.map((op, oIdx) => (
                              <div key={oIdx} className="psi-issue-row">
                                <div className="psi-issue-info">
                                  <div className="psi-issue-title">{op.title}</div>
                                  <div className="psi-issue-desc">High-impact resource optimization recommended by Lighthouse.</div>
                                </div>
                                {op.displayValue && (
                                  <span className="psi-issue-savings">{op.displayValue}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="psi-placeholder-state">
                      Run the AI Audit to analyze live Google PageSpeed performance, Core Web Vitals, and detect major bottlenecks.
                    </div>
                  )}
                </div>
              )}

              {/* Category Panel & Checklist Items */}
              <div className="group-panel">
                {/* 1. Category Pane Header */}
                <div className="cat-pane-header">
                  <div className="cat-pane-meta">
                    <span className="cat-pane-step">CATEGORY 0{activeCategoryIndex + 1} OF 08</span>
                    <h2 className="cat-pane-title">{activeCategory.name}</h2>
                  </div>
                  <span className={`group-tag ${categoryCounts[activeCategoryIndex].failed > 0 ? 'has-failed' : categoryCounts[activeCategoryIndex].notVerified > 0 ? 'has-warn' : 'all-passed'}`}>
                    {categoryCounts[activeCategoryIndex].failed > 0
                      ? `${categoryCounts[activeCategoryIndex].failed} failed`
                      : categoryCounts[activeCategoryIndex].notVerified > 0
                      ? `${categoryCounts[activeCategoryIndex].notVerified} unverified`
                      : 'All passed'}
                  </span>
                </div>

                {/* 2. Checks Container */}
                <div className="checks-list">
                  {activeCategory.items.map((item, itIdx) => {
                    const ev = evaluations[item.id] || { s: 'u', note: '', source: '', exception: '' };
                    const isPass = ev.s === 'p';
                    const isFail = ev.s === 'f';
                    const isNotVerified = ev.s === 'nv';
                    const itemStateClass = isPass ? 'state-p' : isFail ? 'state-f' : isNotVerified ? 'state-n state-nv' : '';

                    return (
                      <div key={item.id} className={`check-item ${itemStateClass}`}>
                        <div className="check-header-row">
                          <div className="check-info">
                            <div className="check-index-title">
                              <span className="check-num">#{String(itIdx + 1).padStart(2, '0')}</span>
                              <span className="check-title">{item.title}</span>
                            </div>
                            <div className="check-rule">{item.rule}</div>
                            {item.how && (
                              <div className="check-how">
                                <span>Verify:</span> <code>{item.how}</code>
                              </div>
                            )}

                            {ev.note && (
                              <div className={`check-evidence-box visible ${isPass ? 'evidence-pass' : isFail ? 'evidence-fail' : 'evidence-nv'}`}>
                                <span className="evidence-icon">{isPass ? '✓' : isFail ? '✕' : '⚠'}</span>
                                {ev.source && (
                                  <span className="evidence-source-tag">{ev.source}</span>
                                )}
                                <span className="evidence-text">{ev.note}</span>
                              </div>
                            )}

                            {/* Collapsible Client Exception Note */}
                            <div className="exception-box">
                              {!openNotes[item.id] && !ev.exception ? (
                                <button
                                  type="button"
                                  className="exception-toggle-btn"
                                  onClick={() => toggleNote(item.id)}
                                >
                                  + Add Exception Note
                                </button>
                              ) : !openNotes[item.id] && ev.exception ? (
                                <button
                                  type="button"
                                  className="exception-toggle-btn has-note"
                                  onClick={() => toggleNote(item.id)}
                                  title="Click to edit exception note"
                                >
                                  ✓ Note: {ev.exception.length > 36 ? ev.exception.slice(0, 36) + '…' : ev.exception} (Edit)
                                </button>
                              ) : (
                                <div className="exception-panel">
                                  <div className="exception-panel-header">
                                    <span className="exception-panel-label">
                                      Client Exception / QA Note
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      {ev.exception && (
                                        <button
                                          type="button"
                                          className="exception-panel-close"
                                          onClick={() => {
                                            setItemException(item.id, '');
                                            setOpenNotes(prev => ({ ...prev, [item.id]: false }));
                                          }}
                                          title="Delete this note"
                                        >
                                          Clear
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="exception-panel-close"
                                        onClick={() => toggleNote(item.id)}
                                        title="Done editing"
                                      >
                                        {ev.exception ? 'Done' : '✕ Cancel'}
                                      </button>
                                    </div>
                                  </div>
                                  <textarea
                                    className="exception-textarea"
                                    placeholder="Explain why this deviation is accepted for this client, or record specific audit findings…"
                                    value={ev.exception || ''}
                                    onChange={(e) => setItemException(item.id, e.target.value)}
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="segmented-ctrl">
                            <button
                              type="button"
                              className={`seg-btn btn-p ${isPass ? 'active' : ''}`}
                              onClick={() => setItemStatus(item.id, 'p')}
                              title="Mark Pass (confirmed by evidence)"
                            >
                              Pass
                            </button>
                            <button
                              type="button"
                              className={`seg-btn btn-f ${isFail ? 'active' : ''}`}
                              onClick={() => setItemStatus(item.id, 'f')}
                              title="Mark Fail (confirmed issue)"
                            >
                              Fail
                            </button>
                            <button
                              type="button"
                              className={`seg-btn btn-nv ${isNotVerified ? 'active' : ''}`}
                              onClick={() => setItemStatus(item.id, 'nv')}
                              title="Mark Not Verified (check incomplete or insufficient evidence)"
                            >
                              Not Verified
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Category Stepper Footer */}
                <div className="cat-stepper">
                  <button
                    type="button"
                    className="stepper-btn prev"
                    disabled={activeCategoryIndex === 0}
                    onClick={() => {
                      setActiveCategoryIndex(prev => Math.max(0, prev - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                    <span>Previous Category</span>
                  </button>

                  <div className="stepper-center">
                    <div className="stepper-count">{activeCategoryIndex + 1} of 8</div>
                    <div className="stepper-dots">
                      {AUDIT_DATA.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`stepper-dot ${dotIdx === activeCategoryIndex ? 'active' : ''}`}
                          onClick={() => setActiveCategoryIndex(dotIdx)}
                          title={`Go to Category ${dotIdx + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="stepper-btn next"
                    disabled={activeCategoryIndex === 7}
                    onClick={() => {
                      setActiveCategoryIndex(prev => Math.min(7, prev + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span>Next: {AUDIT_DATA[Math.min(7, activeCategoryIndex + 1)].tab}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>
              </div>

              <footer className="ledger-footer" style={{ marginTop: '20px' }}>
                <p className="footer-instructions">
                  <strong>QA Guidelines:</strong> Mark an item as <span className="tag-passed-highlight">Passed</span> only after properly checking and confirming it meets the standard. Mark as <span style={{ fontWeight: 700, color: 'var(--fail-solid)' }}>Failed</span> if any requirement is violated.
                </p>
              </footer>
            </section>
          </main>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* FULLSCREEN AUDIT MODAL DIALOG                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {modalState !== 'none' && (
        <div className="audit-modal-backdrop visible" role="dialog" aria-modal="true">
          <div className="audit-modal-dialog">
            <button
              type="button"
              className="btn-modal-close-icon"
              onClick={() => {
                if (!isAuditing) setModalState('none');
              }}
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* View 1: Active Audit In Progress */}
            {modalState === 'audit' && (
              <div className="modal-view active">
                <div className="rn-loader-card" role="status" aria-live="polite">
                  <div className="rn-loader-header">
                    <div className="rn-loader-beacon">
                      <span className="rn-beacon-ping"></span>
                      <span className="rn-beacon-dot"></span>
                    </div>
                    <div className="rn-loader-title-wrap">
                      <span className="rn-loader-title">DIAGNOSTIC SCAN IN PROGRESS</span>
                      <span className="rn-loader-sub">{loaderSub}</span>
                    </div>
                    <span className="rn-loader-timer">{loaderElapsed}</span>
                  </div>

                  <div className="rn-loader-main-grid">
                    {/* Micro-DOM Blueprint Viewport */}
                    <div className="rn-blueprint-screen" aria-hidden="true">
                      <div className="rn-blueprint-topbar">
                        <div className="rn-bp-dots"><span></span><span></span><span></span></div>
                        <div className="rn-bp-url-pill">{targetUrl}</div>
                        <div className="rn-bp-badge">DOM v2.1</div>
                      </div>
                      <div className="rn-blueprint-canvas">
                        <div className="rn-bp-ruler">
                          <span>0px</span><span>120</span><span>240</span><span>360</span>
                        </div>
                        <div className="rn-laser-sweep">
                          <div className="rn-laser-line"></div>
                          <div className="rn-laser-trail"></div>
                        </div>
                        <div className="rn-bp-page">
                          <div className="rn-bp-row rn-bp-nav">
                            <div className="rn-bp-logo-box"></div>
                            <div className="rn-bp-nav-links"><span></span><span></span><span></span></div>
                          </div>
                          <div className="rn-bp-hero">
                            <div className="rn-bp-tag-marker marker-seo">
                              <span className="marker-chip">&lt;H1&gt;</span>
                              <span className="marker-val">TITLE &amp; CANONICAL</span>
                            </div>
                            <div className="rn-bp-line rn-bp-h1"></div>
                            <div className="rn-bp-line rn-bp-sub"></div>
                          </div>
                          <div className="rn-bp-grid">
                            <div className="rn-bp-card rn-bp-img-card">
                              <div className="rn-bp-img-ph">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                              </div>
                              <div className="rn-bp-img-meta">
                                <span className="marker-chip">&lt;IMG&gt;</span>
                                <span className="marker-state">{markerState}</span>
                              </div>
                            </div>
                            <div className="rn-bp-card rn-bp-typo-card">
                              <div className="rn-bp-tag-marker marker-typo">
                                <span className="marker-chip">CSS</span>
                                <span className="marker-val">TYPE SCALE</span>
                              </div>
                              <div className="rn-bp-line rn-bp-p1"></div>
                              <div className="rn-bp-line rn-bp-p2"></div>
                              <div className="rn-bp-line rn-bp-p3"></div>
                            </div>
                          </div>
                          <div className="rn-bp-row rn-bp-cta-bar">
                            <div className="rn-bp-btn-pill"><span>BUTTON</span></div>
                            <div className="rn-bp-tag-marker marker-a11y">
                              <span className="marker-chip">WCAG</span>
                              <span className="marker-val">AA 4.5:1</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    <div className="rn-loader-stepper">
                      <div className="rn-step-item" data-state={loaderStep > 1 ? 'done' : loaderStep === 1 ? 'active' : 'pending'}>
                        <div className="rn-step-icon">
                          <span className="rn-step-num">1</span>
                          <svg className="rn-step-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 8 6.5 11.5 13 4.5" /></svg>
                        </div>
                        <div className="rn-step-content">
                          <div className="rn-step-label">Page Structure &amp; SEO</div>
                          <div className="rn-step-detail">Checking headings (H1–H3), title, meta tags &amp; canonical URL</div>
                        </div>
                        <span className="rn-step-status">{loaderStep > 1 ? 'DONE' : loaderStep === 1 ? 'RUNNING' : 'WAIT'}</span>
                      </div>

                      <div className="rn-step-item" data-state={loaderStep > 2 ? 'done' : loaderStep === 2 ? 'active' : 'pending'}>
                        <div className="rn-step-icon">
                          <span className="rn-step-num">2</span>
                          <svg className="rn-step-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 8 6.5 11.5 13 4.5" /></svg>
                        </div>
                        <div className="rn-step-content">
                          <div className="rn-step-label">Accessibility &amp; Color Contrast</div>
                          <div className="rn-step-detail">Checking WCAG AA contrast, alt text &amp; color rules</div>
                        </div>
                        <span className="rn-step-status">{loaderStep > 2 ? 'DONE' : loaderStep === 2 ? 'RUNNING' : 'WAIT'}</span>
                      </div>

                      <div className="rn-step-item" data-state={loaderStep > 3 ? 'done' : loaderStep === 3 ? 'active' : 'pending'}>
                        <div className="rn-step-icon">
                          <span className="rn-step-num">3</span>
                          <svg className="rn-step-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 8 6.5 11.5 13 4.5" /></svg>
                        </div>
                        <div className="rn-step-content">
                          <div className="rn-step-label">Assets, Links &amp; Technical Health</div>
                          <div className="rn-step-detail">Checking images, link destinations &amp; console errors</div>
                        </div>
                        <span className="rn-step-status">{loaderStep > 3 ? 'DONE' : loaderStep === 3 ? 'RUNNING' : 'WAIT'}</span>
                      </div>

                      <div className="rn-step-item" data-state={loaderStep === 4 ? 'active' : 'pending'}>
                        <div className="rn-step-icon">
                          <span className="rn-step-num">4</span>
                          <svg className="rn-step-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 8 6.5 11.5 13 4.5" /></svg>
                        </div>
                        <div className="rn-step-content">
                          <div className="rn-step-label">Evaluating 23 Quality Standards</div>
                          <div className="rn-step-detail">Reviewing all 8 categories including Google PageSpeed</div>
                        </div>
                        <span className="rn-step-status">{loaderStep === 4 ? 'MERGING' : 'WAIT'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rn-loader-terminal">
                    <div className="rn-terminal-prefix">&gt;</div>
                    <div className="rn-terminal-text">{terminalText}</div>
                    <span className="rn-terminal-cursor"></span>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Audit Result Summary In Pop-Up */}
            {modalState === 'result' && (
              <div className="modal-view active">
                <div className="modal-result-content">
                  <div className="modal-result-header">
                    <div className="modal-result-meta">
                      <div className="modal-result-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--pass-solid)' }}>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Automated Audit Complete</span>
                      </div>
                      <div className="modal-result-sub" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Inspected target:</span>
                        <span className="modal-target-url-chip">{targetUrl}</span>
                        <span className="modal-engine-tag" style={{ margin: 0 }}>
                          Provider: {synthesizedAudit?.provider || 'RankNibbler Core'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score Dial & Stats */}
                  <div className="modal-score-card">
                    <div
                      className="modal-score-dial"
                      style={{
                        '--score-pct': synthesizedAudit?.score ?? stats.pct,
                        '--score-color': scoreColor(synthesizedAudit?.score ?? stats.pct)
                      }}
                    >
                      <span className="modal-score-num" style={{ color: scoreColor(synthesizedAudit?.score ?? stats.pct) }}>
                        {synthesizedAudit?.score ?? stats.pct}
                      </span>
                    </div>
                    <div className="modal-score-info">
                      <div className="modal-score-headline">
                        {(() => {
                          const gVal = synthesizedAudit?.grade ?? (stats.failed === 0 ? 'A' : (stats.failed >= 5 ? 'F' : (stats.failed >= 2 ? 'C' : 'B')));
                          const gClass = String(gVal).replace(/[^a-zA-Z]/g, '');
                          return (
                            <span className={`modal-grade-tag rn-grade-badge rn-grade-${gClass}`}>
                              {gVal}
                            </span>
                          );
                        })()}
                        <span className="modal-score-caption">SEO &amp; Quality Score</span>
                      </div>
                      <div className="modal-stats-pills">
                        <span className="modal-stat-pill pill-pass">
                          {synthesizedAudit?.passedCount ?? stats.passed} Passed
                        </span>
                        <span className="modal-stat-pill pill-fail">
                          {synthesizedAudit?.failedCount ?? stats.failed} Issues
                        </span>
                        <span className="modal-stat-pill pill-nv">
                          {synthesizedAudit?.notVerifiedCount ?? stats.notVerified} Not Verified
                        </span>
                        {pageSpeedData && (
                          <span
                            className="modal-stat-pill"
                            style={{
                              background: 'var(--bg-subtle)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            PageSpeed: {pageSpeedData.score}/100
                          </span>
                        )}
                        <span
                          className="modal-stat-pill"
                          style={{
                            background: 'var(--bg-canvas)',
                            color: 'var(--text-dim)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          23 Items Audited
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-fill banner note */}
                  <div className="rn-autofill-note" style={{ margin: 0 }}>
                    ✓ All 23 checklist items evaluated across 8 categories ({stats.passed} passed, {stats.failed} failed, {stats.notVerified} not verified) &mdash; review findings below
                  </div>

                  {/* Issues Detected List */}
                  <div className="modal-issues-wrapper">
                    <div className="rn-issues-title">Confirmed Issues &amp; Defects</div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                      {synthesizedAudit && synthesizedAudit.issues && synthesizedAudit.issues.length > 0 ? (
                        synthesizedAudit.issues.map((iss, iIdx) => (
                          <div key={iIdx} style={{ fontSize: '13px', lineHeight: '1.5', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', color: 'var(--fail-ink)' }}>
                            ✕ {iss}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 0', color: 'var(--pass-ink)' }}>
                          ✓ No confirmed defects detected on this page.
                        </div>
                      )}
                    </div>

                    {synthesizedAudit && synthesizedAudit.unverified && synthesizedAudit.unverified.length > 0 && (
                      <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '10px' }}>
                        <div className="rn-issues-title" style={{ color: 'var(--warn-ink)', fontSize: '13px' }}>
                          ⚠ Not Verified ({synthesizedAudit.unverified.length}) &mdash; Incomplete / Missing Telemetry
                        </div>
                        <div style={{ maxHeight: '130px', overflowY: 'auto' }}>
                          {synthesizedAudit.unverified.map((uv, uIdx) => (
                            <div key={uIdx} style={{ fontSize: '12.5px', lineHeight: '1.45', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', color: 'var(--warn-ink)' }}>
                              ⚠ {uv}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="btn-see-details"
                    onClick={() => {
                      setModalState('none');
                      setWorkflowStep(2);
                    }}
                  >
                    <span>View Full Checklist &amp; Detailed Results</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                  <div className="modal-footer-note">
                    All 23 checks across 8 categories have been evaluated and filled in the checklist.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Toast Notice */}
      {toastMessage && (
        <div className="toast-notice show" role="status">
          {toastMessage}
        </div>
      )}
    </>
  );
}
