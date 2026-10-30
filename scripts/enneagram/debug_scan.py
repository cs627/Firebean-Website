
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":320,"height":568}, has_touch=True, is_mobile=True)
    pg=ctx.new_page()
    pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelector('#startBtn').scrollIntoView({block:'center'})"); pg.wait_for_timeout(400)
    print(json.dumps(pg.evaluate("""(()=>{
      const b=document.querySelector('#startBtn');
      const r=b.getBoundingClientRect();
      const rects=Array.from(b.getClientRects()).map(function(q){return [q.left,q.top,q.width,q.height].map(Math.round)});
      const row=b.parentElement;
      const kids=Array.from(row.children).map(function(e){const q=e.getBoundingClientRect();
        return e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,20):"")+" "+[q.left,q.top,q.width,q.height].map(Math.round).join(",")});
      const y=Math.round(r.top+r.height/2); const row_=[];
      for(let x=Math.round(r.left); x<=r.left+r.width; x+=8){
        const e=document.elementFromPoint(x,y);
        row_.push(x+":"+(e===b?"BTN":(e?e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,14):""):"null")));
      }
      return {btn:[r.left,r.top,r.width,r.height].map(Math.round), clientRects:rects, offset:[b.offsetLeft,b.offsetTop,b.offsetWidth,b.offsetHeight],
              rowKids:kids, scan:row_};
    })()"""), ensure_ascii=False, indent=1))
    b.close()
