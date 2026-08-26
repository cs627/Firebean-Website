/**
 * ============================================================
 * Outback HK Monitoring — Apps Script Backend  (Code.gs)
 * ============================================================
 *
 * Manual mention submission + AI PR-insight analysis.
 *
 * Deploy:  Web App → Execute as: Me → Who has access: Anyone
 *
 * Script Properties (required):
 *   OPENROUTER_API_KEY  — OpenRouter API key (for AI analysis)
 *   MONITOR_SHEET_ID    — optional; defaults to the Outback sheet
 *
 * Endpoints (POST JSON):
 *   { type: "auto_fetch", url }
 *     → fetch page metadata (title / summary / source) WITHOUT writing
 *   { type: "manual_mention", url, title, summary, published_date, sentiment }
 *     → append a "pending review" row to the Google Sheet
 *   { type: "ai_analysis", records:[...], from, to }
 *     → call OpenRouter and return a PR insight report (繁體中文)
 * ============================================================
 */

var MONITOR_SHEET_ID_DEFAULT = '1uj_3EYaeJFcIYOXJhECJXzmFb3643issOrKIB4WTSe4';
var MONITOR_TAB            = 'Social Listening Data';
var OPENROUTER_MODEL       = 'deepseek/deepseek-chat';

function makeJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return makeJsonResponse_({ status: 'ok', service: 'Outback Monitoring backend' });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return makeJsonResponse_({ success: false, error: 'invalid_json' });
  }

  try {
    if (body.type === 'auto_fetch')     return handleAutoFetch_(body);
    if (body.type === 'manual_mention') return handleManualMention_(body);
    if (body.type === 'ai_analysis')    return handleAiAnalysis_(body);
    return makeJsonResponse_({ success: false, error: 'unknown_type' });
  } catch (err) {
    return makeJsonResponse_({ success: false, error: String((err && err.message) || err) });
  }
}
