/**
 * Firebean Newsletter Unsubscribe — Google Apps Script Web App
 *
 * Deploy as: Web App → Execute as: Me → Who has access: Anyone
 * Endpoint: https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
 *
 * How it works:
 * 1. GET  ?email=xxx  → Show unsubscribe confirmation page (HTML)
 * 2. POST {email}     → Mark email as unsubscribed in Contacts sheet
 *
 * The Contacts sheet gets a new column "Status" (col 5).
 * Unsubscribed rows are marked "UNSUBSCRIBED" so blast scripts can filter them out.
 */

var SPREADSHEET_ID = '1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc';
var SHEET_NAME = 'Contacts';

// === VALIDATION ===
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  var re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}

// === GET: Serve the unsubscribe confirmation page ===
function doGet(e) {
  var email = e.parameter.email || '';
  var decoded = decodeURIComponent(email).toLowerCase().trim();

  var html = '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Unsubscribe — Firebean 公關市場解碼</title>' +
    '<style>' +
    'body{margin:0;padding:0;background:#EBEBEB;font-family:"Helvetica Neue",Arial,sans-serif;}' +
    '.wrap{max-width:520px;margin:60px auto;background:#fff;border:1px solid #E0E0E0;padding:40px 36px;}' +
    '.logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;}' +
    '.logo img{width:32px;height:32px;}' +
    '.logo span{font-size:16px;font-weight:300;color:#111;letter-spacing:0.2em;}' +
    'h1{font-size:20px;font-weight:900;color:#111;margin:0 0 10px;}' +
    'p{font-size:13px;color:#555;line-height:1.7;margin:0 0 20px;}' +
    '.email-box{background:#F8F8F6;border-left:3px solid #E8291C;padding:12px 16px;font-size:13px;color:#333;margin-bottom:24px;word-break:break-all;}' +
    '.btn{display:inline-block;background:#E8291C;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:12px 28px;text-decoration:none;border:none;cursor:pointer;font-family:"Helvetica Neue",Arial,sans-serif;}' +
    '.btn:hover{background:#c0201a;}' +
    '.cancel{display:block;margin-top:14px;font-size:11px;color:#999;text-align:center;}' +
    '.cancel a{color:#999;}' +
    '.success{background:#F0FFF4;border-left:3px solid #22C55E;padding:16px;font-size:13px;color:#166534;}' +
    '.error{background:#FFF0F0;border-left:3px solid #E8291C;padding:16px;font-size:13px;color:#991B1B;}' +
    '</style></head><body>' +
    '<div class="wrap">' +
    '<div class="logo">' +
    '<img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663437368766/OXsmmaNIDdCdSALu.png" alt="Firebean">' +
    '<span>FIREBEAN</span>' +
    '</div>';

  if (!decoded || !isValidEmail(decoded)) {
    html += '<h1>Unsubscribe from 公關市場解碼</h1>' +
      '<p>Enter your email address below to unsubscribe from the Firebean newsletter.</p>' +
      '<form method="POST" action="">' +
      '<input type="email" name="email" placeholder="your@email.com" required ' +
      'style="width:100%;padding:10px 12px;font-size:13px;border:1px solid #E0E0E0;margin-bottom:16px;box-sizing:border-box;">' +
      '<button type="submit" class="btn">Unsubscribe</button>' +
      '</form>' +
      '<p class="cancel"><a href="https://firebean.net">← Back to firebean.net</a></p>';
  } else {
    html += '<h1>Confirm Unsubscribe</h1>' +
      '<p>You are about to unsubscribe the following email from <strong>公關市場解碼</strong>:</p>' +
      '<div class="email-box">' + decoded + '</div>' +
      '<p>You will no longer receive our weekly PR market insights newsletter.</p>' +
      '<form method="POST" action="">' +
      '<input type="hidden" name="email" value="' + decoded + '">' +
      '<button type="submit" class="btn">Confirm Unsubscribe</button>' +
      '</form>' +
      '<p class="cancel"><a href="https://firebean.net">← Keep me subscribed</a></p>';
  }

  html += '</div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Unsubscribe — Firebean')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// === POST: Process the unsubscribe ===
