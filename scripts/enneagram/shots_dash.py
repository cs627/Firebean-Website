#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Targeted screenshots of the dashboard's analysis block + mobile view."""
import functools, http.server, json, os, socketserver, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e_real import exe
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SHOTS = "/opt/data/cache/scratch/ennea_shots"
PORT = 8907
LIVE = json.load(open(os.path.join(HERE, "fixtures_stats_live.json"), encoding="utf-8"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
h = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=REPO))
threading.Thread(target=h.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
    ctx = b.new_context(viewport={"width": 1440, "height": 1000})
    page = ctx.new_page()
    page.route("**/stats", lambda r: r.fulfill(status=200, content_type="application/json; charset=utf-8",
                                               body=json.dumps(LIVE, ensure_ascii=False)))
    page.goto("http://127.0.0.1:%d/enneagram/#data" % PORT, wait_until="load")
    page.wait_for_function("window.__ENNEA && document.querySelector('#dQsel').children.length===20")
    page.wait_for_timeout(600)
    page.locator("#dAnalysis").screenshot(path=os.path.join(SHOTS, "dash_live_analysis.png"))
    page.locator("#dCross").screenshot(path=os.path.join(SHOTS, "dash_live_cross.png"))
    page.locator("#dQbars").screenshot(path=os.path.join(SHOTS, "dash_live_qbars.png"))
    pm = ctx.new_page()
    pm.set_viewport_size({"width": 390, "height": 844})
    pm.route("**/stats", lambda r: r.fulfill(status=200, content_type="application/json; charset=utf-8",
                                             body=json.dumps(LIVE, ensure_ascii=False)))
    pm.goto("http://127.0.0.1:%d/enneagram/#data" % PORT, wait_until="load")
    pm.wait_for_function("window.__ENNEA && document.querySelector('#dQsel').children.length===20")
    pm.wait_for_timeout(600)
    pm.locator("#v-data .card").screenshot(path=os.path.join(SHOTS, "dash_mobile_card.png"))
    print("shots written to", SHOTS)
    b.close()
h.shutdown()
