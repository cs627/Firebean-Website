/**
 * ============================================================
 * Outback HK Monitoring — ai-analysis.gs
 * ============================================================
 * ai_analysis : call OpenRouter with the selected date + records,
 *               generate a client-ready PR insight report (繁體中文).
 * ============================================================
 */

function handleAiAnalysis_(body) {
  var records = body.records || [];
  var from = String(body.from || '');
  var to   = String(body.to || '');

  if (!records.length) {
    return makeJsonResponse_({ success: false, error: 'no_records', message: '所選日期範圍沒有可分析的記錄。' });
  }

  var prompt = buildAiPrompt_(records, from, to);
  var report = callOpenRouter_(prompt);
  return makeJsonResponse_({ success: true, report: report });
}

function buildAiPrompt_(records, from, to) {
  var lines = [];
  records.forEach(function (r, i) {
    lines.push(
      (i + 1) + '. [' + (r.date || '') + '] ' +
      '來源=' + (r.source || '') +
      ' | 情緒=' + (r.sentiment || r.sentiment_label || '') +
      ' | 標題=' + (r.title || '') +
      ' | 摘要=' + (String(r.summary || '').slice(0, 200))
    );
  });
  var sample = lines.slice(0, 200).join('\n');

  return [
    '你係一間香港公關公司嘅資深公關顧問。',
    '以下係品牌「Outback Steakhouse 香港（澳美客）」喺 ' + from + ' 至 ' + to + ' 嘅社交聆聽記錄（共 ' + records.length + ' 條，只列頭 200 條）：',
    '',
    sample,
    '',
    '請用繁體中文，生成一份俾客戶睇嘅「公關洞察報告（PR Insight Report）」，結構如下：',
    '1. 總覽 — 一句話講清呢段時間嘅聲量同整體氣氛。',
    '2. 情緒分佈 — 正面／中性／負面各佔幾多（可用估計比例，但要標明係估算），同趨勢。',
    '3. 主要話題 — 歸納 3-5 個最常被討論嘅主題，各配一至兩句說明。',
    '4. 值得注意嘅聲音 — 揀 2-3 條最有代表性（尤其係負面或高觸達）嘅記錄，說明點解值得留意。',
    '5. 公關建議 — 3-4 條具體、可執行嘅下一步行動。',
    '要求：語氣專業、直接、務實；唔好虛構任何記錄以外嘅事實；如果記錄太少就如實講數據有限。',
    '直接輸出報告正文，唔好加任何前置說明。'
  ].join('\n');
}

function callOpenRouter_(prompt) {
  var key = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!key) {
    throw new Error('Missing OPENROUTER_API_KEY in Script Properties');
  }

  var payload = {
    model: OPENROUTER_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 1800
  };

  var resp = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText('UTF-8') || '{}');

  if (code >= 400) {
    var msg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + code);
    throw new Error('OpenRouter error: ' + msg);
  }
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenRouter returned no choices');
  }
  return data.choices[0].message.content;
}
