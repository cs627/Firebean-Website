# BUILD-LOG — 「灣區第二人生」staging dummy

每次建置／測試之實測輸出。**格式：日期時間 → 動作 → 原始輸出（貼原文，不摘要）。**

## 2026-11-03 14:46:40 UTC — 建置 + 全量測試

```
$ python3 build_site.py
  ✓ index.html          19,181 bytes
  ✓ trend.html          14,532 bytes
  ✓ cities.html         17,924 bytes
  ✓ care.html           16,910 bytes
  ✓ property.html       13,591 bytes
  ✓ car.html            13,725 bytes
  ✓ checkup.html        13,498 bytes
  ✓ about.html          12,431 bytes
  ✓ faq.html            15,361 bytes
  ✓ disclosure.html     13,563 bytes
  ✓ contact.html        12,409 bytes

11 頁寫入 /opt/data/github/Firebean-Website/secondlife

$ python3 test_site.py
FAIL   T1  檔案存在（11 頁 + 5 來源檔）  — 缺少 ['BUILD-LOG.md']
PASS   T2  表格 ≤640px 卡片化 + 每格 data-label  — 100%
PASS   T3  禁字掃描（12 個）  — 命中 0
PASS   T4  四條漏斗 deep link  — 50 links, {'SL-CARE': 36, 'SL-PROP': 6, 'SL-CAR': 42, 'SL-BODY': 6}
PASS   T5  每頁 h1 / title / lang / noindex  — 11/11
PASS   T6  每個有表之頁，.src 同時含「來源」及「截至」  — 100%
PASS   T7  body 18px / .dtable 16px  — 11/11
PASS   T8  .btn 48px / .btn.sm 44px  — 11/11
PASS   T9  Staging HTTP 200（/ 及 /contact.html）  — http://127.0.0.1:8080/secondlife/ → 200; contact.html → 200
PASS  T10  git 乾淨 + production HTTP 200  — 1 lines all `?? secondlife/`; firebean.net → 200
PASS  T11  每頁 ≥1 notice，且冇 notice 喺 <footer> 區塊內  — 11/11
PASS  T12  R4/R5/R6 標示字串  — 100%
PASS  T13  全站無 form/textarea/非 number input/假評價  — 11/11
PASS  T14  計算器防 NaN（0／空白／負數）  — parseFloat||0 + Math.abs
PASS  T15  320px 無固定 min-width  — 11/11
PASS  T16  index 有 <noscript> 提示  — 有

==============================================================
  15/16 PASS
==============================================================
  FAILED: T1
  → 整體 FAIL。唔可以當完成。
```

## 2026-11-03 14:48:28 UTC — 補入 4 條已查證但未用嘅數據（研究員背景進程完成後對照）

新增：trend 頁「00 呢個唔係想像」（274 萬／36%、近 10 萬／+40.5%、1,048 人、29 家、調查 45.2% 最憂醫療）；care 頁風險加「粵閩養老計劃名額 1,000、截至 2026-03 只批核 10 宗」（風險項數 7→8）。

```
$ python3 test_site.py
PASS   T1  檔案存在（11 頁 + 5 來源檔）  — 16/16
PASS   T2  表格 ≤640px 卡片化 + 每格 data-label  — 100%
PASS   T3  禁字掃描（12 個）  — 命中 0
PASS   T4  四條漏斗 deep link  — 50 links, {'SL-CARE': 36, 'SL-PROP': 6, 'SL-CAR': 42, 'SL-BODY': 6}
PASS   T5  每頁 h1 / title / lang / noindex  — 11/11
PASS   T6  每個有表之頁，.src 同時含「來源」及「截至」  — 100%
PASS   T7  body 18px / .dtable 16px  — 11/11
PASS   T8  .btn 48px / .btn.sm 44px  — 11/11
PASS   T9  Staging HTTP 200（/ 及 /contact.html）  — http://127.0.0.1:8080/secondlife/ → 200; contact.html → 200
PASS  T10  git 乾淨 + production HTTP 200  — 1 lines all `?? secondlife/`; firebean.net → 200
PASS  T11  每頁 ≥1 notice，且冇 notice 喺 <footer> 區塊內  — 11/11
PASS  T12  R4/R5/R6 標示字串  — 100%
PASS  T13  全站無 form/textarea/非 number input/假評價  — 11/11
PASS  T14  計算器防 NaN（0／空白／負數）  — parseFloat||0 + Math.abs
PASS  T15  320px 無固定 min-width  — 11/11
PASS  T16  index 有 <noscript> 提示  — 有

==============================================================
  16/16 PASS
==============================================================
  → 整體 PASS。
```
