/**
 * ============================================================
 * FIREBEAN CMS — newsletter.gs  v6.3
 * ============================================================
 *
 * IMPORTANT: This file NO LONGER contains a doPost() function.
 * The doPost() router now lives in Code.gs and calls:
 *   - handleNewsletter_()   when payload contains "email" (subscribe)
 *   - handleUnsubscribe_()  when payload contains "unsubscribe: true"
 *
 * Updated: 2026-07-10 — Added unsubscribe handler
 * ============================================================
 */

var SHEET_NAME_NL        = 'Contacts';
var MAX_ROWS_NL          = 5000;
var RATE_LIMIT_MAX_NL    = 5;
var RATE_LIMIT_WINDOW_MS_NL = 3600000;

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

/**
 * handleNewsletter_
 * Called by the main doPost() router in Code.gs when the payload
 * contains an "email" field (newsletter subscription request).
 *
 * @param {Object} body - Parsed JSON body from the POST request
 * @returns {TextOutput} JSON response
 */
function handleNewsletter_(body) {
  try {
    // Honeypot check
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

    if (lastRow > 1) {
      var existingEmails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existingEmails.length; i++) {
        if (existingEmails[i][0].toString().toLowerCase().trim() === email) {
          return makeJsonResponse_({ success: false, error: 'already_subscribed' });
        }
      }
    }

    var name      = sanitise_(body.name || '');
    var dateAdded = new Date().toISOString();
    sheet.appendRow([email, name, dateAdded, 'Website', 'ACTIVE', '']);

    return makeJsonResponse_({ success: true, message: 'subscribed' });

  } catch (err) {
    Logger.log('Newsletter error: ' + err.message);
    return makeJsonResponse_({ success: false, error: 'server_error' });
  }
}

/**
 * handleUnsubscribe_
 * Called by the main doPost() router in Code.gs when the payload
 * contains "unsubscribe: true" (unsubscribe request from EDM footer).
 *
 * Marks the email as UNSUBSCRIBED in the Contacts sheet (col 5).
 * Privacy-safe: always returns success even if email not found.
 *
 * @param {Object} body - Parsed JSON body: { email: "...", unsubscribe: true }
 * @returns {TextOutput} JSON response
 */
function handleUnsubscribe_(body) {
  try {
    var email = sanitise_(body.email || '').toLowerCase();
    if (!isValidEmail_(email)) {
      // Still return success for privacy (don't reveal if email exists)
      return makeJsonResponse_({ success: true, message: 'unsubscribed' });
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME_NL);

    if (sheet && sheet.getLastRow() > 1) {
      var lastRow = sheet.getLastRow();
      var data    = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

      for (var i = 0; i < data.length; i++) {
        if (data[i][0].toString().toLowerCase().trim() === email) {
          var rowNum = i + 2; // +2 for header row + 0-index offset
          // Col 5 = Status, Col 6 = Unsubscribed Date
          sheet.getRange(rowNum, 5).setValue('UNSUBSCRIBED');
          sheet.getRange(rowNum, 6).setValue(new Date().toISOString());
          Logger.log('Unsubscribed: ' + email + ' at row ' + rowNum);
          break;
        }
      }
    }

    // Always return success (privacy best practice)
    return makeJsonResponse_({ success: true, message: 'unsubscribed' });

  } catch (err) {
    Logger.log('Unsubscribe error: ' + err.message);
    // Still return success to avoid leaking info
    return makeJsonResponse_({ success: true, message: 'unsubscribed' });
  }
}

/**
 * getActiveSubscribers_
 * Utility: returns all active (non-unsubscribed) email addresses.
 * Use this in your blast script to filter the send list.
 *
 * @returns {Array} Array of active email strings
 */
function getActiveSubscribers_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_NL);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data   = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var active = [];

  for (var i = 0; i < data.length; i++) {
    var email  = data[i][0].toString().toLowerCase().trim();
    var status = data[i][4].toString().toUpperCase().trim(); // Col 5 = Status
    if (email && status !== 'UNSUBSCRIBED') {
      active.push(email);
    }
  }

  return active;
}
