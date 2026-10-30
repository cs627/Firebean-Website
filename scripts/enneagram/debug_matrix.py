
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,h,mob,dsf in ((320,568,False,1),(320,568,True,1),(320,568,True,3),(360,640,True,3),(375,667,True,3),(390,844,True,3),(320,568,True,2)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=mob, is_mobile=mob, device_scale_factor=dsf)
        pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
        r=pg.evaluate("""(()=>{
          const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'});
          const q=b.getBoundingClientRect();
          const hit=function(f){const e=document.elementFromPoint(q.left+q.width*f,q.top+q.height/2); return (e===b)?"BTN":(e?e.tagName+"."+String(e.className).slice(0,12):"null")};
          const inp=document.querySelector('meta[name=viewport]');
          return {left:hit(0.25), mid:hit(0.5), right:hit(0.75),
                  vv:window.visualViewport? Math.round(window.visualViewport.width)+"x"+Math.round(window.visualViewport.height)+" s="+window.visualViewport.scale : "n/a",
                  inner:innerWidth+"x"+innerHeight,
                  sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth,
                  meta: inp? inp.content : null, dpr:window.devicePixelRatio};
        })()""")
        print("w=%d mob=%s dsf=%s -> %s" % (w, mob, dsf, json.dumps(r, ensure_ascii=False)))
        ctx.close()
    b.close()
