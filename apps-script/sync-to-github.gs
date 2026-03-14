/**
 * ============================================================
 * FIREBEAN CMS → GITHUB SYNC PIPELINE  v3.1
 * ============================================================
 * 
 * v3.1: Added "🖼️ Re-sync Images for Selected Row" menu button
 * v3.0: Smart sync, progress toasts, text-only optimization
 *
 * FLOW:
 *   Sheet edit → onEditTrigger marks row "Pending" or "Pending (images)"
 *   User clicks "Sync Changed" or runs manually
 *   → Reads all rows, builds projects.json
 *   → For "Pending (images)" rows: downloads hero, logos, gallery photos
 *   → For "Pending" rows: skips image download (text-only, fast!)
 *   → Compares file hashes to avoid re-uploading unchanged images
 *   → Pushes ALL changes in one commit via Git Tree API
 *   → GitHub Action converts any new .jpg to .webp automatically
 *
 * SETUP:
 *   1. Open Google Sheet → Extensions > Apps Script
 *   2. Paste this script
 *   3. Project Settings > Script Properties → add GITHUB_TOKEN
 *   4. Run setupTriggers() once
 *
 * ============================================================
 */

// ─── CONFIG ────────────────────────────────────────────────
var CONFIG = {
  SHEET_NAME: 'Basic Info',
  GITHUB_OWNER: 'cs627',
  GITHUB_REPO: 'Firebean-Website',
  GITHUB_BRANCH: 'main',
  IMAGES_PATH: 'data/images',
  JSON_PATH: 'data/projects.json',
  HASH_PATH: 'data/image-hashes.json',

  HERO_WIDTH: 1200,
  HERO_SM_WIDTH: 400,
  LOGO_WIDTH: 200,
  GALLERY_WIDTH: 1200,

  COL: {
    TIMESTAMP: 1,
    CLIENT: 2,
    PROJECT: 3,
    DATE: 4,
    VENUE: 5,
    CATEGORY: 6,
    WHAT_WE_DO: 7,
    SCOPE: 8,
    YOUTUBE: 9,
    OPEN_QUESTION: 10,
    CHALLENGE: 11,
    SOLUTION: 12,
    GOOGLE_SLIDE: 13,
    LINKEDIN: 14,
    FACEBOOK: 15,
    THREADS: 16,
    INSTAGRAM: 17,
    WEB_EN: 18,
    WEB_TC: 19,
    WEB_JP: 20,
    SYNC_STATUS: 21,
    DRIVE_FOLDER: 22,
    HERO_PHOTO: 23,
    LOGO_BLACK: 24,
    LOGO_WHITE: 25,
    PROJECT_ID: 26,
    SORT_DATE: 27
  }
};

var IMAGE_COLUMNS_ = [
  CONFIG.COL.DRIVE_FOLDER,
  CONFIG.COL.HERO_PHOTO,
  CONFIG.COL.LOGO_BLACK,
  CONFIG.COL.LOGO_WHITE
];

// ─── MENU ──────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🔥 Firebean CMS')
    .addItem('Sync Changed Only', 'syncChangedToGitHub')
    .addItem('🖼️ Re-sync Images for Selected Row', 'markSelectedRowForImageSync')
    .addSeparator()
    .addItem('Sync ALL to Website', 'syncAllToGitHub')
    .addSeparator()
    .addItem('Setup Auto-Sync Trigger', 'setupTriggers')
    .addToUi();
}

/**
 * Mark the currently selected row(s) for image re-sync.
 * Use this when you've updated photos in Google Drive
 * but the Drive links in the sheet haven't changed.
 */
