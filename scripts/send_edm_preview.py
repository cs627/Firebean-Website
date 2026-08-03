#!/usr/bin/env python3
"""
Firebean EDM Preview Sender (Step 10 of the 13-step workflow)
Sends a full HTML preview to Dickson via Brevo transactional API.

Usage:
  BREVO_API_KEY="xkeysib-..." python3 scripts/send_edm_preview.py EDM_003 "Subject Line Here"
"""
import os, sys, json, requests
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent
API_KEY = os.environ.get("BREVO_API_KEY")

if not API_KEY:
    print("❌ BREVO_API_KEY environment variable not set.")
    sys.exit(1)

if len(sys.argv) < 3:
    print("Usage: python3 send_edm_preview.py EDM_ID \"Subject Line\"")
    sys.exit(1)

EDM_ID = sys.argv[1]
SUBJECT = sys.argv[2]

html_path = REPO_DIR / "edm" / f"edm_{EDM_ID}.html"
if not html_path.exists():
    print(f"❌ HTML file not found: {html_path}")
    sys.exit(1)

html_content = html_path.read_text(encoding="utf-8")

r = requests.post(
    "https://api.brevo.com/v3/smtp/email",
    headers={"api-key": API_KEY, "content-type": "application/json"},
    json={
        "sender": {"name": "Firebean Limited", "email": "hello@firebean.net"},
        "to": [{"email": "dickson@firebean.net", "name": "Dickson Chan"}],
        "subject": f"[PREVIEW] Firebean EDM — Issue {EDM_ID} | {SUBJECT}",
        "htmlContent": html_content,
    },
)

if r.status_code == 201:
    print(f"✅ Preview sent successfully for {EDM_ID}")
    print(f"  To: dickson@firebean.net")
    print(f"  Subject: [PREVIEW] Firebean EDM — Issue {EDM_ID} | {SUBJECT}")
else:
    print(f"❌ Failed to send preview. Status: {r.status_code}")
    print(f"  Response: {r.text}")
    sys.exit(1)