/**
 * ============================================================
 * FIREBEAN CMS — SHEET RECEIVER (Streamlit POST Target)  v5.0
 * ============================================================
 *
 * v5.0: Folder Persistence & Smart URL Reuse
 *       - Detects existing Drive URLs for logos and hero photos
 *       - Skips re-uploading if data is already a valid URL
 *       - Preserves folder structure for project regenerations
 * v4.4: Added 3 dedicated FAQ columns (AB=28, AC=29, AD=30)
 * v4.1: Smart Hero Photo picker, Drive folder creation, image upload.
 * v3.0: Initial version.
 *
 * DEPLOYMENT:
 *   Location: Inside the Google Sheet's Apps Script editor
 *   Execute as: Me (dickson@firebean.net)
 *   Access: Anyone
 *   Deployed URL: https://script.google.com/macros/s/AKfycbzaQu2KpJ06I0yWL4dEwk0naB1FOlHkt7Ta340xH84IDwQI7jQNUI3eSmxrwKyQHNj5/exec
 *
 * ============================================================
 */

// ─── COLUMN MAP ────────────────────────────────────────────
var COL = {
  TIMESTAMP:    1,   // A
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
  FAQ_EN:       28,  // AB
  FAQ_TC:       29,  // AC
  FAQ_JP:       30   // AD
};

var SHEET_NAME = 'Basic Info';
var DRIVE_ROOT_FOLDER_ID = '1XT6c6zq-ipGN0sFRwpGl2GSVnaGsmSNg';

// ─── CORS HELPER ───────────────────────────────────────────
function makeResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── ENTRY POINT ───────────────────────────────────────────
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'get_row_count') {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var count = Math.max(0, sheet.getLastRow() - 1);
    return ContentService.createTextOutput(String(count)).setMimeType(ContentService.MimeType.TEXT);
  }
  return makeResponse_({ error: 'Unknown GET action' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'sync_project';

    if (action === 'get_raw_input_list') return handleGetRawInputList_();
    if (action === 'get_raw_input_details') return handleGetRawInputDetails_(payload.project_id);
    if (action === 'sync_project') return handleSyncProject_(payload);

    return makeResponse_({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return makeResponse_({ success: false, error: err.message });
  }
}

function handleGetRawInputList_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var pid = String(row[COL.PROJECT_ID - 1] || '').trim();
    var pname = String(row[COL.PROJECT - 1] || '').trim();
    var client = String(row[COL.CLIENT - 1] || '').trim();
    if (pid && pname) list.push({ project_id: pid, project_name: pname, client: client });
  }
  return makeResponse_({ success: true, projects: list });
}

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
          project_id: pid,
          client: String(row[COL.CLIENT - 1] || ''),
          project_name: String(row[COL.PROJECT - 1] || ''),
          date: String(row[COL.DATE - 1] || ''),
          venue: String(row[COL.VENUE - 1] || ''),
          category: String(row[COL.CATEGORY - 1] || ''),
          what_we_do: String(row[COL.WHAT_WE_DO - 1] || ''),
          scope: String(row[COL.SCOPE - 1] || ''),
          youtube: String(row[COL.YOUTUBE - 1] || ''),
          open_question: String(row[COL.OPEN_QUESTION - 1] || ''),
          challenge: String(row[COL.CHALLENGE - 1] || ''),
          solution: String(row[COL.SOLUTION - 1] || ''),
          google_slide: String(row[COL.GOOGLE_SLIDE - 1] || ''),
          linkedin: String(row[COL.LINKEDIN - 1] || ''),
          facebook: String(row[COL.FACEBOOK - 1] || ''),
          threads: String(row[COL.THREADS - 1] || ''),
          instagram: String(row[COL.INSTAGRAM - 1] || ''),
          web_en: String(row[COL.WEB_EN - 1] || ''),
          web_tc: String(row[COL.WEB_TC - 1] || ''),
          web_jp: String(row[COL.WEB_JP - 1] || ''),
          drive_folder: String(row[COL.DRIVE_FOLDER - 1] || ''),
          hero_photo: String(row[COL.HERO_PHOTO - 1] || ''),
          logo_black: String(row[COL.LOGO_BLACK - 1] || ''),
          logo_white: String(row[COL.LOGO_WHITE - 1] || ''),
          sort_date: String(row[COL.SORT_DATE - 1] || ''),
          faq_en: String(row[COL.FAQ_EN - 1] || ''),
          faq_tc: String(row[COL.FAQ_TC - 1] || ''),
          faq_jp: String(row[COL.FAQ_JP - 1] || '')
        }
      });
    }
  }
  return makeResponse_({ success: false, error: 'Project not found: ' + projectId });
}