function markSelectedRowForImageSync() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + CONFIG.SHEET_NAME + '" not found.');
    return;
  }

  var selection = SpreadsheetApp.getActive().getSelection();
  var ranges = selection.getActiveRangeList().getRanges();
  var markedRows = [];

  for (var r = 0; r < ranges.length; r++) {
    var startRow = ranges[r].getRow();
    var numRows = ranges[r].getNumRows();
    for (var row = startRow; row < startRow + numRows; row++) {
      if (row <= 1) continue;
      var projectName = String(sheet.getRange(row, CONFIG.COL.PROJECT).getValue() || '').trim();
      if (!projectName) continue;
      sheet.getRange(row, CONFIG.COL.SYNC_STATUS).setValue('Pending (images)');
      markedRows.push(projectName);
    }
  }

  if (markedRows.length === 0) {
    SpreadsheetApp.getUi().alert('No valid project rows selected.\nPlease select one or more project rows first.');
    return;
  }

  var msg = markedRows.length + ' project(s) marked for image re-sync:\n\n';
  msg += markedRows.map(function(n) { return '• ' + n; }).join('\n');
  msg += '\n\nNow click "Sync Changed Only" to push updates.';
  SpreadsheetApp.getUi().alert(msg);
}

function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();

  SpreadsheetApp.getUi().alert('Auto-sync triggers installed successfully.');
}

// ─── EDIT TRIGGER ──────────────────────────────────────────

function onEditTrigger(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;

  var row = e.range.getRow();
  if (row <= 1) return;

  var col = e.range.getColumn();
  var currentStatus = String(sheet.getRange(row, CONFIG.COL.SYNC_STATUS).getValue() || '').trim();

  var isImageCol = IMAGE_COLUMNS_.indexOf(col) !== -1;

  if (isImageCol) {
    sheet.getRange(row, CONFIG.COL.SYNC_STATUS).setValue('Pending (images)');
  } else if (currentStatus !== 'Pending (images)') {
    sheet.getRange(row, CONFIG.COL.SYNC_STATUS).setValue('Pending');
  }
}

// ─── MAIN SYNC FUNCTIONS ──────────────────────────────────

function syncAllToGitHub() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert('Sync ALL projects to GitHub?',
    'This will rebuild projects.json and re-check all images. Continue?',
    ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;
  doSync(false);
}

function syncChangedToGitHub() {
  doSync(true);
}

// ─── PROGRESS TOAST ────────────────────────────────────────

function showProgress_(message, title) {
  try {
    SpreadsheetApp.getActive().toast(message, title || '🔥 Syncing...', 30);
  } catch(e) {}
}

