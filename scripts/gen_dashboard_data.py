#!/usr/bin/env python3
"""Generate Outback monitoring dashboard JSON files from Google Sheet data."""

import json
import os
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# ── Config ──────────────────────────────────────────────────────────────
SHEET_ID = "1uj_3EYaeJFcIYOXJhECJXzmFb3643issOrKIB4WTSe4"
DATA_DIR = "/opt/data/Firebean-Website-repo/outback-monitoring/data"
TOKEN_PATH = os.path.expanduser("~/.hermes/google_token.json")

# Past 7 days: today minus 1 to 7, PLUS today itself (matches established
# pattern from previous run "Aug 2-9" which included the run day).
TODAY = datetime.now()
DATE_RANGE = [(TODAY - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7, -1, -1)]
# Chrono order: Aug 3, 4, 5, 6, 7, 8, 9, 10

print(f"Today: {TODAY.strftime('%Y-%m-%d')}")
print(f"Date range: {DATE_RANGE[0]} to {DATE_RANGE[-1]}")

# ── Load data from Google Sheet ─────────────────────────────────────────
creds = Credentials.from_authorized_user_file(TOKEN_PATH)
service = build("sheets", "v4", credentials=creds)

result = service.spreadsheets().values().get(
    spreadsheetId=SHEET_ID, range="Sheet1!A:Z"
).execute()
values = result.get("values", [])

print(f"Total rows from sheet: {len(values)}")

# Headers: 日期, 時間, 來源, 標題, 摘要, 連結, 截圖/備註
rows = values[1:]  # skip header

# ── Sentiment detection ─────────────────────────────────────────────────
def detect_sentiment(tags_col):
    """Detect sentiment from the tags/notes column.
    ⚠️ is a 'needs attention' marker (system), not brand-negative sentiment."""
    if not tags_col:
        return "neutral"
    t = tags_col.lower()
    if any(w in t for w in ["負面", "negative"]):
        return "negative"
    if any(w in t for w in ["正面", "positive"]):
        return "positive"
    return "neutral"

def extract_tags(tags_col):
    """Extract a clean tag from the column."""
    if not tags_col:
        return "一般"
    t = tags_col.replace("⚠️", "").replace("🔴", "").replace("🟡", "").replace("🟢", "").strip()
    if t.startswith("中性") or "neutral" in t.lower():
        return "中性"
    if t.startswith("負面") or "negative" in t.lower():
        return "負面"
    if t.startswith("正面") or "positive" in t.lower():
        return "正面"
    if t in ["品牌推廣", "正面食評", "節日推廣", "會員推廣", "新餐單推廣", "信用卡優惠推廣", "廣告回顧"]:
        return t
    if t in ["一般", "Bot保護擋截", "需關注", "協調員報告"]:
        return t
    if "需關注" in t:
        return "需關注"
    if t.startswith("中性偏"):
        return "中性"
    if t.startswith("MEDIUM") or t.startswith("Monitor"):
        return "需關注"
    if t.startswith("Brand awareness"):
        return "需關注"
    if t.startswith("Premium"):
        return "競爭對手"
    if t.startswith("Active competitor"):
        return "競爭對手"
    if t.startswith("Agent E"):
        return "一般"
    return t[:30] if t else "一般"

# ── Build item ──────────────────────────────────────────────────────────
def build_item(row, date_str):
    date_raw = row[0] if len(row) > 0 else ""
    time_raw = row[1] if len(row) > 1 else ""
    source = row[2] if len(row) > 2 else ""
    title = row[3] if len(row) > 3 else ""
    summary = row[4] if len(row) > 4 else ""
    link = row[5] if len(row) > 5 else ""
    tags_col = row[6] if len(row) > 6 else ""
    explicit_sent = row[7] if len(row) > 7 else ""  # column 8 = explicit sentiment

    # Preference: explicit sentiment column (8th) over tag detection
    sent = explicit_sent.strip().lower() if explicit_sent else detect_sentiment(tags_col)
    if sent not in ("positive", "negative", "neutral"):
        sent = detect_sentiment(tags_col)
    return {
        "title": title,
        "summary": summary,
        "source": source,
        "date": date_str,
        "time": time_raw,
        "link": link,
        "sentiment": sent,
        "tags": extract_tags(tags_col)
    }

# Group rows by date
data_by_date = {}
for row in rows:
    if not row or not row[0]:
        continue
    d = row[0]
    data_by_date.setdefault(d, []).append(build_item(row, d))

print(f"Dates found in sheet: {sorted(data_by_date.keys())}")

# ── Generate daily files ────────────────────────────────────────────────
os.makedirs(DATA_DIR, exist_ok=True)

