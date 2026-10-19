/**
 * ============================================================
 *  Firebean Leave App — Google Apps Script 後端
 *  部署：喺「Firebean Leave App Data」Sheet → 擴充功能 → Apps Script
 *  作者：Hermes Apollo / Firebean  更新：2026-10-19
 * ============================================================
 *  ⚠️ 只會讀寫 Staff / Requests / HK_Holidays / Entitlement_History
 *     「data」tab（人工、銀行）完全唔會 touch。
 * ============================================================
 */

const CFG = {
  SHEET_ID      : '1o88_EyWURlu9vJnkCU4gTFG5OnoOSjGmXq7jekERTD4',
  MANAGER_EMAIL : 'dickson@firebean.net',
  DOMAIN        : 'firebean.net',
  TZ            : 'Asia/Hong_Kong',
  CALENDAR_ID   : 'primary',
  // 年假一律以 0.5 日為單位
  //   ROUND_MODE 'ceil'    = 無條件進位到上一個半日（對員工有利，例：11.58 → 12.0）
  //              'nearest' = 四捨五入到最接近半日（例：11.58 → 11.5）
  //              'floor'   = 向下取到半日（保守，唔會多派）
  ROUND_TO      : 0.5,
  ROUND_MODE    : 'ceil',
  // 年假累積方式
  //   'monthly'  = 逐個「完整月」累積（預設）——做滿一個月先計一個月
  //   'upfront'  = 年頭一次過派足全年額度（年內升職即用新額度）；年中入職者按比例
  //   'pro_rata' = 逐段按生效日累積（舊邏輯）
  ACCRUAL_MODE  : 'monthly',
  // 累積窗：'calendar_year' = 由本年度 1 月 1 日起計（預設）
  //         'leave_year'    = 由本假期年度開始日起計
  ACCRUAL_WINDOW: 'calendar_year',
  // true = 測試模式：唔會真發 email、唔會真建日曆（副本測試用）
  // ⚠️ 正式上線前改成 false，否則同事唔會收到通知、日曆唔會有記錄
  DRY_RUN : true,
  // 請假活動寫入邊個日曆（填 Google Calendar 左邊欄見到嘅日曆名）：
  //   例如 'Firebean Team'。留空或填 'primary' = 寫入預設日曆。
  CALENDAR_NAME : 'Firebean Team',
  // 日曆活動要邀請邊個：
  //   'requester' = 只邀請申請人 + 主管（預設，唔會 spam 全公司）
  //   'all'       = 邀請 Staff 表所有人
  //   'none'      = 唔邀請任何人（活動只喺主管日曆出現）
  CALENDAR_GUESTS : 'requester',
  // 員工相片資料夾（Staff_Images），Staff!E 存檔名，例如 "Staff_Images/Francesai.gif"
  STAFF_IMAGES_FOLDER_ID : '1Xt3THTJlPzCR6B93zQ4OxutjZVNoHvQI',
  // 假期年度起始月：7 = 7月1日–6月30日（額度每 7 月 1 日更新一次）
  LEAVE_YEAR_START_MONTH : 7
};

const T = {
  STAFF : 'Staff',
  REQ   : 'Requests',
  HOL   : 'HK_Holidays',
  HIST  : 'Entitlement_History'
};

// Requests 欄位（1-based），對應你現有 15 欄格式 —— 唔可以改次序
const REQ_COLS = [
  'Request ID',        // A  1
  'Staff Email',       // B  2
  'Name',              // C  3
  'Leave Type',        // D  4
  'Start Date',        // E  5
  'End Date',          // F  6
  'Duration',          // G  7
  'Sick Note',         // H  8
  'Reason',            // I  9
  'OT Date',           // J 10
  'Event Name',        // K 11
  'Status',            // L 12
  'Manager Comments',  // M 13
  'Numeric Duration',  // N 14
  'Calendar Event ID'  // O 15
];

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Compensation Leave'];
const DURATIONS   = ['Full Day', 'Half Day 0900-1300', 'Half Day 1400-1800'];

/* ============================================================
 *  入口
 * ============================================================ */

function doGet(e) {
  // 注意：HtmlService.XFrameOptionsMode 只有 ALLOWALL / DEFAULT，
  // 冇 DENY。DEFAULT 本身已禁止非 Google 網域 embed。
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Firebean Leave App')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** 前端一開機就 call，確認身份＋角色 */
function getSession() {
  const email = _activeEmail();
  const s = _read(T.STAFF);
  const row = s.rows.filter(r => String(r[0]).toLowerCase() === email)[0];
  if (!row) return { ok: false, reason: 'NOT_STAFF', email: email };
  const role = String(row[2] || 'Staff');
  return {
    ok: true,
    email: email,
    name: String(row[1] || ''),
    role: role,
    isManager: ['admin', 'manager'].indexOf(role.toLowerCase()) >= 0,
    avatar: _avatarUrl(row[4]),
    today: _iso(new Date()),
    year: new Date().getFullYear()
  };
}

/* ============================================================
 *  員工相片（Staff_Images 資料夾 → lh3 直連，GIF 會保留動畫）
 * ============================================================ */
function _imageIds_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('staffImgs');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const map = {};
  try {
    const it = DriveApp.getFolderById(CFG.STAFF_IMAGES_FOLDER_ID).getFiles();
    while (it.hasNext()) {
      const f = it.next();
      map[f.getName()] = f.getId();
      map[f.getName().toLowerCase()] = f.getId();
    }
  } catch (e) {
    return map;
  }
  try { cache.put('staffImgs', JSON.stringify(map), 21600); } catch (e) {}
  return map;
}