function doSync(changedOnly) {
  var syncStart = new Date();
  showProgress_('Starting sync...', '🔥 CMS Sync');

  var token = getGitHubToken_();
  if (!token) {
    try {
      SpreadsheetApp.getUi().alert('GitHub token not found.\nGo to Project Settings > Script Properties and add GITHUB_TOKEN.');
    } catch(e) {}
    return;
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    try {
      SpreadsheetApp.getUi().alert('Sheet "' + CONFIG.SHEET_NAME + '" not found.');
    } catch(e) {}
    return;
  }

  var data = sheet.getDataRange().getValues();
  var projects = [];
  var imagesToPush = [];

  var pendingCount = 0;
  var pendingImageCount = 0;
  if (changedOnly) {
    for (var c = 1; c < data.length; c++) {
      var st = String(data[c][CONFIG.COL.SYNC_STATUS - 1] || '').trim();
      if (st === 'Pending (images)') pendingImageCount++;
      else if (st === 'Pending' || st === '') pendingCount++;
    }
    showProgress_(
      'Found ' + pendingCount + ' text change(s), ' + pendingImageCount + ' image change(s)',
      '🔥 CMS Sync'
    );
  }

  showProgress_('Loading image hashes from GitHub...', '🔥 CMS Sync');
  var existingHashes = loadImageHashes_(token);
  var newHashes = {};

  Logger.log('Processing ' + (data.length - 1) + ' rows...');
  var processedCount = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var syncStatus = String(row[CONFIG.COL.SYNC_STATUS - 1] || '').trim();
    var projectName = String(row[CONFIG.COL.PROJECT - 1] || '').trim();

    if (!projectName) continue;

    var projectId = String(row[CONFIG.COL.PROJECT_ID - 1] || '').trim();
    if (!projectId) {
      projectId = 'proj-' + i;
    }
    var pid = projectId.toLowerCase().replace(/[^a-z0-9]/g, '');

    var category = String(row[CONFIG.COL.CATEGORY - 1] || '').toUpperCase().trim();
    var whatWeDo = String(row[CONFIG.COL.WHAT_WE_DO - 1] || '').toUpperCase().trim();
    var categories = [];
    var filterSlugs = [];
    if (category) {
      categories.push(category);
      filterSlugs = filterSlugs.concat(categoryToSlugs_(category));
    }
    if (whatWeDo) {
      whatWeDo.split(',').forEach(function(w) {
        var wt = w.trim();
        if (wt) {
          categories.push(wt);
          filterSlugs = filterSlugs.concat(categoryToSlugs_(wt));
        }
      });
    }

    var heroFileId = extractDriveFileId_(row[CONFIG.COL.HERO_PHOTO - 1]);
    var logoBlackFileId = extractDriveFileId_(row[CONFIG.COL.LOGO_BLACK - 1]);
    var logoWhiteFileId = extractDriveFileId_(row[CONFIG.COL.LOGO_WHITE - 1]);
    var driveFolderId = extractDriveFolderId_(row[CONFIG.COL.DRIVE_FOLDER - 1]);

    var heroPath = heroFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-hero.webp' : '';
    var heroSmPath = heroFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-hero-sm.webp' : '';
    var logoBlackPath = logoBlackFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-logo-black.webp' : '';
    var logoWhitePath = logoWhiteFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-logo-white.webp' : '';

    var needsImageSync = false;
    var needsTextSync = false;

    if (!changedOnly) {
      needsImageSync = true;
      needsTextSync = true;
    } else if (syncStatus === 'Pending (images)' || syncStatus === '') {
      needsImageSync = true;
      needsTextSync = true;
    } else if (syncStatus === 'Pending') {
      needsTextSync = true;
      needsImageSync = false;
    }

    if (needsImageSync) {
      processedCount++;
      showProgress_(
        'Processing images: ' + projectName + ' (' + processedCount + '/' + (pendingImageCount || (data.length - 1)) + ')',
        '🔥 CMS Sync'
      );
      Logger.log('Syncing images for row ' + (i + 1) + ': ' + projectName);

      if (heroFileId) {
        pushIfChanged_(imagesToPush, existingHashes, newHashes,
          heroPath, heroFileId, CONFIG.HERO_WIDTH);
        pushIfChanged_(imagesToPush, existingHashes, newHashes,
          heroSmPath, heroFileId, CONFIG.HERO_SM_WIDTH);
      }

      if (logoBlackFileId) {
        pushIfChanged_(imagesToPush, existingHashes, newHashes,
          logoBlackPath, logoBlackFileId, CONFIG.LOGO_WIDTH);
      }
      if (logoWhiteFileId) {
        pushIfChanged_(imagesToPush, existingHashes, newHashes,
          logoWhitePath, logoWhiteFileId, CONFIG.LOGO_WIDTH);
      }
    } else if (needsTextSync) {
      Logger.log('Text-only sync for row ' + (i + 1) + ': ' + projectName + ' (skipping images)');
      [heroPath, heroSmPath, logoBlackPath, logoWhitePath].forEach(function(p) {
        if (p && existingHashes[p]) newHashes[p] = existingHashes[p];
      });
    } else {
      [heroPath, heroSmPath, logoBlackPath, logoWhitePath].forEach(function(p) {
        if (p && existingHashes[p]) newHashes[p] = existingHashes[p];
      });
    }

    var galleryPhotos = [];
    if (driveFolderId) {
      if (needsImageSync) {
        try {
          var folder = DriveApp.getFolderById(driveFolderId);
          var files = folder.getFiles();
          var photoFiles = [];

          while (files.hasNext()) {
            var file = files.next();
            var fileName = file.getName();
            var mime = file.getMimeType();

            if (mime.indexOf('image/') !== 0) continue;
            if (fileName.match(/^Logo_/i)) continue;
            if (fileName.match(/^Hero_/i)) continue;

            photoFiles.push({
              name: fileName,
              id: file.getId(),
              updated: file.getLastUpdated().getTime()
            });
          }

          photoFiles.sort(function(a, b) { return a.name.localeCompare(b.name); });

          showProgress_(
            projectName + ': checking ' + photoFiles.length + ' gallery photos...',
            '🔥 CMS Sync'
          );

          for (var g = 0; g < photoFiles.length; g++) {
            var galleryPath = CONFIG.IMAGES_PATH + '/' + pid + '-gallery-' + g + '.webp';
            galleryPhotos.push(galleryPath);
            pushIfChanged_(imagesToPush, existingHashes, newHashes,
              galleryPath, photoFiles[g].id, CONFIG.GALLERY_WIDTH);
          }
        } catch (e) {
          Logger.log('Error accessing Drive folder for ' + projectName + ': ' + e.message);
        }
      } else {
        var gIdx = 0;
        while (true) {
          var gPath = CONFIG.IMAGES_PATH + '/' + pid + '-gallery-' + gIdx + '.webp';
          if (existingHashes[gPath]) {
            galleryPhotos.push(gPath);
            newHashes[gPath] = existingHashes[gPath];
            gIdx++;
          } else {
            break;
          }
        }
      }
    }

    var project = {
      index: i - 1,
      client: String(row[CONFIG.COL.CLIENT - 1] || ''),
      project: projectName,
      date: String(row[CONFIG.COL.DATE - 1] || ''),
      venue: String(row[CONFIG.COL.VENUE - 1] || ''),
      category: category,
      whatWeDo: whatWeDo,
      scope: String(row[CONFIG.COL.SCOPE - 1] || ''),
      youtube: String(row[CONFIG.COL.YOUTUBE - 1] || ''),
      challenge: String(row[CONFIG.COL.CHALLENGE - 1] || ''),
      solution: String(row[CONFIG.COL.SOLUTION - 1] || ''),
      linkedin: String(row[CONFIG.COL.LINKEDIN - 1] || ''),
      facebook: String(row[CONFIG.COL.FACEBOOK - 1] || ''),
      threads: String(row[CONFIG.COL.THREADS - 1] || ''),
      instagram: String(row[CONFIG.COL.INSTAGRAM - 1] || ''),
      webEN: String(row[CONFIG.COL.WEB_EN - 1] || ''),
      webTC: String(row[CONFIG.COL.WEB_TC - 1] || ''),
      webJP: String(row[CONFIG.COL.WEB_JP - 1] || ''),
      heroPhoto: heroPath,
      heroPhotoSmall: heroSmPath,
      logoBlack: logoBlackPath,
      logoWhite: logoWhitePath,
      galleryPhotos: galleryPhotos,
      projectId: projectId,
      sortDate: String(row[CONFIG.COL.SORT_DATE - 1] || ''),
      driveFolderId: driveFolderId || '',
      categories: categories,
      filterSlugs: filterSlugs
    };

    projects.push(project);
  }

  projects.sort(function(a, b) {
    return (b.sortDate || '').localeCompare(a.sortDate || '');
  });
  projects.forEach(function(p, idx) { p.index = idx; });

  var projectsJson = JSON.stringify({
    lastSync: new Date().toISOString(),
    projects: projects
  }, null, 2);

  var hashesJson = JSON.stringify(newHashes, null, 2);

  Logger.log('Built projects.json: ' + projects.length + ' projects');
  Logger.log('New/updated images to push: ' + imagesToPush.length);

  showProgress_(
    'Pushing to GitHub: ' + imagesToPush.length + ' image(s) + projects.json',
    '🔥 Uploading'
  );

  try {
    var filesPushed = pushToGitHubBatch_(token, imagesToPush, projectsJson, hashesJson);
    Logger.log('Pushed ' + filesPushed + ' files in single commit');
  } catch (e) {
    Logger.log('Push failed: ' + e.message);
    try {
      SpreadsheetApp.getUi().alert('Sync failed: ' + e.message);
    } catch(e2) {}
    return;
  }

  showProgress_('Updating sync status...', '🔥 Almost done');
  for (var k = 1; k < data.length; k++) {
    var rowPN = String(data[k][CONFIG.COL.PROJECT - 1] || '').trim();
    if (!rowPN) continue;
    var rowSS = String(data[k][CONFIG.COL.SYNC_STATUS - 1] || '').trim();
    if (!changedOnly || rowSS === 'Pending' || rowSS === 'Pending (images)' || rowSS === '') {
      sheet.getRange(k + 1, CONFIG.COL.SYNC_STATUS).setValue('Synced ' + new Date().toLocaleString());
    }
  }

  var elapsed = Math.round((new Date() - syncStart) / 1000);
  var totalGallery = 0;
  projects.forEach(function(p) { totalGallery += (p.galleryPhotos || []).length; });

  var msg = 'Sync complete! (' + elapsed + ' seconds)\n\n' +
    '• Projects: ' + projects.length + '\n' +
    '• Total gallery photos: ' + totalGallery + '\n' +
    '• New/updated images pushed: ' + imagesToPush.length + '\n\n' +
    'Website updates in ~1 min:\nhttps://cs627.github.io/Firebean-Website/';

  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch(e) {}
}


