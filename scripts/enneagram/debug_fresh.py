
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w in (320,360,375,390,414):
        ctx=b.new_context(viewport={"width":w,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
        pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(800)
        d=pg.evaluate("""(()=>{
          const card=document.querySelector('#v-intro .card');
          const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'});
          const r=b.getBoundingClientRect();
          const hit=function(f){const e=document.elementFromPoint(r.left+r.width*f, r.top+r.height/2); return (e===b)?"BTN":(e?e.tagName+":"+String(e.className).slice(0,14):"null")};
          return {cardCW:card.clientWidth, cardSW:card.scrollWidth, docSW:document.documentElement.scrollWidth,
                  left:hit(0.12), mid:hit(0.5), right:hit(0.88)};
        })()""")
        print(w, json.dumps(d, ensure_ascii=False))
        ctx.close()
    b.close()
