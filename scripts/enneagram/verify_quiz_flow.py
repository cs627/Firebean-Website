
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page(); pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    pg.locator("#startBtn").click(); pg.wait_for_timeout(600)
    for i in range(6):
        d=pg.evaluate("""(()=>{
          const v=document.querySelector('#v-quiz');
          const opts=Array.from(v.querySelectorAll('.opt'));
          const multi=v.querySelector('#qOpts')? v.querySelector('#qOpts').className : '';
          const btns=Array.from(v.querySelectorAll('button')).map(function(e){const r=e.getBoundingClientRect(); return e.id+(e.className?'.'+String(e.className).slice(0,16):'')+'['+[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)].join(',')+']'+(getComputedStyle(e).display==='none'?' HIDDEN':'')});
          return {q:(v.querySelector('#qCount')||{}).textContent, text:(v.querySelector('#qText')||{}).textContent.slice(0,34), optsCls:multi, n:opts.length, btns:btns};
        })()""")
        print(i, json.dumps(d, ensure_ascii=False))
        # tap first option, then look for any visible "next/confirm" button and tap it
        r=pg.evaluate("""(()=>{const o=document.querySelector('#v-quiz .opt'); if(!o) return null; o.scrollIntoView({block:'center'}); const q=o.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2}})()""")
        if r: pg.touchscreen.tap(r["x"], r["y"])
        pg.wait_for_timeout(400)
        nb=pg.evaluate("""(()=>{
          const v=document.querySelector('#v-quiz');
          const cand=Array.from(v.querySelectorAll('button')).filter(function(e){
            const s=getComputedStyle(e); return e.id!=='origToggle' && e.className.indexOf('opt')<0 && s.display!=='none' && e.offsetHeight>20;
          });
          if(!cand.length) return null; const n=cand[0]; n.scrollIntoView({block:'center'}); const q=n.getBoundingClientRect();
          return {id:n.id, cls:String(n.className), txt:n.textContent.trim().slice(0,18), x:q.left+q.width/2, y:q.top+q.height/2};
        })()""")
        if nb: pg.touchscreen.tap(nb["x"], nb["y"])
        pg.wait_for_timeout(450)
    b.close()
