
import sys, json, time
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for label,w,h in (("desktop",1440,1000),("mobile",390,844)):
        ctx=b.new_context(viewport={"width":w,"height":h}); pg=ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("https://firebean.net/enneagram/?v=%d"%int(time.time()), wait_until="load")
        pg.wait_for_timeout(1200)
        st=pg.evaluate("""(()=>({tiles:Array.from(document.querySelectorAll('.infostrip .info')).map(e=>e.innerText.replace(/\\n/g,' / ')),icons:document.querySelectorAll('.infostrip .ic svg').length,legacy:document.body.innerText.indexOf('測驗涵蓋七個面向'),head:document.querySelector('#v-intro h1').textContent,lead:document.querySelector('#v-intro .lead').textContent.trim(),btns:Array.from(document.querySelectorAll('#v-intro .btnrow .btn')).map(e=>e.textContent.trim()),ov:document.documentElement.scrollWidth-document.documentElement.clientWidth}))()""")
        print(label, json.dumps(st, ensure_ascii=False))
        print("   errors:", errs[:2])
        ctx.close()
    b.close()
