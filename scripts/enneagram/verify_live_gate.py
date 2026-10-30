
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
base="https://firebean.net/enneagram/"
PROBE="""(()=>{
  const vis=function(sel){return Array.from(document.querySelectorAll(sel)).filter(function(e){return getComputedStyle(e).display!=="none" && e.getBoundingClientRect().width>0})};
  return {team:document.body.classList.contains("team-access"),
          railitems:vis("#railnav button").map(function(e){return e.textContent.trim()}),
          hero:vis("#v-intro .btnrow .btn").map(function(e){return e.textContent.trim()}),
          mobtop:vis(".mobtop button").map(function(e){return e.textContent.trim()}),
          view:Array.from(document.querySelectorAll(".view.on")).map(function(v){return v.id}).join()};
})()"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for label,url,w,h in (("公眾 desktop",base,1440,900),("公眾 mobile",base,390,844),
                          ("內部 ?internal=1",base+"?internal=1",390,844),
                          ("直接 #atlas",base+"#atlas",1440,900),
                          ("直接 #data",base+"#data",1440,900)):
        u=url+("&cb=%d"%int(time.time()) if "?" in url else "?cb=%d"%int(time.time()))
        ctx=b.new_context(viewport={"width":w,"height":h}, has_touch=(w<900), is_mobile=(w<900))
        pg=ctx.new_page(); pg.goto(u, wait_until="load"); pg.wait_for_timeout(1300)
        print(label,"->",json.dumps(pg.evaluate(PROBE), ensure_ascii=False)); ctx.close()
    # 線上任選題：多選全部揀（Q3 7 項）+ 單選標示
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
    ctx.route("**/submit", lambda r: r.fulfill(status=200, content_type="application/json", body='{"ok":true}'))
    pg=ctx.new_page(); pg.goto(base+"?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(1200)
    print("公眾 hero 掣:", pg.evaluate("Array.from(document.querySelectorAll('#v-intro .btnrow .btn')).filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent.trim())"))
    pg.locator("#startBtn").click(); pg.wait_for_timeout(600)
    print("Q1 標示:", pg.evaluate("(document.querySelector('#qNote')||{}).textContent"))
    pg.evaluate("(()=>{const o=document.querySelector('#v-quiz .opt'); o.click()})()"); pg.wait_for_timeout(700)
    pg.evaluate("(()=>{const o=document.querySelector('#v-quiz .opt'); o.click()})()"); pg.wait_for_timeout(700)
    note=pg.evaluate("(document.querySelector('#qNote')||{}).textContent")
    n=pg.evaluate("document.querySelectorAll('#v-quiz .opt').length")
    for j in range(n):
        pg.evaluate("(j)=>{const o=document.querySelectorAll('#v-quiz .opt')[j]; o.click()}", j); pg.wait_for_timeout(110)
    print("多選題(%d 個選項) 標示: %s"%(n, pg.evaluate("(document.querySelector('#qNote')||{}).textContent")))
    print("next 掣可撳:", pg.evaluate("!document.querySelector('#btnNext').disabled"))
    b.close()
