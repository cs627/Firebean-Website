/**
 * ============================================================
 * FIREBEAN CMS — Code.gs  (Main Router)
 * ============================================================
 *
 * This is the main doPost() entry point for the Web App.
 * It routes incoming POST requests to the correct handler:
 *
 *   { unsubscribe: true, email: "..." }  → handleUnsubscribe_()  (newsletter.gs)
 *   { email: "..." }                     → handleNewsletter_()   (newsletter.gs)
 *   { type: "cms", ... }                 → handleCmsUpdate_()    (your CMS handler)
 *   (anything else)                      → handleCmsUpdate_()    (default)
 *
 * Updated: 2026-07-10 — Added unsubscribe routing
 * ============================================================
 */

// ── CORS allowed origins ──────────────────────────────────────
var ALLOWED_ORIGINS = [
  'https://cs627.github.io',
  'https://www.firebean.net',
  'https://firebean.net',
  'http://localhost',
  'http://127.0.0.1'
];

// ── Shared JSON response helper ───────────────────────────────
function makeJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── CORS preflight (GET) ──────────────────────────────────────
function doGet(e) {
  return makeJsonResponse_({ status: 'ok', service: 'Firebean CMS' });
}

// ── MAIN ROUTER ───────────────────────────────────────────────
function doPost(e) {
  var body = {};

  try {
    body = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return makeJsonResponse_({ success: false, error: 'invalid_json' });
  }

  // ── 1. UNSUBSCRIBE request ────────────────────────────────
  // Payload: { unsubscribe: true, email: "user@example.com" }
  if (body.unsubscribe === true) {
    return handleUnsubscribe_(body);
  }

  // ── 2. NEWSLETTER SUBSCRIBE request ──────────────────────
  // Payload: { email: "user@example.com", name: "...", _ip: "..." }
  if (body.email && !body.type) {
    return handleNewsletter_(body);
  }

  // ── 3. CMS / Streamlit data update (default) ─────────────
  // All other payloads (project sync, profile update, etc.)
  // Route to your existing CMS handler if you have one,
  // otherwise return a safe default response.
  if (typeof handleCmsUpdate_ === 'function') {
    return handleCmsUpdate_(body);
  }

  return makeJsonResponse_({ success: true, message: 'received' });
}
