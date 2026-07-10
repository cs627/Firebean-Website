/**
 * ============================================================
 * FIREBEAN — newsletter.gs  v6.3  (FINAL)
 * ============================================================
 * Standalone Web App for newsletter subscribe & unsubscribe.
 * Deploy as: Web App → Execute as: Me → Who has access: Anyone
 *
 * Single source of truth: AI Master DB → "Email list" tab
 *   Spreadsheet: https://docs.google.com/spreadsheets/d/1Ms1Q1i7uJg0ilvW4g1PezBm7mTCNKcYJT_c5-weUBNc
 *
 * "Email list" tab columns:
 *   A = Email | B = Name | C = Date Added | D = Source
 *   E = Status (ACTIVE / UNSUBSCRIBED) | F = Unsubscribed Date
 *
 * Handles two POST request types:
 *   { email: "user@example.com" }              → SUBSCRIBE
 *   { email: "user@example.com",
 *     unsubscribe: true }                       → UNSUBSCRIBE
 *
 * Updated: 2026-07-10
 * ============================================================
 */

// ── Config ────────────────────────────────────────────────────
var SPREADSHEET_ID      = '1Ms1Q1i7uJg0ilvW4g1PezBm7mTCNKcYJT_c5-weUBNc';
var SHEET_NAME_NL       = 'Email list';
var MAX_ROWS_NL         = 5000;
var RATE_LIMIT_MAX_NL   = 5;
var RATE_LIMIT_WINDOW_MS_NL = 3600000; // 1 hour in ms

// ── Shared response helper ────────────────────────────────────
function makeJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet: health check ───────────────────────────────────────
function doGet(e) {
  return makeJsonResponse_({ status: 'ok', service: 'Firebean Newsletter v6.3' });
}

// ── doPost: main router ───────────────────────────────────────
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return makeJsonResponse_({ success: false, error: 'invalid_json' });
  }

  // Route: UNSUBSCRIBE
  if (body.unsubscribe === true) {
    return handleUnsubscribe_(body);
  }

  // Route: SUBSCRIBE
  if (body.email) {
    return handleNewsletter_(body);
  }

  return makeJsonResponse_({ success: false, error: 'unknown_request' });
}

// ── Rate Limiting ─────────────────────────────────────────────
function checkRateLimit_(ip) {
  if (!ip) ip = 'unknown';
  var props = PropertiesService.getScriptProperties();
  var key   = 'rl_' + ip.replace(/[^a-zA-Z0-9.:]/g, '_');
  var now   = Date.now();
  var raw   = props.getProperty(key);
  var data  = raw ? JSON.parse(raw) : { count: 0, windowStart: now };
  if (now - data.windowStart > RATE_LIMIT_WINDOW_MS_NL) {
    data = { count: 0, windowStart: now };
  }
  if (data.count >= RATE_LIMIT_MAX_NL) return false;
  data.count++;
  props.setProperty(key, JSON.stringify(data));
  return true;
}

// ── Validation & Sanitisation ─────────────────────────────────
function isValidEmail_(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  var re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}

function sanitise_(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').substring(0, 200).trim();
}

// ── Helper: open the Email list sheet ────────────────────────
function getEmailSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME_NL);
}

// ── SUBSCRIBE ─────────────────────────────────────────────────
/**
 * handleNewsletter_
 * Adds a new subscriber to the AI Master DB "Email list" tab.
 * If previously unsubscribed, re-activates the row.
 *
 * @param {Object} body  { email, name, _ip, website (honeypot) }
 */
function handleNewsletter_(body) {
  try {
    // Honeypot — bots fill this hidden field
    if (body.website && body.website.length > 0) {
      return makeJsonResponse_({ success: true, message: 'Subscribed' });
    }

    var email = sanitise_(body.email || '').toLowerCase();
    if (!isValidEmail_(email)) {
      return makeJsonResponse_({ success: false, error: 'invalid_email' });
    }

    var ip = body._ip || 'unknown';
    if (!checkRateLimit_(ip)) {
      return makeJsonResponse_({ success: false, error: 'rate_limited' });
    }

    var sheet = getEmailSheet_();
    if (!sheet) {
      return makeJsonResponse_({ success: false, error: 'Sheet not found' });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow >= MAX_ROWS_NL + 1) {
      return makeJsonResponse_({ success: false, error: 'capacity_full' });
    }

    // Duplicate check — re-activate if previously unsubscribed
    if (lastRow > 1) {
      var existingData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      for (var i = 0; i < existingData.length; i++) {
        if (existingData[i][0].toString().toLowerCase().trim() === email) {
          if (existingData[i][4].toString().toUpperCase() === 'UNSUBSCRIBED') {
            sheet.getRange(i + 2, 5).setValue('ACTIVE');
            sheet.getRange(i + 2, 6).setValue('');
            return makeJsonResponse_({ success: true, message: 'resubscribed' });
          }
          return makeJsonResponse_({ success: false, error: 'already_subscribed' });
        }
      }
    }

    var name      = sanitise_(body.name || '');
    var dateAdded = new Date().toISOString();
    // A=Email, B=Name, C=Date Added, D=Source, E=Status, F=Unsubscribed Date
    sheet.appendRow([email, name, dateAdded, 'Website', 'ACTIVE', '']);

    return makeJsonResponse_({ success: true, message: 'subscribed' });

  } catch (err) {
    Logger.log('Subscribe error: ' + err.message);
    return makeJsonResponse_({ success: false, error: 'server_error' });
  }
}

// ── UNSUBSCRIBE ───────────────────────────────────────────────
/**
 * handleUnsubscribe_
 * Marks the email UNSUBSCRIBED in the "Email list" tab (col E).
 * Privacy-safe: always returns success even if email not found.
 *
 * @param {Object} body  { email, unsubscribe: true }
 */
function handleUnsubscribe_(body) {
  try {
    var email = sanitise_(body.email || '').toLowerCase();

    if (isValidEmail_(email)) {
      var sheet = getEmailSheet_();

      if (sheet && sheet.getLastRow() > 1) {
        var lastRow = sheet.getLastRow();
        var emails  = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

        for (var i = 0; i < emails.length; i++) {
          if (emails[i][0].toString().toLowerCase().trim() === email) {
            var rowNum = i + 2; // +2: header row + 0-index
            sheet.getRange(rowNum, 5).setValue('UNSUBSCRIBED');
            sheet.getRange(rowNum, 6).setValue(new Date().toISOString());
            Logger.log('Unsubscribed: ' + email + ' (row ' + rowNum + ')');
            break;
          }
        }
      }
    }

    // Always return success — never reveal whether email existed
    return makeJsonResponse_({ success: true, message: 'unsubscribed' });

  } catch (err) {
    Logger.log('Unsubscribe error: ' + err.message);
    return makeJsonResponse_({ success: true, message: 'unsubscribed' });
  }
}

// ── UTILITY: Get Active Subscribers ───────────────────────────
/**
 * getActiveSubscribers_
 * Returns all emails from "Email list" that are NOT unsubscribed.
 * Use this in your EDM blast script to get the clean send list.
 * Rows with no status (manually added) are treated as ACTIVE.
 *
 * @returns {string[]} Array of active email addresses
 */
function getActiveSubscribers_() {
  var sheet = getEmailSheet_();
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data   = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var active = [];

  for (var i = 0; i < data.length; i++) {
    var email  = data[i][0].toString().toLowerCase().trim();
    var status = data[i][4].toString().toUpperCase().trim();
    if (email && status !== 'UNSUBSCRIBED') {
      active.push(email);
    }
  }

  return active;
}
