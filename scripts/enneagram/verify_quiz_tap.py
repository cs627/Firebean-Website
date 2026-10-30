
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page(); pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    pg.locator("#startBtn").click(); pg.wait_for_timeout(600)
    print("quiz ids:", json.dumps(pg.evaluate("""(()=>{
      const v=document.querySelector('#v-quiz');
      const ids=Array.from(v.querySelectorAll('[id]')).map(function(e){return e.tagName+'#'+e.id+(e.className?'.'+String(e.className).slice(0,18):'')});
      const first=Array.from(v.querySelectorAll('.opt')).slice(0,3).map(function(e){return {tag:e.tagName, cls:String(e.className).slice(0,30), txt:e.textContent.trim().slice(0,24)};});
      return {ids:ids.slice(0,14), optsClass:first};
    })()"""), ensure_ascii=False))
    # real taps: option then next, x3
    for i in range(3):
        before=pg.evaluate("(()=>{const e=document.querySelector('#qCount');return e?e.textContent:'n/a'})()")
        box=pg.evaluate("""(()=>{const o=document.querySelector('#v-quiz .opt'); if(!o) return null; o.scrollIntoView({block:'center'}); const r=o.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}})()""")
        if box: pg.touchscreen.tap(box["x"], box["y"])
        pg.wait_for_timeout(350)
        nb=pg.evaluate("""(()=>{const n=document.querySelector('#nextBtn')||document.querySelector('#v-quiz .next'); if(!n) return null; n.scrollIntoView({block:'center'}); const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,id:n.id}})()""")
        if nb: pg.touchscreen.tap(nb["x"], nb["y"])
        pg.wait_for_timeout(450)
        after=pg.evaluate("(()=>{const e=document.querySelector('#qCount');return e?e.textContent:'n/a'})()")
        print("step", i+1, "nextBtn=", (nb or {}).get("id"), "|", before, "->", after)
    b.close()