/**
 * 由各種 Google 連結抽出檔案 ID；唔係 Google 連結就回 ''
 * 支援：/file/d/<ID>/view、/d/<ID>、?id=<ID>、lh3.googleusercontent.com/d/<ID>
 */
function _driveIdFromUrl(u) {
  const s = String(u || '');
  if (!/(googleusercontent\.com|drive\.google\.com|docs\.google\.com)/i.test(s)) return '';
  const m = s.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]{10,})/)
         || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : '';
}

/**
 * Staff!E 可能係 "Staff_Images/Francesai.gif" 或純檔名
 * → 回傳可直接 <img src> 嘅網址
 * preferStill = true 時優先用同名 .jpeg/.jpg（名單用小圖，避免載入幾 MB 嘅 GIF）
 */
function _avatarUrl(cell, preferStill) {
  const raw = String(cell || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    // Google 相關連結 → 抽出檔案 ID，改寫成可以直接 <img src> 嘅網址
    // （Drive 檢視頁 /file/d/ID/view 係 text/html，<img> 攞唔到圖，會靜靜死圖）
    const id = _driveIdFromUrl(raw);
    if (id) return 'https://lh3.googleusercontent.com/d/' + id;
    return raw;                                       // 其他網址照用
  }
  const name = raw.split('/').pop();
  if (!name) return '';
  const map = _imageIds_();

  if (preferStill) {
    const stem = name.replace(/\.[^.]+$/, '');
    const tries = [stem + '.jpeg', stem + '.jpg', stem + '.png'];
    for (let i = 0; i < tries.length; i++) {
      const sid = map[tries[i]] || map[tries[i].toLowerCase()];
      if (sid) return 'https://lh3.googleusercontent.com/d/' + sid;
    }
  }
  const id = map[name] || map[name.toLowerCase()];
  if (!id) return '';
  return 'https://lh3.googleusercontent.com/d/' + id;
}

/** 主畫面：自己嘅餘額 + 自己嘅申請紀錄 */
function getDashboard() {
  const sess = getSession();
  if (!sess.ok) return { ok: false, reason: sess.reason, email: sess.email };
  const today = _today();
  const hol = _holidaySet();
  return {
    ok: true,
    session: sess,
    balance: _balanceFor(sess.email, today),
    accrualBreakdown: _accrual(sess.email, today).segs,
    requests: _myRequests(sess.email),
    holidays: Object.keys(hol).filter(k => k.indexOf(String(today.getFullYear())) === 0).sort(),
    leaveTypes: LEAVE_TYPES,
    durations: DURATIONS
  };
}

/** 管理層：所有待批 + 全部人餘額 */
function getManagerView() {
  const sess = getSession();
  if (!sess.ok || !sess.isManager) return { ok: false, reason: 'FORBIDDEN' };
  const today = _today();
  const s = _read(T.STAFF);
  const people = s.rows.map(r => {
    const email = String(r[0]).toLowerCase();
    return {
      email: email,
      name: String(r[1] || ''),
      role: String(r[2] || ''),
      photo: String(r[4] || ''),
      avatar: _avatarUrl(r[4], true),   // 名單用靜態細圖
      balance: _balanceFor(email, today)
    };
  });
  return {
    ok: true,
    pending: _allRequests('Pending'),
    recent: _allRequests(null, 40),
    people: people
  };
}

/** 管理層：個別同事嘅完整 dashboard（唯讀，只有 admin/manager 叫得） */
function getMemberView(email) {
  const sess = getSession();
  if (!sess.ok || !sess.isManager) return { ok: false, reason: 'FORBIDDEN' };
  const want = String(email || '').trim().toLowerCase();
  const s = _read(T.STAFF);
  const row = s.rows.filter(r => String(r[0]).toLowerCase() === want)[0];
  if (!row) return { ok: false, reason: 'NOT_ON_STAFF_LIST' };
  const today = _today();
  const acc = _accrual(want, today);
  return {
    ok: true,
    viewer: { name: sess.name, email: sess.email },
    session: {
      email: want,
      name: String(row[1] || ''),
      role: String(row[2] || 'Staff'),
      isManager: false,
      avatar: _avatarUrl(row[4]),
      today: _iso(today),
      year: today.getFullYear()
    },
    balance: _balanceFor(want, today),
    accrualBreakdown: acc.segs,
    requests: _myRequests(want)
  };
}

/* ============================================================
 *  提交申請
 * ============================================================ */

