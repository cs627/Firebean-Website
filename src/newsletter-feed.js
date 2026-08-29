/**
 * newsletter-feed.js — Populates "The Dispatch" newsletter cards
 * with latest EDM case study content from data/edm-feed.json.
 * Links open in new tab since EDM pages have different branding.
 * Runs after CMS inline code to overwrite with EDM content.
 */
(function() {
  'use strict';

  var BASE = (document.querySelector('base[href]') ? document.querySelector('base[href]').getAttribute('href') : '/');
  var FEED_URL = BASE + 'data/edm-feed.json';

  function populateCards(feed) {
    for (var i = 0; i < Math.min(feed.length, 3); i++) {
      var n = i + 1;
      var entry = feed[i];
      
      var img = document.getElementById('newsletter-img-' + n);
      var title = document.getElementById('newsletter-title-' + n);
      var desc = document.getElementById('newsletter-desc-' + n);
      var link = document.getElementById('newsletter-link-' + n);
      
      if (img && entry.photo) {
        img.src = entry.photo;
        img.alt = entry.title;
      }
      if (title && entry.title) title.textContent = entry.title;
      if (desc && entry.desc) {
        var text = entry.desc;
        if (text.length > 200) text = text.substring(0, 200) + '\u2026';
        desc.textContent = text;
      }
      if (link && entry.url) {
        link.href = entry.url;
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
      }
    }
  }

  function loadFeed() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', FEED_URL, true);
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            var feed = JSON.parse(xhr.responseText);
            if (feed && feed.length) { populateCards(feed); return; }
          } catch(e) {}
        }
        useFallback();
      };
      xhr.onerror = useFallback;
      xhr.send();
    } catch(e) { useFallback(); }
  }

  function useFallback() {
    var fallback = [
      { title:"Revitalizing Reading in a Digital Age", desc:"Developing a roving reading exhibition that transformed public spaces across Hong Kong into immersive literary experiences.", photo:"data/images/contact-bg.webp", url:"https://firebean.net/edm/edm_EDM_003.html" },
      { title:"Modernizing OSH Guidelines", desc:"A high-tech interactive roadshow bringing occupational safety to life for Hong Kong's workforce, deployed across 18+ venues.", photo:"data/images/contact-bg.webp", url:"https://firebean.net/edm/edm_EDM_004.html" },
      { title:"Demystifying Building Safety", desc:"Data-driven social strategy that turned complex building regulations into accessible public knowledge.", photo:"data/images/contact-bg.webp", url:"https://firebean.net/edm/edm_EDM_005.html" }
    ];
    populateCards(fallback);
  }

  // Wait for CMS inline code to run first, then overwrite
  function init() {
    // Small delay to let CMS populate first, then we overwrite
    setTimeout(loadFeed, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // After CMS inline code runs, overwrite
      setTimeout(loadFeed, 800);
    });
  } else {
    init();
  }
})();