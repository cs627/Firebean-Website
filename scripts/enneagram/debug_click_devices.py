
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
SH="/opt/data/cache/scratch/ennea_shots"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for tag,w,h,touch,ua in (
        ("mobile",390,844,True,"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
        ("ipad",834,1112,True,"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
        ("desktop",1440,1000,False,None)):
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=touch, is_mobile=touch, user_agent=ua)
        pg=ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("https://firebean.net/enneagram/?v=%d"%int(time.time()), wait_until="load")
        pg.wait_for_timeout(1200)
        st=pg.evaluate("""(()=>{
           const btn=document.querySelector('#startBtn');
           btn.scrollIntoView({block:'center'});
           const r=btn.getBoundingClientRect();
           const cx=r.left+r.width/2, cy=r.top+r.height/2;
           const at=document.elementFromPoint(cx,cy);
           const path=[]; let e=at; while(e && path.length<4){path.push(e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).slice(0,30):'')); e=e.parentElement}
           return {rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
                   viewport:{w:innerWidth,h:innerHeight},
                   hitTarget:path,
                   isBtn: at===btn || (btn.contains(at)),
                   scrollY:Math.round(scrollY)};
        })()""")
        print(tag, json.dumps(st, ensure_ascii=False))
        pg.screenshot(path=SH+"/click_%s_before.png"%tag)
        # real tap/click at coordinates
        if touch:
            pg.touchscreen.tap(st["rect"]["x"]+st["rect"]["w"]/2, st["rect"]["y"]+st["rect"]["h"]/2)
        else:
            pg.mouse.click(st["rect"]["x"]+st["rect"]["w"]/2, st["rect"]["y"]+st["rect"]["h"]/2)
        pg.wait_for_timeout(900)
        after=pg.evaluate("""(()=>({viewsOn:Array.from(document.querySelectorAll('.view')).filter(v=>v.classList.contains('on')).map(v=>v.id)}))()""")
        print("   after tap:", after, "errors:", errs[:2])
        ctx.close()
    b.close()
