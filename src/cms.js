// cms.js — Load project data from static JSON (synced from Google Sheets CMS)
// Primary: /data/projects.json (committed to repo, served as static file)
// Images are pre-converted to WebP and stored in /data/images/
// Exposes window.cmsData, dispatches 'cmsDataReady' event

(function () {
  'use strict';

  // Detect base path from <base> tag or page URL for GitHub Pages subdirectory hosting
  var baseEl = document.querySelector('base[href]');
  var BASE_PATH = baseEl ? baseEl.getAttribute('href') : '/';
  if (BASE_PATH.charAt(BASE_PATH.length - 1) !== '/') BASE_PATH += '/';

  var JSON_URL = BASE_PATH + 'data/projects.json';

  /**
   * Fetch gallery photo IDs from a Google Drive folder via Edge Function proxy.
   * Returns a Promise resolving to an array of thumbnail URLs.
   * (Gallery photos are still fetched at runtime since folders may have many images.)
   */
  function fetchGalleryPhotos(folderId, heroPhotoUrl, maxPhotos) {
    maxPhotos = maxPhotos || 12;
    if (!folderId) return Promise.resolve([]);

    var apiUrl = 'api/gallery?folderId=' + encodeURIComponent(folderId);
    return fetch(apiUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data.photos || !data.photos.length) return [];

        // Extract hero photo file ID for comparison
        var heroId = '';
        if (heroPhotoUrl) {
          var hm = heroPhotoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (hm) heroId = hm[1];
        }

        // Convert IDs to thumbnail URLs, exclude hero photo
        var photos = [];
        for (var i = 0; i < data.photos.length; i++) {
          var fileId = data.photos[i];
          if (heroId && fileId === heroId) continue;
          photos.push('https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200');
        }

        return photos.slice(0, maxPhotos);
      })
      .catch(function (err) {
        console.warn('[CMS] Gallery fetch failed for folder ' + folderId + ':', err);
        return [];
      });
  }

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
          for (var k = 0; k < imgKeys.length; k++) {
            var val = projects[i][imgKeys[k]];
            if (val && val.indexOf('http') !== 0 && val.charAt(0) !== '/') {
              projects[i][imgKeys[k]] = BASE_PATH + val;
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

  // Expose utilities
  window.fetchGalleryPhotos = fetchGalleryPhotos;
  window.cmsData = { projects: [], loaded: false };

  // Start fetching
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCMSData);
  } else {
    fetchCMSData();
  }
})();
