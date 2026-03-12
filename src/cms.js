// cms.js — Load project data from static JSON (synced from Google Sheets CMS)
// Images are synced to data/images/ via Google Apps Script → GitHub pipeline
// Exposes window.cmsData, dispatches 'cmsDataReady' event

(function () {
  'use strict';

  // Detect base path from <base> tag for GitHub Pages subdirectory hosting
  var baseEl = document.querySelector('base[href]');
  var BASE_PATH = baseEl ? baseEl.getAttribute('href') : '/';
  if (BASE_PATH.charAt(BASE_PATH.length - 1) !== '/') BASE_PATH += '/';

  var JSON_URL = BASE_PATH + 'data/projects.json';

  // Fetch static JSON data
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
          // Fix standard image fields
          for (var k = 0; k < imgKeys.length; k++) {
            var val = projects[i][imgKeys[k]];
            if (val && val.indexOf('http') !== 0 && val.charAt(0) !== '/') {
              projects[i][imgKeys[k]] = BASE_PATH + val;
            }
          }
          // Fix gallery photo paths
          if (projects[i].galleryPhotos && projects[i].galleryPhotos.length) {
            for (var g = 0; g < projects[i].galleryPhotos.length; g++) {
              var gVal = projects[i].galleryPhotos[g];
              if (gVal && gVal.indexOf('http') !== 0 && gVal.charAt(0) !== '/') {
                projects[i].galleryPhotos[g] = BASE_PATH + gVal;
              }
            }
          }
        }

        window.cmsData = {
          projects: projects,
          loaded: true,
          lastSync: data.lastSync || ''
        };

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      })
      .catch(function (err) {
        console.error('[CMS] Failed to load projects.json:', err);
        window.cmsData = { projects: [], loaded: false, error: err.message };
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      });
  }

  // Expose CMS data
  window.cmsData = { projects: [], loaded: false };

  // Start fetching
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCMSData);
  } else {
    fetchCMSData();
  }
})();