function doPost(e) {
  var email = '';
  try {
    // Handle both form POST and JSON POST
    if (e.postData && e.postData.type === 'application/json') {
      var body = JSON.parse(e.postData.contents);
      email = (body.email || '').toLowerCase().trim();
    } else {
      email = (e.parameter.email || '').toLowerCase().trim();
    }

    email = decodeURIComponent(email);

    var html = '<!DOCTYPE html><html lang="en"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Unsubscribed — Firebean</title>' +
      '<style>' +
      'body{margin:0;padding:0;background:#EBEBEB;font-family:"Helvetica Neue",Arial,sans-serif;}' +
      '.wrap{max-width:520px;margin:60px auto;background:#fff;border:1px solid #E0E0E0;padding:40px 36px;}' +
      '.logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;}' +
      '.logo img{width:32px;height:32px;}' +
      '.logo span{font-size:16px;font-weight:300;color:#111;letter-spacing:0.2em;}' +
      'h1{font-size:20px;font-weight:900;color:#111;margin:0 0 10px;}' +
      'p{font-size:13px;color:#555;line-height:1.7;margin:0 0 20px;}' +
      '.success{background:#F0FFF4;border-left:3px solid #22C55E;padding:16px;font-size:13px;color:#166534;margin-bottom:20px;}' +
      '.error{background:#FFF0F0;border-left:3px solid #E8291C;padding:16px;font-size:13px;color:#991B1B;margin-bottom:20px;}' +
      '.back{font-size:11px;color:#999;} .back a{color:#999;}' +
      '</style></head><body>' +
      '<div class="wrap">' +
      '<div class="logo">' +
      '<img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663437368766/OXsmmaNIDdCdSALu.png" alt="Firebean">' +
      '<span>FIREBEAN</span>' +
      '</div>';

    if (!isValidEmail(email)) {
      html += '<h1>Invalid Email</h1>' +
        '<div class="error">The email address provided is not valid. Please try again.</div>' +
        '<p class="back"><a href="https://firebean.net">← Back to firebean.net</a></p>';
    } else {
      // Update the sheet
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = ss.getSheetByName(SHEET_NAME);
      var found = false;

      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
        for (var i = 0; i < data.length; i++) {
          if (data[i][0].toString().toLowerCase().trim() === email) {
            // Col 5 (index 4) = Status
            sheet.getRange(i + 2, 5).setValue('UNSUBSCRIBED');
            // Col 6 (index 5) = Unsubscribed Date
            sheet.getRange(i + 2, 6).setValue(new Date().toISOString());
            found = true;
            break;
          }
        }
      }

      if (found) {
        html += '<h1>You\'ve been unsubscribed</h1>' +
          '<div class="success">✓ <strong>' + email + '</strong> has been removed from 公關市場解碼. You will not receive any further emails from us.</div>' +
          '<p>Changed your mind? You can re-subscribe anytime at <a href="https://firebean.net" style="color:#E8291C;">firebean.net</a>.</p>';
      } else {
        // Email not found — still show success (privacy best practice)
        html += '<h1>Unsubscribe Request Received</h1>' +
          '<div class="success">✓ If <strong>' + email + '</strong> was on our list, it has been removed.</div>' +
          '<p><a href="https://firebean.net" style="color:#E8291C;">← Back to firebean.net</a></p>';
      }
    }

    html += '</div></body></html>';
    return HtmlService.createHtmlOutput(html)
      .setTitle('Unsubscribed — Firebean')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch(err) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px;">' +
      '<h2>Something went wrong</h2><p>Please email <a href="mailto:hello@firebean.net">hello@firebean.net</a> to unsubscribe.</p>' +
      '</body></html>'
    );
  }
}
