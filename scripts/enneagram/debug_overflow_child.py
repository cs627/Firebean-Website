
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page()
    pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    print(json.dumps(pg.evaluate("""(()=>{
      const card=document.querySelector('#v-intro .card');
      const cr=card.getBoundingClientRect();
      const out=[];
      card.querySelectorAll("*").forEach(function(e){
        const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
        const rightOver=Math.round(r.right-cr.right), leftOver=Math.round(cr.left-r.left);
        if(rightOver>4 || leftOver>4){
          out.push({el:e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,28):"")+
                    " right+="+rightOver+" left+="+leftOver+" rect="+[r.left,r.top,r.width,r.height].map(Math.round).join(",")+
                    " pos="+cs.position+" m="+cs.margin+" w="+cs.width+" transform="+cs.transform.slice(0,20)});
        }
      });
      // also: any element with a negative margin or absolute positioning inside the card
      const suspects=[];
      card.querySelectorAll("*").forEach(function(e){
        const cs=getComputedStyle(e);
        if(cs.position==="absolute"||cs.position==="fixed"||/-\d/.test(cs.marginLeft+cs.marginRight)||/-\d/.test(cs.margin))
          suspects.push(e.tagName+(e.className?"."+String(e.className).slice(0,24):"")+" pos="+cs.position+" m="+cs.margin);
      });
      return {cardRect:[cr.left,cr.top,cr.width].map(Math.round), overflowing:out, suspects:suspects};
    })()"""), ensure_ascii=False, indent=1))
    b.close()
