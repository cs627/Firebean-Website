/**
 * ============================================================
 * FIREBEAN CMS — SHEET RECEIVER (Streamlit POST Target)  v4.4
 * ============================================================
 *
 * v4.4: Added 3 dedicated FAQ columns (AB=28, AC=29, AD=30)
 *       for faq_en, faq_tc, faq_jp — AI-generated Q&A pairs
 *       stored separately from the website article body.
 * v4.1: Smart Hero Photo picker, Drive folder creation, image upload.
 * v3.0: Initial version.
 *
 * DEPLOYMENT:
 *   Location: Inside the Google Sheet's Apps Script editor
 *   Execute as: Me (dickson@firebean.net)
 *   Access: Anyone
 *   Deployed URL: https://script.google.com/macros/s/AKfycbzaQu2KpJ06I0yWL4dEwk0naB1FOlHkt7Ta340xH84IDwQI7jQNUI3eSmxrwKyQHNj5/exec
 *
 * AFTER UPDATING THIS FILE:
 *   1. Open Google Sheet → Extensions → Apps Script
 *   2. Replace the existing code with this file's contents
 *   3. Click Deploy → Manage Deployments → Edit (pencil icon)
 *   4. Change version to "New version"
 *   5. Click Deploy
 *   6. Copy the new URL and update SHEET_SCRIPT_URL in app.py if changed
 *
 * ============================================================
 */

// ─── COLUMN MAP ────────────────────────────────────────────
// Matches the Google Sheet "Basic Info" tab exactly.
// Update this map whenever columns are added/reordered.
var COL = {
  TIMESTAMP:    1,   // A — Auto-filled on write
  CLIENT:       2,   // B
  PROJECT:      3,   // C
  DATE:         4,   // D
  VENUE:        5,   // E
  CATEGORY:     6,   // F
  WHAT_WE_DO:   7,   // G
  SCOPE:        8,   // H
  YOUTUBE:      9,   // I
  OPEN_QUESTION:10,  // J
  CHALLENGE:    11,  // K
  SOLUTION:     12,  // L
  GOOGLE_SLIDE: 13,  // M
  LINKEDIN:     14,  // N
  FACEBOOK:     15,  // O
  THREADS:      16,  // P
  INSTAGRAM:    17,  // Q
  WEB_EN:       18,  // R
  WEB_TC:       19,  // S
  WEB_JP:       20,  // T
  SYNC_STATUS:  21,  // U
  DRIVE_FOLDER: 22,  // V
  HERO_PHOTO:   23,  // W
  LOGO_BLACK:   24,  // X
  LOGO_WHITE:   25,  // Y
  PROJECT_ID:   26,  // Z
  SORT_DATE:    27,  // AA
  FAQ_EN:       28,  // AB ← NEW v4.4
  FAQ_TC:       29,  // AC ← NEW v4.4
  FAQ_JP:       30   // AD ← NEW v4.4
};

var SHEET_NAME = 'Basic Info';
var DRIVE_ROOT_FOLDER_ID = '1XT6c6zq-ipGN0sFRwpGl2GSVnaGsmSNg';

// ─── CORS HELPER ───────────────────────────────────────────
function makeResponse_(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── ENTRY POINT ───────────────────────────────────────────
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'get_row_count') {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var count = Math.max(0, sheet.getLastRow() - 1); // subtract header
    return ContentService.createTextOutput(String(count))
      .setMimeType(ContentService.MimeType.TEXT);
  }
  return makeResponse_({ error: 'Unknown GET action' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'sync_project';

    if (action === 'get_raw_input_list') {
      return handleGetRawInputList_();
    }
    if (action === 'get_raw_input_details') {
      return handleGetRawInputDetails_(payload.project_id);
    }
    if (action === 'sync_project') {
      return handleSyncProject_(payload);
    }

    return makeResponse_({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return makeResponse_({ success: false, error: err.message });
  }
}

// ─── GET RAW INPUT LIST ────────────────────────────────────
function handleGetRawInputList_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var pid = String(row[COL.PROJECT_ID - 1] || '').trim();
    var pname = String(row[COL.PROJECT - 1] || '').trim();
    var client = String(row[COL.CLIENT - 1] || '').trim();
    if (pid && pname) {
      list.push({ project_id: pid, project_name: pname, client: client });
    }
  }
  return makeResponse_({ success: true, projects: list });
}

