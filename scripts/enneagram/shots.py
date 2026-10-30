#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Capture desktop + mobile screenshots of the live quiz page (bottom of page included)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from e2e_real import exe  # reuse the glob-based chromium resolver

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8903/enneagram/"
SHOTS = "/opt/data/cache/scratch/ennea_shots"
os.makedirs(SHOTS, exist_ok=True)
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox", "--disable-dev-shm-usage"])
    # desktop: full page + bottom slice
    pg = b.new_context(viewport={"width": 1440, "height": 950}, user_agent=UA).new_page()
    pg.goto(URL, wait_until="load"); pg.wait_for_timeout(1500)
    pg.screenshot(path=os.path.join(SHOTS, "chk_desktop_top.png"))
    pg.screenshot(path=os.path.join(SHOTS, "chk_desktop_full.png"), full_page=True)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(700)
    pg.screenshot(path=os.path.join(SHOTS, "chk_desktop_bottom.png"))
    print("desktop page height:", pg.evaluate("document.body.scrollHeight"))
    print("footer text present:", pg.evaluate("!!document.querySelector('footer.foot')"))
    print("railfoot present:", pg.evaluate("!!document.querySelector('.railfoot')"))
    print("has 資料說明:", pg.evaluate("document.body.innerText.includes('資料說明')"))
    print("has 市場調查問卷:", pg.evaluate("document.body.innerText.includes('市場調查問卷')"))
    print("has 互動市場研究交付:", pg.evaluate("document.body.innerText.includes('互動市場研究交付')"))
    print("has 匿名:", pg.evaluate("document.body.innerText.includes('匿名')"))
    # mobile
    pm = b.new_context(viewport={"width": 390, "height": 844}, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1").new_page()
    pm.goto(URL, wait_until="load"); pm.wait_for_timeout(1400)
    pm.screenshot(path=os.path.join(SHOTS, "chk_mobile_top.png"))
    pm.screenshot(path=os.path.join(SHOTS, "chk_mobile_full.png"), full_page=True)
    print("mobile page height:", pm.evaluate("document.body.scrollHeight"))
    b.close()
print("shots ->", SHOTS)
