#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""End-to-end Playwright test for the 都會生活鏡像測驗 page.

Blocks the live collector endpoint (so real data is never polluted) and walks
all 9 type-targeted answer paths, checking the result render, the 3D mascot
image actually loads, the progress copy, and that no JS error fires.

Usage: python3 test_ennea.py
"""
import json, os, sys, threading, time, http.server, socketserver, functools

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import build as B
from playwright.sync_api import sync_playwright

PORT = 8899
ENDPOINT = "https://ennea.firbeanpr.com/submit"
SHOTS = "/opt/data/cache/scratch/ennea_shots"
os.makedirs(SHOTS, exist_ok=True)

EXE_CANDIDATES = (
    "/opt/data/home/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
    "/opt/data/home/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    "/opt/hermes/tools/chromium-1208/chrome-linux64/chrome",
)

payload = B.payload()
questions = payload["questions"]
BASE = "http://127.0.0.1:%d/enneagram/" % PORT

INFO = {"quiz": {}, "views": {}, "mobile": {}}


def exe():
    for c in EXE_CANDIDATES:
        if os.path.exists(c):
            return c
    return None


def best_keys(q, target):
    """Option key(s) that score highest for `target` (fallback: first option)."""
    scored = sorted(((o["w"].get(str(target), 0), o["k"]) for o in q["options"]),
                    key=lambda x: (-x[0], x[1]))
    return [scored[0][1]]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = functools.partial(Quiet, directory=REPO)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def js_click(page, selector):
    page.evaluate("""(sel)=>{
        const b=document.querySelector(sel);
        if(b){b.scrollIntoView({block:'center'});b.click();}
    }""", selector)


def answer_all(page, target):
    """Walk all 20 questions, picking the option that best matches `target`."""
    page.wait_for_selector("#qOpts .opt", timeout=15000)
    for q in questions:
        for k in best_keys(q, target):
            js_click(page, '#qOpts .opt[data-k="%s"]' % k)
            page.wait_for_timeout(160)
        if q["kind"] == "single":
            page.wait_for_timeout(430)          # single-choice auto-advances after 240ms
        else:
            js_click(page, "#btnNext")
            page.wait_for_timeout(280)
    page.wait_for_function("document.querySelector('#v-result').classList.contains('on')", timeout=20000)
    page.wait_for_timeout(500)


def main():
    httpd = serve()
    errors, results, posted = [], [], []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
            ctx = browser.new_context(viewport={"width": 1440, "height": 950})
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append("pageerror: %s" % e))
            page.on("console", lambda m: errors.append("console.error: %s" % m.text) if m.type == "error" else None)
            page.route(ENDPOINT, lambda r: (posted.append(r.request.post_data) if r.request.method == "POST" else None,
                                            r.fulfill(status=200, body='{"ok":true}')))
            page.goto(BASE, wait_until="load")
            page.wait_for_timeout(700)
            page.screenshot(path=os.path.join(SHOTS, "d1_intro.png"))
            h1 = page.inner_text("h1")
            assert "都會生活鏡像測驗" in h1, "intro h1: %r" % h1

            for target in range(1, 10):
                page.goto(BASE, wait_until="load")
                page.evaluate("localStorage.clear()")
                page.goto(BASE, wait_until="load")
                page.wait_for_timeout(250)
                js_click(page, '[data-go="quiz"]')
                answer_all(page, target)
                badge = page.inner_text("#resultBody .badge")
                img_ok = page.evaluate("(()=>{const i=document.querySelector('#resultBody .mascot');return i?(i.complete&&i.naturalWidth>0):false})()")
                results.append({"target": target, "badge": badge, "mascot_loaded": img_ok})
                print("TARGET %d -> %s | mascot=%s" % (target, badge, img_ok), flush=True)
                if target in (1, 3, 6, 9):
                    page.screenshot(path=os.path.join(SHOTS, "d2_result_t%d.png" % target))

            # ---- quiz screen + progress copy ----
            page.goto(BASE, wait_until="load")
            page.evaluate("localStorage.clear()")
            page.goto(BASE, wait_until="load")
            page.wait_for_timeout(250)
            js_click(page, '[data-go="quiz"]')
            page.wait_for_selector("#qOpts .opt", timeout=15000)
            for q in questions[:6]:
                for k in best_keys(q, 3):
                    js_click(page, '#qOpts .opt[data-k="%s"]' % k)
                    page.wait_for_timeout(160)
                if q["kind"] == "single":
                    page.wait_for_timeout(430)
                else:
                    js_click(page, "#btnNext")
                    page.wait_for_timeout(280)
            page.screenshot(path=os.path.join(SHOTS, "d4_quiz.png"))
            INFO["quiz"] = {"mobProgTxt": page.inner_text("#mobProgTxt"),
                            "qCount": page.inner_text("#qCount"),
                            "railProgTxt": page.inner_text("#railProgTxt"),
                            "actionbar_visible": page.is_visible("#actionbar")}

            # ---- atlas / data / proposal ----
            js_click(page, '[data-go="atlas"]')
            page.wait_for_timeout(900)
            INFO["views"]["atlas_mascots_loaded"] = page.evaluate(
                "(()=>[...document.querySelectorAll('#atlasGrid .mascot')].filter(i=>i.complete&&i.naturalWidth>0).length)()")
            INFO["views"]["atlas_cards"] = page.evaluate("document.querySelectorAll('#atlasGrid .acard').length")
            page.screenshot(path=os.path.join(SHOTS, "d5_atlas.png"))
            js_click(page, '[data-go="data"]')
            page.wait_for_timeout(2500)
            INFO["views"]["data_status"] = page.inner_text("#dStatus")
            INFO["views"]["data_total"] = page.inner_text("#dTotal")
            page.screenshot(path=os.path.join(SHOTS, "d6_data.png"))
            js_click(page, '[data-go="proposal"]')
            page.wait_for_timeout(600)
            INFO["views"]["match_rows"] = page.evaluate("document.querySelectorAll('#matchList .matchRow').length")
            page.screenshot(path=os.path.join(SHOTS, "d7_proposal.png"))

            # ---- modal open from atlas ----
            js_click(page, '[data-go="atlas"]')
            page.wait_for_timeout(500)
            js_click(page, "#atlasGrid .acard")
            page.wait_for_timeout(500)
            INFO["views"]["modal_open"] = page.is_visible("#modal")
            INFO["views"]["modal_title"] = page.inner_text("#mTitle")
            page.screenshot(path=os.path.join(SHOTS, "d8_modal.png"))

            # ---- mobile ----
            m = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                    is_mobile=True, has_touch=True)
            mp = m.new_page()
            mp.on("pageerror", lambda e: errors.append("mobile pageerror: %s" % e))
            mp.route(ENDPOINT, lambda r: r.fulfill(status=200, body='{"ok":true}'))
            mp.goto(BASE, wait_until="load")
            mp.wait_for_timeout(700)
            mp.screenshot(path=os.path.join(SHOTS, "m1_intro.png"))
            mp.evaluate("document.querySelector('[data-go=\"quiz\"]').click()")
            mp.wait_for_selector("#qOpts .opt", timeout=15000)
            mp.evaluate("document.querySelector('#qOpts .opt').click()")
            mp.wait_for_timeout(700)
            mp.screenshot(path=os.path.join(SHOTS, "m2_quiz.png"))
            INFO["mobile"] = {"mobProgTxt": mp.inner_text("#mobProgTxt"),
                              "qCount": mp.inner_text("#qCount"),
                              "rail_hidden": not mp.is_visible(".rail")}
            mp.evaluate("document.querySelector('#qOpts .opt').click()")
            mp.wait_for_timeout(600)
            mp.screenshot(path=os.path.join(SHOTS, "m3_quiz2.png"))
            browser.close()
    finally:
        httpd.shutdown()

    sample = None
    for raw in reversed(posted):
        if raw:
            try:
                sample = json.loads(raw)
                break
            except Exception:
                pass
    out = {"results": results, "errors": errors, "posted_count": len([p for p in posted if p]),
           "sample_post": sample}
    out.update(INFO)
    return out


if __name__ == "__main__":
    res = main()
    print(json.dumps(res, ensure_ascii=False, indent=2), flush=True)
    bad = [r for r in res["results"] if not r["mascot_loaded"]]
    if len(res["results"]) != 9 or bad or res["errors"]:
        sys.exit(1)
