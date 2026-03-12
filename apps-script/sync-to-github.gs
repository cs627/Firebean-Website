/**
 * ============================================================
 * FIREBEAN CMS → GITHUB SYNC PIPELINE
 * ============================================================
 * 
 * This Google Apps Script reads project data from the Firebean
 * Master DB Google Sheet, downloads images from Google Drive,
 * and pushes everything to GitHub for the static website.
 *
 * SETUP:
 * 1. Open your Google Sheet (Firebean_Master_DB)
 * 2. Extensions > Apps Script
 * 3. Paste this entire script
 * 4. Go to Project Settings > Script Properties and add:
 *    - GITHUB_TOKEN: your GitHub Personal Access Token (with repo scope)
 * 5. Run setupTriggers() once to install the edit trigger
 * 
 * The script will auto-sync when you edit the "Basic Info" sheet.
 * You can also manually trigger via the "Firebean CMS" menu.
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
  
  // Image sizes (width in pixels)
  HERO_WIDTH: 1200,
  HERO_SM_WIDTH: 400,
  LOGO_WIDTH: 200,
  GALLERY_WIDTH: 1200,
  
  // Columns (1-based index in the sheet)
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

// ─── MENU ──────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🔥 Firebean CMS')
    .addItem('Sync ALL to Website', 'syncAllToGitHub')
    .addItem('Sync Changed Only', 'syncChangedToGitHub')
    .addSeparator()
    .addItem('Setup Auto-Sync Trigger', 'setupTriggers')
    .addToUi();
}

function setupTriggers() {
  // Remove existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  
  // Install onEdit trigger
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  // Install onOpen trigger for menu
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
  
  // Mark the edited row as "Pending" sync
  var row = e.range.getRow();
  if (row <= 1) return; // Skip header
  
  sheet.getRange(row, CONFIG.COL.SYNC_STATUS).setValue('Pending');
}

// ─── MAIN SYNC FUNCTIONS ──────────────────────────────────

/**
 * Sync ALL projects to GitHub (full rebuild)
 */
function syncAllToGitHub() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert('Sync ALL projects to GitHub?', 
    'This will rebuild the entire projects.json and re-upload all images. Continue?',
    ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;
  
  doSync(false);
}

/**
 * Sync only changed (Pending) projects
 */
function syncChangedToGitHub() {
  doSync(true);
}

/**
 * Core sync logic
 * @param {boolean} changedOnly - if true, only sync rows with Sync Status = "Pending"
 */
