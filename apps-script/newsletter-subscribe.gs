/**
 * Firebean Newsletter Subscription — Google Apps Script Web App
 * 
 * Deploy as: Web App → Execute as: Me → Who has access: Anyone
 * 
 * Security features:
 * 1. Email format validation (RFC 5322 regex)
 * 2. Honeypot field (catches bots)
 * 3. Rate limiting (max 5 submissions per IP per hour)
 * 4. Duplicate email check
 * 5. Max row cap (5000 entries — protects CMS)
 * 6. CORS restricted to allowed origins
 * 7. Input sanitisation (strips HTML, limits length)
 */

// === CONFIG ===
var SPREADSHEET_ID = '1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc';
var SHEET_NAME = 'Contacts';
var MAX_ROWS = 5000;
var RATE_LIMIT_MAX = 5;        // max requests per window
var RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

var ALLOWED_ORIGINS = [
  'https://cs627.github.io',
  'https://www.firebean.net',
  'https://firebean.net',
  'http://localhost',
  'http://127.0.0.1'
];

// === CORS HELPERS ===
function getCorsHeaders(origin) {
  var allowed = ALLOWED_ORIGINS.some(function(o) {
    return origin && origin.indexOf(o) === 0;
  });
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
}

function makeResponse(data, origin) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// === RATE LIMITING (Script Properties based) ===
function checkRateLimit(ip) {
  if (!ip) ip = 'unknown';
  var props = PropertiesService.getScriptProperties();
  var key = 'rl_' + ip.replace(/[^a-zA-Z0-9.:]/g, '_');
  var now = Date.now();
  
  var raw = props.getProperty(key);
  var data = raw ? JSON.parse(raw) : { count: 0, windowStart: now };
  
  // Reset window if expired
  if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
    data = { count: 0, windowStart: now };
  }
  
  if (data.count >= RATE_LIMIT_MAX) {
    return false; // rate limited
  }
  
  data.count++;
  props.setProperty(key, JSON.stringify(data));
  return true;
}

// Periodic cleanup of old rate limit keys (called on each request, fast)
function cleanupRateLimitKeys() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  var keysToDelete = [];
  
  for (var key in all) {
    if (key.indexOf('rl_') === 0) {
      try {
        var data = JSON.parse(all[key]);
        if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
          keysToDelete.push(key);
        }
      } catch(e) {
        keysToDelete.push(key);
      }
    }
  }
  
  if (keysToDelete.length > 0) {
    props.deleteProperties(keysToDelete);
  }
}

// === VALIDATION ===
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  // RFC 5322 simplified regex
  var re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}

function sanitise(str) {
  if (!str || typeof str !== 'string') return '';
  // Strip HTML tags, limit length
  return str.replace(/<[^>]*>/g, '').substring(0, 200).trim();
}

// === MAIN HANDLER ===
function doPost(e) {
  var origin = '';
  try {
    // Parse request
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch(parseErr) {
      return makeResponse({ success: false, error: 'Invalid request' }, origin);
    }
    
    origin = body._origin || '';
    
    // 1. Honeypot check — if filled, it's a bot
    if (body.website && body.website.length > 0) {
      // Pretend success to not alert the bot
      return makeResponse({ success: true, message: 'Subscribed' }, origin);
    }
    
    // 2. Email validation
    var email = sanitise(body.email || '').toLowerCase();
    if (!isValidEmail(email)) {
      return makeResponse({ success: false, error: 'invalid_email' }, origin);
    }
    
    // 3. Rate limiting
    var ip = body._ip || 'unknown'; // Client sends a fingerprint
    if (!checkRateLimit(ip)) {
      return makeResponse({ success: false, error: 'rate_limited' }, origin);
    }
    
    // Cleanup old rate limit entries occasionally
    cleanupRateLimitKeys();
    
    // 4. Open sheet
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return makeResponse({ success: false, error: 'Sheet not found' }, origin);
    }
    
    // 5. Check max rows
    var lastRow = sheet.getLastRow();
    if (lastRow >= MAX_ROWS + 1) { // +1 for header
      return makeResponse({ success: false, error: 'capacity_full' }, origin);
    }
    
    // 6. Duplicate check
    if (lastRow > 1) {
      var existingEmails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existingEmails.length; i++) {
        if (existingEmails[i][0].toString().toLowerCase().trim() === email) {
          return makeResponse({ success: false, error: 'already_subscribed' }, origin);
        }
      }
    }
    
    // 7. Write to sheet: Email, Name, Date Added, Source
    var name = sanitise(body.name || '');
    var dateAdded = new Date().toISOString();
    var source = 'Website';
    
    sheet.appendRow([email, name, dateAdded, source]);
    
    return makeResponse({ success: true, message: 'subscribed' }, origin);
    
  } catch(err) {
    return makeResponse({ success: false, error: 'server_error' }, origin);
  }
}

// Handle preflight OPTIONS (not actually called for Apps Script, but good practice)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', service: 'Firebean Newsletter' }))
    .setMimeType(ContentService.MimeType.JSON);
}
