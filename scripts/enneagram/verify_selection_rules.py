
import functools, http.server, os, socketserver, sys, threading, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
HERE="/opt/data/github/Firebean-Website/scripts/enneagram"; REPO=os.path.abspath(os.path.join(HERE,"..",".."))
PORT=8971
class Qx(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(("127.0.0.1",PORT), functools.partial(Qx, directory=REPO)); threading.Thread(target=srv.serve_forever,daemon=True).start()
URL="http://127.0.0.1:%d/enneagram/"%PORT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    ctx.route("**/submit", lambda r: r.fulfill(status=200, content_type="application/json", body='{"ok":true}'))
    pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    pg.goto(URL, wait_until="load"); pg.wait_for_timeout(500)
    pg.locator("#startBtn").click(); pg.wait_for_timeout(400)
    seen=[]; caps_seen=[]
    for step in range(30):
        v=pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()")
        if v!="v-quiz": break
        d=pg.evaluate("""(()=>({q:(document.querySelector('#qCount')||{}).textContent, note:(document.querySelector('#qNote')||{}).textContent, text:(document.querySelector('#qText')||{}).textContent.slice(0,20), n:document.querySelectorAll('#v-quiz .opt').length}))()""")
        seen.append(d["note"])
        if "最多" in d["note"]: caps_seen.append(d["q"])
        is_multi = "可選取多於一項" in d["note"]
        if is_multi:
            # 全部選項都揀（驗證無上限）
            for i in range(d["n"]):
                r=pg.evaluate("""(i)=>{const o=document.querySelectorAll('#v-quiz .opt')[i]; if(!o) return null; o.scrollIntoView({block:'center'}); const q=o.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}}""", i)
                if r: pg.touchscreen.tap(r["x"], r["y"])
                pg.wait_for_timeout(90)
            st=pg.evaluate("(document.querySelector('#qNote')||{}).textContent")
            seen.append("  -> "+st+" (選項數="+str(d["n"])+")")
            r2=pg.evaluate("""(()=>{const n=document.querySelector('#btnNext'); if(!n||n.disabled) return null; n.scrollIntoView({block:'center'}); const q=n.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()""")
            if r2: pg.touchscreen.tap(r2["x"], r2["y"])
        else:
            # 單選：揀一個，應該自動跳下一題
            r=pg.evaluate("""(()=>{const o=document.querySelector('#v-quiz .opt'); o.scrollIntoView({block:'center'}); const q=o.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()""")
            pg.touchscreen.tap(r["x"], r["y"])
        pg.wait_for_timeout(420)
    print("最終畫面:", pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()"))
    print("出現過『最多』的題目:", caps_seen or "無 ✓")
    print("單選標示:", sorted(set(x for x in seen if "請選擇" in x)))
    print("多選標示樣本:", [x for x in seen if "可選取" in x][:3])
    print("完整題目流程記錄:")
    for s in seen: print("   ", s)
    print("JS errors:", errs[:2])
    b.close()
srv.shutdown()