function submitLeave(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: 'The system is busy. Please try again in a moment.' };
  try {
    const sess = getSession();
    if (!sess.ok) return { ok: false, error: 'You are not on the staff list.' };

    const type  = String(payload.leaveType || '');
    const dur   = String(payload.duration || 'Full Day');
    const start = _date(payload.startDate);
    const end   = _date(payload.endDate);
    const reason = String(payload.reason || '').trim();
    const otDate = _date(payload.otDate);
    const eventName = String(payload.eventName || '').trim();

    if (LEAVE_TYPES.indexOf(type) < 0)            return { ok: false, error: 'Invalid leave type.' };
    if (DURATIONS.indexOf(dur) < 0)               return { ok: false, error: 'Invalid duration option.' };
    if (!start || !end)                           return { ok: false, error: 'Please pick both a start and an end date.' };
    if (end < start)                              return { ok: false, error: 'The end date cannot be before the start date.' };
    if (dur.indexOf('Half Day') >= 0 && _iso(start) !== _iso(end))
      return { ok: false, error: 'A half day must start and end on the same date.' };
    if (type === 'Compensation Leave' && !otDate)
      return { ok: false, error: 'Compensation leave requires the OT date.' };

    const days = _computeDays(start, end, dur);
    if (days <= 0) return { ok: false, error: 'No working days in that range (all weekends or public holidays).' };

    // 年假：檢查可用餘額（包含待批）
    if (type === 'Annual Leave') {
      const b = _balanceFor(sess.email, _today());
      if (days > b.available + 0.001) {
        return { ok: false, error:
          'Insufficient annual leave. Accrued ' + b.accrued + ', used ' + b.used +
          ', pending ' + b.pending + ', so ' + b.available +
          ' days are available. This request is ' + days + ' days.' };
      }
    }

    const row = new Array(REQ_COLS.length).fill('');
    row[0]  = _id();
    row[1]  = sess.email;
    row[2]  = sess.name;
    row[3]  = type;
    row[4]  = start;
    row[5]  = end;
    row[6]  = dur;
    row[7]  = String(payload.sickNote || '');
    row[8]  = reason;
    row[9]  = otDate ? otDate : '';
    row[10] = eventName;
    row[11] = 'Pending';
    row[12] = '';
    row[13] = days;
    row[14] = '';

    const sh = _sheet(T.REQ);
    const lastRow = Math.max(sh.getLastRow(), 1);
    sh.getRange(lastRow + 1, 1, 1, REQ_COLS.length).setValues([row]);

    // 通知：管理層 + 申請人
    _emailNewRequest(sess, { type: type, dur: dur, start: start, end: end,
                             days: days, reason: reason, otDate: otDate, eventName: eventName });

    return { ok: true, days: days, message: 'Submitted \u2014 waiting for Dickson to approve.' };
  } catch (err) {
    return { ok: false, error: 'Submission failed: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 *  管理層批核
 * ============================================================ */

function decideLeave(requestId, decision, comment) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: 'The system is busy. Please try again in a moment.' };
  try {
    const sess = getSession();
    if (!sess.ok || !sess.isManager) return { ok: false, error: 'You do not have approval rights.' };
    if (['Approved', 'Rejected'].indexOf(decision) < 0) return { ok: false, error: 'Invalid decision.' };

    const sh = _sheet(T.REQ);
    const values = sh.getDataRange().getValues();
    let rowIdx = -1, rec = null;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(requestId).trim()) { rowIdx = i + 1; rec = values[i]; break; }
    }
    if (rowIdx < 0) return { ok: false, error: 'Request not found (it may have been deleted).' };

    const current = String(rec[11] || '').trim();
    if (current !== 'Pending') return { ok: false, error: 'This request has already been processed (current status: ' + current + ').' };

    const email = String(rec[1]).toLowerCase();
    const name = String(rec[2]);
    const type = String(rec[3]);
    const start = _date(rec[4]);
    const end = _date(rec[5]);
    const dur = String(rec[6]);
    const days = _num(rec[13]);
    const otDate = _date(rec[9]);
    const eventName = String(rec[10] || '');
    const reason = String(rec[8] || '');

    // 寫入狀態
    sh.getRange(rowIdx, 12).setValue(decision);
    sh.getRange(rowIdx, 13).setValue(String(comment || ''));

    let calId = '';
    if (decision === 'Approved') {
      try {
        calId = _createCalendarEvent(name, email, type, start, end, dur, days, otDate, eventName, reason, comment);
        if (calId) sh.getRange(rowIdx, 15).setValue(calId);
      } catch (e) {
        // 唔好因為 calendar 失敗而令批核失敗
        console.error('Calendar error: ' + e.message);
      }
    }

    _emailDecision({ email: email, name: name, type: type, start: start, end: end,
                     days: days, decision: decision, comment: comment, otDate: otDate, eventName: eventName });

    // 同步 Staff!Current Annual Leave
    try { _syncStaffBalance(); } catch (e) { console.error('sync error: ' + e.message); }

    return { ok: true, message: (decision === 'Approved' ? 'Approved' : 'Rejected') + (calId ? ' \u2014 added to calendar' : '') };
  } catch (err) {
    return { ok: false, error: 'Processing failed: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

/** 手動同步（管理層畫面個「重新整理」掣用） */
function syncBalances() {
  const sess = getSession();
  if (!sess.ok || !sess.isManager) return { ok: false, error: 'No permission' };
  return { ok: true, updated: _syncStaffBalance() };
}

/* ============================================================
 *  核心計算
 * ============================================================ */

function _today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 假期年度起始日（額度週期；7 月制 = 7/1–6/30） */
function _leaveYearStart(today) {
  const m = (CFG.LEAVE_YEAR_START_MONTH || 1) - 1;
  const y = (today.getMonth() >= m) ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(y, m, 1);
}

/** 累積窗起點（同「已用」統計窗一致） */
function _accrualWindowStart(today) {
  return (CFG.ACCRUAL_WINDOW === 'leave_year')
    ? _leaveYearStart(today)
    : new Date(today.getFullYear(), 0, 1);
}

/** 某日生效嘅年假額度（最後一條 eff <= dt 嘅紀錄） */
function _rateAt(hist, dt) {
  const v = hist.filter(x => x.eff <= dt);
  return v.length ? v[v.length - 1].ent : 0;
}

/** 完整月數（例如 4/22 → 10/19 = 5，唔夠 22 號唔計） */
function _monthsBetween(a, b) {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

/** 累積年假：支援年中升職／調整年假額
 *  模式 CFG.ACCRUAL_MODE：
 *    'monthly'  = 逐個「完整月」累積（預設）。窗口 = CFG.ACCRUAL_WINDOW；
 *                 每個月嘅速率 = 該月所屬「假期年度」開始時生效嘅額度 ÷ 12
 *                 （所以升職要等到下一個假期年度 7/1 才反映喺累積上）
 *    'upfront'  = 年頭一次過派足全年額度；年中入職者按比例
 *    'pro_rata' = 逐段按生效日累積（舊邏輯）
 */
function _accrual(email, today) {
  const h = _read(T.HIST);
  const hist = h.rows
    .filter(r => String(r[0]).toLowerCase() === email)
    .map(r => ({ eff: _date(r[1]), ent: _num(r[2]) }))
    .filter(x => x.eff)
    .sort((a, b) => a.eff - b.eff);

  if (!hist.length) return { ent: 0, acc: 0, segs: [] };

  const lyStart = _leaveYearStart(today);
  const curEnt = _rateAt(hist, today);
  const mode = CFG.ACCRUAL_MODE || 'monthly';

  // ── 全年派足 ──
  if (mode === 'upfront' && hist[0].eff <= lyStart) {
    return {
      ent: curEnt, acc: curEnt,
      segs: [{ from: _iso(lyStart), eff: _iso(hist[0].eff), ent: curEnt,
               months: 12, days: curEnt, upfront: true }]
    };
  }

  // ── 逐個完整月累積 ──
  if (mode === 'monthly') {
    const winStart = _accrualWindowStart(today);
    const n = _monthsBetween(winStart, today);   // 只有「完整月」計數
    // 每月速率 = 該月所屬假期年度開始時生效嘅額度；
    // 但若該假期年度開始時仲未有任何紀錄（首年入職／首年建檔），
    // 就改用該月 1 號當日生效嘅額度，避免白白漏計。
    // 入職月份之前嘅月份一律唔計。
    const hireM = new Date(hist[0].eff.getFullYear(), hist[0].eff.getMonth(), 1);
    const rateForMonth = (mStart) => {
      if (mStart < hireM) return 0;
      const lys = _leaveYearStart(mStart);
      const r = _rateAt(hist, lys);
      return r > 0 ? r : _rateAt(hist, mStart);
    };
    // 用同一個分段邏輯跑兩個長度：n 個月（至今）同 12 個月（全年）
    const runSegs = (count) => {
      const out = []; let total = 0, i = 0;
      while (i < count) {
        const mStart = new Date(winStart.getFullYear(), winStart.getMonth() + i, 1);
        const rate = rateForMonth(mStart);
        let j = i + 1;
        while (j < count) {
          const m2 = new Date(winStart.getFullYear(), winStart.getMonth() + j, 1);
          if (rateForMonth(m2) !== rate) break;
          j++;
        }
        const months = j - i;
        const days = months * rate / 12;
        total += days;
        out.push({ from: _iso(mStart), ent: rate, months: months,
                   days: Math.round(days * 100) / 100 });
        i = j;
      }
      return { segs: out, total: Math.round(total * 100) / 100 };
    };
    const ytd = runSegs(n), full = runSegs(12);
    // 最後一個完整月嘅月尾（例如 10/19 → 9/30）
    const lastFull = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      ent: curEnt,
      acc: ytd.total,
      accFullYear: full.total,
      segs: ytd.segs,
      segsFullYear: full.segs,
      windowStart: _iso(winStart),
      accruedTo: _iso(lastFull),
      monthsCounted: n
    };
  }

  // ── 舊邏輯：逐段按生效日 ──
  let acc = 0;
  const segs = [];
  for (let i = 0; i < hist.length; i++) {
    const s = new Date(Math.max(hist[i].eff.getTime(), lyStart.getTime()));
    const nextEff = (i + 1 < hist.length) ? hist[i + 1].eff : new Date(2099, 0, 1);
    const e = new Date(Math.min(nextEff.getTime(), today.getTime()));
    if (s >= e) continue;
    const m = Math.min(_monthsBetween(s, e), 12);
    if (m <= 0) continue;
    const days = m * hist[i].ent / 12;
    acc += days;
    segs.push({ from: _iso(s), eff: _iso(hist[i].eff), ent: hist[i].ent,
                months: m, days: Math.round(days * 100) / 100 });
  }
  return {
    ent: curEnt,
    acc: Math.round(acc * 100) / 100,
    segs: segs
  };
}

/** 把日數對齊到 0.5 日網格 */
function _roundHalf(n) {
  const g = CFG.ROUND_TO || 0.5;
  const x = Number(n) / g;
  const m = CFG.ROUND_MODE;
  // 1e-9 誤差保護：避免 11.5/0.5 之類嘅浮點雜訊被 ceil 推高一個單位
  const r = (m === 'floor') ? Math.floor(x + 1e-9)
          : (m === 'ceil')  ? Math.ceil(x - 1e-9)
          : Math.round(x);
  return Math.round(r * g * 100) / 100;
}

/** 某員工餘額 */
function _balanceFor(email, today) {
  const req = _read(T.REQ);
  const lyStart = _accrualWindowStart(today);   // 同累積窗一致（預設 = 本年度 1/1）
  let used = 0, pending = 0, otherUsed = 0;
  req.rows.forEach(r => {
    if (String(r[1]).toLowerCase() !== email) return;
    const st = _date(r[4]);
    if (!st || st < lyStart) return;
    const status = String(r[11] || '').trim();
    const n = _num(r[13]);
    const lt = String(r[3] || '');
    if (lt === 'Annual Leave') {
      if (status === 'Approved') used += n;
      else if (status === 'Pending') pending += n;
    } else if (status === 'Approved') {
      otherUsed += n;
    }
  });
  const a = _accrual(email, today);
  const accruedRaw = Math.round(a.acc * 100) / 100;
  const accrued = _roundHalf(accruedRaw);
  return {
    entitlement: a.ent,
    accrued: accrued,
    accruedRaw: accruedRaw,
    used: Math.round(used * 100) / 100,
    pending: Math.round(pending * 100) / 100,
    otherUsed: Math.round(otherUsed * 100) / 100,
    available: Math.round((accrued - used - pending) * 100) / 100,
    fullYear: Math.round((_roundHalf(a.accFullYear != null ? a.accFullYear : a.ent)
                          - used - pending) * 100) / 100,
    accruedTo: a.accruedTo || '',
    windowStart: a.windowStart || '',
    accFullYearRaw: a.accFullYear != null ? a.accFullYear : a.ent
  };
}

/** 逐日計工作日（扣週六日 + 公眾假期） */
function _computeDays(start, end, duration) {
  if (String(duration || '').indexOf('Half Day') >= 0) return 0.5;
  if (!start || !end || end < start) return 0;
  const hol = _holidaySet();
  let n = 0;
  const d = new Date(start.getTime());
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !hol[_iso(d)]) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function _holidaySet() {
  const h = _read(T.HOL);
  const set = {};
  h.rows.forEach(r => { const d = _date(r[0]); if (d) set[_iso(d)] = true; });
  return set;
}

/* ============================================================
 *  Email / Calendar
 * ============================================================ */

/** '2026-09-30' → 'Sep 2026' */
function _monthLabel(iso) {
  const d = _date(iso);
  if (!d) return '';
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] +
         ' ' + d.getFullYear();
}

/**
 * ⭐ 自我測試 —— 喺 Apps Script 編輯器上方揀「testNotifications」→ Run
 *    會（1）真發一封測試 email、（2）真建一個日曆活動再即刻刪走。
 *    完全唔受 DRY_RUN 影響，用完唔會留痕。
 *    第一次 Run 會彈授權畫面，撳「進階」→「繼續」批准即可。
 */
function testNotifications() {
  const log = [];
  const stamp = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss');

  try {
    MailApp.sendEmail({
      to: CFG.MANAGER_EMAIL,
      subject: '[TEST] Firebean Leave App \u2014 email OK ' + stamp,
      body: 'Firebean Leave App \u6e2c\u8a66\u96fb\u90f5\u3002\n\n'
          + '\u6536\u5230\u5462\u5c01 = MailApp.sendEmail \u6b63\u5e38\u3002\n'
          + '\u6642\u9593\uff1a' + stamp + '\n'
          + '\u4eca\u65e5\u5269\u9918\u5bc4\u4fe1\u984d\u5ea6\uff1a' + MailApp.getRemainingDailyQuota() + '\n\n'
          + '\uff08\u53ef\u4ee5\u76f4\u63a5\u522a\u9664\uff09'
    });
    log.push('\u2705 Email OK \u2192 ' + CFG.MANAGER_EMAIL +
             '\uff08\u5269\u9918\u984d\u5ea6 ' + MailApp.getRemainingDailyQuota() + '\uff09');
  } catch (e) {
    log.push('\u274c Email FAIL \u2192 ' + e.message);
  }

  log.push('');
  log.push('\u4f60\u6240\u6709\u65e5\u66c6\uff1a');
  log = log.concat(listCalendars());
  log.push('');

  try {
    const cal = _calendar();
    const t = new Date();
    const ev = cal.createAllDayEvent('TEST - Firebean Leave App (\u81ea\u52d5\u522a\u9664) ' + stamp, t,
      { description: '\u81ea\u52d5\u6e2c\u8a66\uff0c45 \u79d2\u5f8c\u6703\u81ea\u52d5\u522a\u9664\u3002' });
    log.push('\u2705 Calendar OK \u2192 \u5beb\u5165\u65e5\u66c6\uff1a' + cal.getName());
    log.push('   \u8acb\u53bb Google Calendar \u53f3\u908a\u770b\u4e00\u773c\uff08\u4eca\u65e5\uff09\uff0c45 \u79d2\u5f8c\u81ea\u52d5\u522a\u9664\u3002');
    Utilities.sleep(45000);
    ev.deleteEvent();
    log.push('\u2705 \u6e2c\u8a66\u6d3b\u52d5\u5df2\u522a\u9664\uff0c\u65e5\u66c6\u5df2\u9084\u539f');
  } catch (e) {
    log.push('\u274c Calendar FAIL \u2192 ' + e.message);
  }

  log.push('');
  log.push('DRY_RUN = ' + CFG.DRY_RUN +
    (CFG.DRY_RUN ? '  \u26a0\ufe0f \u4ecd\u7136\u662f true\uff0c\u6b63\u5f0f\u4e0a\u7dda\u524d\u6539 false'
                 : '  \u2705 \u5df2\u958b\u653e\u771f\u767c\u9001'));
  log.push('CALENDAR_NAME = ' + CFG.CALENDAR_NAME);
  log.push('CALENDAR_GUESTS = ' + CFG.CALENDAR_GUESTS);
  Logger.log(log.join('\n'));
  return log.join('\n');
}

function _staffEmails() {
  return _read(T.STAFF).rows
    .map(r => String(r[0]).toLowerCase())
    .filter(e => e.indexOf('@') > 0);
}

function _calendar() {
  const want = String(CFG.CALENDAR_NAME || '').trim();
  if (!want || want.toLowerCase() === 'primary' || want.toLowerCase() === 'default') {
    return CalendarApp.getDefaultCalendar();
  }
  const hits = CalendarApp.getCalendarsByName(want);
  if (hits && hits.length) return hits[0];
  Logger.log('\u26a0\ufe0f \u627e\u5514\u5230\u65e5\u66c6 "' + want +
             '"\uff0c\u6539\u7528\u9810\u8a2d\u65e5\u66c6\u3002\u73fe\u6709\u65e5\u66c6\uff1a\n' +
             listCalendars().join('\n'));
  return CalendarApp.getDefaultCalendar();
}

/** 喺編輯器 Run 呢個 function 就會列出你所有日曆嘅正確名稱。 */
function listCalendars() {
  return CalendarApp.getAllCalendars().map(function (c) {
    return '  ' + c.getName() + '  \u2014 \u6211\u55ba\u9762\u53ef\u5beb\uff1a' +
           (c.isOwnedByMe() ? 'yes (owner)' : 'shared');
  });
}

function _createCalendarEvent(name, email, type, start, end, dur, days, otDate, eventName, reason, comment) {
  const cal = _calendar();
  const calName = cal.getName();
  if (CFG.DRY_RUN) {
    Logger.log('[DRY RUN] would create calendar event on "' + calName + '": ' + name + ' \u00b7 ' +
               type + ' \u00b7 ' + _iso(start) + ' \u2192 ' + _iso(end) + ' (' + days + 'd)');
    return '';
  }

  const half = String(dur).indexOf('Half Day') >= 0;
  const am = String(dur).indexOf('0900') >= 0;
  const clean = String(type).replace(/\s+Leave$/, '').trim();   // 'Annual Leave' → 'Annual'

  let title = name + ' - ' + type + (half ? ' (Half Day)' : ' (Full Day)');
  const why = String(reason || '').trim();
  if (why && why !== '.' && why !== '-') {
    title += ' \u00b7 ' + (why.length > 38 ? why.slice(0, 37) + '\u2026' : why);
  }

  const desc = [
    'Staff: ' + name + ' <' + email + '>',
    'Type: ' + type,
    'Dates: ' + _iso(start) + ' \u2192 ' + _iso(end),
    'Duration: ' + dur + ' (' + days + ' day' + (days === 1 ? '' : 's') + ')',
    why ? ('Reason: ' + why) : '',
    String(comment || '').trim() ? ('Manager remark: ' + String(comment).trim()) : '',
    otDate ? ('OT date: ' + _iso(otDate)) : '',
    eventName ? ('Event: ' + eventName) : '',
    '',
    'Created automatically by Firebean Leave App'
  ].filter(function (x) { return x !== ''; }).join('\n');

  let gl = [];
  if (CFG.CALENDAR_GUESTS === 'all') gl = _staffEmails();
  else if (CFG.CALENDAR_GUESTS === 'requester') gl = [email, CFG.MANAGER_EMAIL];
  gl = gl.map(function (e) { return String(e || '').toLowerCase().trim(); })
         .filter(function (e) { return e.indexOf('@') > 0; })
         .filter(function (e, i, a) { return a.indexOf(e) === i; });
  const opts = { description: desc, sendInvites: true };
  if (gl.length) opts.guests = gl.join(',');

  let ev;
  if (half) {
    // 半日 → 用有時段嘅 event，同人手輸入嘅 9am / 2pm 一樣
    const a = new Date(start.getTime()); a.setHours(am ? 9 : 14, 0, 0, 0);
    const b = new Date(start.getTime()); b.setHours(am ? 13 : 18, 0, 0, 0);
    ev = cal.createEvent(title, a, b, opts);
  } else {
    const endExclusive = new Date(end.getTime());
    endExclusive.setDate(endExclusive.getDate() + 1);   // Google all-day 嘅 end 係 exclusive
    ev = cal.createAllDayEvent(title, start, endExclusive, opts);
  }
  Logger.log('Calendar event created on "' + calName + '": ' + title + ' \u2192 ' + ev.getId());
  return ev.getId();
}

function _send(o) {
  if (CFG.DRY_RUN) {
    Logger.log('[DRY RUN] email → ' + o.to + ' | ' + o.subject);
    return;
  }
  MailApp.sendEmail(o);
}

function _emailNewRequest(sess, d) {
  const lines = [
    'Staff: ' + sess.name + ' (' + sess.email + ')',
    'Type: ' + d.type,
    'Dates: ' + _iso(d.start) + ' \u2192 ' + _iso(d.end),
    'Duration: ' + d.dur,
    'Days: ' + d.days,
    d.otDate ? ('OT date: ' + _iso(d.otDate)) : '',
    d.eventName ? ('Event: ' + d.eventName) : '',
    d.reason ? ('Reason: ' + d.reason) : ''
  ].filter(Boolean).join('\n');

  _send({
    to: CFG.MANAGER_EMAIL,
    subject: 'New leave request: ' + sess.name + ' \u2014 ' + d.type + ' (' + d.days + ' days)',
    body: 'A new leave request is waiting for your approval.\n\n' + lines + '\n\nOpen the Firebean Leave App to action it.'
  });

  _send({
    to: sess.email,
    subject: 'Leave request received \u2014 pending approval',
    body: 'Hi ' + sess.name + ',\n\nWe have received your request. It is now with Dickson for approval and you will be notified once it is decided.\n\n' + lines
  });
}

function _emailDecision(d) {
  const lines = [
    'Type: ' + d.type,
    'Dates: ' + _iso(d.start) + ' \u2192 ' + _iso(d.end),
    'Days: ' + d.days,
    d.otDate ? ('OT date: ' + _iso(d.otDate)) : '',
    d.eventName ? ('Event: ' + d.eventName) : '',
    d.comment ? ('Note: ' + d.comment) : ''
  ].filter(Boolean).join('\n');

  if (d.decision === 'Approved') {
    const b = _balanceFor(d.email, _today());
    _send({
      to: d.email,
      subject: 'Leave approved: ' + d.type + ' (' + d.days + ' days)',
      body: 'Hi ' + d.name + ',\n\nYour leave has been approved and added to the team calendar.\n\n' + lines +
            '\n\nAnnual leave: accrued ' + b.accrued +
            (b.accruedTo ? ' (to ' + _monthLabel(b.accruedTo) + ')' : '') +
            ' \u00b7 used ' + b.used + ' \u00b7 left ' + b.available +
            '.\n\n(Firebean Leave App)'
    });
    _send({
      to: CFG.MANAGER_EMAIL,
      subject: 'You approved ' + d.name + ' \u2014 ' + d.type,
      body: 'Approved and added to the calendar.\n\n' + lines
    });
  } else {
    _send({
      to: d.email,
      subject: 'Leave request not approved: ' + d.type,
      body: 'Hi ' + d.name + ',\n\nYour leave request was not approved.\n\n' + lines + '\n\nPlease speak to Dickson if you have any questions.'
    });
  }
}

/* ============================================================
 *  寫返 Staff!Current Annual Leave
 * ============================================================ */

function _syncStaffBalance() {
  const sh = _sheet(T.STAFF);
  const v = sh.getDataRange().getValues();
  const today = _today();
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const email = String(v[i][0] || '').toLowerCase();
    if (!email) continue;
    const b = _balanceFor(email, today);
    sh.getRange(i + 1, 6).setValue(b.available);   // F = Current Annual Leave
    n++;
  }
  return n;
}

