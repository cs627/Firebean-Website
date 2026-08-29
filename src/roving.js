/**
 * roving.js — Dynamic roving exhibitions page renderer
 * Filters cmsData for projects with 巡迴 or "roving" in name.
 * Auto-calculates stats. Renders cards + methodology steps.
 * Uses translations.js data-key attrs for 3-language support.
 */
(function(window, document) {
  "use strict";

  var STEPS = [
    {num:"01", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'},
    {num:"02", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>'},
    {num:"03", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>'},
    {num:"04", icon:'<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'}
  ];

  function isRoving(p) {
    var n = p.projectName || "";
    return n.indexOf("\u5de1\u8ff4") >= 0 || n.toLowerCase().indexOf("roving") >= 0;
  }

  function buildCards(projects) {
    var out = "";
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      out += '<a href="../profile.html?id=' + p.projectId + '" class="project-card block group overflow-hidden hover:opacity-80 transition-opacity">';
      out += '<div class="aspect-[4/3] overflow-hidden bg-gray-100">';
      out += '<img src="' + (p.heroPhoto || '') + '" alt="' + (p.projectName || '') + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" referrerpolicy="no-referrer">';
      out += '</div>';
      out += '<div class="px-1 pt-3">';
      out += '<div class="font-oswald text-[11px] sm:text-base md:text-lg uppercase font-bold project-card-title transition-colors leading-tight line-clamp-2">' + (p.projectName || '') + '</div>';
      out += '<div class="font-sans text-[10px] sm:text-xs text-gray-400 mt-0.5">' + (p.client || '') + '</div>';
      out += '</div></a>';
    }
    return out;
  }

  function buildStepCards() {
    var out = "";
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      out += '<div class="group border-l-4 border-brand-red pl-5 py-2 hover:bg-white hover:shadow-md transition-all">';
      out += '<div class="flex items-center gap-3 mb-2">';
      out += '<svg class="w-7 h-7 text-brand-red flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">' + s.icon + '</svg>';
      out += '<div>';
      out += '<div class="font-spartan text-xl font-black text-brand-red leading-none">' + s.num + '</div>';
      out += '<h3 class="font-oswald text-base md:text-lg font-bold uppercase text-brand-black leading-tight" data-key="Roving.Methodology.Step' + s.num + 'Title">Step ' + s.num + '</h3>';
      out += '</div></div>';
      out += '<p class="font-sans text-[13px] md:text-sm text-gray-500 leading-relaxed" data-key="Roving.Methodology.Step' + s.num + 'Body"></p>';
      out += '</div>';
    }
    return out;
  }

  function renderPage() {
    var data = window.cmsData;
    if (!data || !data.projects || !data.projects.length) return;

    var roving = data.projects.filter(isRoving);
    roving.sort(function(a, b) { return (b.sortDate || "").localeCompare(a.sortDate || ""); });

    var count = roving.length;
    if (count === 0) return;

    // Calculate stats
    var bureaus = {};
    var years = {};
    for (var i = 0; i < roving.length; i++) {
      var c = roving[i].client || "";
      var cat = (roving[i].category || "").toLowerCase();
      if (cat.indexOf("government") >= 0 || cat.indexOf("public") >= 0 ||
          c.indexOf("\u5c40") >= 0 || c.indexOf("\u7f72") >= 0 ||
          c.indexOf("Department") >= 0 || c.indexOf("Bureau") >= 0) {
        bureaus[c] = (bureaus[c] || 0) + 1;
      }
      var sd = roving[i].sortDate;
      if (sd && sd.length >= 4) years[sd.substring(0, 4)] = 1;
    }
    var burCount = Object.keys(bureaus).length;
    var yrList = Object.keys(years).sort();

    // Build HTML
    var html = "";
    html += '<header class="mb-12 text-center">';
    html += '<p class="font-playfair italic text-lg md:text-xl tracking-wide text-gray-400 mb-4" data-key="Roving.Hero.Tagline">Roving Exhibitions</p>';
    html += '<h1 class="font-display text-4xl md:text-7xl lg:text-8xl tracking-normal uppercase leading-[1.15] md:leading-[1.1] mb-6 md:mb-8 py-2 max-w-5xl mx-auto">';
    html += '<span class="text-brand-red">' + count + '</span> PROJECTS. ';
    html += '<span class="text-brand-red">' + burCount + '</span> GOVERNMENT BUREAUS. ';
    html += '<span class="text-brand-red">1.5M+</span> PEOPLE ENGAGED.';
    html += '</h1>';
    html += '<p class="font-playfair italic text-base md:text-xl font-medium text-brand-black max-w-2xl mx-auto" data-key="Roving.Hero.Subtitle2">Hong Kong\'s Most Experienced Roving Exhibition Agency</p>';
    html += '</header>';

    // Methodology section
    html += '<section class="mb-24">';
    html += '<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">';
    html += '<div class="lg:col-span-4 flex flex-col items-center justify-center text-center">';
    html += '<div style="max-width:280px;margin:0 auto"><img src="../data/images/match.webp" alt="" style="width:100%;height:auto;transform:rotate(-15deg)"></div>';
    html += '<p class="font-playfair italic text-sm md:text-base text-gray-400 mt-6" data-key="Roving.Methodology.Subtitle">From policy to public &mdash; four steps to a memorable roving exhibition.</p>';
    html += '</div>';
    html += '<div class="lg:col-span-8"><div class="grid grid-cols-1 sm:grid-cols-2 gap-5">' + buildStepCards() + '</div></div>';
    html += '</div>';
    html += '</section>';

    // Projects section
    html += '<h2 class="font-display text-3xl md:text-5xl lg:text-6xl tracking-tighter uppercase text-brand-black text-center mb-8">' + count + ' Roving Exhibitions \u00b7 ' + yrList[0] + '\u2014' + yrList[yrList.length - 1] + '</h2>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">' + buildCards(roving) + '</div>';

    document.getElementById("roving-main").innerHTML = html;

    // Re-trigger translations
    if (window.updateTranslations) window.updateTranslations();
  }

  // Wait for CMS data
  if (window.cmsData && window.cmsData.projects && window.cmsData.projects.length) {
    renderPage();
  } else {
    window.addEventListener("cmsDataReady", function(e) {
      if (e.detail && e.detail.projects) renderPage();
    });
  }

})(window, document);