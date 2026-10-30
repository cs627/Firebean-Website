#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify the 調研數據 dashboard: mock the /stats endpoint and check that every
chart + the 綜合分析 render from the payload, with numbers that match the data.

No request ever leaves the browser for our endpoint (route is intercepted), so the
real research sheet is untouched.
"""
import functools, http.server, json, os, random, socketserver, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e_real import exe
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SHOTS = "/opt/data/cache/scratch/ennea_shots"
PORT = 8905
BASE = "http://127.0.0.1:%d/enneagram/" % PORT
URL = BASE + "#data"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
LIVE = json.load(open(os.path.join(HERE, "fixtures_stats_live.json"), encoding="utf-8"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    h = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=REPO))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h


def synth(n):
    """A bigger synthetic payload (20 days) to prove the charts scale."""
    rnd = random.Random(7)
    daily, types, answers = {}, {}, {}
    from build import payload
    QS = payload()["questions"]
    for d in range(n):
        day = "2026-10-%02d" % (1 + d // 3)
        daily[day] = daily.get(day, 0) + rnd.randint(1, 6)
    total = sum(daily.values())
    for t in range(1, 10):
        types[str(t)] = rnd.randint(0, 9)
    for q in QS:
        answers[q["id"]] = {o["k"]: rnd.randint(0, total) for o in q["options"]}
    run, cum = 0, []
    for d in sorted(daily):
        run += daily[d]
        cum.append([d, run])
    return {"ok": True, "total": total, "types": types, "counts": types,
            "centers": {"head": 12, "heart": 9, "gut": 8}, "answers": answers,
            "daily": daily, "cumulative": cum, "wings": {"6w5": 3, "潛藏 3 型": 2},
            "gaps": {"並排（相差 <=4 分）": 4}, "crosstab": LIVE["crosstab"],
            "avg_scores": {}, "n_scored": total, "avg_elapsed_sec": 213,
            "updated": "2026-10-30 17:00:00"}


def probe(page, payload_obj, label, shot=True):
    page.route("**/stats", lambda route: route.fulfill(
        status=200, content_type="application/json; charset=utf-8",
        body=json.dumps(payload_obj, ensure_ascii=False)))
    i = probe.n = getattr(probe, "n", 0) + 1
    page.goto(BASE + "?t=%d#data" % i, wait_until="load")
    page.wait_for_function("window.__ENNEA && document.querySelector('#dQsel').children.length===20", timeout=15000)
    page.wait_for_timeout(500)
    r = page.evaluate("""(() => {
        const svg = id => { const e = document.querySelector(id); return e ? e.querySelectorAll('svg').length : -1 };
        const txt = id => { const e = document.querySelector(id); return e ? e.innerText : '' };
        return {
          view: document.querySelector('#v-data').classList.contains('on'),
          big: (document.querySelector('#dTotal')||{}).textContent,
          kpis: document.querySelectorAll('#dKpis .kpi').length,
          trendSvg: svg('#dTrend'), trendPaths: document.querySelectorAll('#dTrend path').length,
          donutSegs: document.querySelectorAll('#dDonut circle').length,
          donutLegend: document.querySelectorAll('#dDonut .dlegend span').length,
          qOptions: document.querySelectorAll('#dQsel option').length,
          qRows: document.querySelectorAll('#dQbars .qrow').length,
          qFirstPct: (document.querySelector('#dQbars .qrow .pct')||{}).textContent,
          crossRows: document.querySelectorAll('#dCross table tbody tr').length,
          crossCells: document.querySelectorAll('#dCross table tbody td').length,
          analysisHeads: document.querySelectorAll('#dAnalysis h4').length,
          analysisFlag: (document.querySelector('#dAnalysis .flag')||{}).textContent,
          analysisText: txt('#dAnalysis').slice(0, 1200),
          copyTxt: (document.querySelector('#dAnalysis').dataset.txt||'').slice(0, 400),
          status: (document.querySelector('#dStatus')||{}).textContent
        };
    })()""")
    if shot:
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SHOTS, "dash_%s_top.png" % label), full_page=False)
        page.screenshot(path=os.path.join(SHOTS, "dash_%s_full.png" % label), full_page=True)
    return r


def js_syntax_ok():
    """Guard: the whole inline script of the built page must parse (catches escaping bugs)."""
    import re, subprocess
    html = open(os.path.join(REPO, "enneagram", "index.html"), encoding="utf-8").read()
    blocks = re.findall(r"<script>(.*?)</script>", html, re.S)
    if not blocks:
        return False, "no script block found"
    for i, code in enumerate(blocks):
        r = subprocess.run(["node", "-e", "new Function(process.argv[1])", code],
                           capture_output=True, text=True)
        if r.returncode:
            return False, "block %d: %s" % (i, (r.stderr or "").strip().splitlines()[-1][:120])
    return True, "%d script block(s) parse" % len(blocks)


def main():
    os.makedirs(SHOTS, exist_ok=True)
    h = serve()
    errs = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
            ctx = b.new_context(viewport={"width": 1440, "height": 950}, user_agent=UA)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errs.append(str(e)))

            print("== live payload (n=%d) ==" % LIVE["total"], flush=True)
            r = probe(page, LIVE, "live")
            for k, v in r.items():
                if k != "analysisText":
                    print("  %-14s %s" % (k, v), flush=True)
            print("  analysis sample:", r["analysisText"][:220].replace("\n", " | "), flush=True)
            print("  copy text sample:", r["copyTxt"][:120].replace("\n", " | "), flush=True)

            print("\n== question selector switches data ==", flush=True)
            page.select_option("#dQsel", "risk")
            page.wait_for_timeout(300)
            risk_first = page.evaluate("(document.querySelector('#dQbars .qrow .qt span')||{}).textContent")
            page.select_option("#dQsel", "age")
            page.wait_for_timeout(300)
            age_first = page.evaluate("(document.querySelector('#dQbars .qrow .qt span')||{}).textContent")
            print("  risk top option:", risk_first, flush=True)
            print("  age  top option:", age_first, flush=True)
            page.evaluate("document.querySelector('#dCopy').click()")
            page.wait_for_timeout(400)
            print("  copy button msg:", page.evaluate("(document.querySelector('#dCopyMsg')||{}).textContent"), flush=True)

            print("\n== synthetic payload (bigger, 20 days) ==", flush=True)
            big = synth(60)
            r2 = probe(page, big, "synth")
            print("  total:", r2["big"], "| donutSegs:", r2["donutSegs"], "| trendPaths:", r2["trendPaths"],
                  "| qRows:", r2["qRows"], "| crossCells:", r2["crossCells"], "| heads:", r2["analysisHeads"], flush=True)
            print("  flag:", r2["analysisFlag"], flush=True)

            print("\n== empty payload ==", flush=True)
            r3 = probe(page, {"ok": True, "total": 0, "types": {}, "counts": {}, "centers": {},
                              "answers": {}, "daily": {}, "cumulative": [], "wings": {}, "gaps": {},
                              "crosstab": {}, "avg_scores": {}, "n_scored": 0, "avg_elapsed_sec": 0}, "empty")
            print("  total:", r3["big"], "| heads:", r3["analysisHeads"], "| crossRows:", r3["crossRows"], flush=True)
            print("  analysis:", r3["analysisText"][:110].replace("\n", " | "), flush=True)

            # mobile view of the dashboard
            pm = ctx.new_page()
            pm.set_viewport_size({"width": 390, "height": 844})
            pm.route("**/stats", lambda route: route.fulfill(status=200, content_type="application/json; charset=utf-8",
                                                             body=json.dumps(LIVE, ensure_ascii=False)))
            pm.goto(BASE + "?t=mobile#data", wait_until="load")
            pm.wait_for_function("window.__ENNEA && document.querySelector('#dQsel').children.length===20", timeout=15000)
            pm.wait_for_timeout(500)
            pm.screenshot(path=os.path.join(SHOTS, "dash_mobile_full.png"), full_page=True)
            overflow = pm.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            print("\n  mobile horizontal overflow px:", overflow, flush=True)
            mobile_overflow = overflow
            b.close()
    finally:
        h.shutdown()

    print("\n===== CHECKS =====", flush=True)
    js_ok, js_msg = js_syntax_ok()
    checks = [
        ("built page javascript parses (%s)" % js_msg, js_ok),
        ("deep link #data opens the dashboard", r["view"] is True),
        ("total rendered", r["big"] == str(LIVE["total"])),
        ("3 KPI chips", r["kpis"] == 3),
        ("trend chart is real SVG with curve", r["trendSvg"] == 1 and r["trendPaths"] >= 2),
        ("donut segments = distinct types present, legend matches",
         r["donutSegs"] == len(LIVE["types"]) and r["donutLegend"] == len(LIVE["types"])),
        ("all 20 questions in selector", r["qOptions"] == 20),
        ("question bars rendered", r["qRows"] >= 2),
        ("cross-tab table built", r["crossRows"] >= 1 and r["crossCells"] >= 10),
        ("analysis has 8 sections", r["analysisHeads"] == 8),
        ("analysis quotes the real total", ("%d 份" % LIVE["total"]) in r["analysisText"]),
        ("copy text is a full report", "數據摘要" in r["copyTxt"] and "樣本" in r["copyTxt"]),
        ("selector changes the data", risk_first != age_first),
        ("synthetic sample -> 9 segments + multi-day trend", r2["donutSegs"] == 9 and r2["trendPaths"] >= 2),
        ("confidence flag uses sample size", "樣本信心" in (r2["analysisFlag"] or "")),
        ("empty payload degrades gracefully", r3["analysisHeads"] == 0 and r3["crossRows"] == 0),
        ("mobile layout has no horizontal overflow", mobile_overflow <= 1),
        ("no js errors", not errs),
    ]
    bad = [n for n, ok in checks if not ok]
    for n, ok in checks:
        print(("PASS " if ok else "FAIL ") + n)
    if errs:
        print("JS errors:", errs[:3])
    print("\nRESULT:", "ALL PASS" if not bad else "FAILED -> %s" % bad)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
