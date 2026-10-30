
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for label,w,h,touch in (("mobile_scrolled",390,844,True),("small_iphone_se",320,568,True)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=touch, is_mobile=touch)
        pg=ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1200)
        info=pg.evaluate("""(()=>{const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'});
          const r=b.getBoundingClientRect(); const at=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
          return {y:Math.round(r.top), h:innerHeight, hit:at?at.tagName+'#'+(at.id||''):null, isBtn: at===b||b.contains(at)}})()""")
        print(label, json.dumps(info, ensure_ascii=False))
        pg.touchscreen.tap(w/2 if False else info and 0 or 0, 0) if False else None
        r=pg.evaluate("(()=>{const b=document.querySelector('#startBtn').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()")
        pg.touchscreen.tap(r["x"], r["y"]); pg.wait_for_timeout(800)
        print("   ->", json.dumps(pg.evaluate("(()=>({views:Array.from(document.querySelectorAll('.view.on')).map(v=>v.id),hash:location.hash}))()"), ensure_ascii=False), "errors", errs[:1])
        ctx.close()
    b.close()