/* ============================================================
 *  低階工具
 * ============================================================ */

function _activeEmail() {
  // 只認 active user。絕對唔可以用 getEffectiveUser() 做 fallback，
  // 否則一旦識別失敗，所有訪客都會被當成 Dickson（嚴重安全漏洞）。
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
  catch (x) { return ''; }
}

/**
 * 用邊張 Sheet？
 * 1. 如果 script 係「綁定」喺某張 Sheet（由該 Sheet → 擴充功能 → Apps Script 建立），
 *    就用嗰張。所以「測試副本」同「正式版」可以共用同一份 code，唔需要改 ID。
 * 2. 如果係獨立 script，就 fallback 去 CFG.SHEET_ID。
 */
function _ss() {
  try {
    const bound = SpreadsheetApp.getActiveSpreadsheet();
    if (bound) return bound;
  } catch (e) {}
  return SpreadsheetApp.openById(CFG.SHEET_ID);
}
function _sheet(name) {
  const sh = _ss().getSheetByName(name);
  if (!sh) throw new Error('Sheet tab not found: ' + name);
  return sh;
}

function _read(name) {
  const sh = _sheet(name);
  const v = sh.getDataRange().getValues();
  if (!v.length) return { sheet: sh, header: [], rows: [] };
  const header = v[0];
  const rows = v.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
  return { sheet: sh, header: header, rows: rows };
}

