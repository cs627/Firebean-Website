
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
base="https://firebean.net/enneagram/"
PROBE="""(()=>({team:document.body.classList.contains("team-access"),
  view:Array.from(document.querySelectorAll(".view.on")).map(function(v){return v.id}).join(),
  railvis:Array.from(document.querySelectorAll("#railnav button")).filter(function(e){return getComputedStyle(e).display!=="none"}).length,
  atlasBlocks:(document.querySelector("#v-atlas")||{}).innerText? (document.querySelector("#v-atlas").innerText.length>200):false}))()"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    # 正確次序：query 一定要放喺 hash 之前
    for label,url in (("直接開 #atlas", base+"?cb=%d#atlas"%int(time.time())),
                      ("直接開 #data", base+"?cb=%d#data"%int(time.time())),
                      ("直接開 #proposal", base+"?cb=%d#proposal"%int(time.time())),
                      ("#atlas 再 reload（無 query）", base+"#atlas")):
        ctx=b.new_context(viewport={"width":1440,"height":900}); pg=ctx.new_page()
        pg.goto(url, wait_until="load"); pg.wait_for_timeout(1600)
        print(label,"->",json.dumps(pg.evaluate(PROBE), ensure_ascii=False)); ctx.close()
    b.close()
