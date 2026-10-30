
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page()
    pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    out=pg.evaluate("""(()=>{
      const btn=document.querySelector('#startBtn'); btn.scrollIntoView({block:'center'});
      const card=document.querySelector('#v-intro .card');
      const pt=function(){const r=btn.getBoundingClientRect(); return [r.left+r.width*0.15, r.top+r.height/2]};
      const who=function(){const p=pt(); const e=document.elementFromPoint(p[0],p[1]);
        return (e===btn)?"BTN":(e? e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,22):"") + " < " + (e.parentElement? e.parentElement.tagName+"."+String(e.parentElement.className).slice(0,18):""):"null")};
      const log=[];
      log.push("baseline left15%: "+who());
      // 1) card off
      card.style.pointerEvents="none";            log.push("card pe:none -> "+who());
      card.style.pointerEvents="";
      // 2) each child of card off, one at a time
      Array.from(card.children).forEach(function(ch,i){
        const old=ch.style.pointerEvents; ch.style.pointerEvents="none";
        log.push("card child #"+i+" ("+ch.tagName+"."+String(ch.className).slice(0,16)+") pe:none -> "+who());
        ch.style.pointerEvents=old;
      });
      // 3) button itself: drop clip/touch-action/overflow test
      const s=btn.style;
      s.clipPath="none";       log.push("btn clip-path:none -> "+who()); s.clipPath="";
      s.touchAction="auto";    log.push("btn touch-action:auto -> "+who()); s.touchAction="";
      // 4) wrap/main off
      document.querySelector("#mainv").style.pointerEvents="none"; log.push("main pe:none -> "+who()); document.querySelector("#mainv").style.pointerEvents="";
      // 5) full stack at that point
      const p=pt(); const stack=document.elementsFromPoint(p[0],p[1]).map(function(e,i){
        const q=e.getBoundingClientRect(); const cs=getComputedStyle(e);
        return i+":"+e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,20):"")+" ["+[q.left,q.top,q.width,q.height].map(Math.round).join(",")+"] pos="+cs.position+" clip="+cs.clipPath.slice(0,18)+" pe="+cs.pointerEvents;
      });
      return {log:log, stack:stack, btnRect:(function(){const r=btn.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round)})(),
              btnCS:(function(){const cs=getComputedStyle(btn); return {clip:cs.clipPath, mask:cs.webkitMaskImage, pe:cs.pointerEvents, disp:cs.display, ov:cs.overflow, z:cs.zIndex, pos:cs.position}})()};
    })()""")
    print(json.dumps(out, ensure_ascii=False, indent=1))
    b.close()
