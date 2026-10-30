
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
      const btn=document.querySelector('#startBtn'); btn.scrollIntoView({block:'center'});
      const r=btn.getBoundingClientRect();
      const st=document.elementsFromPoint(r.left+r.width*0.15, r.top+r.height/2);
      const all=document.querySelectorAll('.card.hero-intro');
      const cards=Array.from(all).map(function(c,i){
        const q=c.getBoundingClientRect(); const cs=getComputedStyle(c);
        return {i:i, sameAsTop: st[0]===c, containsBtn:c.contains(btn), rect:[q.left,q.top,q.width,q.height].map(Math.round),
                display:cs.display, visibility:cs.visibility, opacity:cs.opacity, z:cs.zIndex, transform:cs.transform, filter:cs.filter,
                offsetParent:(c.offsetParent?c.offsetParent.tagName+(c.offsetParent.id?"#"+c.offsetParent.id:""):"null"),
                parentChain:(function(){const a=[];let e=c; while(e&&a.length<6){a.push(e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,20):"")); e=e.parentElement} return a.join(" < ")})()};
      });
      return {count:all.length, topIsCard: st[0].className, topSameAsAncestor: st[0]===st[3], topContainsBtn: st[0].contains(btn),
              cards:cards,
              stackLens: st.length,
              uniqueTop:(function(){const seen=[]; st.forEach(function(e){if(seen.indexOf(e)<0)seen.push(e)}); return seen.length===st.length?"all unique":"DUPLICATES PRESENT"})()};
    })()"""), ensure_ascii=False, indent=1))
    b.close()