function _num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function _date(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'string' && v.trim() !== '') {
    const t = v.trim();
    let m = t.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);          // YYYY-MM-DD
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);              // M/D/YYYY
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    const d = new Date(t);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

function _iso(d) { return d ? Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd') : ''; }

function _id() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 8);
}

function _myRequests(email) {
  const req = _read(T.REQ);
  const out = [];
  for (let i = req.rows.length - 1; i >= 0; i--) {
    const r = req.rows[i];
    if (String(r[1]).toLowerCase() !== email) continue;
    out.push(_reqObj(r));
  }
  return out;
}

function _allRequests(status, limit) {
  const req = _read(T.REQ);
  const out = [];
  for (let i = req.rows.length - 1; i >= 0; i--) {
    const r = req.rows[i];
    if (status && String(r[11]).trim() !== status) continue;
    out.push(_reqObj(r));
    if (limit && out.length >= limit) break;
  }
  return out;
}

function _reqObj(r) {
  const s = _date(r[4]), e = _date(r[5]);
  return {
    id: String(r[0] || ''),
    email: String(r[1] || ''),
    name: String(r[2] || ''),
    type: String(r[3] || ''),
    start: s ? _iso(s) : String(r[4] || ''),
    end: e ? _iso(e) : String(r[5] || ''),
    duration: String(r[6] || ''),
    reason: String(r[8] || ''),
    otDate: _date(r[9]) ? _iso(_date(r[9])) : '',
    eventName: String(r[10] || ''),
    status: String(r[11] || ''),
    comment: String(r[12] || ''),
    days: _num(r[13]),
    calId: String(r[14] || '')
  };
}