function doSync(changedOnly) {
  var token = getGitHubToken_();
  if (!token) {
    SpreadsheetApp.getUi().alert('GitHub token not found. Go to Project Settings > Script Properties and add GITHUB_TOKEN.');
    return;
  }
  
  var sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + CONFIG.SHEET_NAME + '" not found.');
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var projects = [];
  var imagesToPush = []; // {path, blob} pairs
  
  Logger.log('Processing ' + (data.length - 1) + ' rows...');
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var syncStatus = String(row[CONFIG.COL.SYNC_STATUS - 1] || '').trim();
    var projectName = String(row[CONFIG.COL.PROJECT - 1] || '').trim();
    
    if (!projectName) continue; // Skip empty rows
    
    // Determine project ID
    var projectId = String(row[CONFIG.COL.PROJECT_ID - 1] || '').trim();
    if (!projectId) {
      // Generate a project ID if not set
      projectId = 'proj-' + i;
    }
    var pid = projectId.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Parse category slugs
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
    
    // Extract Drive file IDs from URLs
    var heroFileId = extractDriveFileId_(row[CONFIG.COL.HERO_PHOTO - 1]);
    var logoBlackFileId = extractDriveFileId_(row[CONFIG.COL.LOGO_BLACK - 1]);
    var logoWhiteFileId = extractDriveFileId_(row[CONFIG.COL.LOGO_WHITE - 1]);
    var driveFolderId = extractDriveFolderId_(row[CONFIG.COL.DRIVE_FOLDER - 1]);
    
    // Build image paths
    var heroPath = heroFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-hero.jpg' : '';
    var heroSmPath = heroFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-hero-sm.jpg' : '';
    var logoBlackPath = logoBlackFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-logo-black.jpg' : '';
    var logoWhitePath = logoWhiteFileId ? CONFIG.IMAGES_PATH + '/' + pid + '-logo-white.jpg' : '';
    
    // Download images if this row needs syncing
    var needsSync = !changedOnly || syncStatus === 'Pending' || syncStatus === '';
    
    if (needsSync) {
      Logger.log('Syncing row ' + (i+1) + ': ' + projectName);
      
      // Download hero photo
      if (heroFileId) {
        var heroBlob = downloadDriveThumbnail_(heroFileId, CONFIG.HERO_WIDTH);
        if (heroBlob) imagesToPush.push({ path: heroPath, blob: heroBlob });
        
        var heroSmBlob = downloadDriveThumbnail_(heroFileId, CONFIG.HERO_SM_WIDTH);
        if (heroSmBlob) imagesToPush.push({ path: heroSmPath, blob: heroSmBlob });
      }
      
      // Download logos
      if (logoBlackFileId) {
        var lbBlob = downloadDriveThumbnail_(logoBlackFileId, CONFIG.LOGO_WIDTH);
        if (lbBlob) imagesToPush.push({ path: logoBlackPath, blob: lbBlob });
      }
      if (logoWhiteFileId) {
        var lwBlob = downloadDriveThumbnail_(logoWhiteFileId, CONFIG.LOGO_WIDTH);
        if (lwBlob) imagesToPush.push({ path: logoWhitePath, blob: lwBlob });
      }
    }
    
    // Download gallery photos from Drive folder
    var galleryPhotos = [];
    if (driveFolderId) {
      try {
        var folder = DriveApp.getFolderById(driveFolderId);
        var files = folder.getFiles();
        var galleryIdx = 0;
        
        while (files.hasNext()) {
          var file = files.next();
          var fileName = file.getName();
          
          // Only include Photo_*.jpg files (skip logos)
          if (!fileName.match(/^Photo_/i)) continue;
          
          var galleryPath = CONFIG.IMAGES_PATH + '/' + pid + '-gallery-' + galleryIdx + '.jpg';
          galleryPhotos.push(galleryPath);
          
          if (needsSync) {
            var galleryBlob = downloadDriveThumbnail_(file.getId(), CONFIG.GALLERY_WIDTH);
            if (galleryBlob) {
              imagesToPush.push({ path: galleryPath, blob: galleryBlob });
            }
          }
          galleryIdx++;
        }
      } catch (e) {
        Logger.log('Error accessing Drive folder for ' + projectName + ': ' + e.message);
      }
    }
    
    // Build project object
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
  
  // Sort projects by sortDate descending (newest first)
  projects.sort(function(a, b) {
    return (b.sortDate || '').localeCompare(a.sortDate || '');
  });
  
  // Re-index after sort
  projects.forEach(function(p, idx) { p.index = idx; });
  
  // Build projects.json
  var projectsJson = JSON.stringify({
    lastSync: new Date().toISOString(),
    projects: projects
  }, null, 2);
  
  Logger.log('Built projects.json with ' + projects.length + ' projects');
  Logger.log('Images to push: ' + imagesToPush.length);
  
  // Push to GitHub
  var pushed = 0;
  var failed = 0;
  
  // Push images first
  for (var j = 0; j < imagesToPush.length; j++) {
    var img = imagesToPush[j];
    Logger.log('Pushing image [' + (j+1) + '/' + imagesToPush.length + ']: ' + img.path);
    
    try {
      pushFileToGitHub_(token, img.path, img.blob.getBytes(), 'Sync image: ' + img.path);
      pushed++;
    } catch (e) {
      Logger.log('Failed to push ' + img.path + ': ' + e.message);
      failed++;
    }
    
    // Rate limit: 0.5s between pushes
    if (j < imagesToPush.length - 1) Utilities.sleep(500);
  }
  
  // Push projects.json
  try {
    var jsonBytes = Utilities.newBlob(projectsJson).getBytes();
    pushFileToGitHub_(token, CONFIG.JSON_PATH, jsonBytes, 'Sync projects.json (' + projects.length + ' projects)');
    pushed++;
    Logger.log('Pushed projects.json successfully');
  } catch (e) {
    Logger.log('Failed to push projects.json: ' + e.message);
    failed++;
  }
  
  // Update Sync Status for all synced rows
  for (var k = 1; k < data.length; k++) {
    var rowProjectName = String(data[k][CONFIG.COL.PROJECT - 1] || '').trim();
    if (!rowProjectName) continue;
    
    var rowSyncStatus = String(data[k][CONFIG.COL.SYNC_STATUS - 1] || '').trim();
    if (!changedOnly || rowSyncStatus === 'Pending' || rowSyncStatus === '') {
      sheet.getRange(k + 1, CONFIG.COL.SYNC_STATUS).setValue('Synced ' + new Date().toLocaleString());
    }
  }
  
  var msg = 'Sync complete!\n\n' +
    '• Projects: ' + projects.length + '\n' +
    '• Images pushed: ' + pushed + '\n' +
    '• Failed: ' + failed + '\n\n' +
    'Website will update in ~1 minute at:\nhttps://cs627.github.io/Firebean-Website/';
  
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch(e) {
    // Running from trigger, no UI available
  }
}

