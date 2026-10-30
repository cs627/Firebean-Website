
import functools, http.server, os, socketserver, sys, threading, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
HERE="/opt/data/github/Firebean-Website/scripts/enneagram"; REPO=os.path.abspath(os.path.join(HERE,"..",".."))
PORT=8953
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
h=socketserver.TCPServer(("127.0.0.1",PORT), functools.partial(Q, directory=REPO)); threading.Thread(target=h.serve_forever,daemon=True).start()
URL="http://127.0.0.1:%d/enneagram/"%PORT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,hgt in ((320,568),(360,640),(375,667),(390,844),(414,896),(834,1112),(1440,1000)):
        ctx=b.new_context(viewport={"width":w,"height":hgt}, has_touch=(w<900), is_mobile=(w<900), device_scale_factor=3 if w<900 else 1)
        pg=ctx.new_page()
        pg.goto(URL, wait_until="load"); pg.wait_for_timeout(600)
        res={}
        # 1) Playwright trusted click (auto hit-test)
        try:
            pg.locator("#startBtn").click(timeout=5000); pg.wait_for_timeout(400)
            res["pwclick"]=pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()")
        except Exception as e:
            res["pwclick"]="FAIL: "+str(e).split("\n")[0]
        pg.evaluate("window.__ennView('intro')"); pg.wait_for_timeout(300)
        # 2) left-edge tap (where users actually tap) via elementFromPoint + touch/ mouse
        for label,f in (("left12",0.12),("left25",0.25),("mid",0.5)):
            pg.evaluate("window.__ennView('intro')"); pg.wait_for_timeout(200)
            r=pg.evaluate("(()=>{const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'}); const q=b.getBoundingClientRect(); return {x:q.left+q.width*%s, y:q.top+q.height/2, hit:(function(){const e=document.elementFromPoint(q.left+q.width*%s,q.top+q.height/2); return (e===b)?'BTN':(e?e.tagName:'null')})()}})()"%(f,f))
            if w<900: pg.touchscreen.tap(r["x"], r["y"])
            else: pg.mouse.click(r["x"], r["y"])
            pg.wait_for_timeout(350)
            v=pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()")
            res[label]=r["hit"]+"->"+v
        print("%dx%d %s"%(w,hgt,json.dumps(res, ensure_ascii=False)))
        ctx.close()
    b.close()
h.shutdown()
