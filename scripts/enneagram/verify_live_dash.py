#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""End-to-end check against the LIVE deployed page (read-only: only reads /stats)."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e_real import exe
from playwright.sync_api import sync_playwright

SHOTS = "/opt/data/cache/scratch/ennea_shots"
URL = "https://firebean.net/enneagram/"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 1440, "height": 980})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL + "?v=%d#data" % int(time.time()), wait_until="load")
    try:
        page.wait_for_function("window.__ENNEA && document.querySelector('#dQsel').children.length===20", timeout=25000)
        ok = True
    except Exception as exc:
        ok = False
        print("dashboard did not initialise:", str(exc)[:160])
    page.wait_for_timeout(800)
    state = page.evaluate("""(() => ({
        url: location.href,
        viewOn: document.querySelector('#v-data').classList.contains('on'),
        total: (document.querySelector('#dTotal')||{}).textContent,
        status: (document.querySelector('#dStatus')||{}).textContent,
        kpis: Array.from(document.querySelectorAll('#dKpis .kpi')).map(e=>e.innerText.replace(/\\n/g,' / ')),
        trendDots: document.querySelectorAll('#dTrend circle').length,
        trendXlabels: document.querySelectorAll('#dTrend text').length,
        donutSegs: document.querySelectorAll('#dDonut circle').length,
        qRows: document.querySelectorAll('#dQbars .qrow').length,
        crossRows: document.querySelectorAll('#dCross table tbody tr').length,
        heads: document.querySelectorAll('#dAnalysis h4').length,
        firstBullet: ((document.querySelector('#dAnalysis li')||{}).textContent||'').slice(0,150),
        flag: (document.querySelector('#dAnalysis .flag')||{}).textContent,
        copyLen: (document.querySelector('#dAnalysis').dataset.txt||'').length
    }))()""")
    page.screenshot(path=os.path.join(SHOTS, "live_deployed_dash.png"), full_page=False)
    page.evaluate("document.querySelector('#dAnalysis').scrollIntoView()")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(SHOTS, "live_deployed_analysis.png"), full_page=False)
    print(json.dumps(state, ensure_ascii=False, indent=1))
    print("pageerrors:", errs[:3])
    print("INIT_OK:", ok)
    b.close()
