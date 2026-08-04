#!/usr/bin/env python3
"""
Firebean EDM Weekly Blast Script
Runs every Tuesday at 9:00 AM HKT via Hermes cron job.
Sends the next APPROVED EDM to all eligible recipients and notifies Dickson of the result.

Usage:
  BREVO_API_KEY="xkeysib-..." python3 scripts/run_edm_blast.py
  # or set BREVO_API_KEY in .env / environment
"""
import os, sys, json, subprocess, requests
from datetime import datetime
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────
THIS_DIR = Path(__file__).resolve().parent
REPO_DIR = THIS_DIR.parent
SCRIPTS_DIR = REPO_DIR / "scripts"
SKILL_DIR = REPO_DIR / ".." / ".." / "skills" / "productivity" / "firebean-edm"

API_KEY = os.environ.get("BREVO_API_KEY")
SPREADSHEET_ID = "1Ms1Q1i7uJg0ilvW4g1PezBm7mTCNKcYJT_c5-weUBNc"
NOTIFY_EMAIL = "dickson@firebean.net"
TODAY = datetime.now().strftime("%Y-%m-%d")
UNSUBSCRIBE_PAGE_URL = "https://firebean.net/edm/unsubscribe.html"

if not API_KEY:
    print("❌ BREVO_API_KEY environment variable not set.")
    sys.exit(1)

# ── Google Sheets: use google_api.py from the google-workspace skill ──────────
GAPI = str(Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
           / "skills" / "productivity" / "google-workspace" / "scripts" / "google_api.py")
VENV_PYTHON = "/opt/data/venv/bin/python"


def _run_gapi(*args):
    """Run google_api.py and return parsed JSON output."""
    cmd = [VENV_PYTHON, GAPI] + list(args)
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"gapi error: {res.stderr.strip()}", file=sys.stderr)
        return None
    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError:
        return res.stdout.strip()


def get_sheet(range_str):
    """Get values from a Sheets range via google_api.py."""
    raw = _run_gapi("sheets", "get", SPREADSHEET_ID, range_str)
    if isinstance(raw, list):
        return raw
    return []


def update_cell(range_str, value):
    """Update a single cell in Sheets."""
    _run_gapi("sheets", "update", SPREADSHEET_ID, range_str,
              "--values", json.dumps([[value]]))


def batch_update(updates):
    """Batch update multiple cells in Sheets using the batch_update endpoint."""
    if not updates:
        return
    # Group by sheet range, max 10 per batch to avoid rate limits
    batch_size = 10
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i + batch_size]
        data = [{"range": u["range"], "values": [[u["values"][0][0]]]} for u in batch]
        _run_gapi("sheets", "batch_update", SPREADSHEET_ID, "--data", json.dumps(data))
        import time
        time.sleep(1)  # avoid rate limits


def send_email(to, subject, html):
    """Send an email via Brevo transactional API (used for notifications only)."""
    r = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": API_KEY, "content-type": "application/json"},
        json={
            "sender": {"name": "Firebean Limited", "email": "hello@firebean.net"},
            "to": [{"email": to}],
            "subject": subject,
            "htmlContent": html,
        },
    )
    return r.status_code == 201


def send_campaign_via_api(recipients, subject, html, edm_id):
    """Send a blast using Brevo Campaign API so stats (opens/clicks) appear in the dashboard.

    Flow:
      1. Create a contacts list for this batch
      2. Import recipients into the list
      3. Create a classic email campaign
      4. Send it now
    Returns (campaign_id, error_msg).
    """
    headers = {"api-key": API_KEY, "content-type": "application/json"}
    batch_name = f"EDM_{edm_id}_{TODAY}"

    # 1. Create list
    r = requests.post(
        "https://api.brevo.com/v3/contacts/lists",
        headers=headers,
        json={"name": batch_name, "folderId": 1},
    )
    if r.status_code not in (200, 201):
        return None, f"List create failed ({r.status_code}): {r.text[:200]}"
    list_id = r.json()["id"]
    print(f"  List created: {batch_name} (id={list_id})")

    # 2. Add contacts one by one (more reliable than batch import)
    for i, email in enumerate(recipients):
        r = requests.post(
            "https://api.brevo.com/v3/contacts",
            headers=headers,
            json={"email": email, "listIds": [list_id], "updateEnabled": True},
        )
        if i < 3 or i % 20 == 0:
            print(f"  Adding contact {i+1}/{len(recipients)}...")
    print(f"  Contacts added: {len(recipients)}")

    # 3. Create campaign — replace {unsubscribe_url} with generic URL
    #    (Campaign API sends same HTML to all recipients)
    campaign_html = html.replace("{unsubscribe_url}", UNSUBSCRIBE_PAGE_URL)
    r = requests.post(
        "https://api.brevo.com/v3/emailCampaigns",
        headers=headers,
        json={
            "name": f"Firebean Weekly EDM - Issue {edm_id}",
            "subject": subject,
            "type": "classic",
            "htmlContent": campaign_html,
            "sender": {"name": "Firebean Limited", "email": "hello@firebean.net"},
            "recipients": {"listIds": [list_id]},
        },
    )
    if r.status_code not in (200, 201):
        return None, f"Campaign create failed ({r.status_code}): {r.text[:200]}"
    campaign_id = r.json()["id"]
    print(f"  Campaign created: id={campaign_id}")

    # 4. Send now
    r = requests.post(
        f"https://api.brevo.com/v3/emailCampaigns/{campaign_id}/sendNow",
        headers=headers,
    )
    if r.status_code not in (200, 201, 202):
        return None, f"Campaign send failed ({r.status_code}): {r.text[:200]}"
    print(f"  Campaign send triggered: id={campaign_id}")
    return campaign_id, None