// ─── HELPER FUNCTIONS ──────────────────────────────────────

/**
 * Get GitHub token from Script Properties
 */
function getGitHubToken_() {
  return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
}

/**
 * Extract Google Drive file ID from various URL formats
 */
function extractDriveFileId_(url) {
  if (!url) return '';
  url = String(url).trim();
  
  // Format: https://drive.google.com/file/d/FILE_ID/...
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // Format: https://drive.google.com/thumbnail?id=FILE_ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // If it's just a raw ID (no URL)
  if (url.match(/^[a-zA-Z0-9_-]{10,}$/)) return url;
  
  return '';
}

/**
 * Extract Google Drive folder ID from URL
 */
function extractDriveFolderId_(url) {
  if (!url) return '';
  url = String(url).trim();
  
  // Format: https://drive.google.com/drive/folders/FOLDER_ID
  var match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  if (url.match(/^[a-zA-Z0-9_-]{10,}$/)) return url;
  
  return '';
}

/**
 * Download a Google Drive file as a resized thumbnail (JPEG)
 * Uses the Drive thumbnail API which returns resized images
 */
function downloadDriveThumbnail_(fileId, width) {
  try {
    // Use Drive API to get a resized thumbnail
    var url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + width;
    
    // Need to use OAuth token for private files
    var token = ScriptApp.getOAuthToken();
    var response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    if (response.getResponseCode() !== 200) {
      // Fallback: try direct file download and let Drive resize
      Logger.log('Thumbnail failed for ' + fileId + ', trying direct download...');
      var file = DriveApp.getFileById(fileId);
      return file.getBlob();
    }
    
    return response.getBlob();
  } catch (e) {
    Logger.log('Error downloading ' + fileId + ': ' + e.message);
    // Fallback: direct file blob
    try {
      var file = DriveApp.getFileById(fileId);
      return file.getBlob();
    } catch (e2) {
      Logger.log('Direct download also failed: ' + e2.message);
      return null;
    }
  }
}

/**
 * Push a file to GitHub using the Contents API
 * Handles both create (new file) and update (existing file with SHA)
 */
function pushFileToGitHub_(token, path, contentBytes, message) {
  var apiUrl = 'https://api.github.com/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/contents/' + path;
  
  // Check if file exists to get its SHA
  var sha = null;
  try {
    var checkResponse = UrlFetchApp.fetch(apiUrl + '?ref=' + CONFIG.GITHUB_BRANCH, {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    });
    
    if (checkResponse.getResponseCode() === 200) {
      var existing = JSON.parse(checkResponse.getContentText());
      sha = existing.sha;
    }
  } catch (e) {
    // File doesn't exist yet, that's fine
  }
  
  // Push the file
  var payload = {
    message: message,
    content: Utilities.base64Encode(contentBytes),
    branch: CONFIG.GITHUB_BRANCH
  };
  
  if (sha) {
    payload.sha = sha;
  }
  
  var response = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  var code = response.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub API error ' + code + ': ' + response.getContentText().substring(0, 200));
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Convert category string to URL-friendly filter slugs
 */
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
