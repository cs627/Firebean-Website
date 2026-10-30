
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,h in ((320,568),(360,640),(390,844),(414,896)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=True, is_mobile=True)
        pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
        out=pg.evaluate("""(()=>{
          const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'});
          const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
          const stack=document.elementsFromPoint(cx,cy).slice(0,4).map(function(e){
            const s=getComputedStyle(e);
            return e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).slice(0,30):'')+'['+s.position+',z='+s.zIndex+']';
          });
          return stack.join('  >  ');
        })()""")
        print("%dx%d : %s" % (w,h,out))
        ctx.close()
    b.close()