// ─── GIT TREE API BATCH PUSH ──────────────────────────────

function pushToGitHubBatch_(token, images, projectsJson, hashesJson) {
  var baseUrl = 'https://api.github.com/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO;
  var headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json'
  };

  var refResp = ghGet_(baseUrl + '/git/ref/heads/' + CONFIG.GITHUB_BRANCH, headers);
  var headSha = refResp.object.sha;
  var commitResp = ghGet_(baseUrl + '/git/commits/' + headSha, headers);
  var baseTreeSha = commitResp.tree.sha;

  var treeItems = [];

  for (var i = 0; i < images.length; i++) {
    var img = images[i];

    showProgress_(
      'Uploading image ' + (i + 1) + ' of ' + images.length + '...',
      '🔥 Uploading'
    );

    var blobSha = createBlob_(baseUrl, headers, img.base64, 'base64');
    if (blobSha) {
      treeItems.push({
        path: img.path,
        mode: '100644',
        type: 'blob',
        sha: blobSha
      });
    }

    if (i > 0 && i % 10 === 0) {
      Utilities.sleep(200);
    }
  }

  showProgress_('Uploading projects.json...', '🔥 Uploading');
  var jsonBlobSha = createBlob_(baseUrl, headers, projectsJson, 'utf-8');
  if (jsonBlobSha) {
    treeItems.push({
      path: CONFIG.JSON_PATH,
      mode: '100644',
      type: 'blob',
      sha: jsonBlobSha
    });
  }

  var hashesBlobSha = createBlob_(baseUrl, headers, hashesJson, 'utf-8');
  if (hashesBlobSha) {
    treeItems.push({
      path: CONFIG.HASH_PATH,
      mode: '100644',
      type: 'blob',
      sha: hashesBlobSha
    });
  }

  if (treeItems.length === 0) {
    Logger.log('No changes to push.');
    return 0;
  }

  showProgress_('Creating commit...', '🔥 Uploading');
  var treeResp = ghPost_(baseUrl + '/git/trees', headers, {
    base_tree: baseTreeSha,
    tree: treeItems
  });
  var newTreeSha = treeResp.sha;

  var commitMsg = 'CMS sync: ' + images.length + ' images, ' +
    new Date().toISOString().replace('T', ' ').substring(0, 19);
  var newCommitResp = ghPost_(baseUrl + '/git/commits', headers, {
    message: commitMsg,
    tree: newTreeSha,
    parents: [headSha]
  });
  var newCommitSha = newCommitResp.sha;

  ghPatch_(baseUrl + '/git/refs/heads/' + CONFIG.GITHUB_BRANCH, headers, {
    sha: newCommitSha
  });

  Logger.log('Commit: ' + newCommitSha);
  return treeItems.length;
}