/* ============================================================
 *  一次性工具（喺編輯器手動執行）
 * ============================================================ */

/** 重算全部 Requests 嘅 Numeric Duration（修正舊紀錄） */
function repairAllDurations() {
  const sh = _sheet(T.REQ);
  const v = sh.getDataRange().getValues();
  const hol = _holidaySet();
  let fixed = 0;
  for (let i = 1; i < v.length; i++) {
    if (!String(v[i][0]).trim()) continue;
    const s = _date(v[i][4]), e = _date(v[i][5]);
    if (!s || !e) continue;
    const d = _computeDays(s, e, String(v[i][6]));
    if (Math.abs(_num(v[i][13]) - d) > 0.001) {
      sh.getRange(i + 1, 14).setValue(d);
      fixed++;
    }
  }
  return 'Fixed ' + fixed + ' rows';
}

/** 檢查環境（部署前跑一次） */
function selfTest() {
  const out = [];
  out.push('Signed in as: ' + _activeEmail());
  out.push('Staff rows: ' + _read(T.STAFF).rows.length);
  out.push('Requests rows: ' + _read(T.REQ).rows.length);
  out.push('HK_Holidays rows: ' + _read(T.HOL).rows.length);
  out.push('Entitlement_History rows: ' + _read(T.HIST).rows.length);
  out.push('First holiday: ' + Object.keys(_holidaySet()).sort()[0]);
  const s = getSession();
  out.push('Role: ' + (s.ok ? s.role + ' / isManager=' + s.isManager : 'NOT IN STAFF'));
  if (s.ok) {
    const b = _balanceFor(s.email, _today());
    out.push('My balance: accrued ' + b.accrued + ' / used ' + b.used + ' / available ' + b.available);
  }
  out.push('Today: ' + _iso(_today()));
  return out.join('\n');
}
