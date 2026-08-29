/**
 * roving.js — Dynamic roving exhibitions page
 * Filters cmsData, auto-counts stats, renders cards + methodology.
 * Scroll animations: matchstick parallax left, cards slide-in from right.
 */
(function() {
  "use strict";
  console.log("[roving] init");

  var STEPS = [
    {n:"1", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'},
    {n:"2", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>'},
    {n:"3", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>'},
    {n:"4", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'}
  ];

  function isRoving(p){
    // Match by name: contains 巡迴 or roving
    var n=p.projectName||"";
    if(n.indexOf("\u5de1\u8ff4")>=0||n.toLowerCase().indexOf("roving")>=0) return true;
    // Match by categories (exhibitions) + description mentions roving/巡迴
    var cats=p.categories||[];
    if(typeof cats==="string") cats=cats.split(",");
    if(cats.indexOf("exhibitions")<0) return false;
    // Check if description (webEN/webTC) mentions roving
    var desc=(p.webEN||"")+" "+(p.webTC||"");
    return desc.indexOf("\u5de1\u8ff4")>=0||desc.toLowerCase().indexOf("roving")>=0;
  }

  function buildCards(projects){
    var o="";
    for(var i=0;i<projects.length;i++){
      var p=projects[i];
      o+='<a href="../profile.html?id='+p.projectId+'" class="project-card block group overflow-hidden hover:opacity-80 transition-opacity">';
      o+='<div class="aspect-[4/3] overflow-hidden bg-gray-100"><img src="'+(p.heroPhoto||'')+'" alt="'+(p.projectName||'')+'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" referrerpolicy="no-referrer"></div>';
      o+='<div class="px-1 pt-3"><div class="font-oswald text-[11px] sm:text-base md:text-lg uppercase font-bold project-card-title transition-colors leading-tight line-clamp-2">'+(p.projectName||'')+'</div><div class="font-sans text-[10px] sm:text-xs text-gray-400 mt-0.5">'+(p.client||'')+'</div></div></a>';
    }
    return o;
  }

  function buildStepCards(){
    var fallbacks=[
      {title:"Design",body:"Policy meets lifestyle creative. We translate government briefs into exhibition concepts the public actually wants to engage with \u2014 blending strategic messaging with the visual language of Hong Kong's best consumer brands."},
      {title:"Build &amp; Brand",body:"Modular doesn't mean mediocre. Our exhibition builds combine transport-ready engineering with premium lifestyle aesthetics \u2014 designed to survive 20+ venue rotations without losing visual impact."},
      {title:"Tour &amp; Operate",body:"Hong Kong-wide coverage, zero excuses. From Cheung Chau to Tuen Mun, our logistics team handles transport, installation, staffing, and daily ops. 99.8% on-time setup across 18+ venue tours."},
      {title:"Engage &amp; Measure",body:"Engagement isn't a buzzword \u2014 it's a deliverable. We design interactive experiences that generate real participation data, then report it in formats government stakeholders find useful. Numbers, not adjectives."}
    ];
    var o="";
    for(var i=0;i<STEPS.length;i++){
      var s=STEPS[i];
      var fb=fallbacks[i]||{title:"Step 0"+s.n,body:""};
      o+='<div class="rv-step group border-l-4 border-brand-red pl-5 py-2 hover:bg-white hover:shadow-md transition-all">';
      o+='<div class="flex items-center gap-3 mb-2">';
      o+='<svg class="w-7 h-7 text-brand-red flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">'+s.icon+'</svg>';
      o+='<div><div class="font-spartan text-xl font-black text-brand-red leading-none">0'+s.n+'</div>';
      o+='<h3 class="font-oswald text-base md:text-lg font-bold uppercase text-brand-black leading-tight" data-key="Roving.Methodology.Step'+s.n+'Title">'+fb.title+'</h3></div></div>';
      o+='<p class="font-sans text-[13px] md:text-sm text-gray-500 leading-relaxed" data-key="Roving.Methodology.Step'+s.n+'Body">'+fb.body+'</p></div>';
    }
    return o;
  }

  function renderPage(){
    console.log("[roving] renderPage");
    var d=window.cmsData; if(!d||!d.projects||!d.projects.length){ console.log("[roving] no data"); return; }
    var roving=d.projects.filter(isRoving);
    roving.sort(function(a,b){return (b.sortDate||"").localeCompare(a.sortDate||"");});
    var cnt=roving.length; console.log("[roving]",cnt,"projects"); if(!cnt) return;

    var bureaus={},yrs={};
    for(var i=0;i<roving.length;i++){
      var c=(roving[i].client||"").trim();
      var cat=(roving[i].category||"").toLowerCase();
      // Normalize: remove trailing spaces, unify same bureau variations
      var bureauKey=c.replace(/\s+/g," ").replace(", Curriculum Development Institute, Education Bureau","");
            // Merge sub-departments into parent bureau
            if(bureauKey.indexOf("Curriculum Resources Section")>=0) bureauKey="Education Bureau";
            if(bureauKey.indexOf("\u653f\u5236\u5185\u5730")>=0||bureauKey.indexOf("\u653f\u5236\u5167\u5730")>=0) bureauKey="Constitutional and Mainland Affairs Bureau";
            if(bureauKey.indexOf("Narcotics Division")>=0) bureauKey="Security Bureau";
            // Only count true government/public sector — skip NGOs
      var isGov=(cat.indexOf("government")>=0||cat.indexOf("public")>=0) &&
                 (c.indexOf("\u5c40")>=0||c.indexOf("\u7f72")>=0||c.indexOf("Department")>=0||c.indexOf("Bureau")>=0);
      if(isGov) bureaus[bureauKey]=(bureaus[bureauKey]||0)+1;
      var sd=roving[i].sortDate; if(sd&&sd.length>=4) yrs[sd.substring(0,4)]=1;
    }
    var burCnt=Object.keys(bureaus).length, yrList=Object.keys(yrs).sort();

    var h="";
    h+='<header class="mb-12 text-center">';
    h+='<p class="font-playfair italic text-lg md:text-xl tracking-wide text-gray-400 mb-4" data-key="Roving.Hero.Tagline">Roving Exhibitions</p>';
    h+='<h1 class="font-display text-4xl md:text-7xl lg:text-8xl tracking-normal uppercase leading-[1.15] md:leading-[1.1] mb-6 md:mb-8 py-2 max-w-5xl mx-auto">';
        h+='<span id="rv-hero-n1" class="text-brand-red">'+cnt+'</span><span data-key="Roving.Hero.Slogan1" id="rv-slogan1"> PROJECTS.</span> ';
        h+='<span id="rv-hero-n2" class="text-brand-red">'+burCnt+'</span><span data-key="Roving.Hero.Slogan2" id="rv-slogan2"> GOVERNMENT BUREAUS.</span> ';
        h+='<span id="rv-hero-n3" class="text-brand-red" data-key="Roving.Hero.Slogan3">1.5M+</span><span data-key="Roving.Hero.Slogan4" id="rv-slogan4"> PEOPLE ENGAGED.</span></h1>';
    h+='<p class="font-playfair italic text-base md:text-xl font-medium text-brand-black max-w-2xl mx-auto" data-key="Roving.Hero.Subtitle2">Hong Kong\'s Most Experienced Roving Exhibition Agency</p></header>';

    // Methodology with scroll animations
    h+='<section class="mb-32" id="rv-method">';
    h+='<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">';
    h+='<div class="lg:col-span-4 flex flex-col items-center">';
    h+='<p class="rv-subtitle font-playfair italic text-sm md:text-base text-gray-400 text-right w-full mb-24" data-key="Roving.Methodology.Subtitle">From policy to public &mdash; four steps to a memorable roving exhibition.</p>';
    h+='<div class="rv-match-wrap relative py-24">';
    h+='<img src="../data/images/match.webp" alt="" class="rv-match rv-match-1" style="width:100%;height:auto;position:relative;z-index:1">';
    h+='<img src="../data/images/match.webp" alt="" class="rv-match rv-match-2" style="width:100%;height:auto;position:absolute;top:50%;left:50%;z-index:2">';
    h+='</div></div>';
    h+='<div class="lg:col-span-8"><div class="grid grid-cols-1 sm:grid-cols-2 gap-5">'+buildStepCards()+'</div></div></div></section>';

    h+='<h2 class="font-display text-3xl md:text-5xl lg:text-6xl tracking-normal uppercase text-brand-black text-center mb-8" style="letter-spacing:0.02em;word-spacing:0.08em;line-height:1.2">';
        h+='<span class="text-brand-red" id="rv-count-disp">'+cnt+'</span> ';
        h+='<span data-key="Roving.Projects.SectionTitle">Roving Exhibitions</span> ';
        h+='<span class="text-gray-400">·</span> ';
        h+='<span id="rv-year-disp" data-key="Roving.Projects.YearRange">'+yrList[0]+'\u2014'+yrList[yrList.length-1]+'</span></h2>';
    h+='<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">'+buildCards(roving)+'</div>';

    var el=document.getElementById("roving-main");
    if(!el){ console.log("[roving] #roving-main missing"); return; }
    el.innerHTML=h;
    console.log("[roving] rendered");

    if(window.updateTranslations) window.updateTranslations();
    restoreHeroNumbers(cnt, burCnt);
    toggleSloganBold();
    setupScrollAnimations();
  }

  function setupScrollAnimations(){
    // Matchstick parallax — dual matchsticks sliding in from opposite sides
    var matchWrap=document.getElementById("rv-method");
    var match1=document.querySelector(".rv-match-1");
    var match2=document.querySelector(".rv-match-2");
    if(!matchWrap||!match1) return;

    function onScroll(){
      var rect=matchWrap.getBoundingClientRect();
      var winH=window.innerHeight;
      if(rect.bottom<0||rect.top>winH) return;
      var progress=(winH-rect.top)/(winH+rect.height);
      progress=Math.max(0,Math.min(1,progress));
      // Two matchsticks — diagonal cross, kept clear below subtitle
            // Match 1 (base): starts bottom-left, slides diagonally up-right, ends well below subtitle
            var x1=-100+progress*100;   // -100px → 0
            var y1=280-progress*200;    // +280px → +80px (stays below subtitle zone)
            match1.style.transform="translate("+x1+"px, "+y1+"px) rotate(-15deg)";
            // Match 2 (overlay): starts off-screen right, slides diagonally left-down, ends below subtitle
            if(match2){
              var p2=1-Math.pow(1-progress,3);
              var x2=400-p2*380;        // +400px (off-screen right) → +20px
              var y2=-150+p2*200;       // -150px → +50px (stays below subtitle)
              match2.style.transform="translate(-50%,-50%) translate("+x2+"px, "+y2+"px) rotate(25deg)";
              match2.style.transition="none";
            }
    }
    window.addEventListener("scroll", onScroll, {passive:true});
    onScroll();

    // Step cards slide-up + fade-in
    var steps=document.querySelectorAll(".rv-step");
    if(!steps.length) return;
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add("rv-visible"); observer.unobserve(e.target); }
      });
    },{threshold:0.1, rootMargin:"0px 0px -40px 0px"});

    steps.forEach(function(s,i){
      s.style.opacity="0";
      s.style.transform="translateY(60px)";
      s.style.transition="opacity 0.7s ease-out, transform 0.7s ease-out";
      s.style.transitionDelay=(0.25+i*0.15)+"s"; // 0.25s, 0.4s, 0.55s, 0.7s
      observer.observe(s);
    });
  }

  // Re-inject dynamic count/bureau numbers after translations overwrite them
  function restoreHeroNumbers(cnt, burCnt){
    setTimeout(function(){
      var n1=document.getElementById("rv-hero-n1");
      var n2=document.getElementById("rv-hero-n2");
      if(n1) n1.textContent=cnt;
      if(n2) n2.textContent=burCnt;
    }, 50);
  }

  // Bold slogan text for CJK (CH/JP), normal for EN
  function toggleSloganBold(){
    var lang=(window.getLang||function(){return "en";})();
    var bold=lang==="ch"||lang==="jp";
    ["rv-slogan1","rv-slogan2","rv-slogan4"].forEach(function(id){
      var el=document.getElementById(id);
      if(!el) return;
      if(bold) el.classList.add("font-bold");
      else el.classList.remove("font-bold");
    });
  }

  // Listen for language change to restore numbers + toggle bold
  window.addEventListener("languageChange", function(){
    var el=document.getElementById("rv-hero-n1");
    if(!el) return;
    var cnt=el.textContent;
    restoreHeroNumbers(
      parseInt(document.getElementById("rv-hero-n1")?.textContent) || 11,
      parseInt(document.getElementById("rv-hero-n2")?.textContent) || 6
    );
    toggleSloganBold();
  });

  // Start
  function tryRender(){
    var d=window.cmsData;
    if(d&&d.projects&&d.projects.length){ renderPage(); return true; }
    return false;
  }

  if(!tryRender()){
    var tries=0;
    var iv=setInterval(function(){
      if(tryRender()){ clearInterval(iv); return; }
      if(++tries>50) clearInterval(iv);
    },100);
    window.addEventListener("cmsDataReady", function(e){ if(e.detail&&e.detail.projects) renderPage(); });
  }

})();