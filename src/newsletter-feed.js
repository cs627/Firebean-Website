/**
 * newsletter-feed.js — Populates "The Dispatch" newsletter cards
 * with latest EDM case study content from data/edm-feed.json.
 * Links open in new tab since EDM pages have different branding.
 */
(function() {
  'use strict';

  var FEED_URL = (document.querySelector('base[href]') ? document.querySelector('base[href]').getAttribute('href') : '/') + 'data/edm-feed.json';

  function populateCards(feed) {
    for (var i = 0; i < Math.min(feed.length, 3); i++) {
      var n = i + 1;
      var entry = feed[i];
      
      var img = document.getElementById('newsletter-img-' + n);
      var title = document.getElementById('newsletter-title-' + n);
      var desc = document.getElementById('newsletter-desc-' + n);
      var link = document.getElementById('newsletter-link-' + n);
      
      if (img) {
        img.src = entry.photo;
        img.alt = entry.title;
      }
      if (title) title.textContent = entry.title;
      if (desc) {
        var text = entry.desc;
        if (text.length > 180) text = text.substring(0, 180) + '…';
        desc.textContent = text;
      }
      if (link) {
        link.href = entry.url;
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
      }
    }
  }

  // Try loading from JSON
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', FEED_URL, true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var feed = JSON.parse(xhr.responseText);
          if (feed && feed.length) populateCards(feed);
        } catch(e) {
          console.warn('[newsletter-feed] JSON parse failed, using fallback');
          useFallback();
        }
      } else {
        useFallback();
      }
    };
    xhr.onerror = useFallback;
    xhr.send();
  } catch(e) {
    useFallback();
  }

  function useFallback() {
    // Hardcoded fallback from latest EDMs
    var fallback = [
      {
        title: "Revitalizing Reading in a Digital Age",
        desc: "Developing a roving reading exhibition that transformed public spaces across Hong Kong into immersive literary experiences — blending physical installations with digital interactivity.",
        photo: "data/images/contact-bg.webp",
        url: "https://firebean.net/edm/edm_EDM_003.html",
        issue: "EDM_003"
      },
      {
        title: "Modernizing OSH Guidelines",
        desc: "A high-tech interactive roadshow bringing occupational safety to life for Hong Kong's workforce, deployed across 18+ venues with gamified learning modules.",
        photo: "data/images/contact-bg.webp",
        url: "https://firebean.net/edm/edm_EDM_004.html",
        issue: "EDM_004"
      },
      {
        title: "Demystifying Building Safety",
        desc: "Data-driven social strategy that turned complex building regulations into accessible public knowledge, driving record engagement for the Buildings Department.",
        photo: "data/images/contact-bg.webp",
        url: "https://firebean.net/edm/edm_EDM_005.html",
        issue: "EDM_005"
      }
    ];
    populateCards(fallback);
  }
})();