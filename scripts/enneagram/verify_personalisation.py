#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify the personalised result page: same main type, different score shapes.

Builds several answer paths that all resolve to type 6 but differ in score
profile (adjacent wing / non-adjacent latent / dominant / double-core) and
prints what the result page actually says for each, so we can prove the report
is answer-driven rather than a fixed text per type.

The live submit endpoint is BLOCKED so real research data stays clean.
"""
import functools, http.server, os, socketserver, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
from e2e_real import exe
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
PORT = 8904
URL = "http://127.0.0.1:%d/enneagram/" % PORT
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

D = B.payload()
QS = D["questions"]
TARGET = 6


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    h = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=REPO))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h


def plan(objective):
    """objective(weights_dict) -> score for one option; pick the best per question."""
    out = {}
    for q in QS:
        best, bk = None, None
        for o in q["options"]:
            w = {int(k): v for k, v in o["w"].items()}
            sc = objective(w)
            if best is None or sc > best:
                best, bk = sc, o["k"]
        out[q["id"]] = [bk]
    return out


PROFILES = {
    # name -> objective over a type->weight dict
    "A · 6 帶鄰型翼 (期望 6w5/6w7)": lambda w: w.get(6, 0) * 10 + max(w.get(5, 0), w.get(7, 0)) * 6,
    "B · 6 帶非鄰型潛藏 (期望 潛藏型)": lambda w: w.get(6, 0) * 10 + max(w.get(1, 0), w.get(3, 0), w.get(9, 0)) * 6,
    "C · 6 單一主導 (期望 高分差)": lambda w: w.get(6, 0) * 10 - sum(v for k, v in w.items() if k != 6) * 4,
    "D · 6 + 5 並排 (期望 雙核心)": lambda w: w.get(6, 0) * 10 + w.get(5, 0) * 10,
}


def run(page, choices):
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(800)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")
    page.wait_for_timeout(800)
    page.evaluate("document.querySelector('[data-go=\"quiz\"]').click()")
    page.wait_for_selector("#qOpts .opt", timeout=15000)
    for q in QS:
        for k in choices[q["id"]]:
            page.evaluate("(()=>{const b=document.querySelector('#qOpts .opt[data-k=\"%s\"]');if(b)b.click();})()" % k)
            page.wait_for_timeout(140)
        if q["kind"] == "single":
            page.wait_for_timeout(430)
        else:
            page.evaluate("(()=>{const b=document.querySelector('#btnNext');if(b&&!b.disabled)b.click();})()")
            page.wait_for_timeout(260)
    page.wait_for_function("document.querySelector('#v-result').classList.contains('on')", timeout=25000)
    page.wait_for_timeout(400)
    return page.evaluate("""(() => {
        const g = s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\\s*\\n\\s*/g,' | ').trim() : null; };
        const r = (window.__ENNEA && window.__ENNEA.result()) || {};
        return { badge: g('.rhero .badge'), pat: g('.pat'), ev: g('.ev'), scores: r.scores,
                 type: r.type, wing: r.wing, second: r.second, gap: r.gap, cenPct: r.cenPct };
    })()""")


def main():
    h = serve()
    out = {}
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
            ctx = b.new_context(viewport={"width": 1440, "height": 950}, user_agent=UA)
            ctx.route("**/submit", lambda route: route.fulfill(status=200, content_type="text/json", body='{"ok":true}'))
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            for name, obj in PROFILES.items():
                r = run(page, plan(obj))
                r["errors"] = list(errs)
                out[name] = r
                print("\n==========", name, "==========", flush=True)
                print("badge :", r["badge"], flush=True)
                print("profile:", (r["pat"] or "")[:400], flush=True)
                print("evidence:", (r["ev"] or "")[:330], flush=True)
                print("scores:", r["scores"], "| wing:", r["wing"], "| second:", r["second"], "| gap:", r["gap"], flush=True)
                print("centre %:", r["cenPct"], "| js errors:", r["errors"], flush=True)
                page.evaluate("document.querySelector('#resultBody').scrollIntoView({block:'start'})")
                page.wait_for_timeout(500)
                page.screenshot(path="/opt/data/cache/scratch/ennea_shots/result_%s.png" % name[0], full_page=True)
            b.close()
    finally:
        h.shutdown()

    # --- assertions: same main type, materially different report ---
    print("\n===== CHECKS =====", flush=True)
    pats = [v["pat"] for v in out.values()]
    print("all resolved to type 6 :", all(('# 6 ' in (v["badge"] or "")) or ("6 型" in (v["badge"] or "")) for v in out.values()))
    print("profiles differ        :", len(set(pats)) == len(pats))
    print("evidence differs        :", len(set(v["ev"] for v in out.values())) == len(out))
    wing_cases = [v for v in out.values() if v["wing"] is not None]
    lat_cases  = [v for v in out.values() if v["wing"] is None]
    print("wing rendered (>=1 case)  :", bool(wing_cases) and all("翼型" in v["pat"] for v in wing_cases))
    print("latent rendered (>=1 case):", bool(lat_cases) and all("潛藏傾向" in v["pat"] for v in lat_cases))
    print("badge shows wing          :", all(("%dw%d" % (v["type"], v["wing"])) in (v["badge"] or "") for v in wing_cases))
    print("scoring shape read out    :", all(isinstance(v["gap"], int) for v in out.values()))
    print("gap matches score diff    :", all(
        (v["scores"] or {}).get(str(v["second"])) is not None and
        v["gap"] == (v["scores"] or {}).get(str(v["type"]), 0) - (v["scores"] or {}).get(str(v["second"]), 0)
        for v in out.values()))
    print("centre % sums to ~100     :", all(abs(sum(v["cenPct"].values()) - 100) <= 1 for v in out.values()))
    print("no js errors           :", all(not v["errors"] for v in out.values()))
    print("evidence cites answers :", all(("你揀咗" in (v["ev"] or "")) for v in out.values()))


if __name__ == "__main__":
    main()
