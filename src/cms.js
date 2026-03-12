// cms.js — Fetch project data from Google Sheets "Basic Info" tab
// Converts Google Drive file URLs to thumbnail URLs, exposes window.cmsData

(function () {
  'use strict';

  var SHEET_ID = '1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc';
  var BASIC_INFO_GID = '0';

  // Column mapping for Basic Info sheet (0-indexed)
  var COL = {
    TIMESTAMP: 0,    // A
    CLIENT: 1,       // B
    PROJECT: 2,      // C
    DATE: 3,         // D
    VENUE: 4,        // E
    CATEGORY: 5,     // F - Who we help
    WHAT_WE_DO: 6,   // G
    SCOPE: 7,        // H
    YOUTUBE: 8,      // I
    OPEN_QUESTION: 9, // J
    CHALLENGE: 10,   // K - Boring Challenge (EN)
    SOLUTION: 11,    // L - Creative Solution (EN)
    // M-Q: Social media (skip)
    WEB_EN: 17,      // R
    WEB_TC: 18,      // S
    WEB_JP: 19,      // T
    SYNC_STATUS: 20, // U
    DRIVE_FOLDER: 21, // V
    HERO_PHOTO: 22,  // W
    LOGO_BLACK: 23,  // X
    LOGO_WHITE: 24,  // Y
    PROJECT_ID: 25,  // Z
    SORT_DATE: 26    // AA
  };

  // Convert Google Drive file link to displayable thumbnail URL
  function driveToThumbnail(driveUrl, size) {
    size = size || 800;
    if (!driveUrl || typeof driveUrl !== 'string') return '';
    // Match /d/{FILE_ID}/ or id={FILE_ID}
    var match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      match = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    }
    if (match && match[1]) {
      return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w' + size;
    }
    // Already a thumbnail URL or other format
    if (driveUrl.indexOf('drive.google.com/thumbnail') !== -1) {
      return driveUrl;
    }
    return driveUrl;
  }

  // Parse CSV handling quoted fields with commas, newlines, and escaped quotes
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
    // Last field/row
    if (field || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  // Process a row into a structured project object
  function rowToProject(row, index) {
    var heroUrl = (row[COL.HERO_PHOTO] || '').trim();
    var logoBlackUrl = (row[COL.LOGO_BLACK] || '').trim();
    var logoWhiteUrl = (row[COL.LOGO_WHITE] || '').trim();
    var category = (row[COL.CATEGORY] || '').trim();
    var whatWeDo = (row[COL.WHAT_WE_DO] || '').trim();

    // Build categories array from Category and WhatWeDo columns
    var categories = [];
    if (category) categories.push(category);
    if (whatWeDo) {
      var parts = whatWeDo.split(',');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (p) categories.push(p);
      }
    }

    // Map category strings to filter slugs
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

    // Extract Drive folder ID from folder link
    var driveFolderUrl = (row[COL.DRIVE_FOLDER] || '').trim();
    var driveFolderId = '';
    if (driveFolderUrl) {
      var folderMatch = driveFolderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch) driveFolderId = folderMatch[1];
    }

    return {
      index: index,
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
      projectId: (row[COL.PROJECT_ID] || '').trim(),
      sortDate: (row[COL.SORT_DATE] || '').trim(),
      categories: categories,
      filterSlugs: filterSlugs,
      driveFolderId: driveFolderId
    };
  }

  // Fetch and parse Basic Info sheet
  function fetchCMSData() {
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=' + BASIC_INFO_GID;

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (csvText) {
        var rows = parseCSV(csvText);
        if (rows.length < 2) {
          console.warn('[CMS] No data rows found');
          return;
        }

        // Skip header row, process data rows
        var projects = [];
        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          // Skip empty rows (check if project name exists)
          if (!row[COL.PROJECT] || !row[COL.PROJECT].trim()) continue;
          projects.push(rowToProject(row, i - 1));
        }

        // Sort by sort_date descending (newest first)
        projects.sort(function (a, b) {
          if (!a.sortDate && !b.sortDate) return 0;
          if (!a.sortDate) return 1;
          if (!b.sortDate) return -1;
          return b.sortDate.localeCompare(a.sortDate);
        });

        window.cmsData = {
          projects: projects,
          loaded: true
        };

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      })
      .catch(function (err) {
        console.error('[CMS] Failed to fetch data:', err);
        window.cmsData = { projects: [], loaded: false, error: err.message };
        window.dispatchEvent(new CustomEvent('cmsDataReady', { detail: window.cmsData }));
      });
  }

  /**
   * Fetch gallery photo IDs from a Google Drive folder's public embed page.
   * Returns a Promise that resolves to an array of thumbnail URLs.
   * Filters out Logo files and the hero photo to show only gallery images.
   */
  function fetchGalleryPhotos(folderId, heroPhotoUrl, maxPhotos) {
    maxPhotos = maxPhotos || 12;
    if (!folderId) return Promise.resolve([]);

    var embedUrl = 'https://drive.google.com/embeddedfolderview?id=' + folderId;
    return fetch(embedUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        // Parse entries: id="entry-{FILE_ID}" with title in flip-entry-title
        var entries = [];
        var entryRegex = /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?flip-entry-title">([^<]+)</g;
        var m;
        while ((m = entryRegex.exec(html)) !== null) {
          entries.push({ id: m[1], name: m[2] });
        }

        // Extract hero photo file ID for comparison
        var heroId = '';
        if (heroPhotoUrl) {
          var hm = heroPhotoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (hm) heroId = hm[1];
        }

        // Filter: only image files, exclude logos, exclude hero
        var photos = [];
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          var lower = e.name.toLowerCase();
          // Skip logos
          if (lower.indexOf('logo') !== -1) continue;
          // Skip non-image files
          if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) continue;
          // Skip hero photo (already shown as main hero)
          if (heroId && e.id === heroId) continue;
          photos.push('https://drive.google.com/thumbnail?id=' + e.id + '&sz=w1200');
        }

        return photos.slice(0, maxPhotos);
      })
      .catch(function (err) {
        console.warn('[CMS] Gallery fetch failed for folder ' + folderId + ':', err);
        return [];
      });
  }

  // Expose utilities
  window.driveToThumbnail = driveToThumbnail;
  window.fetchGalleryPhotos = fetchGalleryPhotos;
  window.cmsData = { projects: [], loaded: false };

  // Start fetching
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCMSData);
  } else {
    fetchCMSData();
  }
})();
