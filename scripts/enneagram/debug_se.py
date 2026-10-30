
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
SH="/opt/data/cache/scratch/ennea_shots"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":320,"height":568}, has_touch=True, is_mobile=True)
    pg=ctx.new_page()
    pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelector('#startBtn').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
    d=pg.evaluate("""(()=>{
      const b=document.querySelector('#startBtn'), c=document.querySelector('#v-intro .card');
      const rb=b.getBoundingClientRect(), rc=c.getBoundingClientRect();
      const hits=[0.1,0.3,0.5,0.7,0.9].map(function(f){
        const x=rb.left+rb.width*f, y=rb.top+rb.height*0.5;
        const e=document.elementFromPoint(x,y);
        return Math.round(x)+":"+(e? e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).slice(0,18):''):"null");
      });
      const s=getComputedStyle(b);
      return {btn:[rb.left,rb.top,rb.width,rb.height].map(Math.round), card:[rc.left,rc.top,rc.width,rc.height].map(Math.round),
              btnStyle:{display:s.display, position:s.position, z:s.zIndex, opacity:s.opacity, visibility:s.visibility, transform:s.transform, w:s.width, h:s.height},
              btnrowStyle:(function(){const s2=getComputedStyle(b.parentElement);return {display:s2.display, flexWrap:s2.flexWrap, gap:s2.gap}})(),
              hitsAlongButton:hits, docH:document.body.scrollHeight, sh:document.documentElement.scrollHeight, innerH:innerHeight, scrollY:Math.round(scrollY)};
    })()""")
    print(json.dumps(d, ensure_ascii=False, indent=1))
    pg.screenshot(path=SH+"/se_overlay.png")
    print("tap result:")
    r=pg.evaluate("(()=>{const b=document.querySelector('#startBtn').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()")
    pg.touchscreen.tap(r["x"], r["y"]); pg.wait_for_timeout(700)
    print("  ", pg.evaluate("(()=>({views:Array.from(document.querySelectorAll('.view.on')).map(v=>v.id)}))()"))
    b.close()
