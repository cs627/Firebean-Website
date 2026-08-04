#!/usr/bin/env python3
"""Update Google Sheet with Last Sent Date after blast."""
import json, subprocess, sys
from pathlib import Path
from collections import defaultdict

SPREADSHEET_ID = "1Ms1Q1i7uJg0ilvW4g1PezBm7mTCNKcYJT_c5-weUBNc"
VENV_PYTHON = "/opt/data/venv/bin/python"
GAPI = str(Path("/opt/data/skills/productivity/google-workspace/scripts/google_api.py"))
TODAY = "2026-08-04"


def _run_gapi(*args):
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
    raw = _run_gapi("sheets", "get", SPREADSHEET_ID, range_str)
    return raw if isinstance(raw, list) else []


# Get all rows
data = get_sheet("Email list!A:L")
if not data:
    print("Failed to read Email list")
    sys.exit(1)

header = data[0]
email_col = header.index("Email")
status_col = header.index("Status")
subscribed_col = header.index("Subscribed")
source_col = header.index("Source")
dept_col = header.index("Department")
subdept_col = header.index("Sub-Department")
last_sent_col = header.index("Last Sent Date")

# Identify always-include rows (Subscribed=TRUE or Dickson/Crystal source)
always_rows = []
gov_dir = []
for i, r in enumerate(data[1:], start=2):
    if len(r) <= email_col or not r[0].strip():
        continue
    s = r[status_col].strip().upper() if len(r) > status_col and r[status_col].strip() else "ACTIVE"
    if s != "ACTIVE":
        continue
    source = r[source_col].strip() if len(r) > source_col and r[source_col].strip() else ""
    subscribed = r[subscribed_col].strip().upper() if len(r) > subscribed_col and r[subscribed_col].strip() else "FALSE"
    if subscribed == "TRUE" or source in ("Dickson", "Crystal"):
        always_rows.append(i)
    else:
        dept = r[dept_col].strip() if len(r) > dept_col else ""
        subdept = r[subdept_col].strip() if len(r) > subdept_col else ""
        last_sent = r[last_sent_col].strip() if len(r) > last_sent_col else "0000-00-00"
        gov_dir.append({"row": i, "dept": dept, "subdept": subdept, "last_sent": last_sent})

# Group gov_dir by (dept, subdept), pick 2 per group
groups = defaultdict(list)
for g in gov_dir:
    key = (g["dept"], g["subdept"])
    groups[key].append(g)

rotating_rows = []
for key, members in groups.items():
    members.sort(key=lambda x: x["last_sent"])
    num = min(2, len(members))
    for i in range(num):
        rotating_rows.append(members[i]["row"])

all_rows = sorted(set(always_rows + rotating_rows))
print(f"Always-include: {len(always_rows)}, Rotating: {len(rotating_rows)}, Total: {len(all_rows)}")

# Build batch updates
updates = []
for row_idx in all_rows:
    updates.append({"range": f"Email list!K{row_idx}", "values": [[TODAY]]})
    updates.append({"range": f"Email list!L{row_idx}", "values": [["TRUE"]]})

# Update in batches of 10
batch_size = 10
for i in range(0, len(updates), batch_size):
    batch = updates[i:i + batch_size]
    data_json = json.dumps([{"range": u["range"], "values": u["values"]} for u in batch])
    # Count cells updated
    cell_count = len(batch)
    result = _run_gapi("sheets", "batch_update", SPREADSHEET_ID, "--data", data_json)
    if result and isinstance(result, dict):
        updated = result.get("totalUpdatedCells", 0)
        print(f"  Batch {i//batch_size + 1}: {updated}/{cell_count} cells updated")
    else:
        print(f"  Batch {i//batch_size + 1}: FAILED")
    import time
    time.sleep(1.5)

# Also set EDM_Database status to SENT
result = _run_gapi("sheets", "update", SPREADSHEET_ID, "EDM_Database!B5", "--values", json.dumps([["SENT"]]))
print(f"EDM_Database B5 status: {'SENT set' if result else 'FAILED'}")

print(f"\nDone. Updated {len(all_rows)} recipient rows.")