#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_site.py — 「灣區第二人生」staging dummy 測試（對應 design-v3-buildplan.md §5 T1–T16）

用法：
  python3 test_site.py                     # 對 /opt/data/github/Firebean-Website/secondlife
  python3 test_site.py --dir <path>        # 對其他目錄
  python3 test_site.py --no-net            # 跳過 T9/T10 之網絡檢查

全部為確定性 regex／字串檢查，冇人工例外、冇百分比門檻。
有任何 FAIL → exit code 1。
"""

import argparse
import os
import re
import subprocess
import sys
import urllib.request

REPO = "/opt/data/github/Firebean-Website"
DEFDIR = os.path.join(REPO, "secondlife")
STAGING = "http://127.0.0.1:8080/secondlife/"
PROD = "https://firebean.net/"

PAGES = ["index.html", "trend.html", "cities.html", "care.html", "property.html",
         "car.html", "checkup.html", "about.html", "faq.html", "disclosure.html",
         "contact.html"]
SRC_FILES = ["build_site.py", "test_site.py", "_data/facts.md",
             "README-STAGING.md", "BUILD-LOG.md"]
BANNED = ["保證", "穩賺", "零風險", "一定", "必賺", "最平", "獨家", "必升",
          "保值", "抗跌", "全免費", "絕對信得過"]

results = []
ONLY = []


def rec(tid, name, ok, detail=""):
    if ONLY and tid not in ONLY:
        return
    results.append((tid, name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {tid:>3}  {name}" + (f"  — {detail}" if detail else ""))


def rd(d, fn):
    p = os.path.join(d, fn)
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def http_code(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "firebean-qa/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status
    except Exception as e:
        return f"ERR({type(e).__name__})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=DEFDIR)
    ap.add_argument("--no-net", action="store_true")
    ap.add_argument("only", nargs="*",
                    help="只跑指定測試編號（例：T1 T3 T5）；留空即跑全部")
    a = ap.parse_args()
    global ONLY
    ONLY = a.only
    d = a.dir
    docs = {}
    for fn in PAGES:
        p = os.path.join(d, fn)
        docs[fn] = open(p, encoding="utf-8").read() if os.path.isfile(p) else None

    # ── T1 檔案存在 ────────────────────────────────────────────────────────
    miss = [f for f in PAGES if docs[f] is None] + \
           [f for f in SRC_FILES if not os.path.isfile(os.path.join(d, f))]
    rec("T1", f"檔案存在（11 頁 + {len(SRC_FILES)} 來源檔）", not miss,
        f"缺少 {miss}" if miss else f"{len(PAGES) + len(SRC_FILES)}/{len(PAGES) + len(SRC_FILES)}")

    have = {k: v for k, v in docs.items() if v}

    # ── T2 表格卡片化 ──────────────────────────────────────────────────────
    bad = []
    for fn, t in have.items():
        if 'class="dtable"' not in t:
            continue
        m = t.find("@media (max-width:640px)")
        if m < 0 or "display:block" not in t[m:m + 500]:
            bad.append(f"{fn}:media")
            continue
        if t.count("data-label") < t.count("<td "):
            bad.append(f"{fn}:label({t.count('data-label')}<{t.count('<td ')})")
    rec("T2", "表格 ≤640px 卡片化 + 每格 data-label", not bad, str(bad) if bad else "100%")

    # ── T3 禁字 ────────────────────────────────────────────────────────────
    hits = []
    for fn, t in have.items():
        for w in BANNED:
            if w in t:
                hits.append(f"{fn}:{w}")
    rec("T3", f"禁字掃描（{len(BANNED)} 個）", not hits, str(hits) if hits else "命中 0")

    # ── T4 漏斗 deep link ──────────────────────────────────────────────────
    allt = "".join(have.values())
    links = re.findall(r"wa\.me/85296229372\?text=[^\"']+", allt)
    codes = {c: allt.count(c) for c in ["SL-CARE", "SL-PROP", "SL-CAR", "SL-BODY"]}
    okc = all(v >= 1 for v in codes.values()) and len(links) >= 4
    rec("T4", "四條漏斗 deep link", okc, f"{len(links)} links, {codes}")

    # ── T5 每頁基本元素 ────────────────────────────────────────────────────
    bad = [fn for fn, t in have.items()
           if not ("<h1" in t and "<title" in t and 'lang="zh-Hant-HK"' in t
                   and 'name="robots" content="noindex' in t)]
    rec("T5", "每頁 h1 / title / lang / noindex", not bad, str(bad) if bad else f"{len(have)}/11")

    # ── T6 來源標示 ────────────────────────────────────────────────────────
    bad = []
    for fn, t in have.items():
        if 'class="dtable"' not in t:
            continue
        srcs = re.findall(r'class="src"[^>]*>(.*?)</p>', t, re.S)
        if not any("來源" in s and "截至" in s for s in srcs):
            bad.append(fn)
    rec("T6", "每個有表之頁，.src 同時含「來源」及「截至」", not bad, str(bad) if bad else "100%")

    # ── T7 字級 ────────────────────────────────────────────────────────────
    bad = [fn for fn, t in have.items()
           if not re.search(r"body\{[^}]*font-size:18px", t.replace("\n", ""))
           or not re.search(r"\.dtable[^{]*\{[^}]*font-size:16px", t.replace("\n", ""))]
    rec("T7", "body 18px / .dtable 16px", not bad, str(bad) if bad else "11/11")

    # ── T8 觸控目標 ────────────────────────────────────────────────────────
    bad = [fn for fn, t in have.items()
           if ".btn{display:inline-flex" not in t.replace("\n", "")
           or not re.search(r"\.btn\{[^}]*min-height:48px", t.replace("\n", ""))
           or not re.search(r"\.btn\.sm\{[^}]*min-height:44px", t.replace("\n", ""))]
    rec("T8", ".btn 48px / .btn.sm 44px", not bad, str(bad) if bad else "11/11")

    # ── T9 Staging 可達 ────────────────────────────────────────────────────
    if a.no_net:
        rec("T9", "Staging HTTP 200（已跳過）", True, "--no-net")
    else:
        c1 = http_code(STAGING)
        c2 = http_code(STAGING + "contact.html")
        rec("T9", "Staging HTTP 200（/ 及 /contact.html）", c1 == 200 and c2 == 200,
            f"{STAGING} → {c1}; contact.html → {c2}")

    # ── T10 Production 未受影響 ────────────────────────────────────────────
    try:
        st = subprocess.run(["git", "-C", REPO, "status", "--short"],
                            capture_output=True, text=True, timeout=30).stdout
        lines = [l for l in st.splitlines() if l.strip()]
        stray = [l for l in lines if not l.startswith("?? secondlife/")]
        gitok = not stray
        gitdet = f"{len(lines)} lines all `?? secondlife/`" if gitok else f"unexpected: {stray[:3]}"
    except Exception as e:
        gitok, gitdet = False, f"git error {e}"
    if a.no_net:
        rec("T10", "git 乾淨 + production 200（網絡部分已跳過）", gitok, gitdet)
    else:
        pc = http_code(PROD)
        rec("T10", "git 乾淨 + production HTTP 200", gitok and pc == 200,
            f"{gitdet}; firebean.net → {pc}")

    # ── T11 披露位置 ───────────────────────────────────────────────────────
    bad = []
    for fn, t in have.items():
        m = re.search(r"<footer.*?</footer>", t, re.S)
        footer_block = m.group(0) if m else ""
        if 'class="notice"' in footer_block:
            bad.append(f"{fn}:in-footer")
            continue
        if t.count('class="notice"') < 1:
            bad.append(f"{fn}:none")
    rec("T11", "每頁 ≥1 notice，且冇 notice 喺 <footer> 區塊內", not bad, str(bad) if bad else "11/11")

    # ── T12 標示字串 ───────────────────────────────────────────────────────
    bad = []
    if "示範／模擬，未接駁正式系統" not in have["index.html"]:
        bad.append("index:demo")
    if "估算，非正式理財建議" not in have["index.html"]:
        bad.append("index:estimate")
    for fn, t in have.items():
        if 'class="ph"' in t and "實景相待客戶提供" not in t:
            bad.append(f"{fn}:placeholder")
    if "待客戶確認" not in have["contact.html"]:
        bad.append("contact:confirm")
    rec("T12", "R4/R5/R6 標示字串", not bad, str(bad) if bad else "100%")

    # ── T13 資料收集 / 假評價 ──────────────────────────────────────────────
    bad = []
    for fn, t in have.items():
        if "<form" in t or "<textarea" in t:
            bad.append(f"{fn}:form")
        for m in re.findall(r"<input[^>]*>", t):
            if 'type="number"' not in m:
                bad.append(f"{fn}:input={m[:60]}")
        for w in ["客戶評價", "推薦文", "合作機構"]:
            if w in t:
                bad.append(f"{fn}:{w}")
    rec("T13", "全站無 form/textarea/非 number input/假評價", not bad, str(bad) if bad else "11/11")

    # ── T14 Edge：計算器輸入 ───────────────────────────────────────────────
    t14 = "parseFloat(f.value)||0" in have["index.html"] and "Math.abs(" in have["index.html"]
    rec("T14", "計算器防 NaN（0／空白／負數）", t14, "parseFloat||0 + Math.abs" if t14 else "缺")

    # ── T15 Edge：320px ────────────────────────────────────────────────────
    bad = []
    for fn, t in have.items():
        if 'width=device-width' not in t:
            bad.append(f"{fn}:viewport")
            continue
        stripped = re.sub(r"@media \(min-width:[^)]*\)", "", t)
        if "min-width" in stripped:
            bad.append(f"{fn}:min-width")
    rec("T15", "320px 無固定 min-width", not bad, str(bad) if bad else "11/11")

    # ── T16 Edge：JS 停用 ──────────────────────────────────────────────────
    t16 = "<noscript>" in have["index.html"] and re.search(
        r"<noscript>.*?JavaScript.*?</noscript>", have["index.html"], re.S) is not None
    rec("T16", "index 有 <noscript> 提示", t16, "有" if t16 else "缺")

    # ── 總結 ───────────────────────────────────────────────────────────────
    npass = sum(1 for r in results if r[2])
    print(f"\n{'=' * 62}\n  {npass}/{len(results)} PASS\n{'=' * 62}")
    fails = [r for r in results if not r[2]]
    if fails:
        print("  FAILED: " + ", ".join(r[0] for r in fails))
        print("  → 整體 FAIL。唔可以當完成。")
        return 1
    print("  → 整體 PASS。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
