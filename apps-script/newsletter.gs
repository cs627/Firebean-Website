/**
 * ============================================================
 * FIREBEAN — newsletter.gs  v6.3
 * ============================================================
 * Standalone Web App for newsletter subscribe & unsubscribe.
 * Deploy as: Web App → Execute as: Me → Who has access: Anyone
 *
 * Handles two types of POST requests:
 *   { email: "user@example.com" }              → SUBSCRIBE
 *   { email: "user@example.com",
 *     unsubscribe: true }                       → UNSUBSCRIBE
 *
 * Contacts sheet columns:
 *   A = Email | B = Name | C = Date Added | D = Source
 *   E = Status (ACTIVE / UNSUBSCRIBED) | F = Unsubscribed Date
 *
 * Updated: 2026-07-10 — Added unsubscribe + getActiveSubscribers_
 * ============================================================
 */

var SHEET_NAME_NL           = 'Contacts';
var MAX_ROWS_NL              = 5000;
var RATE_LIMIT_MAX_NL        = 5;
var RATE_LIMIT_WINDOW_MS_NL  = 3600000; // 1 hour in ms

var ALLOWED_ORIGINS_NL = [
  'https://cs627.github.io',
  'https://www.firebean.net',
  'https://firebean.net',
  'http://localhost',
  'http://127.0.0.1'
];

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

// ── SUBSCRIBE ─────────────────────────────────────────────────
/**
 * handleNewsletter_
 * Adds a new subscriber to the Contacts sheet.
 * If the email was previously unsubscribed, it is re-activated.
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

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_NL);
    if (!sheet) {
      return makeJsonResponse_({ success: false, error: 'Sheet not found' });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow >= MAX_ROWS_NL + 1) {
      return makeJsonResponse_({ success: false, error: 'capacity_full' });
    }

    // Duplicate check — also handles re-subscribe after unsubscribe
    if (lastRow > 1) {
      var existingData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      for (var i = 0; i < existingData.length; i++) {
        if (existingData[i][0].toString().toLowerCase().trim() === email) {
          // Was previously unsubscribed → re-activate
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
 * Marks the email as UNSUBSCRIBED in the Contacts sheet.
 * Privacy-safe: always returns success even if email not found.
 *
 * @param {Object} body  { email, unsubscribe: true }
 */
function handleUnsubscribe_(body) {
  try {
    var email = sanitise_(body.email || '').toLowerCase();

    if (isValidEmail_(email)) {
      var ss    = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME_NL);

      if (sheet && sheet.getLastRow() > 1) {
        var lastRow = sheet.getLastRow();
        var emails  = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

        for (var i = 0; i < emails.length; i++) {
          if (emails[i][0].toString().toLowerCase().trim() === email) {
            var rowNum = i + 2; // +2: skip header + 0-index
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

// ── UTILITY: Active Subscribers ───────────────────────────────
/**
 * getActiveSubscribers_
 * Returns all email addresses that are NOT unsubscribed.
 * Use this in your EDM blast script to get the clean send list.
 *
 * @returns {string[]} Array of active email addresses
 */
function getActiveSubscribers_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_NL);
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
