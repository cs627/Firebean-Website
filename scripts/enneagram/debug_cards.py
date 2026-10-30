
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
      const cards=Array.from(document.querySelectorAll('.card.hero-intro'));
      return {count:cards.length, cards:cards.map(function(c,i){
        const r=c.getBoundingClientRect(); const s=getComputedStyle(c);
        return {i:i, inView:(c.closest('.view')||{}).id, rect:[r.left,r.top,r.width,r.height].map(Math.round),
                disp:s.display, vis:s.visibility, op:s.opacity, z:s.zIndex, filter:s.filter, transform:s.transform,
                pad:s.padding, boxShadow:s.boxShadow.slice(0,40), hasBtn:!!c.querySelector('#startBtn'),
                parentHTMLstart:(c.parentElement?c.parentElement.className||c.parentElement.tagName:"")};
      })};
    })()"""), ensure_ascii=False, indent=1))
    b.close()
