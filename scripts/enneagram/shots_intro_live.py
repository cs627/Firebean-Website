
import sys, time
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
S="/opt/data/cache/scratch/ennea_shots"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    for tag,w,h in (("live_desktop",1440,1040),("live_mobile",390,844)):
        ctx=b.new_context(viewport={"width":w,"height":h}); pg=ctx.new_page()
        pg.goto("https://firebean.net/enneagram/?v=%d"%int(time.time()), wait_until="load")
        pg.wait_for_timeout(1300)
        pg.locator("#v-intro .card").screenshot(path=S+"/intro_%s.png"%tag)
        print("shot", tag)
        ctx.close()
    b.close()