def notify_dickson(subject, message_html):
    """Send notification to Dickson regardless of outcome."""
    send_email(NOTIFY_EMAIL, subject, message_html)


# ── Step 1: Find next APPROVED EDM ──────────────────────────────────────────
print("Step 1: Finding next APPROVED EDM...")
edm_rows = get_sheet("EDM_Database!A1:D20")
if not edm_rows:
    msg = "Could not read EDM_Database sheet. Check Google OAuth setup."
    print(msg)
    notify_dickson("⚠️ Firebean EDM Blast — Sheet Read Error",
                   f"<p>{msg}</p>")
    sys.exit(1)

headers = edm_rows[0] if edm_rows else []
target_edm = None
target_row = None
for i, row in enumerate(edm_rows[1:], start=2):
    if len(row) >= 2 and row[1].upper() == "APPROVED":
        target_edm = row
        target_row = i
        break

if not target_edm:
    msg = "No APPROVED EDM found in database. Blast skipped."
    print(msg)
    notify_dickson(
        "⚠️ Firebean EDM Blast — No APPROVED EDM Found",
        f"<p>{msg}</p><p>Check the EDM_Database sheet and set next EDM to APPROVED.</p>"
    )
    sys.exit(0)

EDM_ID = target_edm[0]
SUBJECT = target_edm[3] if len(target_edm) > 3 else f"Firebean Weekly EDM — {EDM_ID}"
print(f"Found: {EDM_ID} — {SUBJECT}")

# ── Step 2: Load HTML ──────────────────────────────────────────────────────
html_path = REPO_DIR / "edm" / f"edm_{EDM_ID}.html"
if not html_path.exists():
    msg = f"HTML file not found: {html_path}"
    print(msg)
    notify_dickson(
        f"❌ Firebean EDM Blast FAILED — {EDM_ID}",
        f"<p><strong>Blast failed on {TODAY}</strong></p><p>{msg}</p><p>Check the EDM HTML file in GitHub.</p>"
    )
    sys.exit(1)

html_content = html_path.read_text(encoding="utf-8")
print(f"HTML loaded: {len(html_content)} chars")

# ── Step 3: Build recipient list ─────────────────────────────────────────────
print("Step 3: Building recipient list...")
contact_rows = get_sheet("Email list!A1:L1000")
if not contact_rows:
    print("Could not read Email list sheet.")
    sys.exit(1)

h = contact_rows[0]
email_col = h.index("Email")
status_col = h.index("Status")
subscribed_col = h.index("Subscribed")
source_col = h.index("Source")
dept_col = h.index("Department")
subdept_col = h.index("Sub-Department")
last_sent_col = h.index("Last Sent Date")

# ── Group A: Always-include contacts ──────────────────────────────────────
# Subscribed=TRUE + non-HK-Gov-Directory sources → every mailing
always_recipients = []
always_row_idxs = []
gov_dir_recipients = []
gov_dir_row_idxs = []

for i, r in enumerate(contact_rows[1:], start=2):
    if len(r) <= email_col or not r[email_col].strip():
        continue
    status_val = r[status_col].strip().upper() if len(r) > status_col and r[status_col].strip() else "ACTIVE"
    if status_val != "ACTIVE":
        continue
    email = r[email_col].strip()
    source = r[source_col].strip() if len(r) > source_col and r[source_col].strip() else ""
    subscribed = r[subscribed_col].strip().upper() if len(r) > subscribed_col else "FALSE"

    # Always include if: Subscribed=TRUE OR Source is "Dickson" or "Crystal"
    is_always_source = source in ("Dickson", "Crystal")
    if subscribed == "TRUE" or is_always_source:
        always_recipients.append(email)
        always_row_idxs.append(i)
    else:
        gov_dir_recipients.append({"email": email, "source": source, "dept": r[dept_col].strip() if len(r) > dept_col else "", "subdept": r[subdept_col].strip() if len(r) > subdept_col else "", "last_sent": r[last_sent_col].strip() if len(r) > last_sent_col else "0000-00-00", "row": i})

