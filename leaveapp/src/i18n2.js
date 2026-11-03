/* ══════════════════════════════════════════════════════════════════════
   i18n 補丁 2 — build-2026-10-23a
   修復：中文版仍有英文（長句被 <b>/<br> 拆散、legend、toast、對話框、
        伺服器錯誤訊息、佔位符）
   做法：先以「整段 innerHTML」層面替換（處理被標籤拆散嘅句子），
        再逐個文字節點用字典／規則補漏。
   ══════════════════════════════════════════════════════════════════════ */
(function () {

  /* ── 1. 字典補充 ─────────────────────────────────────────────────── */
  var EXTRA = {
    /* 角色 */
    "Admin": "管理員", "ADMIN": "管理員", "Supervisor": "主管", "SUPERVISOR": "主管",
    "Staff": "員工", "STAFF": "員工",
    /* 卡片／小標／計數 */
    "Carried forward from last year": "去年結轉",
    "Carry-over from last year": "去年結轉",
    "Rounded up to next half day": "向上取整至最近半日",
    "days already approved": "日已批准",
    "days carry-over": "日結轉",
    "days waiting for approval": "日待批",
    "Full History": "完整紀錄",
    "Comp Leave": "補假",
    "Nothing waiting": "暫無待批項目",
    "No records": "暫無紀錄",
    "No requests yet": "暫無申請",
    "← Team": "← 團隊",
    "✓ Added to team calendar": "✓ 已加入團隊日曆",
    "read-only": "唯讀",
    "days": "日",
    /* 佔位符 */
    "e.g. Family trip": "例：家庭旅行",
    "e.g. CMAB District Election – Lei Yue Mun": "例：CMAB 地區選舉 – 鯉魚門",
    /* toast / 對話框 */
    "Please pick your dates": "請選擇日期",
    "Processing…": "處理中…",
    "Cancelling…": "取消中…",
    "Cancelled": "已取消",
    "— calendar entry removed": "—— 已移除日曆項目",
    "Approve this request?": "批准此申請？",
    "Reject this request?": "拒絕此申請？",
    "Cancel this request?": "取消此申請？",
    "Note (optional — saved to the record and emailed)": "備註（可選 —— 會存入紀錄並以電郵通知）",
    "Reason for rejection (emailed to the staff member)": "拒絕原因（會電郵通知同事）",
    "Reason for cancellation (optional — emailed to the staff member)": "取消原因（可選 —— 會電郵通知同事）",
    "Cancel approved leave": "取消已批准假期",
    /* 伺服器訊息 */
    "The system is busy. Please try again in a moment.": "系統繁忙，請稍後再試。",
    "You are not on the staff list.": "你唔喺員工名單上。",
    "You do not have approval rights.": "你沒有審批權限。",
    "Invalid leave type.": "假期類型無效。",
    "Invalid duration option.": "時長選項無效。",
    "Invalid decision.": "審批決定無效。",
    "Please pick both a start and an end date.": "請選擇開始及結束日期。",
    "The end date cannot be before the start date.": "結束日期不可早於開始日期。",
    "A half day must start and end on the same date.": "半日假必須同一日開始及結束。",
    "Compensation leave requires the OT date.": "補假必須填寫 OT 日期。",
    "No working days in that range (all weekends or public holidays).": "該段期間沒有工作日（全部係週末或公眾假期）。",
    "No permission": "沒有權限",
    "Request not found (it may have been deleted).": "找不到此申請（可能已被刪除）。",
    "This request has already been cancelled.": "此申請已經取消。",
    "This request was already rejected.": "此申請已被拒絕。",
    "Approved leave can only be cancelled by a manager. Please ask Dickson.": "已批准的假期只能由管理層取消，請聯絡 Dickson。",
    "You can only cancel your own requests.": "你只可以取消自己的申請。",
    "Could not load": "載入失敗",
    "Could not submit": "提交失敗",
    "Could not cancel": "取消失敗",
    "Could not process": "處理失敗",
    "Submission failed: ": "提交失敗：",
    "Processing failed: ": "處理失敗：",
    "Submitted — waiting for Dickson to approve.": "已提交 —— 等待 Dickson 審批。",
    /* 頁首／登入被拒／錯誤畫面 */
    "Leave Application": "請假申請",
    "Request submitted": "申請已提交",
    "Submitting…": "提交中…",
    "Done": "完成",
    "Access Restricted": "無法進入",
    "Not on the staff list": "你唔喺員工名單上",
  "Could not read your Google account": "未能讀取你嘅 Google 帳號",
  "Your browser did not pass your Google account to the app.": "瀏覽器冇話畀應用程式知你用邊個 Google 帳號。",
  "This usually happens when several Google accounts are signed in at once.": "多數係同一個瀏覽器同時登入咗多個 Google 帳戶。",
  "Sign in with your @firebean.net account": "用 @firebean.net 帳號登入",
  "Or sign in with an email code": "或者用公司電郵攞驗證碼登入",
  "Send code": "攞驗證碼",
  "Sign in with code": "用驗證碼登入",
  "Sending…": "發送中…",
  "Checking…": "核對中…",
  "Signed in — reloading…": "已登入，重新載入中…",
  "Try again": "再試一次",
    "This app is for Firebean team members only.": "此 App 只供 Firebean 團隊成員使用。",
    "Ask Dickson to add you to the Staff tab.": "請 Dickson 將你加入 Staff 分頁。",
    "Signed in as": "登入帳號：",
    "Something went wrong": "發生錯誤",
    "Try again": "再試一次",
    "This request:": "本申請：",
    "(weekends & public holidays excluded)": "（不計週末及公眾假期）",
    "Annual leave left after booking:": "請假後剩餘年假：",
    "— exceeds your balance": "—— 超出你的結餘",
    /* 其他 */
    "Why a rate change does not show up straight away": "為何年假額調整唔會即時反映",
    "Contract entitlement": "合約年假額",
    "What you can book now": "現可申請"
  };
  for (var k in EXTRA) { if (!(k in ZH)) ZH[k] = EXTRA[k]; }

  /* ── 2. 文字節點規則補充（處理短碎片）──────────────────────────── */
  var R2 = [
    /* 「點解係呢個數」第 3 項 —— 結轉（三種情況） */
    [/^You finished last year$/, '你去年度結餘為'],
    [/^\. That shortfall is carried forward and deducted from this year\.$/, '。差額會順延並於本年度扣除。'],
    [/^Last year you had$/, '去年你剩餘'],
    [/^left\. Unused annual leave may be$/, '。未用的年假可'],
    [/^carried into the new year but must be taken by$/, '帶落下一年，但必須於此日期前放完：'],
    [/^; that deadline has passed,$/, '；該限期已過，'],
    [/^so these days have expired and are$/, '所以這些日數已失效，'],
    [/^counted below\.$/, '不計入下列數字。'],
    [/^left, carried into this year\.$/, '，已結轉至本年度。'],
    [/^They must be taken by$/, '必須於此日期前放完：'],
    [/^— after that they expire\.$/, ' —— 之後便會失效。'],
    /* 負結餘段落碎片 */
    [/^You are$/, '你超用了'],
    [/^You booked$/, '你已申請'],
    [/^days, but by$/, '日，但截至'],
    [/^only$/, '只累積了'],
    [/^days had been earned\.$/, '日。'],
    [/^days over\.$/, '日超用。'],
    [/^and nothing waiting for approval$/, '，沒有待批申請'],
    /* 數值碎片 */
    [/^(\S+) day\(s\) over$/, '$1 日超用'],
    [/^(\S+) day\(s\) over\.$/, '$1 日超用。'],
    [/^(\S+) day\(s\)$/, '$1 日'],
    [/^(\S+) days \(full year\)$/, '$1 日（全年）'],
    [/^(\S+) month$/, '$1 個月'],
    [/^days\/year\.$/, '日／年。'],
    [/^Over-used in (\S+) — carried forward$/, '於 $1 年超用 —— 已結轉'],
    [/^Effective (\S+)$/, '生效日期 $1'],
    [/^Contract entitlement (\S+) days\/year \(full 12 months\) · available to book now: (\S+) days$/,
      '合約年假額 $1 日／年（完整 12 個月）· 現可申請：$2 日'],
    /* 年假額調整卡 */
    [/^Your entitlement was last changed on$/, '你的年假額最後修改於'],
    [/^to$/, '，改為'],
    [/^onwards\.$/, '起生效。'],
    /* 伺服器複合訊息 */
    [/^This request has already been processed \(current status: (\S+)\)\.$/, '此申請已處理（現況：$1）。'],
    [/^Cannot approve: another APPROVED request already covers (.+)$/, '無法批准：已有另一宗已批准申請覆蓋 $1'],
    [/^Cannot cancel: this leave has already started or passed \((.+)\)\.$/, '無法取消：此假期已開始或已過去（$1）。'],
    [/^You already have a (.+)$/, '你已經有一宗 $1'],
    [/^build-(\d{4}-\d{2}-\d{2}[a-z]?)$/, '版本 $1'],
    [/^Contract entitlement ([\d.]+) days\/year \(full 12 months\) · available to book now: ([\d.]+) days$/,
      '合約年假額 $1 日／年（完整 12 個月）· 現可申請：$2 日'],
    [/^Signed in as (.+)$/, '登入帳號：$1'],
    [/^Cancel this APPROVED leave\?\n\nThe days will be returned to the balance and the calendar entry will be removed\.$/,
      '取消已批准的假期？\n\n日數會退回結餘，團隊日曆項目亦會移除。']
  ];
  for (var i = 0; i < R2.length; i++) { ZH_RULES.push(R2[i]); }

  /* ── 月份漢化：任何 "20 Oct" / "Oct 2026" / "Sep" 都變中文 ───────── */
  var MON2 = {Jan:'1 月',Feb:'2 月',Mar:'3 月',Apr:'4 月',May:'5 月',Jun:'6 月',
              Jul:'7 月',Aug:'8 月',Sep:'9 月',Oct:'10 月',Nov:'11 月',Dec:'12 月'};
  var MONPAT = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  /* 英文日期 → 中文（'28 Feb 2026' / '2026-02-28' → '2026 年 2 月 28 日'）。
     唔可以留英文月份：段內 <b> 節點會被逐字翻譯，出現「28 2026 年 2 月」咁嘅亂碼。 */
  var zhDate = function(str){
    var s = String(str).trim();
    var m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (m) return m[3] + ' 年 ' + String(MON2[m[2]] || m[2]).replace(/\s*月$/, '') + ' 月 ' + Number(m[1]) + ' 日';
    var i = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (i) return i[1] + ' 年 ' + Number(i[2]) + ' 月 ' + Number(i[3]) + ' 日';
    return s;
  };
  function zhMon(t){
    if (LANG !== 'zh' || !t) return t;
    return t
      .replace(new RegExp('(\\d{1,2}) (' + MONPAT + ')\\b', 'g'),
               function(m, d, mo){ return MON2[mo] + ' ' + Number(d) + ' 日'; })
      .replace(new RegExp('\\b(' + MONPAT + ') (\\d{4})\\b', 'g'),
               function(m, mo, y){ return y + ' 年 ' + MON2[mo]; })
      .replace(new RegExp('\\b(' + MONPAT + ')\\b', 'g'), function(m, mo){ return MON2[mo]; });
  }

  /* ── 3. HTML 層規則（句子被 <b>/<br> 拆散都處理得到）──────────── */
  var H = [
    /* 「點解」卡底部四行說明 */
    [/<b>Accrued<\/b> — complete months from 1 Jan, each at that leave year.s entitlement ÷ 12, rounded UP to the next half day\.<br>/,
      '<b>已累積</b> —— 由 1 月 1 日起的完整月份，每月以該假期年度的年假額 ÷ 12 計算，並向上取整至最近半日。<br>'],
    [/<b>Annual Leave Left<\/b> — Accrued \+ Carry-over − Used − Pending\. The only figure you need to book leave\.<br>/,
      '<b>剩餘年假</b> —— 已累積 ＋ 結轉 − 已用 − 待批。申請假期只需看這個數字。<br>'],
    [/<b>Carry-over<\/b> — unused days move into the next year, but must be used by the end of February, otherwise they expire\. Over-used days carry forward with no deadline\.<br>/,
      '<b>結轉</b> —— 未用的日數可帶落下一年，但必須於 2 月底前用完，否則失效。超用的日數會順延，沒有期限。<br>'],
    [/<b>Contract entitlement<\/b> — ([\d.]+) days for a full 12 months \(leave year 1 Jul – 30 Jun\)\. This is the contract figure, <b>not<\/b> what you can book today\./,
      '<b>合約年假額</b> —— 完整 12 個月為 $1 日（假期年度 7 月 1 日至 6 月 30 日）。此為合約數字，<b>不</b>等於現時可申請的日數。'],
    /* 合約數字方框 */
    [/<b>Contract entitlement<\/b> = ([\d.]+) days — this is for a <b>full 12 months<\/b>\./,
      '<b>合約年假額</b> = $1 日 —— 以<b>完整 12 個月</b>計。'],
    [/<b>What you can book now<\/b> = <b style="[^"]*">([\d.]+) days<\/b> — only months you have actually completed are credited\./,
      '<b>現可申請</b> = <b style="[^"]*">$1 日</b> —— 只計算你真正完成的完整月份。'],
    /* 點解卡：1 合約年假額 */
    [/([\d.]+) days for a full 12 months\. That is the contract figure — <b>not<\/b> what you can use today\./,
      '$1 日為完整 12 個月的額度。此為合約數字 —— <b>不</b>等於今日可用的日數。'],
    /* 點解卡：2 累積 */
    [/You earn 1\/12 of the rate for each <b>complete<\/b> month you have worked\. The current month, and any month before you joined, do not count yet\./,
      '每完成一個<b>完整</b>月份，可累積年度額度的 1/12。當月及入職前的月份不計算。'],
    [/from (\S+) · rate set on (\S+) · \(([\d.]+) × (\d+)\) ÷ 12 = <b>([\d.]+) days<\/b>/,
      '由 $1 起 · 額度定於 $2 ·（$3 日 × $4 個月）÷ 12 個月 = <b>$5 日</b>'],
    [/<b>Earned so far = ([\d.]+) days<\/b> — counting complete months up to ([A-Z][a-z]{2}) (\d{4})/,
      function(m, d, mo, y){ return '<b>至今已累積 = ' + d + ' 日</b> —— 計算至 ' + y + ' 年 ' + MON2[mo] + ' 的完整月份'; }],
    /* 點解卡：3 結轉 */
    [/^Last year you had <b>([\d.]+) day\(s\)<\/b> left,[\s\S]*?taken by <b>([^<]+)<\/b>[\s\S]*?after that they expire\./,
      function(m, n, d){ return '去年你剩餘 <b>' + n + ' 日</b>，已結轉至本年度。必須於 <b>' + zhDate(d) + '</b> 前放完 —— 之後便會失效。'; }],
    [/^Last year you had <b>([\d.]+) day\(s\)<\/b> left\.[\s\S]*?taken by <b>([^<]+)<\/b>[\s\S]*?counted below\./,
      function(m, n, d){ return '去年你剩餘 <b>' + n + ' 日</b>。未用的年假可帶落下一年，但必須於 <b>' + zhDate(d) + '</b> 前放完；該限期已過，所以這些日數已失效，<b>不</b>計入下列數字。'; }],
    [/You finished last year <b>([\d.]+) day\(s\) over<\/b>\. That shortfall is carried forward and deducted from this year\./,
      '你去年度超用 <b>$1 日</b>。差額會順延並於本年度扣除。'],
    /* 點解卡：負結餘 */
    [/You are <b>([\d.]+) day\(s\) over\.<\/b> You booked ([\d.]+) days, but by (\S+) only ([\d.]+) days had been earned\. ([\d.]+) − ([\d.]+) = ([\d.]+) days over\./,
      '你超用了 <b>$1 日。</b> 你已申請 $2 日，但截至 $3 只累積了 $4 日。$5 − $4 = $6 日超用。'],
    [/This is not wiped: a negative closing balance on 31 December carries into the next year with no deadline and comes off next year.s leave\. \(Unused <b>positive<\/b> days behave differently — they carry forward but expire at the end of February\.\)/,
      '唔會一筆勾銷：12 月 31 日的負數結餘會順延至下一年、無限期，並從下一年年假扣除。（未用的<b>正數</b>日數唔同 —— 會結轉但於 2 月底失效。）'],
    [/You cannot book more annual leave until the balance is positive again — but you can still book <b>Sick Leave<\/b> and <b>Compensation Leave<\/b>\./,
      '結餘回復正數前唔可以再申請年假 —— 但你仍然可以申請<b>病假</b>及<b>補假</b>。'],
    /* 年假額調整卡 */
    [/Your entitlement was last changed on <b>(\S+)<\/b> to ([\d.]+) days\/year\. Entitlement changes only start counting from the beginning of a leave year \(1 July\), so this one first affects months from <b>(\S+)<\/b> onwards\./,
      '你的年假額最後修改於 <b>$1</b>，改為 $2 日／年。年假額調整只由假期年度開始（7 月 1 日）起計算，所以今次調整最早由 <b>$3</b> 起生效。']
    ,
    /* 已取假句子（含 waiting for approval 版） */
    [/^(\d+(?:\.\d+)?) days already approved, and nothing waiting for approval\./,
      '$1 日已批准，未有等待批核嘅申請。'],
    [/^(\d+(?:\.\d+)?) days already approved, plus (\d+(?:\.\d+)?) days waiting for approval\./,
      '$1 日已批准，另有 $2 日等待批核。'],
    /* 結轉提示（⚠️／↪️ 三個狀態） */
    [/^⚠️ ([\d.]+) day\(s\) were carried forward from last year, but the deadline passed on <b>([^<]+)<\/b>[\s\S]*?can no longer be used\./,
      function(m, n, d){ return '⚠️ 去年有 ' + n + ' 日結轉，但已於 <b>' + zhDate(d) + '</b> 到期 —— 已失效，不能再使用。'; }],
    [/^⚠️ ([\d.]+) day\(s\) over-used last year, carried forward and already deducted from this year\./,
      '⚠️ 去年超用 $1 日，已順延並於本年度扣除。'],
    [/^↪️ <b>([\d.]+) day\(s\)<\/b> carried forward from last year — usable until <b>([^<]+)<\/b>[\s\S]*?unused days expire\./,
      function(m, n, d){ return '↪️ 去年結轉 <b>' + n + ' 日</b>，可用至 <b>' + zhDate(d) + '</b>，之後未用的日數便會失效。'; }],
    /* 結轉池扣抵（1–2 月用假先扣去年結轉） */
    [/<b>([\d.]+) day\(s\)<\/b> of them were taken before the deadline, so they are not charged against this year.s accrual\./,
      '<b>$1 日</b>已於期限前使用，因此不會扣減本年度的累積。'],
    [/<b>([\d.]+) day\(s\)<\/b> of them were taken before the deadline — those days are covered by the carry-over and are not charged to this year.s accrual\./,
      '<b>$1 日</b>已於期限前使用 —— 該些日數由去年結轉覆蓋，不會扣減本年度累積。'],
    [/Of these, <b>([\d.]+) day\(s\)<\/b> were taken before ([\w. ]+?) and are charged against last year.s carry-over, so only <b>([\d.]+) day\(s\)<\/b> come off this year.s accrual\./,
      function(m, a, d, b){ return '其中 <b>' + a + ' 日</b>於 <b>' + zhDate(d) + '</b> 前使用，由去年結轉扣抵，所以本年度累積只需扣 <b>' + b + ' 日</b>。'; }],
    [/\(Of the ([\d.]+) day\(s\) taken, ([\d.]+) are covered by last year.s carry-over, so only ([\d.]+) day\(s\) come off this year.s accrual\.\)/,
      '（已取的 $1 日之中，$2 日由去年結轉扣抵，所以本年度累積只需扣 $3 日。）'],
    /* 角色標籤：ADMIN · email */
    [/(^|>)(admin|staff|supervisor|manager)( · )/gi,
      function(m, pre, r, mid){
        var M={'admin':'管理員','staff':'員工','supervisor':'主管','manager':'主管'};
        return pre + (M[r.toLowerCase()] || r) + mid;
      }],
    /* heroNote：Annual Leave · as of 2026-10-22 · read-only */
    [/(Annual Leave|Sick Leave|Compensation Leave|Comp Leave) · as of (\d{4}-\d{2}-\d{2}) · read-only/g,
      function(m, tp, d){
        var M = {'Annual Leave':'年假','Sick Leave':'病假','Compensation Leave':'補假','Comp Leave':'補假'};
        return (M[tp] || tp) + ' · 截至 ' + d + ' · 唯讀';
      }]
  ];

  /* ── 4. 套用 ──────────────────────────��─────────────────────────── */
  var SEL = '.d,.legend,.empty,.cl,.cm,.ch,.label,.t,.heroNote,.tip,.memRole,.prole,.pname';

  function ownedText(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (p.__enHtml !== undefined) return true;
      p = p.parentNode;
    }
    return false;
  }

  function localText(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false), n, t, z;
    while ((n = w.nextNode())) {
      t = n.nodeValue; if (!t || !/[A-Za-z]/.test(t)) continue;
      z = zhMon(zhFor(t.trim()));
      if (z !== t.trim()) n.nodeValue = t.replace(t.trim(), z);
    }
  }

  function i18nHtml() {
    var root = document.getElementById('root'); if (!root) return;
    var els = root.querySelectorAll(SEL), i, j, el, out;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.__enHtml === undefined) el.__enHtml = el.innerHTML;
      if (LANG !== 'zh') { el.innerHTML = el.__enHtml; continue; }
      out = el.__enHtml;
      for (j = 0; j < H.length; j++) out = out.replace(H[j][0], H[j][1]);
      el.innerHTML = out;
      localText(el);                    /* 未覆蓋到嘅碎片，逐節點補 */
    }
  }

  function i18nApply() {
    document.documentElement.lang = (LANG === 'zh' ? 'zh-Hant-HK' : 'en');
    i18nHtml();
    var root = document.getElementById('root');
    if (root) {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, t, z;
      while ((n = w.nextNode())) {
        if (ownedText(n)) continue;                       /* 由 i18nHtml 負責 */
        t = n.nodeValue; if (!t || !/[A-Za-z]/.test(t)) continue;
        if (n.__en === undefined) n.__en = t;
        if (LANG === 'zh') {
          z = zhMon(zhFor(n.__en.trim()));
          if (z !== n.__en.trim()) n.nodeValue = n.__en.replace(n.__en.trim(), z);
        } else {
          n.nodeValue = n.__en;
        }
      }
      Array.prototype.forEach.call(root.querySelectorAll('[placeholder]'), function (e) {
        if (e.__enPh === undefined) e.__enPh = e.placeholder;
        e.placeholder = (LANG === 'zh') ? zhMon(zhFor(e.__enPh)) : e.__enPh;
      });
      Array.prototype.forEach.call(root.querySelectorAll('option'), function (e) {
        if (e.__enTx === undefined) e.__enTx = e.textContent;
        e.textContent = (LANG === 'zh') ? zhMon(zhFor(e.__enTx)) : e.__enTx;
      });
    }
    var b = document.getElementById('langBtn');
    if (b) b.textContent = (LANG === 'zh') ? 'EN' : '中文';
  }
  window.i18nApply = i18nApply;

  /* 雙語即時字串（對話框、動態訊息用） */
  window.L = function (s) { return (LANG === 'zh') ? zhFor(String(s)) : String(s); };

  /* toast 自動翻譯 */
  var _toast = window.toast;
  if (typeof _toast === 'function') {
    window.toast = function (msg, bad) { return _toast(L(msg), bad); };
  }

})();