// ─── CHANGE DETECTION ──────────────────────────────────────

function pushIfChanged_(imagesToPush, existingHashes, newHashes, path, fileId, width) {
  if (!path || !fileId) return;

  try {
    var blob = downloadDriveImage_(fileId, width);
    if (!blob) return;

    var bytes = blob.getBytes();
    var hash = computeHash_(bytes);
    newHashes[path] = hash;

    if (existingHashes[path] === hash) {
      Logger.log('  [SKIP] ' + path + ' (unchanged)');
      return;
    }

    Logger.log('  [PUSH] ' + path + ' (' + bytes.length + ' bytes)');
    imagesToPush.push({
      path: path,
      base64: Utilities.base64Encode(bytes)
    });
  } catch (e) {
    Logger.log('  [ERROR] ' + path + ': ' + e.message);
  }
}

function loadImageHashes_(token) {
  var url = 'https://api.github.com/repos/' + CONFIG.GITHUB_OWNER + '/' +
    CONFIG.GITHUB_REPO + '/contents/' + CONFIG.HASH_PATH + '?ref=' + CONFIG.GITHUB_BRANCH;
  try {
    var resp = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      var content = Utilities.newBlob(Utilities.base64Decode(data.content)).getDataAsString();
      return JSON.parse(content);
    }
  } catch (e) {
    Logger.log('Could not load hashes: ' + e.message);
  }
  return {};
}