function handleSyncProject_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var projectId = String(payload.project_id || '').trim();

  // ── 1. Handle Drive Folder (Reuse if URL provided) ──
  var folder;
  var folderUrl = String(payload.drive_folder || '').trim();
  if (folderUrl.indexOf('http') === 0) {
    try {
      var folderId = folderUrl.split('/folders/')[1].split('?')[0];
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = getOrCreateFolder_(projectId, payload.project_name);
    }
  } else {
    folder = getOrCreateFolder_(projectId, payload.project_name);
  }
  folderUrl = 'https://drive.google.com/drive/folders/' + folder.getId();

  // ── 2. Handle Images (Reuse or Upload) ──
  var heroFileUrl = String(payload.hero_photo || '').trim();
  var images = payload.images || [];
  var heroIdx = parseInt(payload.hero_photo_index || 0, 10);

  // Only upload if images are provided (not just URLs)
  for (var i = 0; i < images.length; i++) {
    var imgData = images[i];
    var base64 = imgData.base64 || imgData;
    if (base64.indexOf('http') === 0) continue; // Skip if already a URL

    try {
      var bytes = Utilities.base64Decode(base64);
      var blob = Utilities.newBlob(bytes, 'image/jpeg', ((i === heroIdx) ? 'Hero_' : 'Gallery_') + projectId + '_' + i + '.jpg');
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      if (i === heroIdx) heroFileUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    } catch (e) {
      Logger.log('Upload error: ' + e.message);
    }
  }

  // ── 3. Handle Logos (Reuse or Upload) ──
  var logoBlackUrl = handleAsset_(folder, payload.logo_black, projectId + '_logo_black.png');
  var logoWhiteUrl = handleAsset_(folder, payload.logo_white, projectId + '_logo_white.png');

  // ── 4. Build Row Data ──
  var ai = payload.ai_content || {};
  var webContent = ai['6_website'] || {};
  var now = new Date();
  var eventYear = String(payload.event_year || now.getFullYear());
  var eventMonth = String(payload.event_month || 'JAN');
  var sortDate = eventYear + String(monthToNum_(eventMonth)).padStart(2, '0') + '01';

  var row = new Array(COL.FAQ_JP);
  row[COL.TIMESTAMP - 1] = now.toISOString();
  row[COL.CLIENT - 1] = String(payload.client_name || '');
  row[COL.PROJECT - 1] = String(payload.project_name || '');
  row[COL.DATE - 1] = eventYear + '-' + eventMonth;
  row[COL.VENUE - 1] = String(payload.venue || '');
  row[COL.CATEGORY - 1] = String(payload.category || '');
  row[COL.WHAT_WE_DO - 1] = Array.isArray(payload.what_we_do) ? payload.what_we_do.join(', ') : String(payload.what_we_do || '');
  row[COL.SCOPE - 1] = Array.isArray(payload.scope) ? payload.scope.join(', ') : String(payload.scope || '');
  row[COL.YOUTUBE - 1] = String(payload.youtube || '');
  row[COL.OPEN_QUESTION - 1] = String(payload.open_question || '');
  row[COL.CHALLENGE - 1] = String(ai.challenge_summary || payload.challenge || '');
  row[COL.SOLUTION - 1] = String(ai.solution_summary || payload.solution || '');
  row[COL.GOOGLE_SLIDE - 1] = String(ai['1_google_slide'] || '');
  row[COL.LINKEDIN - 1] = String(ai['5_linkedin_post'] || '');
  row[COL.FACEBOOK - 1] = String(ai['2_facebook_post'] || '');
  row[COL.THREADS - 1] = String(ai['3_threads_post'] || '');
  row[COL.INSTAGRAM - 1] = String(ai['4_instagram_post'] || '');
  row[COL.WEB_EN - 1] = typeof webContent === 'object' ? String(webContent.en || '') : String(webContent || '');
  row[COL.WEB_TC - 1] = typeof webContent === 'object' ? String(webContent.tc || '') : '';
  row[COL.WEB_JP - 1] = typeof webContent === 'object' ? String(webContent.jp || '') : '';
  row[COL.SYNC_STATUS - 1] = 'Pending';
  row[COL.DRIVE_FOLDER - 1] = folderUrl;
  row[COL.HERO_PHOTO - 1] = heroFileUrl;
  row[COL.LOGO_BLACK - 1] = logoBlackUrl;
  row[COL.LOGO_WHITE - 1] = logoWhiteUrl;
  row[COL.PROJECT_ID - 1] = projectId;
  row[COL.SORT_DATE - 1] = sortDate;
  
  var faqData = ai['7_faq'] || {};
  row[COL.FAQ_EN - 1] = String(payload.faq_en || (typeof faqData === 'object' ? faqData.en || '' : '') || '');
  row[COL.FAQ_TC - 1] = String(payload.faq_tc || (typeof faqData === 'object' ? faqData.tc || '' : '') || '');
  row[COL.FAQ_JP - 1] = String(payload.faq_jp || (typeof faqData === 'object' ? faqData.jp || '' : '') || '');

  // ── 5. Write to Sheet ──
  var data = sheet.getDataRange().getValues();
  var existingRow = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][COL.PROJECT_ID - 1] || '').trim() === projectId) {
      existingRow = r + 1;
      break;
    }
  }

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return makeResponse_({ success: true, project_id: projectId, folder_url: folderUrl, message: existingRow > 0 ? 'Updated' : 'Added' });
}

function getOrCreateFolder_(projectId, projectName) {
  var root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  var name = projectId || (projectName + '_' + new Date().getTime());
  var existing = root.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : root.createFolder(name);
}

function handleAsset_(folder, data, filename) {
  var val = String(data || '').trim();
  if (!val) return '';
  if (val.indexOf('http') === 0) return val; // Reuse existing URL
  try {
    var bytes = Utilities.base64Decode(val);
    var blob = Utilities.newBlob(bytes, 'image/png', filename);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/file/d/' + file.getId() + '/view';
  } catch (e) {
    return '';
  }
}

function monthToNum_(m) {
  var map = {'JAN':1,'FEB':2,'MAR':3,'APR':4,'MAY':5,'JUN':6,'JUL':7,'AUG':8,'SEP':9,'OCT':10,'NOV':11,'DEC':12};
  return map[String(m).toUpperCase()] || 1;
}
