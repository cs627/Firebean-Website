
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
SH="/opt/data/cache/scratch/ennea_shots"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for label,w,h,touch in (("desktop",1440,1000,False),("mobile",390,844,True),("ipad",834,1112,True)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=touch, is_mobile=touch)
        pg=ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1200)
        tag=pg.evaluate("document.querySelector('#startBtn').tagName")
        r=pg.evaluate("(()=>{const b=document.querySelector('#startBtn').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()")
        if touch: pg.touchscreen.tap(r["x"], r["y"])
        else: pg.mouse.click(r["x"], r["y"])
        pg.wait_for_timeout(800)
        st=pg.evaluate("(()=>({views:Array.from(document.querySelectorAll('.view.on')).map(v=>v.id),hash:location.hash,q:(document.querySelector('#qText')||{}).textContent}))()")
        print(label, "startBtn=<%s>"%tag, json.dumps(st, ensure_ascii=False), "errors", errs[:1])
        ctx.close()
    b.close()
