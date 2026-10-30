
import functools, http.server, os, socketserver, sys, threading, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
HERE="/opt/data/github/Firebean-Website/scripts/enneagram"; REPO=os.path.abspath(os.path.join(HERE,"..",".."))
PORT=8987
class Qx(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(("127.0.0.1",PORT), functools.partial(Qx, directory=REPO)); threading.Thread(target=srv.serve_forever,daemon=True).start()
BASE="http://127.0.0.1:%d/enneagram/"%PORT
PROBE = """(()=>{
  const vis=function(sel){return Array.from(document.querySelectorAll(sel)).filter(function(e){const s=getComputedStyle(e); const r=e.getBoundingClientRect(); return s.display!=="none" && s.visibility!=="hidden" && r.width>0;})};
  return {
    team: document.body.classList.contains("team-access"),
    rail: vis("#railnav button").map(function(e){return e.textContent.trim()}),
    mobtop: vis(".mobtop button").map(function(e){return e.textContent.trim()}),
    heroBtns: vis("#v-intro .btnrow .btn").map(function(e){return e.textContent.trim()}),
    view: Array.from(document.querySelectorAll(".view.on")).map(function(v){return v.id}).join(),
    hash: location.hash
  };
})()"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for label,url,w in (("公眾 desktop",BASE,1440),("公眾 mobile",BASE,390),
                        ("內部 ?internal=1 desktop",BASE+"?internal=1",1440),
                        ("內部 ?internal=1 mobile",BASE+"?internal=1",390),
                        ("直接開 #atlas",BASE+"#atlas",1440),
                        ("直接開 #data",BASE+"#data",1440),
                        ("直接開 #proposal",BASE+"#proposal",1440)):
        ctx=b.new_context(viewport={"width":w,"height":900}, has_touch=(w<900), is_mobile=(w<900))
        pg=ctx.new_page(); pg.goto(url, wait_until="load"); pg.wait_for_timeout(1100)
        print(label, "->", json.dumps(pg.evaluate(PROBE), ensure_ascii=False))
        ctx.close()
    # 公眾完整流程：簡介 -> 測驗 -> 報告，而且報告頁唔應該見到圖鑑入口
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
    ctx.route("**/submit", lambda r: r.fulfill(status=200, content_type="application/json", body='{"ok":true}'))
    pg=ctx.new_page(); pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(700)
    print("公眾 intro 按鈕:", pg.evaluate("Array.from(document.querySelectorAll('#v-intro .btnrow .btn')).map(e=>e.textContent.trim())"))
    pg.locator("#startBtn").click(); pg.wait_for_timeout(500)
    for i in range(24):
        v=pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()")
        if v!="v-quiz": break
        note=pg.evaluate("(document.querySelector('#qNote')||{}).textContent||''")
        if "可選取多於一項" in note:
            n=pg.evaluate("document.querySelectorAll('#v-quiz .opt').length")
            for j in range(min(n,2)):
                r=pg.evaluate("(j)=>{const o=document.querySelectorAll('#v-quiz .opt')[j]; o.scrollIntoView({block:'center'}); const q=o.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}}", j)
                pg.touchscreen.tap(r["x"], r["y"]); pg.wait_for_timeout(120)
            r=pg.evaluate("(()=>{const n=document.querySelector('#btnNext'); n.scrollIntoView({block:'center'}); const q=n.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()")
            pg.touchscreen.tap(r["x"], r["y"])
        else:
            r=pg.evaluate("(()=>{const o=document.querySelector('#v-quiz .opt'); o.scrollIntoView({block:'center'}); const q=o.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()")
            pg.touchscreen.tap(r["x"], r["y"])
        pg.wait_for_timeout(380)
    print("公眾流程結束畫面:", pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()"))
    print("報告頁可見嘅圖鑑／數據入口:", pg.evaluate("""Array.from(document.querySelectorAll('#v-result .internal-only')).filter(function(e){return getComputedStyle(e).display!=="none"}).length"""))
    ctx.close(); b.close()
srv.shutdown()
