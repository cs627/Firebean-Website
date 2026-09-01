/**
 * newsletter-feed.js — Populates "The Dispatch" newsletter cards
 * with latest EDM market insight content from data/edm-feed.json.
 * Links open in new tab since EDM pages have different branding.
 * Runs after CMS inline code to overwrite with EDM content.
 */
(function() {
  'use strict';

  var BASE = (document.querySelector('base[href]') ? document.querySelector('base[href]').getAttribute('href') : '/');
  var FEED_URL = BASE + 'data/edm-feed.json';

  function truncate(text, maxChars) {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '…';
  }

  function populateCards(feed) {
    for (var i = 0; i < Math.min(feed.length, 3); i++) {
      var n = i + 1;
      var entry = feed[i];
      
      var img = document.getElementById('newsletter-img-' + n);
      var badge = document.getElementById('newsletter-badge-' + n);
      var dateEl = document.getElementById('newsletter-date-' + n);
      var title = document.getElementById('newsletter-title-' + n);
      var desc = document.getElementById('newsletter-desc-' + n);
      var link = document.getElementById('newsletter-link-' + n);
      
      if (img && entry.photo) {
        img.src = entry.photo;
        img.alt = entry.title || 'Report';
      }
      if (badge && entry.issue) {
        badge.textContent = entry.issue;
      }
      if (dateEl && entry.date) {
        dateEl.textContent = entry.date;
      }
      if (title && entry.title) {
        title.textContent = entry.title;
      }
      if (desc && entry.desc) {
        desc.textContent = truncate(entry.desc, 50);
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
      { issue:"EDM_006", date:"August 18, 2026", title:"Fortifying Public Trust: Data Privacy & Security in Gov Engagements", desc:"In an era where data breaches make headlines weekly, Hong Kong government departments face unprecedented scrutiny over how they handle citizen data at public events and exhibitions.", photo:"https://raw.githubusercontent.com/cs627/Firebean-Website/main/assets/edm/EDM_006/insight.jpg", url:"https://firebean.net/edm/edm_EDM_006.html" },
      { issue:"EDM_007", date:"August 25, 2026", title:"Inclusive Hong Kong: Universal Design & Experiential Accessibility", desc:"Hong Kong's public spaces are undergoing a quiet transformation — one that's not about grand architectural gestures but about making every citizen feel seen.", photo:"https://raw.githubusercontent.com/cs627/Firebean-Website/main/assets/edm/EDM_007/FB2026011-hero.jpg", url:"https://firebean.net/edm/edm_EDM_007.html" },
      { issue:"EDM_008", date:"September 1, 2026", title:"Heritage Meets Innovation: Lessons from ICH Month 2026", desc:"The Intangible Cultural Heritage (ICH) Month 2026 demonstrated something remarkable: when heritage presentations move beyond glass cases and into immersive formats.", photo:"https://raw.githubusercontent.com/cs627/Firebean-Website/main/assets/edm/EDM_008/s1_icho_desktop.jpg", url:"https://firebean.net/edm/edm_EDM_008.html" }
    ];
    populateCards(fallback);
  }

  // Wait for CMS inline code to run first, then overwrite
  function init() {
    setTimeout(loadFeed, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(loadFeed, 800);
    });
  } else {
    init();
  }
})();