for date_str in DATE_RANGE:
    items = data_by_date.get(date_str, [])
    alerts = []
    for item in items:
        if item["sentiment"] == "negative":
            alerts.append({"level": "MEDIUM", "title": item["title"],
                           "summary": item["summary"], "source": item["source"]})
        elif item["tags"] in ["Bot保護擋截", "需關注"]:
            alerts.append({"level": "LOW", "title": item["title"],
                           "summary": item["summary"], "source": item["source"]})

    pos = sum(1 for i in items if i["sentiment"] == "positive")
    neg = sum(1 for i in items if i["sentiment"] == "negative")
    neu = sum(1 for i in items if i["sentiment"] == "neutral")

    daily = {
        "date": date_str,
        "items": items,
        "alerts": alerts,
        "summary": f"{date_str} — {len(items)} 條mention (正面:{pos} 中性:{neu} 負面:{neg})"
    }

    filepath = os.path.join(DATA_DIR, f"daily-{date_str}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(daily, f, ensure_ascii=False, indent=2)
    print(f"Written: {filepath} ({len(items)} items)")

# ── Generate weekly-latest.json ─────────────────────────────────────────
week_items = []
week_alerts = []
for date_str in DATE_RANGE:
    for item in data_by_date.get(date_str, []):
        week_items.append(item)
        if item["sentiment"] == "negative":
            week_alerts.append({"level": "MEDIUM", "title": item["title"],
                                "summary": item["summary"], "source": item["source"]})
        elif item["tags"] in ["Bot保護擋截", "需關注"]:
            week_alerts.append({"level": "LOW", "title": item["title"],
                                "summary": item["summary"], "source": item["source"]})

seen_titles = set()
deduped_alerts = []
for a in week_alerts:
    if a["title"] not in seen_titles:
        seen_titles.add(a["title"])
        deduped_alerts.append(a)

pos_total = sum(1 for i in week_items if i["sentiment"] == "positive")
neg_total = sum(1 for i in week_items if i["sentiment"] == "negative")
neu_total = sum(1 for i in week_items if i["sentiment"] == "neutral")

weekly = {
    "week": f"{DATE_RANGE[0]} to {DATE_RANGE[-1]}",
    "items": week_items,
    "alerts": deduped_alerts,
    "stats": {"total": len(week_items), "positive": pos_total,
              "negative": neg_total, "neutral": neu_total}
}

weekly_path = os.path.join(DATA_DIR, "weekly-latest.json")
with open(weekly_path, "w", encoding="utf-8") as f:
    json.dump(weekly, f, ensure_ascii=False, indent=2)
print(f"Written: {weekly_path} ({len(week_items)} items, {len(deduped_alerts)} alerts)")

# ── Generate monthly-latest.json ────────────────────────────────────────
month = TODAY.strftime("%Y-%m")
month_items = []
month_alerts = []
seen_titles_month = set()

for d, items in data_by_date.items():
    if d.startswith(month):
        for item in items:
            month_items.append(item)
            if item["sentiment"] == "negative" or item["tags"] in ["Bot保護擋截", "需關注"]:
                if item["title"] not in seen_titles_month:
                    level = "MEDIUM" if item["sentiment"] == "negative" else "LOW"
                    month_alerts.append({"level": level, "title": item["title"],
                                         "summary": item["summary"], "source": item["source"]})
                    seen_titles_month.add(item["title"])

pos_m = sum(1 for i in month_items if i["sentiment"] == "positive")
neg_m = sum(1 for i in month_items if i["sentiment"] == "negative")
neu_m = sum(1 for i in month_items if i["sentiment"] == "neutral")

monthly = {
    "month": month,
    "items": month_items,
    "alerts": month_alerts,
    "stats": {"total": len(month_items), "positive": pos_m,
              "negative": neg_m, "neutral": neu_m}
}

monthly_path = os.path.join(DATA_DIR, "monthly-latest.json")
with open(monthly_path, "w", encoding="utf-8") as f:
    json.dump(monthly, f, ensure_ascii=False, indent=2)
print(f"Written: {monthly_path} ({len(month_items)} items, {len(month_alerts)} alerts)")

# ── Summary ─────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("GENERATION COMPLETE")
print("="*60)
for date_str in DATE_RANGE:
    items = data_by_date.get(date_str, [])
    pos = sum(1 for i in items if i["sentiment"] == "positive")
    neg = sum(1 for i in items if i["sentiment"] == "negative")
    neu = sum(1 for i in items if i["sentiment"] == "neutral")
    print(f"  {date_str}: {len(items)} items (P:{pos} N:{neg} Neu:{neu})")
print(f"  Weekly: {len(week_items)} items total")
print(f"  Monthly ({month}): {len(month_items)} items total")