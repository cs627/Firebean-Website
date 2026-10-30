
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
for W,H in ((390,844),(320,568)):
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":W,"height":H}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page(); pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    pg.locator("#startBtn").click(); pg.wait_for_timeout(500)
    nb=pg.evaluate("""(()=>{const n=document.querySelector('#btnNext'); if(!n) return {found:false};
      const r=n.getBoundingClientRect(); const s=getComputedStyle(n); const bar=n.closest('.actionbar');
      return {found:true, rect:[r.left,r.top,r.width,r.height].map(Math.round), disp:s.display, vis:s.visibility,
              inBar:!!bar, barCls:bar?String(bar.className):null, barDisp:bar?getComputedStyle(bar).display:null,
              hitAtCenter:(function(){const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return e? e.tagName+(e.id?'#'+e.id:''):'null'})()};})()""")
    print(W, "btnNext:", json.dumps(nb, ensure_ascii=False))
    prog=[]
    for i in range(8):
        # tap first option
        r=pg.evaluate("""(()=>{const o=document.querySelector('#v-quiz .opt'); if(!o) return null; o.scrollIntoView({block:'center'}); const q=o.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()""")
        if r: pg.touchscreen.tap(r["x"], r["y"])
        pg.wait_for_timeout(350)
        q1=pg.evaluate("(document.querySelector('#qCount')||{}).textContent")
        # tap btnNext wherever it is
        r2=pg.evaluate("""(()=>{const n=document.querySelector('#btnNext'); n.scrollIntoView({block:'center'}); const q=n.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2,vis:getComputedStyle(n).display!=='none'}})()""")
        if r2 and r2.get("vis"):
            if W<900: pg.touchscreen.tap(r2["x"], r2["y"])
            else: pg.mouse.click(r2["x"], r2["y"])
        pg.wait_for_timeout(450)
        q2=pg.evaluate("(document.querySelector('#qCount')||{}).textContent")
        prog.append("%s -> %s"%(q1,q2))
    print(W, json.dumps(prog, ensure_ascii=False))
    ctx.close(); b.close()
