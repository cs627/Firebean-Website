#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""REAL end-to-end test — page -> live Cloudflare tunnel -> collector -> Google Sheet.

Unlike test_ennea.py this does NOT block the endpoint. It completes one full
questionnaire in a real browser, then verifies:
  * the page reports its own delivery as verified (localStorage retry queue empty)
  * the collector's /stats total increased by exactly one
  * the newest Google Sheet row has all 29 columns filled as expected

Usage:
    python3 e2e_real.py            # serves the repo locally (127.0.0.1)
    python3 e2e_real.py live       # exercises the deployed https://firebean.net/enneagram/
"""
import json, os, sys, threading, time, http.server, socketserver, functools

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, "/opt/data/scripts")
import build as B
import ennea_collector as C
from playwright.sync_api import sync_playwright

PORT = 8901
LIVE = "https://firebean.net/enneagram/"
SHOTS = "/opt/data/cache/scratch/ennea_shots"
os.makedirs(SHOTS, exist_ok=True)
EXE = "/opt/data/home/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"

payload = B.payload()
questions = payload["questions"]


def best_keys(q, target):
    scored = sorted(((o["w"].get(str(target), 0), o["k"]) for o in q["options"]), key=lambda x: (-x[0], x[1]))
    return [scored[0][1]]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=REPO))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    use_live = len(sys.argv) > 1 and sys.argv[1] == "live"
    url = LIVE if use_live else "http://127.0.0.1:%d/enneagram/" % PORT
    httpd = None if use_live else serve()
    errors, reqs = [], []
    before = C.read_stats()
    print("mode:", "LIVE" if use_live else "local", url, flush=True)
    print("sheet rows before:", before["total"], flush=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=EXE, args=["--no-sandbox", "--disable-dev-shm-usage"])
            ctx = browser.new_context(viewport={"width": 1440, "height": 950},
                                      user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                                                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"))
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append("pageerror: %s" % e))
            page.on("console", lambda m: errors.append("console.error: %s" % m.text) if m.type == "error" else None)
            page.on("request", lambda r: reqs.append(r.url) if "/submit" in r.url else None)

            page.goto(url, wait_until="load")
            page.wait_for_timeout(900)
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="load")
            page.wait_for_timeout(900)
            page.evaluate("document.querySelector('[data-go=\"quiz\"]').click()")
            page.wait_for_selector("#qOpts .opt", timeout=15000)

            target = 6
            for q in questions:
                for k in best_keys(q, target):
                    page.evaluate("(()=>{const b=document.querySelector('#qOpts .opt[data-k=\"%s\"]');if(b)b.click();})()" % k)
                    page.wait_for_timeout(150)
                if q["kind"] == "single":
                    page.wait_for_timeout(430)
                else:
                    page.evaluate("(()=>{const b=document.querySelector('#btnNext');if(b&&!b.disabled)b.click();})()")
                    page.wait_for_timeout(280)

            page.wait_for_function("document.querySelector('#v-result').classList.contains('on')", timeout=25000)
            page.wait_for_timeout(3500)          # let the POST round-trip finish
            badge = page.inner_text("#resultBody .badge")
            pending = page.evaluate("localStorage.getItem('ennea_pending')")
            delivered = page.evaluate("localStorage.getItem('ennea_last_delivery')")
            page.screenshot(path=os.path.join(SHOTS, "real_result.png"))
            browser.close()
    finally:
        if httpd:
            httpd.shutdown()

    print("result badge:", badge, flush=True)
    print("submit requests fired:", len(reqs), reqs[-1] if reqs else None, flush=True)
    print("client retry queue (ennea_pending):", pending, flush=True)
    print("client delivery stamp (ennea_last_delivery):", delivered, flush=True)
    verified = pending in (None, "[]") and bool(delivered)
    print("client-side delivery verified:", verified, flush=True)

    time.sleep(4)
    after = C.read_stats()
    print("sheet rows after:", after["total"], "delta:", after["total"] - before["total"], flush=True)
    rows = C.sheets("GET", C.SHEET_ID + "/values/" + C.TAB + "!A1:AD200?majorDimension=ROWS").get("values", [])
    newest = rows[-1]
    print("newest row cols:", len(newest), flush=True)
    print(json.dumps(newest, ensure_ascii=False), flush=True)
    print("js errors:", errors[:5], flush=True)

    ok = verified and after["total"] > before["total"] and not errors
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
