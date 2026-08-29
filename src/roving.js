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

  function isRoving(p){ var n=p.projectName||""; return n.indexOf("\u5de1\u8ff4")>=0||n.toLowerCase().indexOf("roving")>=0; }

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
    var o="";
    for(var i=0;i<STEPS.length;i++){
      var s=STEPS[i];
      o+='<div class="rv-step group border-l-4 border-brand-red pl-5 py-2 hover:bg-white hover:shadow-md transition-all">';
      o+='<div class="flex items-center gap-3 mb-2">';
      o+='<svg class="w-7 h-7 text-brand-red flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">'+s.icon+'</svg>';
      o+='<div><div class="font-spartan text-xl font-black text-brand-red leading-none">0'+s.n+'</div>';
      o+='<h3 class="font-oswald text-base md:text-lg font-bold uppercase text-brand-black leading-tight" data-key="Roving.Methodology.Step'+s.n+'Title">Step 0'+s.n+'</h3></div></div>';
      o+='<p class="font-sans text-[13px] md:text-sm text-gray-500 leading-relaxed" data-key="Roving.Methodology.Step'+s.n+'Body"></p></div>';
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
      var c=roving[i].client||"", cat=(roving[i].category||"").toLowerCase();
      if(cat.indexOf("government")>=0||cat.indexOf("public")>=0||c.indexOf("\u5c40")>=0||c.indexOf("\u7f72")>=0||c.indexOf("Department")>=0||c.indexOf("Bureau")>=0) bureaus[c]=(bureaus[c]||0)+1;
      var sd=roving[i].sortDate; if(sd&&sd.length>=4) yrs[sd.substring(0,4)]=1;
    }
    var burCnt=Object.keys(bureaus).length, yrList=Object.keys(yrs).sort();

    var h="";
    h+='<header class="mb-12 text-center">';
    h+='<p class="font-playfair italic text-lg md:text-xl tracking-wide text-gray-400 mb-4" data-key="Roving.Hero.Tagline">Roving Exhibitions</p>';
    h+='<h1 class="font-display text-4xl md:text-7xl lg:text-8xl tracking-normal uppercase leading-[1.15] md:leading-[1.1] mb-6 md:mb-8 py-2 max-w-5xl mx-auto">';
    h+='<span class="text-brand-red">'+cnt+'</span> PROJECTS. <span class="text-brand-red">'+burCnt+'</span> GOVERNMENT BUREAUS. <span class="text-brand-red">1.5M+</span> PEOPLE ENGAGED.</h1>';
    h+='<p class="font-playfair italic text-base md:text-xl font-medium text-brand-black max-w-2xl mx-auto" data-key="Roving.Hero.Subtitle2">Hong Kong\'s Most Experienced Roving Exhibition Agency</p></header>';

    // Methodology with scroll animations
    h+='<section class="mb-24" id="rv-method">';
    h+='<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">';
    h+='<div class="lg:col-span-4 flex flex-col items-center">';
    h+='<div class="rv-match-wrap"><img src="../data/images/match.webp" alt="" class="rv-match" style="width:100%;height:auto"></div>';
    h+='<p class="rv-subtitle font-playfair italic text-sm md:text-base text-gray-400 mt-6 text-right w-full" data-key="Roving.Methodology.Subtitle">From policy to public &mdash; four steps to a memorable roving exhibition.</p></div>';
    h+='<div class="lg:col-span-8"><div class="grid grid-cols-1 sm:grid-cols-2 gap-5">'+buildStepCards()+'</div></div></div></section>';

    h+='<h2 class="font-display text-3xl md:text-5xl lg:text-6xl tracking-tighter uppercase text-brand-black text-center mb-8">'+cnt+' Roving Exhibitions \u00b7 '+yrList[0]+'\u2014'+yrList[yrList.length-1]+'</h2>';
    h+='<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">'+buildCards(roving)+'</div>';

    var el=document.getElementById("roving-main");
    if(!el){ console.log("[roving] #roving-main missing"); return; }
    el.innerHTML=h;
    console.log("[roving] rendered");

    if(window.updateTranslations) window.updateTranslations();
    setupScrollAnimations();
  }

  function setupScrollAnimations(){
    // Matchstick parallax
    var matchWrap=document.getElementById("rv-method");
    var matchImg=document.querySelector(".rv-match");
    var subtitle=document.querySelector(".rv-subtitle");
    if(!matchWrap||!matchImg) return;

    function onScroll(){
      var rect=matchWrap.getBoundingClientRect();
      var winH=window.innerHeight;
      if(rect.bottom<0||rect.top>winH) return; // off screen
      var progress=1-(rect.top/winH); // 0=not visible, 1=scrolled past
      progress=Math.max(0,Math.min(1,progress*1.3)); // amplify slightly
      var offset=-60+progress*60; // moves from -60px to 0px
      matchImg.style.transform="translateX("+offset+"px) rotate(-15deg)";
      matchImg.style.opacity=0.3+progress*0.7;
    }
    window.addEventListener("scroll", onScroll, {passive:true});
    onScroll();

    // Step cards slide-in from right
    var steps=document.querySelectorAll(".rv-step");
    if(!steps.length) return;
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add("rv-visible"); observer.unobserve(e.target); }
      });
    },{threshold:0.15});

    steps.forEach(function(s,i){
      s.style.opacity="0";
      s.style.transform="translateX(80px)";
      s.style.transition="opacity 0.6s ease, transform 0.6s ease";
      s.style.transitionDelay=(i*0.1)+"s";
      observer.observe(s);
    });
  }

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