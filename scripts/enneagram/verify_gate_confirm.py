
import functools, http.server, os, socketserver, sys, threading, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
HERE="/opt/data/github/Firebean-Website/scripts/enneagram"; REPO=os.path.abspath(os.path.join(HERE,"..",".."))
PORT=8993
class Qx(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(("127.0.0.1",PORT), functools.partial(Qx, directory=REPO)); threading.Thread(target=srv.serve_forever,daemon=True).start()
BASE="http://127.0.0.1:%d/enneagram/"%PORT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for url in (BASE, BASE, BASE+"?internal=1"):
        ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
        pg=ctx.new_page(); pg.goto(url, wait_until="load"); pg.wait_for_timeout(900)
        print(url.split("enneagram/")[1] or "(public)", json.dumps(pg.evaluate("""(()=>({
          team: document.body.classList.contains("team-access"),
          ghostDisplay: getComputedStyle(document.querySelector('#v-intro .btnrow .btn.ghost')).display,
          ghostVisible: document.querySelector('#v-intro .btnrow .btn.ghost').getBoundingClientRect().width>0,
          atlasRail: getComputedStyle(document.querySelector('#railnav button[data-go=atlas]')).display
        }))()"""), ensure_ascii=False))
        ctx.close()
    b.close()
srv.shutdown()
