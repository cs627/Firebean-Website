// cms.js — Load project data from static JSON (synced from Google Sheets CMS)
// Images are synced to data/images/ via Google Apps Script → GitHub pipeline
// Exposes window.cmsData, dispatches 'cmsDataReady' event
// GEO: Auto-injects CreativeWork + FAQPage JSON-LD schema on profile pages
(function () {
  'use strict';

  // Detect base path from <base> tag for GitHub Pages subdirectory hosting
  var baseEl = document.querySelector('base[href]');
  var BASE_PATH = baseEl ? baseEl.getAttribute('href') : '/';
  if (BASE_PATH.charAt(BASE_PATH.length - 1) !== '/') BASE_PATH += '/';

  var JSON_URL = BASE_PATH + 'data/projects.json';

  // ── GEO: Inject JSON-LD schema for profile pages ──────────────────────
  function injectProfileSchema(project) {
    // Only run on profile pages with a valid project
    if (!window.location.pathname.match(/\/profile\.html$/i)) return;
    if (!project || !project.projectId) return;

    // Build CreativeWork schema
    var abstractText = '';
    if (project.webEN) {
      var div = document.createElement('div');
      div.innerHTML = project.webEN;
      var firstP = div.querySelector('p');
      abstractText = firstP ? firstP.textContent.trim().substring(0, 300) : '';
    }

    var creativeWork = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      'identifier': project.projectId,
      'name': project.projectName || '',
      'author': {
        '@type': 'Organization',
        'name': 'Firebean Limited',
        'url': 'https://firebean.net'
      },
      'provider': {
        '@type': 'Organization',
        'name': (project.category || '').split(',')[0].trim()
      },
      'dateCreated': project.sortDate || '',
      'inLanguage': ['en', 'zh-HK', 'ja']
    };

    if (abstractText) creativeWork.abstract = abstractText;
    if (project.scope) creativeWork.description = project.scope;
    if (project.venue) {
      creativeWork.locationCreated = { '@type': 'Place', 'name': project.venue };
    }

    // Inject CreativeWork
    var scriptCW = document.createElement('script');
    scriptCW.type = 'application/ld+json';
    scriptCW.setAttribute('data-geo', 'creativework');
    scriptCW.textContent = JSON.stringify(creativeWork);
    document.head.appendChild(scriptCW);

    // Build FAQPage schema
    var faqData = project.faqEN;
    if (!faqData) return;

    try {
      var faqs = typeof faqData === 'string' ? JSON.parse(faqData) : faqData;
      if (!Array.isArray(faqs) || !faqs.length) return;

      var mainEntity = [];
      for (var i = 0; i < faqs.length; i++) {
        if (faqs[i].q && faqs[i].a) {
          mainEntity.push({
            '@type': 'Question',
            'name': faqs[i].q,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': faqs[i].a.substring(0, 500)
            }
          });
        }
      }

      if (mainEntity.length) {
        var scriptFaq = document.createElement('script');
        scriptFaq.type = 'application/ld+json';
        scriptFaq.setAttribute('data-geo', 'faqpage');
        scriptFaq.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          'mainEntity': mainEntity
        });
        document.head.appendChild(scriptFaq);
      }
    } catch (e) {
      console.warn('[CMS-GEO] FAQ parse error:', e.message);
    }
  }

  // ── Core CMS data loader ──────────────────────────────────────────────
  function fetchCMSData() {
    fetch(JSON_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var projects = data.projects || [];
        if (!projects.length) {
          console.warn('[CMS] No projects in JSON');
        }

        // Prepend base path to relative image URLs
        var imgKeys = ['heroPhoto', 'heroPhotoSmall', 'logoBlack', 'logoWhite'];
        for (var i = 0; i < projects.length; i++) {
          for (var k = 0; k < imgKeys.length; k++) {
            var val = projects[i][imgKeys[k]];
            if (val && val.indexOf('http') !== 0 && val.charAt(0) !== '/') {
              projects[i][imgKeys[k]] = BASE_PATH + val;
            }
          }
          if (projects[i].galleryPhotos && projects[i].galleryPhotos.length) {
            for (var g = 0; g < projects[i].galleryPhotos.length; g++) {
              var gVal = projects[i].galleryPhotos[g];
              if (gVal && gVal.indexOf('http') !== 0 && gVal.charAt(0) !== '/') {
                projects[i].galleryPhotos[g] = BASE_PATH + gVal;
              }
            }
          }

          // Generate filterSlugs from categories
          var categoryMapping = {
            'government': 'government', 'public': 'government', 'public sector': 'government',
            'lifestyle': 'lifestyle', 'consumer': 'lifestyle', 'lifestyle & consumer': 'lifestyle',
            'f&b': 'hospitality', 'hospitality': 'hospitality', 'f&b & hospitality': 'hospitality',
            'malls': 'venues', 'venues': 'venues', 'malls & venues': 'venues',
            'exhibitions': 'exhibitions', 'roving exhibitions': 'exhibitions',
            'social': 'social', 'content': 'social', 'social & content': 'social', 'social media': 'social',
            'interactive': 'tech', 'tech': 'tech', 'technology': 'tech', 'interactive & tech': 'tech',
            'pr': 'pr', 'media': 'pr', 'pr & media': 'pr', 'pr consulting': 'pr', 'media relations': 'pr',
            'events': 'events', 'ceremonies': 'events', 'events & ceremonies': 'events', 'event planning': 'events', 'event production': 'events'
          };

          if (projects[i].categories && projects[i].categories.length) {
            projects[i].filterSlugs = projects[i].categories.map(function(cat) {
              var normalized = cat.toLowerCase().trim();
              return categoryMapping[normalized] || normalized.replace(/[^a-z0-9]/g, '');
            }).filter(function(slug, idx, arr) { return arr.indexOf(slug) === idx; });
          } else {
            projects[i].filterSlugs = [];
          }

          var logoCategory = 'lifestyle';
          if (projects[i].categories && projects[i].categories.length) {
            var catStr = projects[i].categories.join(' ').toLowerCase();
            if (catStr.indexOf('government') !== -1 || catStr.indexOf('public') !== -1) {
              logoCategory = 'government';
            }
          }
          projects[i].logoCategory = logoCategory;
        }

        window.cmsData = {
          projects: projects,
          loaded: true,
          lastSync: data.lastSync || ''
        };

        // ── GEO: Inject schema for profile pages ──
        if (window.location.pathname.match(/\/profile\.html$/i)) {
          var urlParams = new URLSearchParams(window.location.search);
          var profileId = urlParams.get('id');
          if (profileId) {
            var project = projects.find(function(p) {
              return p.projectId === profileId || p.id === profileId;
            });
            if (project) {
              injectProfileSchema(project);
            }
          }
        }

        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      })
      .catch(function (err) {
        console.error('[CMS] Failed to load projects.json:', err);
        window.cmsData = { projects: [], loaded: false, error: err.message };
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      });
  }

  window.cmsData = { projects: [], loaded: false };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCMSData);
  } else {
    fetchCMSData();
  }
})();