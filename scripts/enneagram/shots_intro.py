#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Screenshot the static intro view (desktop + mobile) from the built page."""
import functools, http.server, os, socketserver, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e_real import exe
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SHOTS = "/opt/data/cache/scratch/ennea_shots"
PORT = 8911


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
h = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=REPO))
threading.Thread(target=h.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
    for name, w, hh in (("intro", 1440, 1000), ("intro_ipad", 834, 1100), ("intro_mobile", 390, 844)):
        ctx = b.new_context(viewport={"width": w, "height": hh})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/enneagram/" % PORT, wait_until="load")
        pg.wait_for_timeout(900)
        pg.locator("#v-intro .card").screenshot(path=os.path.join(SHOTS, "intro_%s.png" % name))
        ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        boxes = pg.evaluate("""Array.from(document.querySelectorAll('#v-intro .infostrip .info')).map(e=>{
            const r=e.getBoundingClientRect();
            return {t:e.innerText.replace(/\\n/g,' / '), w:Math.round(r.width), h:Math.round(r.height)}})""")
        print(name, w, "overflow", ov, "errors", errs[:2])
        for bx in boxes:
            print("    tile:", bx)
        ctx.close()
    b.close()
h.shutdown()