// ─── GET RAW INPUT DETAILS ─────────────────────────────────
function handleGetRawInputDetails_(projectId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var pid = String(row[COL.PROJECT_ID - 1] || '').trim();
    if (pid === projectId) {
      return makeResponse_({
        success: true,
        project: {
          project_id:    pid,
          client:        String(row[COL.CLIENT - 1] || ''),
          project_name:  String(row[COL.PROJECT - 1] || ''),
          date:          String(row[COL.DATE - 1] || ''),
          venue:         String(row[COL.VENUE - 1] || ''),
          category:      String(row[COL.CATEGORY - 1] || ''),
          what_we_do:    String(row[COL.WHAT_WE_DO - 1] || ''),
          scope:         String(row[COL.SCOPE - 1] || ''),
          youtube:       String(row[COL.YOUTUBE - 1] || ''),
          open_question: String(row[COL.OPEN_QUESTION - 1] || ''),
          challenge:     String(row[COL.CHALLENGE - 1] || ''),
          solution:      String(row[COL.SOLUTION - 1] || ''),
          google_slide:  String(row[COL.GOOGLE_SLIDE - 1] || ''),
          linkedin:      String(row[COL.LINKEDIN - 1] || ''),
          facebook:      String(row[COL.FACEBOOK - 1] || ''),
          threads:       String(row[COL.THREADS - 1] || ''),
          instagram:     String(row[COL.INSTAGRAM - 1] || ''),
          web_en:        String(row[COL.WEB_EN - 1] || ''),
          web_tc:        String(row[COL.WEB_TC - 1] || ''),
          web_jp:        String(row[COL.WEB_JP - 1] || ''),
          drive_folder:  String(row[COL.DRIVE_FOLDER - 1] || ''),
          hero_photo:    String(row[COL.HERO_PHOTO - 1] || ''),
          logo_black:    String(row[COL.LOGO_BLACK - 1] || ''),
          logo_white:    String(row[COL.LOGO_WHITE - 1] || ''),
          sort_date:     String(row[COL.SORT_DATE - 1] || ''),
          faq_en:        String(row[COL.FAQ_EN - 1] || ''),  // v4.4
          faq_tc:        String(row[COL.FAQ_TC - 1] || ''),  // v4.4
          faq_jp:        String(row[COL.FAQ_JP - 1] || '')   // v4.4
        }
      });
    }
  }
  return makeResponse_({ success: false, error: 'Project not found: ' + projectId });
}

