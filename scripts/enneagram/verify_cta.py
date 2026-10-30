
import functools, http.server, json, os, socketserver, sys, threading
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
HERE="/opt/data/github/Firebean-Website/scripts/enneagram"; REPO=os.path.abspath(os.path.join(HERE,"..",".."))
PORT=8917
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
h=socketserver.TCPServer(("127.0.0.1",PORT), functools.partial(Q, directory=REPO)); threading.Thread(target=h.serve_forever,daemon=True).start()
def run(pg, w, hh, label, touch):
    ctx_page=pg
    stats=[]
    ctx_page.route("**/stats", lambda r: (stats.append(1), r.fulfill(status=200, content_type="application/json", body="{}")))
    ctx_page.goto("http://127.0.0.1:%d/enneagram/"%PORT, wait_until="load"); ctx_page.wait_for_timeout(700)
    print(label, "start: views", ctx_page.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id)"), "hash", ctx_page.evaluate("location.hash"))
    ctx_page.click("#startBtn"); ctx_page.wait_for_timeout(600)
    print(label, "after CTA:", ctx_page.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id)"), "hash", ctx_page.evaluate("location.hash"), "q", (ctx_page.evaluate("document.querySelector('#qText').textContent"))[:22])
    ctx_page.click("a[data-go=intro]") if ctx_page.locator("a[data-go=intro]").count() else None
    ctx_page.evaluate("document.querySelector('#railnav button[data-go=intro]') ? document.querySelector('#railnav button[data-go=intro]').click() : window.__ennView('intro')")
    ctx_page.wait_for_timeout(400)
    ctx_page.click("a[data-go=atlas]"); ctx_page.wait_for_timeout(500)
    print(label, "after 圖鑑:", ctx_page.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id)"), "hash", ctx_page.evaluate("location.hash"))
    print(label, "stats requests:", len(stats))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":1440,"height":1000}); run(ctx.new_page(),1440,1000,"desktop",False); ctx.close()
    ctx=b.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True); run(ctx.new_page(),390,844,"mobile",True)
    # deep links must still open their view
    for hs in ("data","atlas","quiz","intro"):
        ctx=b.new_context(viewport={"width":1200,"height":900}); pg=ctx.new_page()
        pg.goto("http://127.0.0.1:%d/enneagram/#%s"%(PORT,hs), wait_until="load"); pg.wait_for_timeout(900)
        print("deeplink #%s ->"%hs, pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id)"))
        ctx.close()
    b.close()
h.shutdown()
