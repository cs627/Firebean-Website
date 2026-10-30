
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,h in ((320,568),(360,640),(390,844)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=True, is_mobile=True)
        pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1000)
        out=pg.evaluate("""(()=>{
          const b=document.querySelector('#startBtn'); b.scrollIntoView({block:'center'});
          const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
          const stack=document.elementsFromPoint(cx,cy).slice(0,5).map(function(e){
            const s=getComputedStyle(e); const q=e.getBoundingClientRect();
            return {el:e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).slice(0,34):''),
                    pos:s.position,z:s.zIndex,pe:s.pointerEvents,op:s.opacity,
                    box:[Math.round(q.x),Math.round(q.y),Math.round(q.width),Math.round(q.height)],
                    parent:(e.parentElement? e.parentElement.tagName+(e.parentElement.id?'#'+e.parentElement.id:'')+(e.parentElement.className?'.'+String(e.parentElement.className).slice(0,26):''):null)};
          });
          const cover=stack[0].el.indexOf('startBtn')===-1;
          return {vw:innerWidth, btnRect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], top:stack[0].el, cover:cover, stack:stack};
        })()""")
        print(json.dumps(out, ensure_ascii=False, indent=1))
        ctx.close()
    b.close()
