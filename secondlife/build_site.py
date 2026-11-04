#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_site.py — 產生「灣區第二人生」staging dummy 網站（11 頁靜態 HTML）。

依設計文件：/opt/data/secondlife/design-v2-buildplan.md
數字台帳：/opt/data/secondlife/research-facts.md（所有數字必須出自該檔，附來源+日期）

用法：
  python3 build_site.py                 # 寫入 /opt/data/github/Firebean-Website/secondlife/
  python3 build_site.py --out /tmp/x    # 寫去其他目錄（測試用）

安全：只新增檔案；唔改、唔刪任何現有檔案；唔 commit、唔 push。
"""

import argparse
import os
import sys

WA = "https://wa.me/85296229372?text="
SLUG = "secondlife"
AS_OF = "2026-11-03"

# ── 漏斗 deep link（凍結代號）──────────────────────────────────────────────
FUNNEL = {
    "care":  "SL-CARE",
    "prop":  "SL-PROP",
    "car":   "SL-CAR",
    "body":  "SL-BODY",
}
PREFILL = {
    "care": "你好，我想了解大灣區安老院轉介服務 [SL-CARE]",
    "prop": "你好，我想了解大灣區置業資訊 [SL-PROP]",
    "car":  "你好，我想了解大灣區出行同買車安排 [SL-CAR]",
    "body": "你好，我想了解內地體檢團 [SL-BODY]",
}


def wa_link(key, label="用 WhatsApp 問一問", cls="btn"):
    from urllib.parse import quote
    href = WA + quote(PREFILL[key], safe="")
    return f'<a class="{cls}" href="{href}" rel="noopener">{label}</a>'


# ── 共用樣式（凍結 token，見 buildplan §1）────────────────────────────────
CSS = """
:root{
  --brand:#123B33; --brand-2:#1B5A4E; --bg:#F6F1E7; --card:#FFFCF6;
  --cta:#C2571C; --cta-hover:#A3460F; --data:#24384A;
  --notice-bg:#FFF6E0; --notice-line:#C99A2E;
  --ink:#1A1A1A; --ink-2:#4A4A4A; --line:#DED5C4;
  --ok:#1E6B4F; --warn:#8A5A00; --radius:12px; --maxw:1120px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;
  font-size:18px; line-height:1.75;
  padding-bottom:calc(76px + env(safe-area-inset-bottom));
}
h1,h2{font-family:"Noto Serif TC","Songti TC",serif; line-height:1.35; margin:0 0 .5em}
h1{font-size:clamp(28px,5.2vw,48px); font-weight:900; letter-spacing:.01em}
h2{font-size:clamp(22px,3.4vw,32px); font-weight:700; margin-top:0}
h3{font-size:20px; font-weight:700; margin:0 0 .4em}
p{margin:0 0 1em}
a{color:var(--brand-2)}
.wrap{max-width:var(--maxw); margin:0 auto; padding:0 20px}
.num{font-variant-numeric:tabular-nums}

