// cms.js — Fetch project data from projects.json (synced from Google Sheets via Apps Script)
// Exposes window.cmsData with pre-processed project data including gallery photos

(function () {
  'use strict';

  // Path to the synced projects.json (relative to site root)
  // BASE_HREF is set in index.html <base> tag, so this is relative to that
  var JSON_PATH = 'data/projects.json';

  // Fetch and parse projects.json
  function fetchCMSData() {
    fetch(JSON_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var projects = data.projects || [];

        if (projects.length === 0) {
          console.warn('[CMS] No projects found in projects.json');
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
        console.error('[CMS] Failed to fetch projects.json:', err);
        // Fallback: try fetching from Google Sheets CSV
        console.log('[CMS] Attempting fallback to Google Sheets CSV...');
        fetchFromSheetsFallback();
      });
  }

  // Fallback: fetch from Google Sheets CSV if projects.json fails
  function fetchFromSheetsFallback() {
    var SHEET_ID = '1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc';
    var BASIC_INFO_GID = '0';
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=' + BASIC_INFO_GID;

    // Column mapping for Basic Info sheet (0-indexed)
    var COL = {
      TIMESTAMP: 0, CLIENT: 1, PROJECT: 2, DATE: 3, VENUE: 4,
      CATEGORY: 5, WHAT_WE_DO: 6, SCOPE: 7, YOUTUBE: 8,
      OPEN_QUESTION: 9, CHALLENGE: 10, SOLUTION: 11,
      GOOGLE_SLIDE: 12, LINKEDIN: 13, FACEBOOK: 14, THREADS: 15, INSTAGRAM: 16,
      WEB_EN: 17, WEB_TC: 18, WEB_JP: 19,
      SYNC_STATUS: 20, DRIVE_FOLDER: 21, HERO_PHOTO: 22,
      LOGO_BLACK: 23, LOGO_WHITE: 24, PROJECT_ID: 25, SORT_DATE: 26
    };

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (csvText) {
        var rows = parseCSV(csvText);
        if (rows.length < 2) {
          console.warn('[CMS] No data rows found in CSV fallback');
          return;
        }

        var projects = [];
        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          if (!row[COL.PROJECT] || !row[COL.PROJECT].trim()) continue;

          var heroUrl = (row[COL.HERO_PHOTO] || '').trim();
          var logoBlackUrl = (row[COL.LOGO_BLACK] || '').trim();
          var logoWhiteUrl = (row[COL.LOGO_WHITE] || '').trim();
          var category = (row[COL.CATEGORY] || '').trim();
          var whatWeDo = (row[COL.WHAT_WE_DO] || '').trim();

          var categories = [];
          if (category) categories.push(category);
          if (whatWeDo) {
            whatWeDo.split(',').forEach(function (p) {
              var t = p.trim();
              if (t) categories.push(t);
            });
          }

          var filterSlugs = categories.map(function (cat) {
            var lower = cat.toLowerCase();
            if (lower.indexOf('government') !== -1 || lower.indexOf('public sector') !== -1) return 'government';
            if (lower.indexOf('lifestyle') !== -1 || lower.indexOf('consumer') !== -1) return 'lifestyle';
            if (lower.indexOf('f&b') !== -1 || lower.indexOf('hospitality') !== -1) return 'hospitality';
            if (lower.indexOf('mall') !== -1 || lower.indexOf('venue') !== -1) return 'venues';
            if (lower.indexOf('roving') !== -1 || lower.indexOf('exhibition') !== -1) return 'exhibitions';
            if (lower.indexOf('social') !== -1 || lower.indexOf('content') !== -1) return 'social';
            if (lower.indexOf('interactive') !== -1 || lower.indexOf('tech') !== -1) return 'tech';
            if (lower.indexOf('pr') !== -1 || lower.indexOf('media') !== -1) return 'pr';
            if (lower.indexOf('event') !== -1 || lower.indexOf('ceremon') !== -1) return 'events';
            return lower.replace(/[^a-z0-9]/g, '');
          });

          projects.push({
            index: i - 1,
            client: (row[COL.CLIENT] || '').trim(),
            project: (row[COL.PROJECT] || '').trim(),
            date: (row[COL.DATE] || '').trim(),
            venue: (row[COL.VENUE] || '').trim(),
            category: category,
            whatWeDo: whatWeDo,
            scope: (row[COL.SCOPE] || '').trim(),
            youtube: (row[COL.YOUTUBE] || '').trim(),
            challenge: (row[COL.CHALLENGE] || '').trim(),
            solution: (row[COL.SOLUTION] || '').trim(),
            webEN: (row[COL.WEB_EN] || '').trim(),
            webTC: (row[COL.WEB_TC] || '').trim(),
            webJP: (row[COL.WEB_JP] || '').trim(),
            heroPhoto: driveToThumbnail(heroUrl, 1200),
            heroPhotoSmall: driveToThumbnail(heroUrl, 400),
            logoBlack: driveToThumbnail(logoBlackUrl, 200),
            logoWhite: driveToThumbnail(logoWhiteUrl, 200),
            galleryPhotos: [],
            projectId: (row[COL.PROJECT_ID] || '').trim(),
            sortDate: (row[COL.SORT_DATE] || '').trim(),
            categories: categories,
            filterSlugs: filterSlugs
          });
        }

        projects.sort(function (a, b) {
          if (!a.sortDate && !b.sortDate) return 0;
          if (!a.sortDate) return 1;
          if (!b.sortDate) return -1;
          return b.sortDate.localeCompare(a.sortDate);
        });

        window.cmsData = { projects: projects, loaded: true };
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      })
      .catch(function (err) {
        console.error('[CMS] CSV fallback also failed:', err);
        window.cmsData = { projects: [], loaded: false, error: err.message };
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      });
  }

  // Convert Google Drive file link to displayable thumbnail URL (used in fallback only)
  function driveToThumbnail(driveUrl, size) {
    size = size || 800;
    if (!driveUrl || typeof driveUrl !== 'string') return '';
    var match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      match = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    }
    if (match && match[1]) {
      return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w' + size;
    }
    if (driveUrl.indexOf('drive.google.com/thumbnail') !== -1) {
      return driveUrl;
    }
    return driveUrl;
  }

  // Parse CSV handling quoted fields (used in fallback only)
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          row.push(field);
          field = '';
          i++;
        } else if (ch === '\n' || ch === '\r') {
          row.push(field);
          field = '';
          if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
            i++;
          }
          rows.push(row);
          row = [];
          i++;
        } else {
          field += ch;
          i++;
        }
      }
    }
    if (field || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  // Expose utilities
  window.driveToThumbnail = driveToThumbnail;
  window.cmsData = { projects: [], loaded: false };

  // Start fetching
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCMSData);
  } else {
    fetchCMSData();
  }
})();