// ─── SYNC PROJECT ──────────────────────────────────────────
function handleSyncProject_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  // ── 1. Create Drive folder ──
  var rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  var projectId  = String(payload.project_id || '').trim();
  var folderName = projectId || (String(payload.project_name || '').trim() + '_' + new Date().getTime());
  var folder;
  try {
    var existing = rootFolder.getFoldersByName(folderName);
    folder = existing.hasNext() ? existing.next() : rootFolder.createFolder(folderName);
  } catch (e) {
    folder = rootFolder.createFolder(folderName);
  }
  var folderUrl = 'https://drive.google.com/drive/folders/' + folder.getId();

  // ── 2. Upload images ──
  var images = payload.images || [];
  var heroFileUrl  = '';
  var heroIdx      = parseInt(payload.hero_photo_index || 0, 10);

  for (var i = 0; i < images.length; i++) {
    var imgData = images[i];
    var base64  = imgData.base64 || imgData;
    var ext     = imgData.ext || 'jpg';
    var prefix  = (i === heroIdx) ? 'Hero_' : ('Gallery_' + String(i).padStart(2, '0') + '_');
    var fname   = prefix + projectId + '.' + ext;

    try {
      var bytes = Utilities.base64Decode(base64);
      var blob  = Utilities.newBlob(bytes, 'image/jpeg', fname);
      var file  = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      if (i === heroIdx) {
        heroFileUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';
      }
    } catch (e) {
      Logger.log('Image upload error [' + i + ']: ' + e.message);
    }
  }

  // ── 3. Upload logos ──
  var logoBlackUrl = uploadLogo_(folder, payload.logo_black, projectId + '_logo_black.png');
  var logoWhiteUrl = uploadLogo_(folder, payload.logo_white, projectId + '_logo_white.png');

  // ── 4. Extract AI content ──
  var ai = payload.ai_content || {};
  var webContent = ai['6_website'] || {};

  // ── 5. Build row (30 columns) ──
  var now = new Date();
  var eventYear  = String(payload.event_year  || now.getFullYear());
  var eventMonth = String(payload.event_month || 'JAN');
  var dateStr    = eventYear + '-' + eventMonth;
  var sortDate   = eventYear + String(monthToNum_(eventMonth)).padStart(2, '0') + '01';

  var row = new Array(COL.FAQ_JP); // 30 elements
  row[COL.TIMESTAMP    - 1] = now.toISOString();
  row[COL.CLIENT       - 1] = String(payload.client_name   || '');
  row[COL.PROJECT      - 1] = String(payload.project_name  || '');
  row[COL.DATE         - 1] = dateStr;
  row[COL.VENUE        - 1] = String(payload.venue         || '');
  row[COL.CATEGORY     - 1] = String(payload.category      || '');
  row[COL.WHAT_WE_DO   - 1] = Array.isArray(payload.what_we_do) ? payload.what_we_do.join(', ') : String(payload.what_we_do || '');
  row[COL.SCOPE        - 1] = Array.isArray(payload.scope)      ? payload.scope.join(', ')      : String(payload.scope      || '');
  row[COL.YOUTUBE      - 1] = String(payload.youtube       || '');
  row[COL.OPEN_QUESTION- 1] = String(payload.open_question || '');
  row[COL.CHALLENGE    - 1] = String(ai.challenge_summary  || payload.challenge || '');
  row[COL.SOLUTION     - 1] = String(ai.solution_summary   || payload.solution  || '');
  row[COL.GOOGLE_SLIDE - 1] = String(ai['1_google_slide']  || '');
  row[COL.LINKEDIN     - 1] = String(ai['5_linkedin_post'] || '');
  row[COL.FACEBOOK     - 1] = String(ai['2_facebook_post'] || '');
  row[COL.THREADS      - 1] = String(ai['3_threads_post']  || '');
  row[COL.INSTAGRAM    - 1] = String(ai['4_instagram_post']|| '');
  row[COL.WEB_EN       - 1] = typeof webContent === 'object' ? String(webContent.en || '') : String(webContent || '');
  row[COL.WEB_TC       - 1] = typeof webContent === 'object' ? String(webContent.tc || '') : '';
  row[COL.WEB_JP       - 1] = typeof webContent === 'object' ? String(webContent.jp || '') : '';
  row[COL.SYNC_STATUS  - 1] = 'Pending (images)';
  row[COL.DRIVE_FOLDER - 1] = folderUrl;
  row[COL.HERO_PHOTO   - 1] = heroFileUrl;
  row[COL.LOGO_BLACK   - 1] = logoBlackUrl;
  row[COL.LOGO_WHITE   - 1] = logoWhiteUrl;
  row[COL.PROJECT_ID   - 1] = projectId;
  row[COL.SORT_DATE    - 1] = sortDate;
  // ── v4.4: Dedicated FAQ columns ──
  var faqData = ai['7_faq'] || {};
  row[COL.FAQ_EN - 1] = String(payload.faq_en || (typeof faqData === 'object' ? faqData.en || '' : '') || '');
  row[COL.FAQ_TC - 1] = String(payload.faq_tc || (typeof faqData === 'object' ? faqData.tc || '' : '') || '');
  row[COL.FAQ_JP - 1] = String(payload.faq_jp || (typeof faqData === 'object' ? faqData.jp || '' : '') || '');

  // ── 6. Check if updating existing row or appending new ──
  var data = sheet.getDataRange().getValues();
  var existingRow = -1;
  if (projectId) {
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][COL.PROJECT_ID - 1] || '').trim() === projectId) {
        existingRow = r + 1; // 1-based sheet row
        break;
      }
    }
  }

  if (existingRow > 0) {
    // Update existing row
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    Logger.log('Updated existing row ' + existingRow + ' for project: ' + projectId);
  } else {
    // Append new row
    sheet.appendRow(row);
    Logger.log('Appended new row for project: ' + projectId);
  }

  return makeResponse_({
    success: true,
    project_id: projectId,
    folder_url: folderUrl,
    hero_url: heroFileUrl,
    message: existingRow > 0 ? 'Updated existing project' : 'New project added'
  });
}

// ─── HELPERS ───────────────────────────────────────────────
function uploadLogo_(folder, base64, filename) {
  if (!base64) return '';
  try {
    var bytes = Utilities.base64Decode(base64);
    var blob  = Utilities.newBlob(bytes, 'image/png', filename);
    var file  = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/file/d/' + file.getId() + '/view';
  } catch (e) {
    Logger.log('Logo upload error: ' + e.message);
    return '';
  }
}

function monthToNum_(month) {
  var map = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
    'MAY': 5, 'JUN': 6, 'JUL': 7, 'AUG': 8,
    'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
  };
  return map[String(month).toUpperCase()] || 1;
}