/* 頂欄 */
header.top{background:var(--brand); color:#fff; position:sticky; top:0; z-index:50; box-shadow:0 2px 8px rgba(0,0,0,.18)}
.top-in{max-width:var(--maxw); margin:0 auto; padding:12px 20px; display:flex; align-items:center; gap:16px; flex-wrap:wrap}
.brand{font-family:"Noto Serif TC",serif; font-weight:900; font-size:21px; color:#fff; text-decoration:none; margin-right:auto}
.brand small{display:block; font-family:"Noto Sans TC",sans-serif; font-weight:400; font-size:12px; opacity:.85; letter-spacing:.08em}
nav.main{display:flex; gap:4px; flex-wrap:wrap}
nav.main a{color:#EAF2EF; text-decoration:none; font-size:15px; padding:9px 11px; border-radius:8px; min-height:44px; display:flex; align-items:center}
nav.main a:hover,nav.main a[aria-current]{background:rgba(255,255,255,.16); color:#fff}

/* Hero */
.hero{background:linear-gradient(165deg,var(--brand) 0%,var(--brand-2) 100%); color:#fff; padding:clamp(36px,7vw,80px) 0}
.hero h1{color:#fff; max-width:20em}
.hero .lead{font-size:clamp(18px,2.2vw,22px); color:#DCE9E5; max-width:34em}
.hero .cta-row{display:flex; gap:12px; flex-wrap:wrap; margin-top:24px}
.btn{display:inline-flex; align-items:center; justify-content:center; gap:8px;
  background:var(--cta); color:#fff !important; text-decoration:none; font-weight:700;
  padding:14px 22px; border-radius:10px; min-height:48px; font-size:17px; border:2px solid var(--cta)}
.btn:hover{background:var(--cta-hover); border-color:var(--cta-hover)}
.btn.ghost{background:transparent; border-color:rgba(255,255,255,.65); color:#fff !important}
.btn.ghost:hover{background:rgba(255,255,255,.16)}
.btn.sm{font-size:16px; padding:11px 16px; min-height:44px}
.btn.dark{background:var(--brand); border-color:var(--brand)}
.btn.dark:hover{background:var(--brand-2); border-color:var(--brand-2)}

/* 區塊 */
section{padding:clamp(32px,5vw,64px) 0}
section.alt{background:#FBF7EE}
.kicker{display:inline-block; background:var(--notice-bg); color:var(--warn); border-left:4px solid var(--notice-line);
  padding:5px 12px; border-radius:0 6px 6px 0; font-size:15px; font-weight:700; margin-bottom:12px}
.grid{display:grid; gap:18px}
.g2{grid-template-columns:1fr}
.g3{grid-template-columns:1fr}
@media (min-width:700px){.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}}
.card{background:var(--card); border:1px solid var(--line); border-radius:var(--radius);
  padding:22px; box-shadow:0 1px 2px rgba(0,0,0,.05)}
.card h3{color:var(--brand)}
.card .big{font-family:"Noto Serif TC",serif; font-size:clamp(26px,4vw,38px); font-weight:900; color:var(--brand); display:block; line-height:1.2}
.card .big.o{color:var(--cta)}
.card p{font-size:17px; color:var(--ink-2); margin-bottom:.6em}

/* 表格 */
.tscroll{overflow-x:auto}
.dtable{width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; font-size:16px}
.dtable th{background:var(--data); color:#fff; text-align:left; padding:12px 14px; font-weight:700; font-size:16px}
.dtable td{padding:12px 14px; border-top:1px solid var(--line); vertical-align:top}
.dtable tr:nth-child(even) td{background:#FBF7EE}
.dtable .hi{color:var(--ok); font-weight:700}
.dtable .lo{color:var(--warn); font-weight:700}
@media (max-width:640px){
  .tscroll{overflow-x:visible}
  .dtable{font-size:16px; border:none; background:transparent}
  .dtable thead{display:none}
  .dtable tr{display:block; border:1px solid var(--line); border-radius:10px; margin-bottom:12px; background:var(--card); overflow:hidden}
  .dtable td{display:block; border:none; border-bottom:1px dashed var(--line); padding:10px 14px}
  .dtable td:last-child{border-bottom:none}
  .dtable td::before{content:attr(data-label); display:block; font-weight:700; color:var(--ink-2); font-size:14px; margin-bottom:2px}
  .dtable tr:nth-child(even) td{background:transparent}
}
.src{font-size:14px; color:var(--ink-2); margin-top:8px; line-height:1.6}

/* 披露框 */
.notice{background:var(--notice-bg); border-left:5px solid var(--notice-line); border-radius:0 10px 10px 0; padding:18px 20px; margin:20px 0}
.notice h3{color:var(--warn); font-size:18px}
.notice ul{margin:.4em 0 0; padding-left:1.2em}
.notice li{margin-bottom:.45em; font-size:16px}

ul.plain{padding-left:1.15em}
ul.plain li{margin-bottom:.55em}
.pill{display:inline-block; background:#E7F1ED; color:var(--brand); font-size:14px; font-weight:700; padding:3px 10px; border-radius:999px; margin:0 6px 6px 0}
details.faq{border:1px solid var(--line); border-radius:10px; background:var(--card); padding:0; margin-bottom:12px}
details.faq summary{cursor:pointer; padding:16px 20px; font-weight:700; min-height:44px; display:flex; align-items:center; font-size:18px}
details.faq[open] summary{border-bottom:1px solid var(--line)}
details.faq .body{padding:14px 20px}
details.faq .body p{font-size:17px}

/* sticky WhatsApp bar（手機） */
.stickybar{position:fixed; left:0; right:0; bottom:0; z-index:60; background:var(--brand); border-top:3px solid var(--cta);
  padding:10px 14px calc(10px + env(safe-area-inset-bottom)); display:flex; gap:10px; align-items:center; justify-content:center}
.stickybar .lbl{color:#DCE9E5; font-size:15px; font-weight:700; margin-right:auto}
.stickybar .btn{flex:0 0 auto}
@media (min-width:900px){.stickybar{display:none} body{padding-bottom:0}}

footer.bot{background:#0E2C26; color:#C7D8D3; padding:40px 0 30px; font-size:16px}
footer.bot h4{color:#fff; font-size:17px; margin:0 0 10px}
footer.bot a{color:#9FD0C2}
footer.bot .cols{display:grid; gap:26px; grid-template-columns:1fr}
@media (min-width:700px){footer.bot .cols{grid-template-columns:2fr 1fr 1fr}}
footer.bot .fine{border-top:1px solid #24463E; margin-top:24px; padding-top:16px; font-size:14px; color:#9FB5AF}
.ph{background:repeating-linear-gradient(45deg,#EDE6D8,#EDE6D8 10px,#E3DACA 10px,#E3DACA 20px);
  border:1px dashed #B7A98C; border-radius:10px; color:#6B5E45; display:flex; align-items:center; justify-content:center;
  text-align:center; font-size:15px; padding:26px 16px; min-height:130px}
.bar{background:#EDE6D8; border-radius:6px; height:14px; overflow:hidden; margin:10px 0 4px}
.bar span{display:block; height:100%; background:var(--brand)}
.bar.o span{background:var(--cta)}
"""

def head(title, desc, page):
    return f"""<!doctype html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>{title}｜灣區第二人生（Staging 示範版）</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#123B33">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700;900&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<header class="top"><div class="top-in">
  <a class="brand" href="/{SLUG}/">灣區第二人生<small>SECOND LIFE · 宜居樂（珠海）企業服務</small></a>
  <nav class="main">
    {nav(page)}
  </nav>
</div></header>
"""

NAVITEMS = [
    ("index", "首頁", ""),
    ("trend", "西移大趨勢", "trend.html"),
    ("cities", "城市指南", "cities.html"),
    ("care", "安老院轉介", "care.html"),
    ("property", "置業", "property.html"),
    ("car", "出行", "car.html"),
    ("checkup", "內地體檢團", "checkup.html"),
    ("about", "關於我們", "about.html"),
    ("faq", "常見問題", "faq.html"),
    ("disclosure", "風險披露", "disclosure.html"),
    ("contact", "聯絡我們", "contact.html"),
]


def nav(cur):
    out = []
    for slug, label, href in NAVITEMS:
        if slug == "index":
            h = f"/{SLUG}/"
        else:
            h = href
        cur_attr = ' aria-current="page"' if slug == cur else ""
        out.append(f'<a href="{h}"{cur_attr}>{label}</a>')
    return "\n    ".join(out)


def footer():
    from urllib.parse import quote
    sticky_href = WA + quote(PREFILL["care"], safe="")
    return f"""
<footer class="bot"><div class="wrap">
  <div class="cols">
    <div>
      <h4>灣區第二人生 · Second Life</h4>
      <p>香港人北上大灣區（中山 · 珠海）退休、置業、安老院轉介及內地體檢團的實地顧問服務。</p>
      <p>營運實體：<strong>宜居樂（珠海）企業服務有限公司</strong><br>
      創辦人：Causson 朱嘉信</p>
    </div>
    <div>
      <h4>服務</h4>
      <p><a href="/{SLUG}/care.html">安老院轉介</a><br>
      <a href="/{SLUG}/property.html">置業</a><br>
      <a href="/{SLUG}/car.html">出行</a><br>
      <a href="/{SLUG}/checkup.html">內地體檢團</a></p>
    </div>
    <div>
      <h4>關於</h4>
      <p><a href="/{SLUG}/about.html">關於我們</a><br>
      <a href="/{SLUG}/faq.html">常見問題</a><br>
      <a href="/{SLUG}/disclosure.html">風險披露與免責</a><br>
      <a href="/{SLUG}/contact.html">聯絡我們</a></p>
    </div>
  </div>
  <div class="fine">
    <p><strong>本頁為 Staging 示範版（dummy）。</strong>未經法律審閱，未對外發佈，頁面內所有示範數據僅供內部討論之用，不可作為任何決定依據。</p>
    <p>本網站提供的數字均標明來源及資料截止日期，資料截至 {AS_OF}。政策及價格會變動，實際情況請向官方渠道及專業人士核實。本網站不提供醫療、法律或投資建議。</p>
    <p>© 2026 宜居樂（珠海）企業服務有限公司 · 灣區第二人生</p>
  </div>
</div></footer>
<div class="stickybar">
  <span class="lbl">想了解多啲？</span>
  <a class="btn sm" href="{sticky_href}" rel="noopener">WhatsApp 問一問</a>
</div>
"""


def notice(items, title="請注意：以下係你決策前必須知嘅事"):
    lis = "".join(f"<li>{i}</li>" for i in items)
    return f'<div class="notice"><h3>{title}</h3><ul>{lis}</ul></div>'


def src(text):
    return f'<p class="src">資料來源：{text}　·　資料截至 {AS_OF}。價格及政策會變動，以官方最新公布為準。</p>'


def dtable(headers, rows, srcline):
    """rows: list of list of (text, datalabel)"""
    th = "".join(f"<th>{h}</th>" for h in headers)
    trs = []
    for r in rows:
        tds = "".join(f'<td data-label="{lab}">{val}</td>' for val, lab in r)
        trs.append(f"<tr>{tds}</tr>")
    return (f'<div class="tscroll"><table class="dtable"><thead><tr>{th}</tr></thead>'
            f'<tbody>{"".join(trs)}</tbody></table></div>' + src(srcline))


def cta_block(key, heading, text, label="用 WhatsApp 問一問"):
    return (f'<div class="card" style="background:var(--brand); border-color:var(--brand)">'
            f'<h3 style="color:#fff">{heading}</h3>'
            f'<p style="color:#DCE9E5">{text}</p>'
            f'{wa_link(key, label, "btn")}</div>')


def page(title, desc, slug, body):
    return head(title, desc, slug) + body + footer() + "\n</body>\n</html>\n"


# ══════════════════════════════════════════════════════════════════════════
# 頁面內容
# ══════════════════════════════════════════════════════════════════════════

def p_index():
    b = f"""
<section class="hero"><div class="wrap">
  <h1>灣區第二人生<br>用同一筆錢，換一種生活方式</h1>
  <p class="lead">香港嘅生活成本、居住面積同安老院輪候時間，係好多人退休前先發現嘅難題。
  一個鐘生活圈之外，中山同珠海提供咗另一個答案。呢個網站唔會叫你即刻決定 —— 我哋只係把數字攤開，等你睇完先講。</p>
  <div class="cta-row">
    {wa_link("care", "用 WhatsApp 問一問", "btn")}
    <a class="btn ghost" href="#tools">試用退休預算示範計算器</a>
  </div>
</div></section>

<section><div class="wrap">
  <span class="kicker">先講現實</span>
  <h2>香港退休面前嘅三組數字</h2>
  <div class="grid g3">
    <div class="card"><span class="big num">22 個月</span>
      <p>輪候資助護理安老宿位（津助及合約院舍）嘅平均輪候時間。截至 2026 年 1 月底，有 17,894 人喺中央輪候冊上。</p></div>
    <div class="card"><span class="big num">HK$7,000 – 25,000+</span>
      <p>香港私營安老院每月收費區間（視地區、房型、護理程度）。合約院舍及自負盈虧院舍非資助宿位可達每月 HK$12,000 – 60,000。</p></div>
    <div class="card"><span class="big num">HK$3,000</span>
      <p>在香港，呢個租金大約只夠租一個車位。喺中山，同一個數已經接近月供一個 80 平方米單位。</p></div>
  </div>
  {src("社會福利署《輪候資助長者住宿照顧服務的人數》(2026-01)；長者服務資訊網《香港老人院收費參考 2026》；市場約數，個別單位差異可以好大。")}
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">我哋做咩</span>
  <h2>四條路，你想行邊條？</h2>
  <p>呢個網站唔係一個「睇樓團」廣告。每一條路都係獨立嘅事，你可以只揀一條。</p>
  <div class="grid g2" style="margin-top:22px">
    <div class="card"><h3>安老院轉介</h3>
      <p>由香港嘅輪候現實講起，到政府「廣東院舍照顧服務計劃」點樣幫你免院費，再到內地院舍實際月費同試住安排。</p>
      {wa_link("care", "了解安老院轉介", "btn sm")}</div>
    <div class="card"><h3>置業</h3>
      <p>把「買樓」當成退休資產配置，而唔係炒賣。中珠惠三地實際樓價、首付政策、流程，同埋你必須知嘅樓價風險。</p>
      {wa_link("prop", "了解置業安排", "btn sm")}</div>
    <div class="card"><h3>出行</h3>
      <p>上去之後點樣周圍走、點樣返香港探親。金巴、深中通道、跨境七人車、港車北上嘅實際時間同價錢。</p>
      {wa_link("car", "了解出行安排", "btn sm")}</div>
    <div class="card"><h3>內地體檢團</h3>
      <p>香港驗身要過萬先驗得詳細，內地同樣項目價錢差幾倍。仲可以順便親身睇下當地生活係咩一回事，包專車接送。</p>
      {wa_link("body", "了解體檢團", "btn sm")}</div>
  </div>
</div></section>

<section><div class="wrap">
  <span class="kicker">數字對照</span>
  <h2>香港 vs 中山 / 珠海 vs 惠州</h2>
  <p>以下係市場約數，用嚟建立概念。實際價錢視地段、樓層、裝修同時間而定。</p>
  {dtable(["項目", "中山", "珠海", "惠州"], [
      [("平均樓價（每平方米）", "項目"), ("¥12,000 – 16,000", "中山"), ("¥20,000 – 35,000", "珠海"), ("¥8,000 – 12,000", "惠州")],
      [("兩房單位月租", "項目"), ("¥1,500 – 2,500", "中山"), ("¥2,500 – 4,500", "珠海"), ("¥1,200 – 2,000", "惠州")],
      [("人均每餐餐飲", "項目"), ("¥20 – 50", "中山"), ("¥30 – 80", "珠海"), ("¥15 – 40", "惠州")],
      [("的士起錶", "項目"), ("¥8", "中山"), ("¥10", "珠海"), ("¥8", "惠州")],
      [("官方住宅單價參考", "項目"), ("2025 年約 ¥11,140／㎡", "中山"), ("2025 年全市網簽均價約 ¥19,940／㎡", "珠海"), ("—", "惠州")],
  ], "中山市國民經濟和社會發展統計公報（轉引南方日報，2026-06-12）；中原澳門及珠海橫琴《2025 年樓市回顧》(2026-01-06)；市場約數為綜合整理，非官方統計。")}
  <p><a href="/{SLUG}/cities.html">睇完整九個城市對比 →</a></p>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">冇人講嘅情緒</span>
  <h2>子女過去探你，就好似去一次旅行</h2>
  <div class="grid g2">
    <div class="card">
      <p>呢個係好多香港家庭真正嘅顧慮：唔係錢，係「見唔到仔女、見唔到孫」。</p>
      <p>由香港去珠海，港珠澳大橋金巴 24 小時行駛，口岸至口岸約 40 至 55 分鐘；去中山，深中通道通車後深圳至中山由約 2 小時縮短至約 30 分鐘。</p>
      <p>意思係：星期六朝早出門，中午一齊飲茶，下晝去行下商場，夜晚食完飯返香港 —— 呢個唔係離別，係週末。</p>
      {wa_link("car", "睇交通同出行安排", "btn sm")}
    </div>
    <div class="ph">實景相待客戶提供<br><small>（本頁為 staging 示範版，未使用任何示意圖或購買圖片）</small></div>
  </div>
  {src("港珠澳大橋穿梭巴士（金巴）官方網站；深中通道通車報道（2024-06-28）。")}
</div></section>

<section id="tools"><div class="wrap">
  <span class="kicker">示範／模擬，未接駁正式系統</span>
  <h2>退休預算示範計算器</h2>
  <p><strong>呢個係示範／模擬，未接駁正式系統。</strong>輸入你嘅情況，睇一睇粗略概念。所有結果都係<strong>估算，非正式理財建議</strong>。</p>
  <div class="card">
    <label for="mi">每月可動用收入（港幣）</label>
    <input id="mi" type="number" value="15000" min="0" step="1000" style="width:100%;max-width:260px;font-size:17px;padding:10px;border:1px solid var(--line);border-radius:8px;min-height:44px">
    <div id="out" style="margin-top:18px"></div>
    <p class="src" style="margin-top:14px">計算方式：以中山兩房月租約 ¥2,000、珠海約 ¥3,500 作起點（市場約數），再計日常開支。
    匯率以 1 人民幣 ≈ 1.09 港幣作示意。呢個係示範，未接駁正式系統，數字僅供概念參考。</p>
  </div>
  <noscript><p style="background:var(--notice-bg);border-left:5px solid var(--notice-line);padding:14px 18px;border-radius:0 8px 8px 0"><strong>示範計算器需要啟用 JavaScript 才會運作。</strong>如果你停用了 JavaScript，可以改用 WhatsApp 問我哋，我哋會直接幫你估算。</p></noscript>
  <script>
  (function(){{
    var f=document.getElementById('mi'), o=document.getElementById('out');
    function calc(){{
      var m=parseFloat(f.value)||0;
      function box(name,yue,hkd){{
        var rows=[['兩房租金',yue[0]],['日常開支',yue[1]],['醫療備用金',yue[2]]];
        var tot=yue[0]+yue[1]+yue[2], left=m-tot*1.09;
        var h='<h3 style="margin-top:6px">'+name+'</h3><table class="dtable"><thead><tr><th>項目</th><th>每月（人民幣）</th></tr></thead><tbody>';
        for(var i=0;i<rows.length;i++){{h+='<tr><td data-label="項目">'+rows[i][0]+'</td><td data-label="每月（人民幣）">¥'+rows[i][1].toLocaleString()+'</td></tr>';}}
        h+='<tr><td data-label="項目"><strong>合計（約兌港幣）</strong></td><td data-label="每月（人民幣）"><strong>約 HK$'+Math.round(tot*1.09).toLocaleString()+'</strong></td></tr>';
        h+='</tbody></table><p style="margin-top:10px">每月盈餘／差額：<strong class="num" style="color:'+(left>=0?'var(--ok)':'var(--warn)')+'">'+(left>=0?'+HK$':'−HK$')+Math.abs(Math.round(left)).toLocaleString()+'</strong></p>';
        return h;
      }}
      o.innerHTML='<div class="grid g2">'+
        '<div class="card">'+box('中山',[2000,2500,800])+'</div>'+
        '<div class="card">'+box('珠海',[3500,3500,1000])+'</div></div>';
    }}
    f.addEventListener('input',calc); calc();
  }})();
  </script>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">關於顧問</span>
  <h2>一個真正住上去嘅人</h2>
  <div class="grid g2">
    <div class="ph" style="min-height:210px">Causson 朱嘉信先生實景相待客戶提供<br><small>（本頁為 staging 示範版，未使用任何示意圖或購買圖片）</small></div>
    <div class="card">
      <h3>Causson 朱嘉信｜宜居樂（珠海）企業服務有限公司</h3>
      <p>超過 20 年香港金融保險及財富管理經驗，現已定居大灣區，親身落場做「實地顧問」。</p>
      <p>我哋唔會同你講「上去就樣樣好」。反而會同你講清楚：邊啲人適合、邊啲人唔適合、邊啲位會蝕。</p>
      <p><a href="/{SLUG}/about.html">睇完整背景 →</a></p>
    </div>
  </div>
</div></section>

<section><div class="wrap">
  <div class="notice">
    <h3>呢個網站唔會同你講嘅四件事</h3>
    <ul>
      <li><strong>冇「樣樣好」呢回事。</strong>如果你需要頻密返港覆診、或者完全唔慣用內地嘅電子支付同手機號，北上未必適合你。</li>
      <li><strong>樓價可以跌。</strong>橫琴有業主高位買入，住宅價格由每平方米約 ¥5.6 萬跌至約 ¥3.9 萬，累計跌幅約三成。中山亦有港人買入約 400 呎 Loft 單位，估值由 ¥70 萬跌至 ¥30 – 40 萬。</li>
      <li><strong>「免院費」唔代表唔需要自費。</strong>廣東院舍照顧服務計劃唔收院費，但尿片、傷口敷料、緊急救護車同計劃外項目要自費。</li>
      <li><strong>醫療券唔可以累積。</strong>長者醫療券每年 HK$2,000，用唔完唔會累積到下一年。</li>
    </ul>
  </div>
  <p>完整風險清單請睇 <a href="/{SLUG}/disclosure.html">風險披露與免責聲明</a>。</p>
</div></section>

<section class="alt"><div class="wrap">
  <h2>你可能想問</h2>
  <details class="faq"><summary>政府嘅「廣東院舍照顧服務計劃」要唔要資產審查？</summary>
    <div class="body"><p>唔需要。申請人須接受「安老服務統一評估機制」評估，確定服務需要後，就可以按評估結果申請。入住後院舍嘅食宿、護理、個人照顧及基本醫療費用由政府資助。</p>
    {src("社會福利署《廣東院舍照顧服務計劃》網頁。")}</div></details>
  <details class="faq"><summary>內地養老院係唔係平香港好多？</summary>
    <div class="body"><p>視乎城市同級別。社署公布嘅指定院舍參考月費，由惠州約 ¥3,000 – 4,000 到深圳約 ¥7,000 – 8,000 不等。相對香港私營安老院每月 HK$7,000 – 25,000+，差距可以由一半到數倍。</p>
    {src("社署《指定安老院的院費概況》(2025-09)；長者服務資訊網 (2026)。")}</div></details>
  <details class="faq"><summary>內地醫療信得過嗎？</summary>
    <div class="body"><p>呢個要分開講。內地三甲醫院設備同專科能力唔差，但<strong>香港醫生未必認受內地非三甲機構嘅影像診斷報告</strong>，臨床責任歸屬亦可能模糊。做法上，建議選擇港資背景或三甲機構、索取原始 DICOM 影像檔，並保留香港嘅醫療方案。</p>
    {src("跨境體檢及報告認受性討論（媒體綜合報道，2025-2026）；立法會跨境醫療合作文件 (2026-07)。")}</div></details>
  <p style="margin-top:20px"><a href="/{SLUG}/faq.html">睇全部常見問題 →</a></p>
</div></section>
"""
    return page("首頁", "香港人北上大灣區退休、置業、安老院轉介及內地體檢團的實地顧問服務。所有數字附來源。", "index", b)


def p_trend():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>西移大趨勢：香港人北上養老，唔係新鮮事</h1>
  <p class="lead">當交通、政策同生活成本同時改變，「上去」由一個冒險選擇，變成一個可以計算嘅選項。</p>
</div></section>

<section><div class="wrap">
  <span class="kicker">00 呢個唔係想像</span>
  <h2>人口數字擺喺眼前，係正在發生嘅事</h2>
  <div class="grid g3">
    <div class="card"><span class="big num">274 萬</span>
      <p>2046 年香港 65 歲及以上人口推算，佔總人口約 <strong>36%</strong> —— 即係每 3 個人就有 1 個係長者。</p></div>
    <div class="card"><span class="big num">近 10 萬</span>
      <p>已定居廣東省嘅香港長者人數，10 年間增加約 <strong>40.5%</strong>。</p></div>
    <div class="card"><span class="big num">1,048 人</span>
      <p>截至 2026 年 2 月底，已透過政府「廣東院舍照顧服務計劃」入住內地認可院舍嘅港人長者；認可院舍 2026-07-01 起增至 <strong>29 家</strong>。</p></div>
  </div>
  <p class="lead" style="margin-top:22px">同時，2026 年一項香港調查顯示，受訪者對北上養老最擔心嘅係<strong>醫療（45.2%）</strong>。呢個顧慮係合理嘅 —— 所以我哋把風險寫喺〈風險披露與免責聲明〉同每一條服務線裡面，而唔係收埋喺細字。</p>
  {src("政府統計處《香港人口推算》；政府新聞公報及媒體綜合報道 (2026)；立法會及媒體報道 (2026)；2026 年香港養老意向調查（媒體轉引）。")}
</div></section>

<section><div class="wrap">
  <span class="kicker">01 交通時空逆轉</span>
  <h2>一個鐘生活圈，已經成形</h2>
  {dtable(["通道", "通車 / 實施", "實際時間", "費用"], [
      [("深中通道", "通道"), ("2024-06-30", "通車 / 實施"), ("深圳至中山由約 2 小時縮短至約 30 分鐘", "實際時間"), ("標準車次 ¥66", "費用")],
      [("港珠澳大橋（金巴）", "通道"), ("24 小時營運", "通車 / 實施"), ("口岸至口岸約 40 – 55 分鐘，繁忙時段約 5 分鐘一班", "實際時間"), ("香港→珠海 日間 HK$65／夜間 HK$70；65 歲或以上半價", "費用")],
      [("中山往返香港跨境大巴", "通道"), ("深中通道通車後", "通車 / 實施"), ("由約 2 小時 30 分縮短至約 1 小時 45 分", "實際時間"), ("—", "費用")],
      [("珠海九洲港 ↔ 香港", "通道"), ("現行", "通車 / 實施"), ("航程約 70 分鐘；每日約 7 班", "實際時間"), ("成人普通位單程約 HK$200、來回約 HK$340", "費用")],
      [("港車北上", "通道"), ("2023-07-01", "通車 / 實施"), ("每次入境連續停留不超過 30 日、每年累計不超過 180 日", "實際時間"), ("—", "費用")],
  ], "港珠澳大橋穿梭巴士官方網站；深中通道通車報道 (2024-06-28)；港車北上官方網站；TurboJET 價目表。船票價格按航班日期浮動。")}
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">02 居住降維打擊</span>
  <h2>同一個價錢，空間差幾倍</h2>
  <div class="grid g3">
    <div class="card"><h3>香港</h3>
      <div class="bar o"><span style="width:100%"></span></div>
      <p>HK$3,000 租金 ≈ 一個車位。</p>
      <p>平均樓價以每平方米計，市區普通住宅動輒十數萬港元起。</p></div>
    <div class="card"><h3>中山</h3>
      <div class="bar"><span style="width:26%"></span></div>
      <p>市場約數 ¥12,000 – 16,000／㎡；官方統計 2025 年商品住宅銷售單價約 ¥11,140／㎡。</p>
      <p>月供 ¥3,000 已接近一個 80 平方米單位。</p></div>
    <div class="card"><h3>珠海</h3>
      <div class="bar"><span style="width:52%"></span></div>
      <p>市場約數 ¥20,000 – 35,000／㎡；2025 年全市網簽均價約 ¥19,940／㎡，較上年跌約 7%。</p>
      <p>海濱城市，近澳門，成本較中山高。</p></div>
  </div>
  {src("中山市國民經濟和社會發展統計公報（轉引南方日報，2026-06-12）；中原澳門及珠海橫琴《2025 年樓市回顧》(2026-01-06)；市場約數為綜合整理。")}
</div></section>

<section><div class="wrap">
  <span class="kicker">03 心態由「炒賣」到「享老」</span>
  <h2>呢一輩人買樓係為咗住，唔係為咗賺</h2>
  <p>過去二十年，香港人講買樓，第一句問「會唔會升」。而家唔少年過五十嘅人，問嘅係另一條問題：「我退咗休之後，想過點樣嘅生活？」</p>
  <ul class="plain">
    <li><strong>生活成本彈性大。</strong>由十幾蚊一個飯盒到人均一千嘅餐廳都有，豐儉由人。</li>
    <li><strong>空間換時間。</strong>唔少人選擇大單位、有露台、有綠化，而唔係迫喺市區細單位。</li>
    <li><strong>生活節奏慢。</strong>飲茶、行公園、打球、社區活動，係退休生活嘅主軸。</li>
  </ul>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">04 政策平權</span>
  <h2>首付同結匯，已經唔係以前咁難</h2>
  <ul class="plain">
    <li><strong>首付比例：</strong>中國人民銀行及國家金融監督管理總局 2024 年 9 月 24 日通知，貸款購買住房家庭最低首付款比例全國統一為不低於 15%。</li>
    <li><strong>港澳居民購房結匯：</strong>人民銀行 2024 年 1 月《港澳居民購買粵港澳大灣區內地城市房產結算支付便利化業務指引》（廣東銀發〔2024〕9 號），允許港澳居民將境外購房款匯往境內同名帳戶，從境外汇入人民幣不納入「每人每天最高限額」管理，但須定向用於購房。</li>
    <li><strong>限購放寬：</strong>廣州自 2024 年 9 月 30 日起，非戶籍居民家庭及單身人士購房不再審核資格、不再限制套數（港澳人士適用）。深圳亦於 2025 至 2026 年分階段放寬多區限購。</li>
  </ul>
  {src("大灣區建設《內地政策措施》(2024-09-24)；中國政府網 (2024-01-25)；大公文匯網 (2026-04-30)；律師行政策整理 (2025-03-05)。政策會變，簽約前請向銀行及律師核實。")}
  <div style="margin-top:22px">{wa_link("prop", "想了解置業政策點應用？用 WhatsApp 問", "btn")}</div>
</div></section>

<section><div class="wrap">
  <div class="notice" style="border-left-color:#8A3B14">
    <h3>講清楚：以下幾種情況，北上退休可能唔適合你</h3>
    <ul>
      <li><strong>需要頻密返港覆診。</strong>如果你有慢性病、要定期睇專科，每次跨境嘅交通時間同成本都要保守計算。惠州等較遠城市尤其要小心。</li>
      <li><strong>完全唔識用內地工具。</strong>日常辦事要用內地手機號、微信、支付寶，唔慣會好麻煩。</li>
      <li><strong>唔接受離開原有社交圈。</strong>如果朋友、教會、街坊、晨運腳全部喺香港，搬上去會有一段好長嘅適應期。</li>
      <li><strong>想靠買樓賺錢。</strong>呢個網站唔會幫你炒樓。橫琴樓價由每平方米約 ¥5.6 萬跌至約 ¥3.9 萬，累計跌約三成，係真實發生嘅事。</li>
      <li><strong>期望「唔使錢」。</strong>政府資助免院費，但消耗品、緊急救護車、計劃外項目要自費。</li>
    </ul>
  </div>
  <p>相反，如果你係為自己或父母提早做準備、想親身睇過先決定、又願意接受「唔係樣樣同香港一樣」，呢條路值得你花一個週末去了解。</p>
  <div style="margin-top:22px">{wa_link("care", "預約實地考察團（WhatsApp）", "btn")}</div>
</div></section>
"""
    return page("西移大趨勢", "港珠澳大橋、深中通道、港車北上全面打通後，香港人北上中山珠海退休的實際交通、居住、政策與風險。", "trend", b)


def p_cities():
    cities = [
        ("深圳", "最近香港，醫療資源最豐富，成本亦最高。適合需要頻密返港、或想貼近深圳口岸嘅人。",
         "社署計劃指定院舍月費約 ¥7,000 – 8,000", "醫療券可用服務點包括香港大學深圳醫院及多間三甲醫院。"),
        ("廣州", "省會，三甲醫院密度最高，生活配套最齊。距離香港較遠。",
         "南沙區養老院、麓湖家長薈分院等指定院舍月費約 ¥5,500 起", "醫療券可用點包括多間三甲醫院。"),
        ("佛山", "粵港澳大湾区西翼，生活成本中等，部分院舍有香港機構合作營運。",
         "指定院舍月費約 ¥4,000 – 6,500 起", "需自行查核。" ),
        ("東莞", "製造業重鎮，樓價相對低，交通逐步改善。",
         "指定院舍陸續增加，2026 年 7 月新增一間醫養服務機構。", "需自行查核。"),
        ("中山", "港人退休熱點。環境清幽、節奏慢、粵語文化接近，深中通道通車後往返深圳約 30 分鐘。",
         "指定院舍月費約 ¥5,000 – 6,000", "醫療券可用點：中山陳星海中西醫結合醫院（2024-07-18 起）、中山市中醫院（2025-07-09 起）。"),
        ("珠海", "海濱城市，港珠澳大橋起點，返港最方便（金巴 24 小時）。成本較中山高。",
         "指定院舍月費約 ¥3,500 – 4,500", "醫療券可用點：中山大學附屬第五醫院、珠海市人民醫院（均 2025-06-26 起）。"),
        ("江門", "僑鄉，生活成本低，生活節奏慢。",
         "指定院舍月費約 ¥4,000 – 5,000", "需自行查核。"),
        ("惠州", "有山有海有湖，空間最大，成本最低。距離香港最遠。",
         "指定院舍月費約 ¥3,000 – 4,000", "需自行查核。適合唔需要頻密返港嘅人。"),
        ("肇慶", "最西，綠化好，成本低。距離香港最遠。",
         "指定院舍月費約 ¥4,500 起", "需自行查核。"),
    ]
    cards = []
    for name, desc, fee, med in cities:
        cards.append(f"""<div class="card">
        <h3>{name}</h3><p>{desc}</p>
        <p><span class="pill">院舍月費：{fee}</span></p>
        <p style="font-size:16px"><strong>醫療：</strong>{med}</p>
        {wa_link('care', f'問 {name} 嘅安排', 'btn sm')}
      </div>""")
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>城市指南：九個城市，九種生活</h1>
  <p class="lead">冇一個城市係「最好」。只有適唔適合你。以下按返港便利度、成本、醫療資源排列。</p>
</div></section>

<section><div class="wrap">
  <span class="kicker">成本對比</span>
  <h2>三地生活成本一覽</h2>
  {dtable(["項目", "中山", "珠海", "惠州"], [
      [("平均樓價（每平方米）", "項目"), ("¥12,000 – 16,000", "中山"), ("¥20,000 – 35,000", "珠海"), ("¥8,000 – 12,000", "惠州")],
      [("兩房單位月租（市場約數）", "項目"), ("¥1,500 – 2,500", "中山"), ("¥2,500 – 4,500", "珠海"), ("¥1,200 – 2,000", "惠州")],
      [("人均每餐餐飲", "項目"), ("¥20 – 50", "中山"), ("¥30 – 80", "珠海"), ("¥15 – 40", "惠州")],
      [("的士起錶", "項目"), ("¥8", "中山"), ("¥10", "珠海"), ("¥8", "惠州")],
  ], "市場約數（綜合整理），非官方統計。⚠️ 中山及珠海「兩房住宅」權威月租中位數未見官方公布，上述為市場約數，個別單位差異可以好大。")}
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">逐個城市睇</span>
  <h2>九個城市</h2>
  <div class="grid g2" style="margin-top:20px">
    {''.join(cards)}
  </div>
  {src("社會福利署《指定安老院的院費概況》(2025-09)；社署《廣東院舍照顧服務計劃》院舍名單 (2026-07-01)；長者醫療券發展里程。")}
</div></section>

<section><div class="wrap">
  <span class="kicker">返港便利度</span>
  <h2>由邊個口岸返香港</h2>
  {dtable(["方式", "連接", "時間", "費用"], [
      [("港珠澳大橋金巴", "方式"), ("珠海口岸人工島", "連接"), ("口岸至口岸約 40 – 55 分鐘，24 小時營運", "時間"), ("HK$65 日間／HK$70 夜間；65 歲或以上半價", "費用")],
      [("深中通道", "方式"), ("中山 ↔ 深圳", "連接"), ("約 30 分鐘（通車後）", "時間"), ("標準車次 ¥66", "費用")],
      [("中山跨境大巴", "方式"), ("中山 ↔ 香港", "連接"), ("約 1 小時 45 分", "時間"), ("實際票價請向營運商查詢", "費用")],
      [("珠海九洲港 ↔ 香港", "方式"), ("珠海 ↔ 上環／九龍", "連接"), ("航程約 70 分鐘，每日約 7 班", "時間"), ("單程約 HK$200、來回約 HK$340（按日期浮動）", "費用")],
      [("跨境七人車（點對點）", "方式"), ("香港 ↔ 珠海／中山", "連接"), ("點對點直達", "時間"), ("香港→珠海口岸約 HK$1,100 起；珠海市區約 HK$1,500 起；中山約 HK$1,900 起", "費用")],
  ], "港珠澳大橋穿梭巴士官方網站；深中通道通車報道 (2024-06-28)；TurboJET 價目表；跨境車服務商公開報價。⚠️ 門到門時間會因上落點、過關、行李及天氣而異，建議預留緩衝。")}
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">醫療資源</span>
  <h2>醫療券可以用喺邊</h2>
  <p>「長者醫療券大灣區試點計劃」已覆蓋大灣區全部九個內地城市，連同港大深圳醫院「一院兩點」，共 21 個服務點。合資格長者每年可用 HK$2,000 醫療券。</p>
  <div class="notice">
    <h3>醫療券嘅限制（要知）</h3>
    <ul>
      <li>每年 HK$2,000，<strong>不可累積</strong>，用唔完唔會留到下一年。</li>
      <li><strong>不可與國家醫保同時支付同一項服務。</strong></li>
      <li>不包括住院、須預先繳費嘅醫療服務及日間手術。</li>
      <li>不可用於單純購買物品、藥物或儀器。</li>
    </ul>
  </div>
  {src("政府新聞公報《長者醫療券大灣區試點計劃》全面覆蓋九市 (2025-08-18)；立法會 CB(3)639/2025(04)；醫療券發展里程。")}
  <div style="margin-top:20px">{wa_link("care", "想知邊個城市最適合你？用 WhatsApp 問", "btn")}</div>
</div></section>
"""
    return page("城市指南", "大灣區九個城市的生活成本、安老院月費、醫療資源及返港交通對比。", "cities", b)


def p_care():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>安老院轉介：香港等 22 個月，你可以先上去睇一次</h1>
  <p class="lead">呢一頁寫畀兩類人睇：為自己準備嘅準退休人士，同為父母奔波嘅子女。</p>
  <div class="cta-row">{wa_link("care", "用 WhatsApp 傾一傾", "btn")}</div>
</div></section>

<section><div class="wrap">
  <span class="kicker">香港嘅現實</span>
  <h2>輪候，同一個月費嘅距離</h2>
  {dtable(["項目", "數字", "說明"], [
      [("資助護理安老宿位輪候（津助及合約院舍）", "項目"), ("22 個月", "數字"), ("截至 2026 年 1 月底統計", "說明")],
      [("改善買位計劃私營安老院", "項目"), ("6 個月", "數字"), ("兩者綜合平均 12 個月", "說明")],
      [("資助護養院宿位", "項目"), ("8 個月", "數字"), ("護理需求較高者", "說明")],
      [("中央輪候冊人數", "項目"), ("17,894 人", "數字"), ("截至 2026 年 1 月底（另有 37,830 宗「非活躍」個案）", "說明")],
      [("香港私營安老院月費", "項目"), ("HK$7,000 – 25,000+", "數字"), ("視地區、房型、護理程度；合約及自負盈虧院舍可達 HK$12,000 – 60,000", "說明")],
      [("長者院舍券面值（2026-04-01 起）", "項目"), ("護理安老 $17,015／月；護養院 $21,982／月", "數字"), ("「錢跟人走」，須通過入息及資產審查定共同付款級別", "說明")],
  ], "社會福利署《輪候資助長者住宿照顧服務的人數》(2026-01)；社署《長者院舍照顧服務券計劃》；長者服務資訊網《香港老人院收費參考 2026》。")}
  <div style="margin-top:20px">{wa_link("care", "想知你／家人排到咩位置？用 WhatsApp 問", "btn")}</div>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">政府現有計劃</span>
  <h2>「廣東院舍照顧服務計劃」係咩</h2>
  <p>呢個係社會福利署推行嘅資助院舍照顧服務，讓正在中央輪候冊輪候資助護理安老宿位或護養院宿位、而有意在內地養老嘅香港長者，選擇入住廣東省內嘅認可安老院。</p>
  <div class="grid g3" style="margin-top:18px">
    <div class="card"><span class="big num">29 間</span><p>認可院舍數目（2026 年 7 月 1 日起），分布深圳、廣州、佛山、東莞、中山、珠海、江門、肇慶、惠州。</p></div>
    <div class="card"><span class="big num">免資產審查</span><p>毋須入息及資產審查，但須通過「安老服務統一評估機制」確定服務需要。</p></div>
    <div class="card"><span class="big num">6 個月</span><p>試住期。期內離開，可按原本申請日期恢復中央輪候冊位置。</p></div>
  </div>
  <ul class="plain" style="margin-top:18px">
    <li><strong>入住免院費：</strong>食宿、護理、個人照顧及基本醫療費用由政府資助。</li>
    <li><strong>醫療補貼（2025-12-22 起，為期 2 年）：</strong>由社署委託中國太平人壽保險（香港）推行 —— 門診自付費用每年上限人民幣 10,000 元，住院每年上限人民幣 30,000 元。</li>
    <li><strong>綜援長者赴粵養老試驗計劃（2025-10-01 起，為期 3 年）：</strong>每名合資格長者每月可獲 HK$5,000 資助，名額 1,000 個。</li>
    <li><strong>「廣東計劃」現金援助：</strong>高齡津貼（70 歲或以上）每月 HK$1,675；長者生活津貼（65 歲或以上）每月 HK$4,345（須入息及資產審查，並在付款年度內於廣東居住不少於 60 天）。</li>
  </ul>
  {src("社會福利署《廣東院舍照顧服務計劃》網頁及《醫療補貼試行安排》服務簡介；政府新聞公報 (2026-06-16)；立法會七題 - 本港長者入住廣東院舍 (2026-03-25)；2025 施政報告。")}
  <div style="margin-top:20px">{wa_link("care", "想知自己符唔符合資格？用 WhatsApp 問", "btn")}</div>
</div></section>

<section><div class="wrap">
  <span class="kicker">月費對照</span>
  <h2>指定院舍參考月費（人民幣）</h2>
  {dtable(["院舍", "城市", "參考月費（多人房）"], [
      [("蔚耆（廣東）養老有限公司", "院舍"), ("惠州", "城市"), ("¥3,000 – 4,000", "參考月費（多人房）")],
      [("珠海和園頤養中心 ⚠️", "院舍"), ("珠海", "城市"), ("¥3,500 – 4,500", "參考月費（多人房）")],
      [("江門市新會區養老中心", "院舍"), ("江門", "城市"), ("¥4,000 – 5,000", "參考月費（多人房）")],
      [("中山市頤康養老服務有限公司", "院舍"), ("中山", "城市"), ("¥5,000 – 6,000", "參考月費（多人房）")],
      [("深業頤居養老運營（深圳）有限公司", "院舍"), ("深圳", "城市"), ("¥7,000 – 8,000", "參考月費（多人房）")],
  ], "社會福利署《指定安老院的院費概況》(2025-09)，以多人房計，不包括前期一次性收費。⚠️ 珠海和園頤養中心因宿位緊張，已於 2026 年 6 月 12 日起停止接受新的申請。")}
  <div style="margin-top:20px">{wa_link("care", "想睇實際院舍環境？預約考察", "btn")}</div>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">醫療過河</span>
  <h2>長者醫療券同跨境醫療安排</h2>
  <ul class="plain">
    <li><strong>長者醫療券大灣區試點計劃：</strong>已覆蓋大灣區全部九個內地城市，連同港大深圳醫院「一院兩點」共 21 個服務點。合資格長者每年可用 HK$2,000，<strong>不可累積</strong>。</li>
    <li><strong>使用情況：</strong>截至 2026 年 5 月底，超過 40,600 名合資格長者曾在試點醫療機構使用醫療券，涉及約 101,000 宗交易，總額約 HK$1.03 億；使用者整體滿意度平均 9.15 分（滿分 10 分）。</li>
    <li><strong>醫管局病人先導計劃（港大深圳醫院）：</strong>2023 年 5 月推出，延長至 2027 年 3 月 31 日。每名合資格病人每次診症共付人民幣 100 元，餘額由計劃資助、每年上限人民幣 2,000 元。截至 2026 年 2 月底累計超過 6,000 名病人參加，逾六成為 65 歲或以上長者。</li>
  </ul>
  {src("立法會 CB(3)801/2026(05) 跨境醫療合作文件 (2026-07)；政府新聞公報 (2026-03-31)。")}
</div></section>

<section><div class="wrap">
  {notice([
    "<strong>「免院費」唔代表唔需要自費。</strong>計劃資助食宿、護理、個人照顧及基本醫療，但尿片、傷口敷料等消耗品、緊急救護車費用，以及計劃以外嘅額外項目要自費。大部分院舍亦要求入住時預繳醫療押金。",
    "<strong>宿位會緊張。</strong>珠海和園頤養中心已於 2026 年 6 月 12 日起停止接受新申請；部分院舍社署亦以符號標示輪候時間不確定。",
    "<strong>實際採用率仍然好低。</strong>為綜援長者而設嘅粵閩養老計劃名額 1,000 個，截至 2026 年 3 月只批核 10 宗。政策存在，但由申請到成事嘅門檻唔低 —— 唔好當佢係一條自動通道。",
    "<strong>醫療券唔可以累積。</strong>每年 HK$2,000，用唔完唔會留到下一年，亦不可與國家醫保同時支付同一項服務，不包括住院。",
    "<strong>報告認受性。</strong>香港醫生未必認受內地非三甲機構嘅影像診斷報告，臨床責任歸屬亦可能模糊。建議選港資背景或三甲機構，並索取原始影像檔。",
    "<strong>跨境救護車有限制。</strong>現行跨境直通救護車試行計劃只涵蓋深圳（港大深圳醫院）與澳門（仁伯爵綜合醫院）指定派送醫院，且不涵蓋急症個案。",
    "<strong>香港公營醫療唔會因為你搬上去而改變。</strong>政府已明確表示，公營及資助醫療服務以照顧香港本地市民為基礎，有關措施並非為全面照顧選擇在內地定居的香港市民。",
    "<strong>自費前要問清楚。</strong>入住前必須向院舍索取完整收費清單，包括押金、消耗品、陪診、特別護理等項目。",
  ])}
</div></section>

<section class="alt"><div class="wrap">
  <h2>下一步：我哋可以做咩</h2>
  <div class="grid g3">
    <div class="card"><h3>01 先計數</h3><p>用你嘅預算，對照香港同內地嘅實際開支，睇下差距有幾大。</p></div>
    <div class="card"><h3>02 去睇一次</h3><p>安排實地考察團 —— 睇樓、睇院舍、行下附近街市同商場，親身感受。</p></div>
    <div class="card"><h3>03 先試住</h3><p>廣東院舍計劃本身有 6 個月試住期；亦可考慮短租試住 1 – 3 個月再決定。</p></div>
  </div>
  <div style="margin-top:24px">{cta_block("care", "預約實地考察團", "我哋會按你嘅預算同需要，安排 2 個項目實地參觀，連同醫院及生活配套。")}</div>
</div></section>
"""
    return page("安老院轉介", "香港安老院輪候現實、政府廣東院舍照顧服務計劃、內地院舍月費對照及必須知道的風險。", "care", b)


def p_property():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>置業：把「買樓」當退休配置，唔係炒賣</h1>
  <p class="lead">呢一頁唔會同你講升值潛力。呢一頁講嘅係：如果你打算喺大灣區住十年以上，要點樣計呢筆數，同埋有咩風險。</p>
  <div class="cta-row">{wa_link("prop", "用 WhatsApp 傾一傾", "btn")}</div>
</div></section>

<section><div class="wrap">
  <span class="kicker">價格</span>
  <h2>三地樓價對照</h2>
  {dtable(["城市", "市場約數（每平方米）", "官方／機構參考"], [
      [("中山", "城市"), ("¥12,000 – 16,000", "市場約數（每平方米）"), ("2025 年商品住宅銷售單價約 ¥11,140／㎡", "官方／機構參考")],
      [("珠海", "城市"), ("¥20,000 – 35,000", "市場約數（每平方米）"), ("2025 年全市網簽均價約 ¥19,940／㎡（較上年跌約 7%）", "官方／機構參考")],
      [("惠州", "城市"), ("¥8,000 – 12,000", "市場約數（每平方米）"), ("—", "官方／機構參考")],
  ], "中山市國民經濟和社會發展統計公報（轉引南方日報，2026-06-12）；中原澳門及珠海橫琴《2025 年樓市回顧》(2026-01-06)。市場約數為綜合整理，非官方統計。")}
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">政策</span>
  <h2>首付同結匯安排</h2>
  <div class="grid g2">
    <div class="card"><h3>最低首付 15%</h3>
      <p>中國人民銀行及國家金融監督管理總局 2024 年 9 月 24 日印發通知，貸款購買住房家庭最低首付款比例全國統一為不低於 15%。</p>
      <p style="font-size:16px">以中山市場約數每平方米 ¥11,000 計，一個 100 平方米單位約 ¥110 萬，15% 首付約 ¥16.5 萬。</p></div>
    <div class="card"><h3>港澳居民購房結匯</h3>
      <p>人民銀行 2024 年 1 月《港澳居民購買粵港澳大灣區內地城市房產結算支付便利化業務指引》（廣東銀發〔2024〕9 號）。</p>
      <p>允許港澳居民將境外購房款匯往其境內同名帳戶，從境外汇入人民幣不納入「每人每天最高限額」管理，但須定向用於購房。</p></div>
  </div>
  {src("大灣區建設《內地政策措施》(2024-09-24)；中國政府網 (2024-01-25)；律師行政策整理 (2025-03-05)。⚠️ 上述首付例子為示意計算，實際按揭成數、利率及審批以銀行決定為準。")}
</div></section>

<section><div class="wrap">
  <span class="kicker">流程</span>
  <h2>由睇樓到收樓，大概係咁</h2>
  <ul class="plain">
    <li><strong>01 需求同預算。</strong>先定係自住定出租、住幾多年、每月可承受幾多。</li>
    <li><strong>02 實地睇樓。</strong>親身去，睇樓盤、睇周邊配套、睇同一區嘅實際生活。</li>
    <li><strong>03 政策核實。</strong>限購、按揭、稅費、結匯安排，逐項向銀行同律師核實。</li>
    <li><strong>04 資金安排。</strong>先處理境外汇入同名帳戶嘅流程，再簽約。</li>
    <li><strong>05 簽約及收樓。</strong>留意交樓期、裝修標準、發展商背景同違約條款。</li>
  </ul>
</div></section>

<section class="alt"><div class="wrap">
  {notice([
    "<strong>樓價可以跌，而且跌得好急。</strong>橫琴住宅價格曾由每平方米約 ¥5.6 萬跌至約 ¥3.9 萬，累計跌幅約三成；待售二手房由 712 套增至 2,781 套。中山馬鞍島新盤樓價亦曾由每平方米 ¥3 萬多回落近半。",
    "<strong>有港人真實蝕錢個案。</strong>一名 60 多歲港人以 ¥70 萬買入中山一個約 400 多呎 Loft 公寓，現估值僅 ¥30 – 40 萬，蒸發約一半。",
    "<strong>「退休資產配置」唔等於「投資回報」。</strong>本網站所講嘅配置，係指將居住需求同資金安排對應，<strong>唔係</strong>任何升值或回報承諾。",
    "<strong>匯款有成本同限制。</strong>跨境匯款有手續費（例如部分銀行每次約 HK$70），亦可能受限於銀行選擇及政策。",
    "<strong>流動性風險。</strong>內地二手市場可以好靜，想賣未必即刻賣得出，亦未必賣到你想像嘅價。",
    "<strong>產權同法規。</strong>公寓、Loft、住宅嘅產權年期、稅費同轉讓限制都唔同，簽約前必須由內地律師審閱。",
  ], "呢一頁有咩風險你要知")}
</div></section>

<section><div class="wrap">
  <div style="margin-top:6px">{cta_block("prop", "想睇實際樓盤？安排考察", "我哋可以按你嘅預算，安排 2 個項目實地參觀，連同周邊生活配套同醫院位置。")}</div>
  {src("房天下及網易《珠海樓市深度調整》報道 (2025)；星島頭條報道 (2025-11-04)。上述為媒體報道及市場個案，非官方統計。")}
</div></section>
"""
    return page("置業", "大灣區置業：中山珠海惠州樓價、15% 首付政策、購房結匯安排，以及必須知道的樓價下跌風險。", "property", b)


def p_car():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>出行：上去之後點樣周圍走</h1>
  <p class="lead">呢一頁只講已查證嘅交通事實。我哋冇足夠可靠數據講內地車價、牌費、保險，所以唔會亂噏。</p>
  <div class="cta-row">{wa_link("car", "用 WhatsApp 問出行安排", "btn")}</div>
</div></section>

<section><div class="wrap">
  <span class="kicker">返香港</span>
  <h2>四種方式，按你需要揀</h2>
  {dtable(["方式", "連接", "時間", "費用"], [
      [("港珠澳大橋穿梭巴士（金巴）", "方式"), ("香港口岸 ↔ 珠海口岸", "連接"), ("口岸至口岸約 40 – 55 分鐘；24 小時營運；繁忙時段約 5 分鐘一班，深宵約 15 – 30 分鐘一班", "時間"), ("香港→珠海 日間 HK$65、夜間 HK$70；65 歲或以上半價（HK$33／HK$35）", "費用")],
      [("深中通道", "方式"), ("中山 ↔ 深圳", "連接"), ("約 30 分鐘（2024-06-30 通車後）", "時間"), ("標準車次 ¥66", "費用")],
      [("跨境大巴", "方式"), ("中山 ↔ 香港", "連接"), ("約 1 小時 45 分", "時間"), ("票價請向營運商查詢", "費用")],
      [("珠海九洲港 ↔ 香港", "方式"), ("珠海 ↔ 上環／九龍", "連接"), ("航程約 70 分鐘；每日約 7 班", "時間"), ("單程約 HK$200、來回約 HK$340（按航班日期浮動）", "費用")],
  ], "港珠澳大橋穿梭巴士官方網站；深中通道通車報道 (2024-06-28)；TurboJET 價目表。⚠️ 中山港現行船期及票價未見官方最新公布，故不在此列出。")}
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">點對點</span>
  <h2>跨境七人車（唔想轉車嘅選擇）</h2>
  <p>如果同行有長者、行李多、或者唔想轉車，點對點跨境車會方便好多。以下為服務商公開參考價。</p>
  {dtable(["路線", "參考價格"], [
      [("香港 → 珠海口岸人工島", "路線"), ("HK$1,100 起", "參考價格")],
      [("香港 → 珠海市區（拱北）／橫琴", "路線"), ("HK$1,500 起", "參考價格")],
      [("香港 → 中山", "路線"), ("HK$1,900 起", "參考價格")],
  ], "跨境車服務商公開報價。⚠️ 實際報價、附加費、車期及條款以服務商確認為準。")}
</div></section>

<section><div class="wrap">
  <span class="kicker">自己揸車</span>
  <h2>港車北上</h2>
  <ul class="plain">
    <li><strong>實施日期：</strong>2023 年 7 月 1 日零時正式實施，毋須常規配額。</li>
    <li><strong>停留限制：</strong>每次入境後不得連續停留超過 30 日，每年累計不得超過 180 日。</li>
    <li><strong>申請：</strong>需經官方網上系統申請，須持有有效香港車輛登記及駕駛執照，並按規定購買內地機動車交通事故責任強制保險（交強險）。</li>
  </ul>
  {src("港車北上官方網站；港澳車北上相關公開資料。")}
  <div class="notice">
    <h3>誠實聲明：以下嘅嘢我哋未查證，所以唔會寫</h3>
    <ul>
      <li>內地購車車價、牌費、保險費用 —— 冇可靠公開數據支持，故不列出。</li>
      <li>中山港現行船期班次與票價 —— 網上只有較舊資料，未見官方最新公布。</li>
      <li>「香港市區→中山／珠海」的權威門到門時間 —— 只有媒體及巴士公司個案，未有官方數字。</li>
    </ul>
    <p style="margin-top:10px;font-size:16px">與其寫一個「大概係咁」嘅數，不如老實講：呢幾項要等你決定咗住邊個城市之後，我哋逐項幫你查實。</p>
  </div>
</div></section>

<section class="alt"><div class="wrap">
  <div class="grid g2">
    <div class="card"><h3>子女探訪，其實好方便</h3>
      <p>港珠澳大橋金巴 24 小時行駛，長者有半價；由香港去珠海口岸只要約 40 – 55 分鐘。</p>
      <p>意思係星期六可以上午出發、中午一齊飲茶、下晝行下商場，夜晚返香港食飯。</p></div>
    <div class="card"><h3>但要老實講</h3>
      <p>如果你住惠州或肇慶等較遠城市，返港次數同每次耗費嘅時間、金錢都要保守計算。</p>
      <p>有慢性病、要定期睇專科嘅長者，尤其要考慮呢一點。</p></div>
  </div>
  <div style="margin-top:24px">{cta_block("car", "想知邊個城市返港最方便？", "同我哋講你嘅情況（例如要唔要成日返香港覆診），我哋幫你按實際需要揀。")}</div>
</div></section>
"""
    return page("出行", "大灣區出行交通：港珠澳大橋金巴、深中通道、跨境七人車、港車北上規則與實際時間。", "car", b)


def p_checkup():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>內地體檢團：同樣預算，驗多啲，順便睇下當地生活</h1>
  <p class="lead">好多人第一次踏足大灣區，係因為驗身。驗完之後，順便食餐好嘅、行下商場、睇下樓 —— 呢個就係我哋嘅體檢團。</p>
  <div class="cta-row">{wa_link("body", "用 WhatsApp 問體檢團詳情", "btn")}</div>
</div></section>

<section><div class="wrap">
  <span class="kicker">價錢對照</span>
  <h2>同樣嘅項目，價錢差幾遠</h2>
  {dtable(["項目", "香港（私家）", "內地（深圳）"], [
      [("基礎體檢套餐", "項目"), ("約 HK$500 – 2,000（入門）", "香港（私家）"), ("約 ¥468 – 728", "內地（深圳）")],
      [("標準全面檢查", "項目"), ("約 HK$2,000 – 8,000", "香港（私家）"), ("約 ¥1,100 – 3,300", "內地（深圳）")],
      [("進階／含影像檢查", "項目"), ("約 HK$8,000 – 15,000（例如養和「健康檢查計劃 B」約 HK$9,060；明德女士全面計劃由 HK$14,800 起）", "香港（私家）"), ("深圳和睦家甄選套餐約 ¥6,000（男）／¥6,300（女）", "內地（深圳）")],
      [("單項：低劑量肺部 CT", "項目"), ("HK$6,800+", "香港（私家）"), ("約 ¥800", "內地（深圳）")],
      [("單項：腹部超聲波", "項目"), ("HK$800+", "香港（私家）"), ("約 ¥300", "內地（深圳）")],
  ], "明報教育資源《活在北灣區：北上體檢》(2025-04-03)；ESDlife 健康網購《身體檢查 2026》；Bowtie 專欄《深圳身體檢查》(2026-04-21)；深圳新風和睦家醫院官網；10Life 體檢比較 (2026)。⚠️ 上述價格為公開報價整理，非同一套餐嘅逐項對比；「差距倍數」屬自行換算，僅供參考。")}
  <div style="margin-top:20px">{wa_link("body", "想知邊個套餐適合你？用 WhatsApp 問", "btn")}</div>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">行程</span>
  <h2>體檢團大概包括咩</h2>
  <div class="grid g2">
    <div class="card"><h3>醫療部分</h3>
      <ul class="plain">
        <li>預約及安排內地體檢機構（可按需要選擇港資背景、三甲醫院或特定套餐）</li>
        <li>協助準備過往病歷及檢查報告，方便醫生對照</li>
        <li>報告講解安排（部分機構提供繁體中文、英文及粵語講解）</li>
        <li>索取原始 DICOM 影像檔，方便返港覆診時使用</li>
      </ul></div>
    <div class="card"><h3>生活部分</h3>
      <ul class="plain">
        <li><strong>VIP 專車接送</strong>往返香港與內地</li>
        <li>當地飲茶、特色食肆體驗</li>
        <li>商場、超市、街市實地睇（睇下實際物價）</li>
        <li>可加插睇樓、睇院舍行程</li>
      </ul></div>
  </div>
  {src("行程內容會按實際報名人數及體檢機構嘅檔期安排，最終以出團通知為準。")}
</div></section>

<section><div class="wrap">
  {notice([
    "<strong>報告認受性。</strong>香港醫生未必認受內地非三甲機構嘅影像診斷報告，臨床責任歸屬亦可能模糊。建議優先選擇港資背景機構或三甲醫院，並索取中英文雙語報告及原始 DICOM 影像檔。",
    "<strong>低價套餐嘅隱藏加費。</strong>部分套餐以低價招徠，但關鍵項目（例如癌症指標、指定部位超聲波）要逐項加費，每項約 ¥200 – 500。報名前必須索取完整項目清單，講明「套餐已包咩、唔包咩」。",
    "<strong>保險理賠風險。</strong>非保險公司認可嘅機構，可能導致理賠被拒。如果你有醫療保險，出發前應先向保險公司確認。",
    "<strong>唔係「同樣質素但平」。</strong>價差反映嘅係地區成本、機構級別同服務內容差異，唔可以一概而論。選擇時要睇機構資質，唔係只睇價錢。",
    "<strong>本團不構成醫療建議。</strong>體檢項目選擇、結果解讀及後續治療，須由註冊醫生決定。",
  ], "報名之前，你要知嘅事")}
</div></section>

<section class="alt"><div class="wrap">
  {cta_block("body", "今期體檢團招生中", "想知道最新團期、費用同體檢機構選擇？用 WhatsApp 問我哋，我哋會按你嘅需要建議。」", "用 WhatsApp 報名／查詢")}
</div></section>
"""
    return page("內地體檢團", "內地體檢團：香港與深圳體檢價錢對照、行程內容（VIP 專車接送）及必須知道的風險。", "checkup", b)


def p_about():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>關於 Causson 朱嘉信｜宜居樂（珠海）企業服務</h1>
  <p class="lead">一個真正搬咗上去住嘅香港人，做你嘅實地顧問。</p>
</div></section>

<section><div class="wrap">
  <div class="grid g2">
    <div class="ph" style="min-height:280px">Causson 朱嘉信先生實景相待客戶提供<br><small>（本頁為 staging 示範版，未使用任何示意圖或購買圖片）</small></div>
    <div class="card">
      <h3>超過 20 年香港財富管理經驗</h3>
      <p>在香港金融保險及財富管理界深耕逾 20 年，深明香港中產階層對退休生活嘅期望與擔憂。</p>
      <p>為此創辦「宜居樂（珠海）企業服務有限公司」，親身踏足並定居大灣區，成為客戶嘅「實地顧問」。</p>
      <p><strong>資歷核實：</strong>有關牌照號碼及專業資格，待客戶提供後於本頁更新。</p>
    </div>
  </div>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">點解要搬上去</span>
  <h2>隔住個芒睇樓，係睇唔到嘢嘅</h2>
  <p>做財富管理嘅時候，我見過太多人做退休決定嘅方式：睇圖片、聽經紀講、睇一個下午就落訂。</p>
  <p>但退休唔係一單交易，係未來十幾二十年嘅生活。你想知嘅係：樓下間醫院幾遠、街市啲餸幾錢、朝早飲茶要唔要排隊、落雨嘅時候屋苑會唔會水浸。呢啲嘢，坐喺香港係查唔到嘅。</p>
  <p>所以我搬咗上去。唔係做經紀，係做一個住喺當地、可以幫你落場睇嘅人。</p>
</div></section>

<section><div class="wrap">
  <span class="kicker">服務理念</span>
  <h2>把退休決定，當成一場資產配置</h2>
  <div class="grid g3">
    <div class="card"><h3>先算，後睇</h3><p>用你嘅實際預算同收入，對照當地生活開支，先知道呢件事可唔可行。</p></div>
    <div class="card"><h3>先睇，後決定</h3><p>安排實地考察 —— 睇樓、睇院舍、睇醫院、睇街市，唔靠圖片。</p></div>
    <div class="card"><h3>唔啱就講唔啱</h3><p>如果計完數發現唔划算，或者你根本唔適應，我哋會照講。</p></div>
  </div>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">營運實體</span>
  <h2>公司資料</h2>
  <div class="card">
    <p><strong>公司名稱：</strong>宜居樂（珠海）企業服務有限公司</p>
    <p><strong>業務性質：</strong>大灣區退休及置業顧問、安老院轉介、內地體檢團安排</p>
    <p><strong>聯絡：</strong>WhatsApp +852 9622 9372</p>
    <p><strong>註冊資料：</strong>商業登記／註冊編號待客戶提供後於本頁更新。</p>
  </div>
  {notice([
    "<strong>利益關係披露：</strong>本公司可能就轉介服務（包括安老院、物業、車輛、體檢及其他服務）收取費用或佣金。具體收費及佣金安排待客戶提供並確認後於此頁及〈風險披露與免責聲明〉更新。",
    "<strong>服務性質：</strong>本網站及本公司提供嘅係顧問及轉介服務，<strong>不構成醫療建議、法律建議或投資建議</strong>。",
    "<strong>資歷聲明：</strong>「超過 20 年香港金融保險及財富管理經驗」為客戶提供之陳述，相關專業資格及牌照資料待客戶補充以供核實。",
  ])}
</div></section>

<section><div class="wrap">
  <div style="margin-top:6px">{cta_block("contact_placeholder" if False else "care", "想同 Causson 傾一傾？", "講你嘅情況就得：你係為自己定為父母準備、大概預算、有冇特別嘅醫療需要。")}</div>
</div></section>
"""
    return page("關於我們", "關於 Causson 朱嘉信及宜居樂（珠海）企業服務有限公司：背景、服務理念及利益關係披露。", "about", b)


def p_faq():
    items = [
        ("醫療", "內地醫療信得過嗎？", "要分兩層講。內地三甲醫院嘅設備同專科能力唔差；但香港醫生未必認受內地非三甲機構嘅影像診斷報告，臨床責任歸屬亦可能模糊。做法上：選港資背景或三甲機構、索取原始 DICOM 影像檔、保留香港嘅醫療方案。", "立法會跨境醫療合作文件 (2026-07)；媒體綜合報道 (2025-2026)。"),
        ("醫療", "長者醫療券喺大灣區點用？", "「長者醫療券大灣區試點計劃」已覆蓋九個內地城市共 21 個服務點，合資格長者每年可用 HK$2,000。但要注意：不可累積、不可與國家醫保同時支付同一項服務、不包括住院及日間手術、不可用於單純購買物品或藥物。", "政府新聞公報 (2025-08-18)；立法會 CB(3)639/2025(04)。"),
        ("醫療", "如果喺內地急病，可以點？", "呢個係最重要嘅風險。現行跨境直通救護車試行計劃只涵蓋深圳（港大深圳醫院）同澳門（仁伯爵綜合醫院）指定派送醫院，而且不涵蓋急症個案。政府亦已明確表示，公營醫療服務以照顧香港本地市民為基礎，並非為全面照顧在內地定居嘅香港市民。所以計劃北上退休時，必須自己準備內地醫療保險同緊急應變方案。", "立法會十八題 - 本港長者在內地養老 (2025-07-09)。"),
        ("院舍", "政府「廣東院舍照顧服務計劃」要唔要資產審查？", "唔需要。但須接受「安老服務統一評估機制」評估，確定服務需要後，按評估結果申請。入住後免院費（食宿、護理、個人照顧及基本醫療）。", "社會福利署《廣東院舍照顧服務計劃》網頁。"),
        ("院舍", "免院費係唔係即係咩都唔使錢？", "唔係。尿片、傷口敷料等消耗品、緊急救護車費用，以及計劃以外嘅額外項目要自費。大部分院舍亦要求入住時預繳醫療押金。入住前必須索取完整收費清單。", "社會福利署《常見問題》(2026-09-11)。"),
        ("院舍", "入住之後唔習慣，可以返香港？", "可以。計劃設有 6 個月試住期，經香港轉介辦事處申請嘅長者，期內離開可按原本申請日期恢復中央輪候冊位置。", "社會福利署《廣東院舍照顧服務計劃》網頁。"),
        ("置業", "內地樓價係唔係穩陣？", "唔係。橫琴住宅價格曾由每平方米約 ¥5.6 萬跌至約 ¥3.9 萬，累計跌幅約三成，待售二手房由 712 套增至 2,781 套。亦有港人買入中山 Loft 單位，估值由 ¥70 萬跌至 ¥30 – 40 萬。買樓前要當呢筆錢係「已經用咗」，唔好當投資。", "房天下及網易報道 (2025)；星島頭條 (2025-11-04)。"),
        ("置業", "首付幾多？", "中國人民銀行及國家金融監督管理總局 2024 年 9 月 24 日通知，貸款購買住房家庭最低首付款比例全國統一為不低於 15%。實際按揭成數、利率及審批以銀行決定為準。", "大灣區建設《內地政策措施》(2024-09-24)。"),
        ("交通", "子女過嚟探我方便嗎？", "港珠澳大橋金巴 24 小時行駛，口岸至口岸約 40 – 55 分鐘，65 歲或以上半價。如果住中山，深中通道通車後深圳至中山只約 30 分鐘。但住惠州、肇慶等較遠城市，時間同成本要保守計算。", "港珠澳大橋穿梭巴士官方網站；深中通道通車報道。"),
        ("交通", "我可以揸自己嘅車上去嗎？", "可以。「港車北上」2023 年 7 月 1 日實施，毋須常規配額，但每次入境後不得連續停留超過 30 日，每年累計不得超過 180 日。", "港車北上官方網站。"),
        ("費用", "你哋點收費？", "視乎服務範圍。本公司可能就轉介服務收取費用或佣金，具體安排待客戶確認後於〈風險披露與免責聲明〉公布。我哋唔會在你未清楚收費之前叫你簽任何嘢。", "本公司資料，待確認。"),
        ("費用", "上去睇一次要幾錢？", "考察團費用會按行程（睇樓、睇院舍、交通、餐飲）逐團報價。跨境七人車點對點參考價：香港→珠海口岸約 HK$1,100 起、珠海市區約 HK$1,500 起、中山約 HK$1,900 起。", "跨境車服務商公開報價。"),
        ("證件", "我需要咩證件同準備？", "一般需要回鄉證（港澳居民來往內地通行證）。另外，日常辦事會用到內地手機號、微信或支付寶。如果你要買樓或入住院舍，仲會涉及更多文件。建議出發前準備內地電話卡、常用醫院清單同緊急聯絡資料。", "一般公開資料。"),
        ("證件", "我唔識用內地嘅手機支付，點算？", "呢個係真實障礙，唔好低估。日常買嘢、搭車、叫外賣、睇醫生掛號，好多都要用手機支付。如果完全唔想學，北上長住會比較辛苦。可以考慮先短住一至三個月試下。", "實務觀察。"),
    ]
    blocks = []
    lastcat = None
    for i, (cat, q, a, s) in enumerate(items):
        if cat != lastcat:
            blocks.append(f'<h2 style="margin-top:34px">{cat}</h2>')
            lastcat = cat
        blocks.append(f'<details class="faq"><summary>{q}</summary><div class="body"><p>{a}</p>{src(s)}</div></details>')
        if (i + 1) % 5 == 0:
            blocks.append(f'<div style="margin:18px 0">{wa_link("care", "有其他問題？用 WhatsApp 直接問", "btn sm")}</div>')
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>常見問題</h1>
  <p class="lead">呢一頁包括一啲唔好聽嘅答案。因為你決定之前，應該知最壞嘅情況。</p>
</div></section>
<section><div class="wrap">
  {notice([
    "本頁答案部分涉及<strong>醫療、法律及投資範疇</strong>，僅屬一般資料整理，<strong>不構成任何專業建議</strong>。實際決定請諮詢註冊醫生、律師或持牌專業人士。",
    "所有政策、金額及價格均會變動，並已在各條目標明資料來源及截止日期。",
    "<strong>本公司可能就轉介服務收取費用或佣金</strong>，詳見〈風險披露與免責聲明〉。",
  ], "睇之前，要知呢三件事")}
  {''.join(blocks)}
</div></section>
<section class="alt"><div class="wrap">
  {cta_block("care", "搵唔到你想問嘅？", "直接用 WhatsApp 問我哋，我哋會老實答。")}
</div></section>
"""
    return page("常見問題", "大灣區退休常見問題：醫療、院舍、置業、交通、費用及證件的直接回答，包括負面答案。", "faq", b)


def p_disclosure():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>風險披露與免責聲明</h1>
  <p class="lead">呢一頁係俾你（同你家人）喺做決定之前睇清楚嘅。</p>
</div></section>

<section><div class="wrap">
  <div class="notice" style="border-left-color:#8A3B14">
    <h3>⚠️ 本頁尚未經法律審閱</h3>
    <ul>
      <li>本頁為 <strong>staging 示範版（dummy）</strong>，內容為草擬稿，<strong>未經律師審閱</strong>。</li>
      <li>正式對外發佈前，必須由熟悉香港及內地相關法規嘅法律專業人士審閱並定稿。</li>
      <li>本頁內容不構成任何法律意見。</li>
    </ul>
  </div>

  <h2>1. 服務性質聲明</h2>
  <p>本網站由 <strong>宜居樂（珠海）企業服務有限公司</strong>（下稱「本公司」）營運。本公司提供嘅係大灣區退休及置業<strong>顧問及轉介服務</strong>。</p>
  <p>本網站及本公司：</p>
  <ul class="plain">
    <li><strong>不提供醫療建議。</strong>任何體檢項目選擇、報告解讀、診斷及治療，須由註冊醫生決定。</li>
    <li><strong>不提供法律建議。</strong>物業買賣、合約、產權、稅務及居留事宜，須由具備相關司法管轄區資格嘅律師處理。</li>
    <li><strong>不提供投資建議。</strong>本網站唔會就任何物業或資產嘅升值潛力、回報或價格穩定性作出陳述或承諾。</li>
    <li><strong>不提供受規管之財務策劃服務。</strong>如有需要，請諮詢持牌專業人士。</li>
  </ul>

  <h2>2. 資料來源與時效</h2>
  <p>本網站所載數字及政策資料，均為公開可查證資料之整理，並標明來源及資料截止日期（本網站整體資料截至 {AS_OF}）。</p>
  <ul class="plain">
    <li>價格、政策及服務安排<strong>會隨時間變動</strong>，本網站未必能即時反映最新情況。</li>
    <li>部分數字（例如市場租金、餐飲消費）屬<strong>市場約數</strong>或<strong>自行換算</strong>，並非官方統計，已在相關位置標明。</li>
    <li>所有資料僅供一般參考，<strong>不可作為任何決定嘅唯一依據</strong>。實際情況請向官方渠道、銀行、律師及醫療專業人士核實。</li>
    <li>如發現本網站任何資料有誤或有更新，請透過 WhatsApp 通知我們，我哋會盡快更正。</li>
  </ul>

  <h2>3. 已知風險清單</h2>
  {dtable(["範疇", "風險"], [
      [("醫療", "範疇"), ("香港醫生未必認受內地非三甲機構嘅影像診斷報告；臨床責任歸屬可能模糊。跨境直通救護車試行計劃只涵蓋深圳（港大深圳醫院）及澳門（仁伯爵綜合醫院）指定派送醫院，且不涵蓋急症個案。香港公營醫療服務以照顧香港本地市民為基礎，並非為全面照顧在內地定居嘅香港市民而設。", "風險")],
      [("醫療券", "範疇"), ("長者醫療券每年 HK$2,000，不可累積，不可與國家醫保同時支付同一項服務，不包括住院及日間手術。", "風險")],
      [("院舍", "範疇"), ("部分院舍宿位緊張（例如珠海和園頤養中心已於 2026 年 6 月 12 日起停止接受新申請）。「免院費」不包括消耗品、緊急救護車及計劃外項目。", "風險")],
      [("物業", "範疇"), ("內地樓價可以大幅下跌。橫琴住宅價格曾由每平方米約 ¥5.6 萬跌至約 ¥3.9 萬；亦有港人買入中山 Loft 單位後估值跌約一半。二手市場流動性可能偏低。公寓／Loft／住宅嘅產權年期、稅費及轉讓限制各異。", "風險")],
      [("匯款", "範疇"), ("跨境匯款有手續費及銀行渠道限制；具體安排須向銀行核實。", "風險")],
      [("生活", "範疇"), ("日常辦事可能需使用內地手機號、微信、支付寶；語言及制度差異可能造成不適應。離開原有社交圈子嘅心理成本不容低估。", "風險")],
      [("政策", "範疇"), ("所有補貼、資助及購房政策均可能隨時調整或取消。金額（例如院舍券面值、廣東計劃津貼）會按年檢討。", "風險")],
  ], "本網站各頁提及之風險，綜合自社會福利署、立法會文件、政府新聞公報及公開媒體報道（2025-2026）。")}

  <h2>4. 利益關係披露</h2>
  <p>為維持服務運作，本公司可能就以下轉介服務收取費用或佣金：</p>
  <ul class="plain">
    <li>安老院或養老機構轉介</li>
    <li>物業代理或發展商轉介</li>
    <li>車輛相關服務轉介</li>
    <li>體檢機構或醫療服務轉介</li>
    <li>其他大灣區生活配套服務轉介</li>
  </ul>
  <p><strong>具體收費水平及佣金安排，待本公司提供並確認後，將於本頁詳細列明。</strong>在您清楚了解收費安排之前，我們不會要求您作出任何承諾或簽署任何文件。您亦有權選擇自行直接聯絡任何機構。</p>

  <h2>5. 個人資料處理</h2>
  <ul class="plain">
    <li>本網站<strong>不設任何資料收集表格</strong>，不會透過網站收集您的個人資料。</li>
    <li>當您透過 WhatsApp 聯絡我們時，您提供的資料將用於回覆查詢及提供服務。我們會按《個人資料（私隱）條例》處理有關資料。</li>
    <li>本網站為 staging 示範版本，<strong>不應用於收集任何真實個人資料</strong>。</li>
  </ul>

  <h2>6. 免責</h2>
  <p>在法律允許的最大範圍內，本公司及其人員不就因使用或依賴本網站資料而引致的任何直接或間接損失承擔責任。您應自行核實所有資料，並在作出任何重大決定前諮詢相關專業人士。</p>

  <h2>7. 聯絡</h2>
  <p>如對本聲明有任何疑問：</p>
  {cta_block("care", "WhatsApp 聯絡我們", "我們會盡快回覆你的查詢。")}
</div></section>
"""
    return page("風險披露與免責聲明", "灣區第二人生的風險披露、服務性質聲明、資料來源與時效、利益關係披露及個人資料處理。", "disclosure", b)


def p_contact():
    b = f"""
<section class="hero" style="padding:clamp(30px,5vw,60px) 0"><div class="wrap">
  <h1>聯絡我們｜啟動您的灣區第二人生</h1>
  <p class="lead">揀你想傾嘅方向，撳落去就得。唔需要填表、唔需要留電話。</p>
</div></section>

<section><div class="wrap">
  <span class="kicker">揀你嘅方向</span>
  <h2>四個入口</h2>
  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>安老院轉介</h3><p>為自己或父母了解廣東院舍照顧服務計劃、內地院舍月費同試住安排。</p>{wa_link('care', '用 WhatsApp 問（SL-CARE）', 'btn sm')}</div>
    <div class="card"><h3>置業</h3><p>了解中山、珠海、惠州樓價、首付政策、流程同風險。</p>{wa_link('prop', '用 WhatsApp 問（SL-PROP）', 'btn sm')}</div>
    <div class="card"><h3>出行</h3><p>金巴、深中通道、跨境七人車、港車北上嘅實際安排。</p>{wa_link('car', '用 WhatsApp 問（SL-CAR）', 'btn sm')}</div>
    <div class="card"><h3>內地體檢團</h3><p>最新團期、費用、體檢機構選擇同行程內容。</p>{wa_link('body', '用 WhatsApp 問（SL-BODY）', 'btn sm')}</div>
  </div>
</div></section>

<section class="alt"><div class="wrap">
  <span class="kicker">公司資料</span>
  <h2>直接聯絡</h2>
  <div class="card">
    <p><strong>WhatsApp：</strong>+852 9622 9372</p>
    <p><strong>營運實體：</strong>宜居樂（珠海）企業服務有限公司</p>
    <p><strong>創辦人：</strong>Causson 朱嘉信</p>
    <p><strong>服務對象：</strong>香港準退休人士及其家人</p>
  </div>
  {notice([
    "<strong>聯絡管道說明（重要）：</strong>客戶提供嘅資料將此 WhatsApp 號碼標示為「AI 專屬置業助理」。<strong>實際運作方式（由 AI 抑或人手回覆）待客戶確認</strong>，因此本頁統一使用「WhatsApp 專屬助理」字眼，未確認前不會聲稱為「專人」或「真人」服務。",
    "<strong>未被驗證事項：</strong>本頁 WhatsApp 號碼之有效性未經本次施工驗證。上線前必須實測。",
    "<strong>本頁為 staging 示範版：</strong>不應用於接收任何真實個人資料。",
  ])}
</div></section>

<section><div class="wrap">
  <h2>我哋唔會做嘅事</h2>
  <ul class="plain">
    <li>唔會未傾清楚就約你上去簽任何文件。</li>
    <li>唔會同你講任何升值、穩陣嘅承諾。</li>
    <li>唔會叫你買一啲你自己未親身睇過嘅嘢。</li>
  </ul>
  <p>同時，如果計完數之後發現唔適合你，我哋會照講。</p>
</div></section>
"""
    return page("聯絡我們", "用 WhatsApp 聯絡灣區第二人生：安老院轉介、置業、出行及內地體檢團四條查詢線。", "contact", b)


PAGES = {
    "index.html": p_index,
    "trend.html": p_trend,
    "cities.html": p_cities,
    "care.html": p_care,
    "property.html": p_property,
    "car.html": p_car,
    "checkup.html": p_checkup,
    "about.html": p_about,
    "faq.html": p_faq,
    "disclosure.html": p_disclosure,
    "contact.html": p_contact,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/opt/data/github/Firebean-Website/secondlife")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    n = 0
    for fn, builder in PAGES.items():
        html = builder()
        with open(os.path.join(a.out, fn), "w", encoding="utf-8") as fh:
            fh.write(html)
        n += 1
        print(f"  ✓ {fn:18s} {len(html):>7,} bytes")
    print(f"\n{n} 頁寫入 {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
