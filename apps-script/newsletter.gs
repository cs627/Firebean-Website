/**
 * ============================================================
 * FIREBEAN CMS — newsletter.gs  v6.3
 * ============================================================
 *
 * IMPORTANT: This file does NOT contain a doPost() function.
 * The doPost() router lives in Code.gs and calls:
 *   - handleNewsletter_()   when payload has { email: "..." }
 *   - handleUnsubscribe_()  when payload has { unsubscribe: true }
 *
 * Updated: 2026-07-10 — Added unsubscribe + getActiveSubscribers_
 * ============================================================
 */

var SHEET_NAME_NL           = 'Contacts';
var MAX_ROWS_NL              = 5000;
var RATE_LIMIT_MAX_NL        = 5;
var RATE_LIMIT_WINDOW_MS_NL  = 3600000; // 1 hour

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
 * Called by Code.gs doPost() when payload contains { email: "..." }.
 * Adds the email to the Contacts sheet with status ACTIVE.
 *
 * Contacts sheet columns:
 *   A = Email | B = Name | C = Date Added | D = Source | E = Status | F = Unsubscribed Date
 */
function handleNewsletter_(body) {
  try {
    // Honeypot — if filled, it's a bot
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

    // Duplicate check
    if (lastRow > 1) {
      var existingData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      for (var i = 0; i < existingData.length; i++) {
        if (existingData[i][0].toString().toLowerCase().trim() === email) {
          // If previously unsubscribed, re-activate
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
    // Col A=Email, B=Name, C=Date, D=Source, E=Status, F=Unsubscribed Date
    sheet.appendRow([email, name, dateAdded, 'Website', 'ACTIVE', '']);

    return makeJsonResponse_({ success: true, message: 'subscribed' });

  } catch (err) {
    Logger.log('Newsletter subscribe error: ' + err.message);
    return makeJsonResponse_({ success: false, error: 'server_error' });
  }
}

// ── UNSUBSCRIBE ───────────────────────────────────────────────
/**
 * handleUnsubscribe_
 * Called by Code.gs doPost() when payload contains { unsubscribe: true }.
 * Marks the email UNSUBSCRIBED in the Contacts sheet (col E).
 * Privacy-safe: always returns success even if email not found.
 *
 * @param {Object} body - { email: "user@example.com", unsubscribe: true }
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
            var rowNum = i + 2; // +2: header row + 0-index offset
            sheet.getRange(rowNum, 5).setValue('UNSUBSCRIBED');
            sheet.getRange(rowNum, 6).setValue(new Date().toISOString());
            Logger.log('Unsubscribed: ' + email + ' at row ' + rowNum);
            break;
          }
        }
      }
    }

    // Always return success (privacy best practice — don't reveal if email exists)
    return makeJsonResponse_({ success: true, message: 'unsubscribed' });

  } catch (err) {
    Logger.log('Unsubscribe error: ' + err.message);
    return makeJsonResponse_({ success: true, message: 'unsubscribed' });
  }
}

// ── UTILITY: Get Active Subscribers ───────────────────────────
/**
 * getActiveSubscribers_
 * Returns all email addresses that are NOT unsubscribed.
 * Use this in your EDM blast script to filter the send list.
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
    var status = data[i][4].toString().toUpperCase().trim(); // Col E = Status
    if (email && status !== 'UNSUBSCRIBED') {
      active.push(email);
    }
  }

  return active;
}
