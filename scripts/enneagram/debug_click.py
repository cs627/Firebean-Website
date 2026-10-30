
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":1440,"height":1000}); pg=ctx.new_page()
    errs=[]; logs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: logs.append(m.type+": "+m.text[:200]))
    pg.goto("https://firebean.net/enneagram/?v=%d"%int(time.time()), wait_until="load")
    pg.wait_for_timeout(1500)
    info = pg.evaluate("""(()=>{
      const btn=document.querySelector('#startBtn');
      const r=btn?btn.getBoundingClientRect():null;
      const at= r? document.elementFromPoint(r.left+r.width/2, r.top+r.height/2) : null;
      return {btnExists:!!btn, rect:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,
              topElementAtCentre: at? (at.tagName+"."+at.className+" #"+(at.id||"")) : null,
              viewsOn: Array.from(document.querySelectorAll('.view')).filter(v=>v.classList.contains('on')).map(v=>v.id),
              hasSetView: typeof window.setView};
    })()""")
    print("BEFORE:", json.dumps(info, ensure_ascii=False))
    try:
        pg.click("#startBtn", timeout=4000)
    except Exception as e:
        print("click failed:", str(e)[:200])
        pg.evaluate("document.querySelector('#startBtn').click()")
    pg.wait_for_timeout(900)
    after = pg.evaluate("""(()=>({viewsOn:Array.from(document.querySelectorAll('.view')).filter(v=>v.classList.contains('on')).map(v=>v.id), qText:(document.querySelector('#qText')||{}).textContent}))()""")
    print("AFTER:", json.dumps(after, ensure_ascii=False))
    # try the real-intro path too: does a plain mouse click work?
    print("pageerrors:", errs[:3])
    print("console:", logs[-6:])
    pg.screenshot(path="/opt/data/cache/scratch/ennea_shots/click_debug.png")
    b.close()