function computeHash_(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes);
  return digest.map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}


// ─── IMAGE DOWNLOAD ────────────────────────────────────────

function downloadDriveImage_(fileId, width) {
  try {
    var url = 'https://lh3.googleusercontent.com/d/' + fileId + '=w' + width;
    var oauthToken = ScriptApp.getOAuthToken();
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + oauthToken },
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (resp.getResponseCode() === 200 && resp.getBlob().getBytes().length > 1000) {
      return resp.getBlob();
    }

    url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + width;
    resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + oauthToken },
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (resp.getResponseCode() === 200 && resp.getBlob().getBytes().length > 1000) {
      return resp.getBlob();
    }

    Logger.log('  Falling back to direct download for ' + fileId);
    var file = DriveApp.getFileById(fileId);
    return file.getBlob();
  } catch (e) {
    Logger.log('Error downloading ' + fileId + ': ' + e.message);
    try {
      return DriveApp.getFileById(fileId).getBlob();
    } catch (e2) {
      return null;
    }
  }
}


// ─── GITHUB API HELPERS ────────────────────────────────────

function ghGet_(url, headers) {
  var resp = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('GET ' + url + ' → ' + resp.getResponseCode());
  }
  return JSON.parse(resp.getContentText());
}

function ghPost_(url, headers, payload) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('POST ' + url + ' → ' + code + ': ' + resp.getContentText().substring(0, 300));
  }
  return JSON.parse(resp.getContentText());
}

function ghPatch_(url, headers, payload) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('PATCH ' + url + ' → ' + code);
  }
  return JSON.parse(resp.getContentText());
}

function createBlob_(baseUrl, headers, content, encoding) {
  var resp = ghPost_(baseUrl + '/git/blobs', headers, {
    content: content,
    encoding: encoding
  });
  return resp.sha;
}


// ─── UTILITY FUNCTIONS ─────────────────────────────────────

function getGitHubToken_() {
  return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
}

function extractDriveFileId_(url) {
  if (!url) return '';
  url = String(url).trim();
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (url.match(/^[a-zA-Z0-9_-]{10,}$/)) return url;
  return '';
}

function extractDriveFolderId_(url) {
  if (!url) return '';
  url = String(url).trim();
  var match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (url.match(/^[a-zA-Z0-9_-]{10,}$/)) return url;
  return '';
}

function categoryToSlugs_(cat) {
  var map = {
    'GOVERNMENT & PUBLIC SECTOR': ['government'],
    'LIFESTYLE & CONSUMER': ['lifestyle'],
    'F&B & HOSPITALITY': ['hospitality'],
    'MALLS & VENUES': ['venues'],
    'ROVING EXHIBITIONS': ['exhibitions'],
    'SOCIAL & CONTENT': ['social'],
    'INTERACTIVE & TECH': ['tech'],
    'PR & MEDIA': ['pr'],
    'EVENTS & CEREMONIES': ['events']
  };
  var slugs = [];
  for (var key in map) {
    if (cat.indexOf(key) !== -1) {
      slugs = slugs.concat(map[key]);
    }
  }
  return slugs;
}