# ── Group B: HK Gov Directory rotation ────────────────────────────────────
# Group by (dept, subdept), pick 2 with oldest Last Sent Date (reloop when all sent)
always_emails = set(always_recipients)
dept_groups = {}
for r in gov_dir_recipients:
    key = (r["dept"], r["subdept"])
    if key not in dept_groups:
        dept_groups[key] = []
    dept_groups[key].append(r)

rotating_recipients = []
rotating_row_idxs = []
for members in dept_groups.values():
    # Sort by Last Sent Date ascending (oldest first)
    members.sort(key=lambda x: x["last_sent"])
    # Pick 2 per group (or all if group has < 2)
    num_to_pick = min(2, len(members))
    for i in range(num_to_pick):
        chosen = members[i]
        rotating_recipients.append(chosen["email"])
        rotating_row_idxs.append(chosen["row"])

all_recipients = list(set(always_recipients + rotating_recipients))
all_row_idxs = list(set(always_row_idxs + rotating_row_idxs))
print(f"Recipients: {len(always_recipients)} always-include + {len(rotating_recipients)} rotating = {len(all_recipients)} total")

# ── Step 4: Send blast via Brevo Campaign API ────────────────────────────────
print("Step 4: Sending blast via Campaign API...")
campaign_id, err = send_campaign_via_api(all_recipients, SUBJECT, html_content, EDM_ID)
if err:
    print(f"  ❌ Campaign API error: {err}")
    print("  Falling back to transactional API per-recipient...")
    sent_count = 0
    failed_emails = []
    for email in all_recipients:
        # Personalize unsubscribe link per recipient
        personal_url = f"{UNSUBSCRIBE_PAGE_URL}?email={email}"
        personal_html = html_content.replace("{unsubscribe_url}", personal_url)
        ok = send_email(email, SUBJECT, personal_html)
        if ok:
            sent_count += 1
            if sent_count % 10 == 0:
                print(f"  Sent {sent_count}/{len(all_recipients)}...")
        else:
            failed_emails.append(email)
    print(f"Blast complete (fallback): {sent_count} sent, {len(failed_emails)} failed")
else:
    print(f"  ✅ Campaign sent via API (id={campaign_id})")
    sent_count = len(all_recipients)
    failed_emails = []

# ── Step 5: Update Google Sheet ──────────────────────────────────────────────
print("Step 5: Updating Google Sheet...")
updates = []
for row_idx in all_row_idxs:
    updates.append({"range": f"Email list!K{row_idx}", "values": [[TODAY]]})
    updates.append({"range": f"Email list!L{row_idx}", "values": [["TRUE"]]})
if updates:
    batch_update(updates)

update_cell(f"EDM_Database!B{target_row}", "SENT")
print(f"EDM_Database row {target_row} status set to SENT")

# ── Step 6: Notify Dickson ───────────────────────────────────────────────────
print("Step 6: Sending notification to Dickson...")
if sent_count > 0 and len(failed_emails) == 0:
    notify_dickson(
        f"✅ Firebean EDM Blast Complete — {EDM_ID}",
        f"""<p><strong>EDM Blast Report — {TODAY}</strong></p>
        <table border="1" cellpadding="8" style="border-collapse:collapse;">
        <tr><td><strong>EDM Issue</strong></td><td>{EDM_ID}</td></tr>
        <tr><td><strong>Subject</strong></td><td>{SUBJECT}</td></tr>
        <tr><td><strong>Total Sent</strong></td><td>{sent_count}</td></tr>
        <tr><td><strong>Always-Include (Subscribed + Dickson/Crystal)</strong></td><td>{len(always_recipients)}</td></tr>
        <tr><td><strong>Rotating Sub-Dept Reps</strong></td><td>{len(rotating_recipients)}</td></tr>
        <tr><td><strong>Failed</strong></td><td>0</td></tr>
        <tr><td><strong>Status</strong></td><td>SENT ✓</td></tr>
        </table>
        <p>View web version: <a href="https://firebean.net/edm/edm_{EDM_ID}.html">https://firebean.net/edm/edm_{EDM_ID}.html</a></p>"""
    )
else:
    failed_list = "<br>".join(failed_emails[:10]) if failed_emails else "None"
    notify_dickson(
        f"⚠️ Firebean EDM Blast Partial/Failed — {EDM_ID}",
        f"""<p><strong>EDM Blast Report — {TODAY}</strong></p>
        <p>Sent: {sent_count}/{len(all_recipients)}</p>
        <p>Failed ({len(failed_emails)}): {failed_list}</p>
        <p>Please check the Brevo account and retry if needed.</p>"""
    )

print(f"\n=== FINAL REPORT ===")
print(f"EDM: {EDM_ID}")
print(f"Sent: {sent_count}/{len(all_recipients)}")
print(f"Failed: {len(failed_emails)}")
print(f"Notification sent to: {NOTIFY_EMAIL}")