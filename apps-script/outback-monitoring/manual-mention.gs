/**
 * ============================================================
 * Outback HK Monitoring — manual-mention.gs
 * ============================================================
 * auto_fetch  : fetch page metadata (title / summary / source) — read only.
 * manual_mention : append a "pending review" row to the Google Sheet.
 * ============================================================
 */

/** GET metadata for a URL without writing anything. */
function handleAutoFetch_(body) {
  var url = String(body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return makeJsonResponse_({ success: false, error: 'invalid_url' });
  }
  var meta = fetchPageMetadata_(url);
  return makeJsonResponse_({
    success: true,
    detected: {
      title: meta.title,
      summary: meta.description,
      source: meta.source || detectSource_(url)
    }
  });
}

/** Fetch metadata + append a manual mention row to the sheet. */
function handleManualMention_(body) {
  var url = String(body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return makeJsonResponse_({ success: false, error: 'invalid_url' });
  }

  var meta    = fetchPageMetadata_(url);
  var title   = String(body.title   || meta.title       || '').trim();
  var summary = String(body.summary || meta.description || '').trim();
  var source  = String(body.source  || meta.source || detectSource_(url)).trim();
  var published = normalizeDate_(body.published_date);
  var sentiment = normalizeSentiment_(body.sentiment);

  // require at least a title — otherwise it can't be verified later
  if (!title) {
    return makeJsonResponse_({
      success: false,
      error: 'no_title',
      message: '無法自動取得標題，請手動填寫 Title 欄後再提交。'
    });
  }

  var now = new Date();
  var fmt = function (p) { return Utilities.formatDate(now, 'Asia/Hong_Kong', p); };
  var row = [
    fmt('yyyy-MM-dd'),          // 日期
    fmt('HH:mm'),               // 時間
    source,                     // 來源
    '手動提交',                  // 平台類型
    title,                      // 標題
    summary,                    // 摘要
    url,                        // 連結
    '',                         // 匹配關鍵字
    sentiment,                  // 情緒
    '',                         // 新活動
    fmt('yyyy-MM-dd HH:mm:ss'), // 收集時間
    'manual · pending review'   // 備註
  ];

  var ss = SpreadsheetApp.openById(getSheetId_());
  var sheet = ss.getSheetByName(MONITOR_TAB);
  if (!sheet) sheet = ss.insertSheet(MONITOR_TAB);
  sheet.appendRow(row);

  return makeJsonResponse_({
    success: true,
    detected: { title: title, summary: summary, source: source, published_date: published, sentiment: sentiment },
    note: 'added as pending review — merge into verified dataset after review'
  });
}

function getSheetId_() {
  var p = PropertiesService.getScriptProperties().getProperty('MONITOR_SHEET_ID');
  return p || MONITOR_SHEET_ID_DEFAULT;
}

/** Fetch page HTML and pull title / description from <head> meta tags. */
function fetchPageMetadata_(url) {
  var out = { title: '', description: '', source: '' };
  try {
    var resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FirebeanMonitoring/1.0; +https://firebean.net)' }
    });
    if (resp.getResponseCode() >= 400) return out;
    var html = resp.getContentText('UTF-8');

    var ogt = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)
           || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html);
    if (ogt) out.title = ogt[1];
    if (!out.title) {
      var t = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
      if (t) out.title = t[1];
    }

    var ogd = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html)
           || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i.exec(html);
    if (ogd) out.description = ogd[1];
    if (!out.description) {
      var d = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)
           || /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(html);
      if (d) out.description = d[1];
    }

    out.source = detectSource_(url);
    out.title = decodeEntities_(out.title);
    out.description = decodeEntities_(out.description);
  } catch (err) {
    // leave empty — caller decides how to proceed
  }
  return out;
}

/** Map hostname → friendly source name. */
function detectSource_(url) {
  var m = /^https?:\/\/(?:www\.)?([^\/]+)/i.exec(url);
  var host = m ? m[1].toLowerCase() : '';
  var map = {
    'threads.net': 'Threads', 'instagram.com': 'Instagram',
    'facebook.com': 'Facebook', 'fb.com': 'Facebook',
    'linkedin.com': 'LinkedIn', 'youtube.com': 'YouTube',
    'youtu.be': 'YouTube', 'openrice.com': 'OpenRice',
    'xiaohongshu.com': '小紅書', 'tripadvisor': 'TripAdvisor',
    'maps.google': 'Google Maps', 'google.com/maps': 'Google Maps',
    'scmp.com': 'SCMP', 'hk01.com': '香港01', 'mingpao.com': '明報',
    'hket.com': '香港經濟日報', 'am730.com.hk': 'am730',
    'skypost.ulifestyle': '晴報', 'topick.hket.com': 'TOPick',
    'thestandard.com.hk': 'The Standard', 'std.stheadline.com': '星島日報',
    'orientaldaily': '東方日報', 'wenweipo.com': '文匯報',
    'ta Kung pao': '大公報', 'ta kung pao': '大公報',
    'hkej.com': '信報', 'hk.carousell.com': 'Carousell',
    'lihkg.com': 'LIHKG', 'discuss.com.hk': '香港討論區',
    'ulifestyle.com.hk': 'U Lifestyle', 'gotrip.hk': 'GOtrip',
    'timeout.com.hk': 'Time Out HK', 'weekendhk.com': '新假期'
  };
  for (var k in map) {
    if (host.indexOf(k) >= 0) return map[k];
  }
  return host.replace(/^www\./, '').split('.')[0] || 'Unknown';
}

function normalizeDate_(v) {
  v = String(v || '').trim();
  if (!v) return '';
  // dd/mm/yyyy → yyyy-mm-dd
  var dm = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/.exec(v);
  if (dm) {
    return dm[3] + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[1]).slice(-2);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return v;
}

function normalizeSentiment_(v) {
  v = String(v || '').trim();
  if (/正面|positive/i.test(v)) return '正面';
  if (/負面|negative/i.test(v)) return '負面';
  if (/中性|neutral/i.test(v)) return '中性';
  return '';
}

function decodeEntities_(s) {
  if (!s) return '';
  return s
    .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
