import http.server
import urllib.request
import urllib.error
import urllib.parse
import json
import os
import sys
import subprocess
import traceback

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
CITEVANA_API_KEY = "cv_live_AuUfx52u9IUYjyQysEvuBin7ArAA0_-mMhYAg-65MPc"

# Load environment variables from .env if present (without hardcoding keys in source)
env_path = os.path.join(DIRECTORY, ".env")
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()
    except Exception:
        pass

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        clean_path = self.path.split("?")[0].rstrip("/")

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b""
        except Exception:
            body = b""

        # 1. Citevana Proxy
        if clean_path.startswith("/api/citevana"):
            endpoint = clean_path.replace("/api/citevana", "").strip("/")
            target_url = f"https://citevana.com/api/v1/tools/{endpoint}"
            try:
                req = urllib.request.Request(
                    target_url,
                    data=body,
                    headers={
                        "Authorization": f"Bearer {CITEVANA_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "PageAuditChecklist/2.0"
                    }
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_data = resp.read()
                    self.send_response(resp.status)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(resp_data)
            except urllib.error.HTTPError as e:
                err_data = e.read()
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(err_data)
            except Exception as e:
                err_obj = json.dumps({"ok": False, "error": str(e)}).encode("utf-8")
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(err_obj)
            return

        # 2. Page Check Runner (Headless Chrome measurement across 5 viewports)
        if clean_path == "/api/page-check":
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
                target_url = payload.get("url", "")
                if not target_url:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "Missing target URL"}).encode("utf-8"))
                    return

                script_path = os.path.join(DIRECTORY, "page-checker.js")
                proc = subprocess.run(
                    ["node", script_path, target_url],
                    capture_output=True,
                    text=True,
                    timeout=55,
                    cwd=DIRECTORY
                )

                if proc.returncode == 0 and proc.stdout:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(proc.stdout.encode("utf-8"))
                else:
                    err_msg = proc.stderr or "Page check process terminated unexpectedly"
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": err_msg, "hits": []}).encode("utf-8"))
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e), "hits": []}).encode("utf-8"))
            return

        # 3. PageSpeed Insights with Primary & Fallback API Keys (Backend only, never log keys)
        if clean_path == "/api/pagespeed":
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
                target_url = payload.get("url", "")
                if not target_url:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "Missing target URL"}).encode("utf-8"))
                    return

                primary_key = os.environ.get("PSI_API_KEY_PRIMARY", "").strip()
                fallback_key = os.environ.get("PSI_API_KEY_FALLBACK", "").strip()

                key_used = None
                failover_reason = None
                raw_psi = None

                def call_psi(key):
                    enc_url = urllib.parse.quote(target_url, safe="")
                    api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={enc_url}&strategy=mobile&category=performance&key={key}"
                    req = urllib.request.Request(api_url, headers={"User-Agent": "PageAuditChecklist/2.0"})
                    with urllib.request.urlopen(req, timeout=50) as r:
                        return json.loads(r.read().decode("utf-8"))

                # Try primary key
                if primary_key:
                    try:
                        raw_psi = call_psi(primary_key)
                        key_used = "primary"
                    except urllib.error.HTTPError as e:
                        failover_reason = f"Primary key failed (HTTP {e.code})"
                    except Exception as e:
                        failover_reason = f"Primary key failed ({str(e)})"

                # Retry with fallback key if primary failed or was not configured
                if not raw_psi and fallback_key:
                    try:
                        raw_psi = call_psi(fallback_key)
                        key_used = "fallback"
                    except urllib.error.HTTPError as e:
                        failover_reason = f"{failover_reason or 'Primary key failed'}; Fallback key failed (HTTP {e.code})"
                    except Exception as e:
                        failover_reason = f"{failover_reason or 'Primary key failed'}; Fallback key failed ({str(e)})"

                if raw_psi and raw_psi.get("lighthouseResult"):
                    lh = raw_psi.get("lighthouseResult", {})
                    perf = lh.get("categories", {}).get("performance", {})
                    audits = lh.get("audits", {})

                    score = int(round(perf.get("score", 0) * 100)) if perf.get("score") is not None else None
                    fcp = audits.get("first-contentful-paint", {}).get("displayValue", "—")
                    lcp = audits.get("largest-contentful-paint", {}).get("displayValue", "—")
                    tbt = audits.get("total-blocking-time", {}).get("displayValue", "—")
                    cls = audits.get("cumulative-layout-shift", {}).get("displayValue", "—")
                    si = audits.get("speed-index", {}).get("displayValue", "—")

                    opportunities = []
                    for k, a in audits.items():
                        if a.get("details", {}).get("type") == "opportunity":
                            savings = a.get("details", {}).get("overallSavingsMs", 0)
                            byte_savings = a.get("details", {}).get("overallSavingsBytes", 0)
                            if savings > 100 or byte_savings > 40000:
                                opportunities.append({
                                    "title": a.get("title"),
                                    "displayValue": a.get("displayValue", ""),
                                    "savingsMs": savings,
                                    "savingsBytes": byte_savings
                                })

                    res_obj = {
                        "ok": True,
                        "keyUsed": key_used,
                        "failoverReason": failover_reason if key_used == "fallback" else None,
                        "data": {
                            "score": score,
                            "fcp": fcp,
                            "lcp": lcp,
                            "tbt": tbt,
                            "cls": cls,
                            "speedIndex": si,
                            "opportunities": opportunities
                        }
                    }
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res_obj).encode("utf-8"))
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "ok": False,
                        "error": "PageSpeed unavailable",
                        "reason": failover_reason or "All configured API keys failed or timed out",
                        "keyUsed": None
                    }).encode("utf-8"))
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "PageSpeed unavailable", "reason": str(e)}).encode("utf-8"))
            return

        # 4. Groq LLM Proxy (Reliable synthesis without Cloudflare bot friction)
        if clean_path == "/api/groq":
            try:
                target_url = "https://api.groq.com/openai/v1/chat/completions"
                groq_key = os.environ.get("GROQ_API_KEY", "").strip()
                auth_header = self.headers.get("Authorization", "")
                if not auth_header and groq_key:
                    auth_header = f"Bearer {groq_key}"
                req = urllib.request.Request(
                    target_url,
                    data=body,
                    headers={
                        "Authorization": auth_header,
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                )
                with urllib.request.urlopen(req, timeout=35) as resp:
                    resp_data = resp.read()
                    self.send_response(resp.status)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(resp_data)
            except urllib.error.HTTPError as e:
                err_data = e.read()
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(err_data)
            except Exception as e:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": False, "error": "Not Found"}).encode("utf-8"))

if __name__ == "__main__":
    server_address = ("", PORT)
    httpd = http.server.ThreadingHTTPServer(server_address, ProxyHTTPRequestHandler)
    print(f"Proxy server running on port {PORT}", flush=True)
    httpd.serve_forever()
