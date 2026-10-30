
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
LIVE="https://firebean.net/enneagram/?cb=%d"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,hgt in ((320,568),(360,640),(375,667),(390,844),(414,896),(834,1112),(1440,1000)):
        ctx=b.new_context(viewport={"width":w,"height":hgt}, has_touch=(w<900), is_mobile=(w<900), device_scale_factor=3 if w<900 else 1)
        pg=ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(LIVE%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
        res={}
        try:
            pg.locator("#startBtn").click(timeout=6000); pg.wait_for_timeout(400)
            res["pwclick"]=pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()") or "none"
        except Exception as e:
            res["pwclick"]="FAIL "+str(e).split("\n")[0]
        for label,f in (("left12",0.12),("left25",0.25),("mid",0.5)):
            pg.evaluate("window.__ennView('intro')"); pg.wait_for_timeout(250)
            r=pg.evaluate("(()=>{const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'}); const q=b.getBoundingClientRect(); return {x:q.left+q.width*%s,y:q.top+q.height/2,hit:(function(){const e=document.elementFromPoint(q.left+q.width*%s,q.top+q.height/2); return (e===b)?'BTN':(e?e.tagName:'null')})()}})()"%(f,f))
            if w<900: pg.touchscreen.tap(r["x"], r["y"])
            else: pg.mouse.click(r["x"], r["y"])
            pg.wait_for_timeout(400)
            res[label]=r["hit"]+"->"+(pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join()") or "none")
        print("%dx%d %s errs=%s"%(w,hgt,json.dumps(res, ensure_ascii=False), errs[:1]))
        ctx.close()
    # end-to-end still healthy: answer 3 questions online, check progress
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page(); pg.goto(LIVE%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    pg.locator("#startBtn").click(); pg.wait_for_timeout(500)
    for i in range(3):
        pg.evaluate("(()=>{const o=document.querySelector('#opts .opt'); if(o) o.click()})()"); pg.wait_for_timeout(300)
        pg.evaluate("(()=>{const n=document.querySelector('#nextBtn'); if(n) n.click()})()"); pg.wait_for_timeout(400)
    print("after 3 answers:", pg.evaluate("(()=>({view:Array.from(document.querySelectorAll('.view.on')).map(v=>v.id).join(),prog:(document.querySelector('#qCount')||{}).textContent}))()"))
    b.close()
