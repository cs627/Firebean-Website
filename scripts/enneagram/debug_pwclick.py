
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for w,h in ((320,568),(390,844)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=True, is_mobile=True)
        pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1000)
        # 1) Playwright actionability click (names any intercepting element)
        try:
            pg.locator("#startBtn").click(timeout=6000)
            print(w, "PW click OK ->", pg.evaluate("Array.from(document.querySelectorAll('.view.on')).map(v=>v.id)"))
        except Exception as e:
            print(w, "PW click FAILED:", str(e).split("\n")[0], "|", [l.strip() for l in str(e).split("\n") if "intercepts" in l or "from <" in l][:2])
        # 2) scan fixed/absolute overlays near the CTA
        pg.evaluate("window.__ennView && window.__ennView('intro')"); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('#startBtn').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
        ov=pg.evaluate("""(()=>{
          const b=document.querySelector('#startBtn').getBoundingClientRect();
          const out=[];
          document.querySelectorAll('*').forEach(function(e){
            const s=getComputedStyle(e); if(s.position!=="fixed"&&s.position!=="absolute") return;
            if(s.display==="none"||s.visibility==="hidden"||s.pointerEvents==="none"||e.offsetParent===null&&s.position!=="fixed") return;
            const q=e.getBoundingClientRect(); if(q.width<4||q.height<4) return;
            const hit=!(q.right<b.left||q.left>b.right||q.bottom<b.top||q.top>b.bottom);
            if(hit) out.push(e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,24):"")+" ["+[q.left,q.top,q.width,q.height].map(Math.round).join(",")+"] z="+s.zIndex);
          });
          return {btn:[b.left,b.top,b.width,b.height].map(Math.round), overlays:out};
        })()""")
        print(w, "overlays overlapping CTA:", json.dumps(ov, ensure_ascii=False))
        ctx.close()
    b.close()
