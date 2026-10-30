
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w in (390, 360, 320):
        ctx=b.new_context(viewport={"width":w,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
        pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(800)
        print(w, json.dumps(pg.evaluate("""(()=>{
          const card=document.querySelector('#v-intro .card');
          const cs=getComputedStyle(card);
          const kids=Array.from(card.children).map(function(e,i){
            const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
            return {i:i, el:e.tagName+(e.className?"."+String(e.className).slice(0,22):""),
                    box:[Math.round(r.left),Math.round(r.width)].join("/"),
                    scrollW:e.scrollWidth, offsetW:e.offsetWidth, ws:s.whiteSpace, mini:s.minWidth, ovf:s.overflow, txt:(e.textContent||"").slice(0,0)};
          });
          // widest descendant by scrollWidth
          let worst=null;
          card.querySelectorAll("*").forEach(function(e){
            if(e.scrollWidth > card.clientWidth+2 && (!worst || e.scrollWidth>worst.sw)) worst={el:e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,26):""), sw:e.scrollWidth, ow:e.offsetWidth, txt:(e.textContent||"").trim().slice(0,60)};
          });
          return {card:{clientW:card.clientWidth, scrollW:card.scrollWidth, pad:cs.padding, ovf:cs.overflow}, kids:kids, worst:worst};
        })()"""), ensure_ascii=False, indent=1))
        ctx.close()
    b.close()
