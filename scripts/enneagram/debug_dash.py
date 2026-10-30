#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Debug the dashboard load: dump console/page errors and view state."""
import functools, http.server, json, os, socketserver, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e_real import exe
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
PORT = 8906
LIVE = json.load(open(os.path.join(HERE, "fixtures_stats_live.json"), encoding="utf-8"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
h = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=REPO))
threading.Thread(target=h.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = b.new_context(viewport={"width": 1440, "height": 950}).new_page()
    logs, errs, reqs = [], [], []
    page.on("console", lambda m: logs.append(m.type + ": " + m.text))
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("request", lambda r: reqs.append(r.method + " " + r.url))
    page.route("**/stats", lambda route: route.fulfill(status=200, content_type="application/json; charset=utf-8",
                                                      body=json.dumps(LIVE, ensure_ascii=False)))
    page.goto("http://127.0.0.1:%d/enneagram/#data" % PORT, wait_until="load")
    page.wait_for_timeout(2500)
    print("hash:", page.evaluate("location.hash"))
    print("view classes:", page.evaluate("Array.from(document.querySelectorAll('.view')).map(function(v){return v.id+':'+v.className})"))
    print("v-data display:", page.evaluate("getComputedStyle(document.querySelector('#v-data')).display"))
    print("dStatus:", page.evaluate("(document.querySelector('#dStatus')||{}).textContent"))
    print("dQsel children:", page.evaluate("document.querySelector('#dQsel').children.length"))
    print("DASH:", page.evaluate("(()=>{try{return JSON.stringify(window.__ENNEA.dash()).slice(0,80)}catch(e){return 'ERR '+e.message}})()"))
    print("statsUrl:", page.evaluate("(()=>{try{return document.querySelector('#dSrc').textContent||'n/a'}catch(e){return 'ERR'}})()"))
    print("requests:", reqs)
    print("console:", logs[:12])
    print("pageerrors:", errs[:6])
    b.close()
h.shutdown()
