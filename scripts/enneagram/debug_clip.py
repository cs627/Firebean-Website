
import sys, time, json
sys.path.insert(0, "/opt/data/github/Firebean-Website/scripts/enneagram")
from e2e_real import exe
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe(), args=["--no-sandbox","--disable-dev-shm-usage"])
    ctx=b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg=ctx.new_page()
    pg.goto("https://firebean.net/enneagram/?cb=%d"%int(time.time()), wait_until="load"); pg.wait_for_timeout(900)
    print(json.dumps(pg.evaluate("""(()=>{
      const btn=document.querySelector('#startBtn'); btn.scrollIntoView({block:'center'});
      const card=document.querySelector('#v-intro .card');
      const who=function(f){const r=btn.getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width*f, r.top+r.height/2);
        return (e===btn)?"BTN":(e? e.tagName+(e.id?"#"+e.id:"")+(e.className?"."+String(e.className).slice(0,16):""):"null")};
      const log=[];
      const before={left:who(0.15), mid:who(0.5)};
      log.push("baseline "+JSON.stringify(before));
      const try_=function(label, fn){ fn(); log.push(label+" -> left15%="+who(0.15)+" mid="+who(0.5)); };
      const set=(el,k,v)=>{el.style[k]=v};
      // A) overflow on the card
      try_("card overflow:visible", function(){ set(card,'overflow','visible') }); set(card,'overflow','hidden');
      // B) border radius
      try_("card radius 0", function(){ set(card,'borderRadius','0px') }); set(card,'borderRadius','');
      // C) contain
      try_("card contain:none", function(){ set(card,'contain','none') }); set(card,'contain','');
      // D) the card's measured clip vs content
      const metrics={scrollH:card.scrollHeight, clientH:card.clientHeight, offsetH:card.offsetHeight,
                     scrollW:card.scrollWidth, clientW:card.clientWidth,
                     btnOffsetTop:btn.offsetTop, btnOffsetLeft:btn.offsetLeft,
                     innerH:innerHeight};
      // E) try removing the mascot image (its height may push content)
      const img=card.querySelector('.hero-mascot');
      try_("mascot display:none", function(){ set(img,'display','none') }); set(img,'display','');
      // F) try setting the btnrow z-index high
      const row=btn.parentElement;
      try_("btnrow z-index:9 position:relative", function(){ set(row,'zIndex','9'); set(row,'position','relative') }); set(row,'zIndex',''); set(row,'position','');
      // G) aria/role off
      try_("remove role attr", function(){ btn.removeAttribute('role') });
      return {log:log, metrics:metrics, afterG:{left:who(0.15), mid:who(0.5)}};
    })()"""), ensure_ascii=False, indent=1))
    b.close()
