
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
SH="/opt/data/cache/scratch/ennea_shots"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("https://firebean.net/enneagram/?v=%d"%int(time.time()), wait_until="load")
    pg.wait_for_timeout(1200)
    # natural scroll to bottom like a thumb swipe, then tap the button as-positioned
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    pg.wait_for_timeout(400)
    pre = pg.evaluate("""(()=>{
      const btn=document.querySelector('#startBtn'); const r=btn.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const stack=document.elementsFromPoint(cx,cy).slice(0,6).map(e=>e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).slice(0,26):''));
      // any fixed/absolute elements overlapping the CTA box?
      const overlays=[];
      document.querySelectorAll('*').forEach(function(e){
        const s=getComputedStyle(e); if(s.position!=="fixed" && s.position!=="absolute") return;
        if(s.display==="none"||s.visibility==="hidden"||s.pointerEvents==="none") return;
        const q=e.getBoundingClientRect();
        if(q.width<8||q.height<8) return;
        const hit = !(q.right<cx||q.left>cx||q.bottom<cy||q.top>cy);
        if(hit) overlays.push((e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).slice(0,26):''))+" z="+s.zIndex+" pe="+s.pointerEvents);
      });
      return {scrollY:Math.round(scrollY), rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
              stack:stack, overlays:overlays};
    })()""")
    print("PRE:", json.dumps(pre, ensure_ascii=False, indent=1))
    pg.screenshot(path=SH+"/cts_before.png")
    pg.touchscreen.tap(pre["rect"]["x"]+pre["rect"]["w"]/2, pre["rect"]["y"]+pre["rect"]["h"]/2)
    pg.wait_for_timeout(700)
    post = pg.evaluate("""(()=>{
      const q=document.querySelector('#v-quiz'); const r=q.getBoundingClientRect();
      return {viewsOn:Array.from(document.querySelectorAll('.view')).filter(v=>v.classList.contains('on')).map(v=>v.id),
              scrollY:Math.round(scrollY), quizTop:Math.round(r.top), docH:document.body.scrollHeight};
    })()""")
    print("POST:", json.dumps(post, ensure_ascii=False))
    print("errors:", errs[:2])
    pg.screenshot(path=SH+"/cts_after.png")
    b.close()
