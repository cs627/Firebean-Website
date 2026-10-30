
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":320,"height":568}, has_touch=True, is_mobile=True)
    pg=ctx.new_page()
    pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1000)
    print(json.dumps(pg.evaluate("""(()=>{
      const card=document.querySelector('#v-intro .card');
      const order=Array.from(card.children).map(function(e,i){
        const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
        return i+":"+e.tagName+(e.className?"."+String(e.className).slice(0,24):"")+" "+[r.top,r.height].map(Math.round).join("/")+" pos="+s.position;
      });
      return {children:order, cardOverflow:getComputedStyle(card).overflow, cardRadius:getComputedStyle(card).borderRadius,
              cardPad:getComputedStyle(card).padding, btnrowIndex:Array.from(card.children).indexOf(document.querySelector(".btnrow"))};
    })()"""), ensure_ascii=False, indent=1))
    b.close()
