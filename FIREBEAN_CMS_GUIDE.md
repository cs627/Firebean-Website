# Firebean CMS — Complete Technical Guide

> **Version:** 3.2 | **Last updated:** 2026-03-14
> **Purpose:** Full system documentation so any AI or developer can pick up, modify, and extend the Firebean website CMS.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Repository Structure (GitHub)](#2-repository-structure-github)
3. [Database — Google Sheet Structure](#3-database--google-sheet-structure)
4. [Frontend — Streamlit Admin App](#4-frontend--streamlit-admin-app)
5. [Backend Logic — Apps Script: CMS → GitHub Sync (v3.2)](#5-backend-logic--apps-script-cms--github-sync-v32)
6. [Backend Logic — Apps Script: Newsletter Subscribe](#6-backend-logic--apps-script-newsletter-subscribe)
7. [Backend Logic — Apps Script: Sheet Receiver (Streamlit POST target)](#7-backend-logic--apps-script-sheet-receiver-streamlit-post-target)
8. [Data File — projects.json Schema](#8-data-file--projectsjson-schema)
9. [GitHub Actions — Image Conversion Workflow](#9-github-actions--image-conversion-workflow)
10. [Website — Frontend Pages](#10-website--frontend-pages)
11. [Feature: Smart Hero Photo Picker (v3.2)](#11-feature-smart-hero-photo-picker-v32)
12. [Feature: Dark Mode](#12-feature-dark-mode)
13. [Feature: Newsletter Subscription](#13-feature-newsletter-subscription)
14. [Accounts & Credentials](#14-accounts--credentials)
15. [Common Tasks & Troubleshooting](#15-common-tasks--troubleshooting)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTENT CREATION                             │
│                                                                     │
│  ┌─────────────────────┐       ┌─────────────────────────────────┐  │
│  │  Streamlit Admin App │       │  Google Sheet (Master DB)       │  │
│  │  (firebean-app)      │──POST─▶│  Basic Info | UI_Text | Contacts│  │
│  │  dickson-crypto repo │       │  Sheet ID: 1aTuqgm...pi-yc     │  │
│  └─────────────────────┘       └──────────────┬──────────────────┘  │
│                                                │                     │
│                                     onEdit / Manual "Sync"          │
│                                                │                     │
│                                                ▼                     │
│                                  ┌──────────────────────────┐       │
│                                  │  Apps Script: sync-to-   │       │
│                                  │  github.gs (v3.2)        │       │
│                                  │  Reads Sheet → Downloads  │       │
│                                  │  Drive images → Resizes → │       │
│                                  │  Pushes to GitHub via     │       │
│                                  │  Git Tree API             │       │
│                                  └────────────┬─────────────┘       │
│                                               │                      │
└───────────────────────────────────────────────┼──────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          GITHUB REPO                                │
│  cs627/Firebean-Website (PUBLIC, main branch)                       │
│                                                                     │
│  ├── index.html           (Homepage)                                │
│  ├── work.html            (Work/Portfolio page)                     │
│  ├── profile.html         (Agency profile page)                     │
│  ├── data/                                                          │
│  │   ├── projects.json    (All project data — auto-generated)       │
│  │   ├── image-hashes.json (MD5 hashes for change detection)        │
│  │   └── images/          (381+ .webp images — hero, logo, gallery) │
│  ├── apps-script/         (Backup of all Apps Script code)          │
│  │   ├── sync-to-github.gs                                         │
│  │   └── newsletter-subscribe.gs                                   │
│  └── .github/workflows/                                             │
│      └── convert-images.yml (Auto jpg→webp conversion)              │
│                                                                     │
│  On push to data/images/** → GitHub Action converts jpg/png to webp │
│                                                                     │
│  GitHub Pages serves: https://cs627.github.io/Firebean-Website/     │
│  Future DNS: https://www.firebean.net                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       WEBSITE (READ-ONLY)                           │
│                                                                     │
│  index.html / work.html / profile.html                              │
│    └── fetch("data/projects.json") at runtime                       │
│    └── Renders hero banners, project cards, galleries, modals       │
│    └── Newsletter form → POST to newsletter-subscribe.gs            │
│    └── Dark mode toggles light/dark client logos from JSON           │
│                                                                     │
│  Base href: /Firebean-Website/ (until DNS switch to www.firebean.net)│
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. **Staff enters project data** via Streamlit app OR directly in Google Sheet
2. **Streamlit app POSTs** to a server-side Apps Script (`SHEET_SCRIPT_URL`) which writes row data + uploads images to Google Drive
3. **Staff clicks "Sync Changed Only"** in the Sheet's custom menu (🔥 Firebean CMS)
4. **sync-to-github.gs (v3.2)** reads all rows, downloads images from Drive, resizes them, builds `projects.json`, and pushes everything to GitHub in one commit
5. **GitHub Actions** auto-converts any new .jpg/.png to .webp
6. **GitHub Pages** serves the static site, which fetches `projects.json` at runtime

---

## 2. Repository Structure (GitHub)

**Repo:** `cs627/Firebean-Website` — PUBLIC, `main` branch
**GitHub Pages URL:** https://cs627.github.io/Firebean-Website/
**Account:** cs@firebean.net (GitHub user: cs627)

```
Firebean-Website/
├── .github/
│   └── workflows/
│       └── convert-images.yml      # Auto jpg/png → webp
├── apps-script/
│   ├── sync-to-github.gs          # v3.2 — CMS sync pipeline
│   └── newsletter-subscribe.gs     # Newsletter subscription handler
├── data/
│   ├── images/                     # 381+ webp images
│   │   ├── {pid}-hero.webp        # Hero banner (1200px wide)
│   │   ├── {pid}-hero-sm.webp     # Hero small (400px wide)
│   │   ├── {pid}-logo-black.webp  # Client logo black (200px)
│   │   ├── {pid}-logo-white.webp  # Client logo white (200px)
│   │   └── {pid}-gallery-{n}.webp # Gallery photos (1200px)
│   ├── projects.json               # Auto-generated — ALL project data
│   └── image-hashes.json           # MD5 hashes for change detection
├── public/                         # Static assets (fonts, icons)
├── index.html                      # Homepage
├── work.html                       # Portfolio/work page
├── profile.html                    # Agency profile page
├── STYLE_GUIDE.md                  # CSS/design conventions
├── metadata.json                   # Site metadata
├── server.ts                       # Legacy Vite dev server (not used in prod)
├── package.json                    # Legacy Node.js config
├── netlify.toml                    # Legacy Netlify config (not used)
└── README.md
```

### Image Naming Convention

All images in `data/images/` follow this pattern:
- `{pid}` = lowercase project ID with special chars removed (e.g., `fb2024002`)
- Hero: `{pid}-hero.webp` (1200px) and `{pid}-hero-sm.webp` (400px)
- Logos: `{pid}-logo-black.webp` and `{pid}-logo-white.webp` (200px)
- Gallery: `{pid}-gallery-0.webp`, `{pid}-gallery-1.webp`, ... (1200px)

**Streamlit Admin App Repo:** `dickson-crypto/Firebean-app` — PUBLIC
- URL: https://firebean-app-jfaads7deubxac5ha2qosx.streamlit.app/
- Contains: `app.py`, `requirements.txt`, `Firebeanlogo2026.png`

---

## 3. Database — Google Sheet Structure

**Spreadsheet ID:** `1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc`
**Owner:** dickson@firebean.net (Google Workspace)

### Worksheets

| Sheet Name | Sheet ID | Purpose |
|---|---|---|
| Basic Info | 0 | Main project database — 27 columns, 24+ rows |
| UI_Text | 799431517 | Website UI text strings (nav labels, section titles) |
| Contacts | 248481220 | Newsletter subscriber list |

### Basic Info — Column Map (27 columns)

| Col | Letter | Header | Content | Source |
|---|---|---|---|---|
| 1 | A | Timestamp | Auto-generated datetime | Streamlit / Manual |
| 2 | B | Client Name | e.g., "agnès b." | Streamlit / Manual |
| 3 | C | Project Name | e.g., "One day Shop Manager Joycelin" | Streamlit / Manual |
| 4 | D | Event Date | e.g., "2024 FEB" | Streamlit / Manual |
| 5 | E | Venue | e.g., "Hong Kong Convention Centre" | Streamlit / Manual |
| 6 | F | Category (Who we help) | One of: GOVERNMENT & PUBLIC SECTOR, LIFESTYLE & CONSUMER, F&B & HOSPITALITY, MALLS & VENUES | Streamlit / Manual |
| 7 | G | What we do | Comma-separated: ROVING EXHIBITIONS, SOCIAL & CONTENT, INTERACTIVE & TECH, PR & MEDIA, EVENTS & CEREMONIES | Streamlit / Manual |
| 8 | H | Scope of Work | Comma-separated SOW items | Streamlit / Manual |
| 9 | I | YouTube Link | YouTube URL (optional) | Streamlit / Manual |
| 10 | J | Open Question | AI diagnostic open-ended answer | Streamlit AI |
| 11 | K | Boring Challenge | AI-generated challenge summary (~50 words) | Streamlit AI |
| 12 | L | Creative Solution | AI-generated solution summary | Streamlit AI |
| 13 | M | Google Slide | Link to generated Google Slide | Streamlit sync |
| 14 | N | LinkedIn Post | AI-generated LinkedIn post (EN+TC, 150-300 words) | Streamlit AI |
| 15 | O | Facebook Post | AI-generated Facebook post (TC, 100-250 words) | Streamlit AI |
| 16 | P | Threads Post | AI-generated Threads post (Cantonese, <50 words) | Streamlit AI |
| 17 | Q | Instagram Post | AI-generated IG post (TC, <150 words) | Streamlit AI |
| 18 | R | Web EN | AI-generated 500-word English article | Streamlit AI |
| 19 | S | Web TC | AI-generated 500-word Traditional Chinese article | Streamlit AI |
| 20 | T | Web JP | AI-generated 500-word Japanese article | Streamlit AI |
| **21** | **U** | **Sync Status** | Auto-set: "Pending", "Pending (images)", "Synced {datetime}" | **Apps Script trigger** |
| **22** | **V** | **Drive Folder Link** | Google Drive folder URL containing project photos | Streamlit sync / Manual |
| **23** | **W** | **Hero Photo Picker** | Smart picker: empty, "1"-"8", filename, or Drive URL | **Manual / v3.2 feature** |
| **24** | **X** | **Logo Black** | Google Drive file URL for black logo | Streamlit sync / Manual |
| **25** | **Y** | **Logo White** | Google Drive file URL for white logo | Streamlit sync / Manual |
| **26** | **Z** | **Project_id** | Format: FB{YEAR}{###} e.g., "FB2024002" | Streamlit auto-gen |
| **27** | **AA** | **Sort_date** | Format: YYYY-MM-01 for sorting | Streamlit auto-gen |

### Contacts — Column Map (4 columns)

| Col | Letter | Header | Content |
|---|---|---|---|
| 1 | A | Email | Subscriber email (lowercase, validated) |
| 2 | B | Name | Subscriber name (optional) |
| 3 | C | Date Added | ISO 8601 datetime |
| 4 | D | Source | Always "Website" |

### UI_Text — Column Map

| Col | Letter | Header | Content |
|---|---|---|---|
| 1 | A | Page | Page name (e.g., "Global") |
| 2 | B | Section | Section name (e.g., "Navigation") |
| 3 | C | Key | Text key (e.g., "Home", "About") |

---

## 4. Frontend — Streamlit Admin App

**Repo:** `dickson-crypto/Firebean-app`
**Live URL:** https://firebean-app-jfaads7deubxac5ha2qosx.streamlit.app/
**File:** `app.py`

### Purpose

Staff-facing web app for creating new project entries. Streamlit Cloud hosts it. It:
1. Collects project metadata (client, project name, venue, date, category, scope)
2. Accepts 4-8 project photos + optional logos (black/white PNG)
3. Uses Gemini AI (gemini-2.5-flash) to analyze photos and generate:
   - 15 diagnostic MC questions (Traditional Chinese)
   - Challenge/solution summaries
   - Social media posts (LinkedIn, Facebook, Threads, Instagram)
   - Magazine-style articles in EN, TC, JP
4. POSTs everything to the Sheet Script URL for writing to Google Sheet + Drive

### Key Configuration

```python
SHEET_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzaQu2KpJ06I0yWL4dEwk0naB1FOlHkt7Ta340xH84IDwQI7jQNUI3eSmxrwKyQHNj5/exec"
SLIDE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZvtm8M8a5sLYF3vz9kLyAdimzzwpSlnTkzIeQ3DJxkklNYNlwSoJc5j5CkorM6w5V/exec"
STABLE_MODEL_ID = "gemini-2.5-flash"
```

### Tabs

| Tab | Purpose |
|---|---|
| **Project Collector** | Main data entry form — client info, photos, AI diagnostic questions |
| **Review & Multi-Sync** | Review AI content, confirm & sync to Sheet + Slide + Drive |

### Hero Photo Selection Flow

1. Staff uploads 4-8 photos
2. Radio buttons let staff pick which photo is the Hero Banner
3. On sync, the selected hero photo is moved to index 0 of the `images` array
4. The server-side Apps Script receives the reordered array and uploads to Drive
5. The first image becomes the hero, rest become gallery photos
6. Column W in the Sheet gets populated with the hero's Drive URL

### Payload Structure (POST to SHEET_SCRIPT_URL)

```json
{
  "action": "sync_project",
  "project_id": "FB2026005",
  "sort_date": "2026-02-01",
  "client_name": "Client Name",
  "project_name": "Project Name",
  "venue": "Venue",
  "date": "2026 FEB",
  "youtube": "https://youtube.com/...",
  "category": "LIFESTYLE & CONSUMER",
  "category_what": "INTERACTIVE & TECH, PR & MEDIA",
  "scope": "Theme Design, Event Production",
  "challenge": "AI-generated challenge summary",
  "solution": "AI-generated solution summary",
  "open_question": "Staff's open-ended answer",
  "logo_white": "base64-encoded-png",
  "logo_black": "base64-encoded-png",
  "images": ["base64-img-1", "base64-img-2", "..."],
  "ai_content": {
    "challenge_summary": "...",
    "solution_summary": "...",
    "1_google_slide": "...",
    "2_facebook_post": "...",
    "3_threads_post": "...",
    "4_instagram_post": "...",
    "5_linkedin_post": "...",
    "6_website": {
      "angle_chosen": "Style 2: The Contrarian",
      "en": "500-word English article...",
      "tc": "500-word TC article...",
      "jp": "500-word JP article..."
    }
  }
}
```

### Streamlit Secrets Required

```toml
# .streamlit/secrets.toml (NOT in repo — configured in Streamlit Cloud)
GEMINI_API_KEY = "your-gemini-api-key"
```

### Full Source Code

The complete `app.py` source is in the `dickson-crypto/Firebean-app` repo:
https://github.com/dickson-crypto/Firebean-app/blob/main/app.py

### Dependencies

```
# requirements.txt
streamlit
google-generativeai
Pillow
requests
```

---

## 5. Backend Logic — Apps Script: CMS → GitHub Sync (v3.2)

**File:** `apps-script/sync-to-github.gs`
**Location:** Installed in the Google Sheet's Apps Script editor (Extensions → Apps Script)
**Also backed up at:** https://github.com/cs627/Firebean-Website/blob/main/apps-script/sync-to-github.gs

### Purpose

The core sync engine. Reads the Google Sheet, downloads images from Google Drive, resizes them, builds `projects.json`, and pushes everything to GitHub in a single atomic commit.

### Version History

| Version | Feature |
|---|---|
| v3.0 | Smart sync, progress toasts, text-only optimization |
| v3.1 | Added "🖼️ Re-sync Images for Selected Row" menu button |
| v3.2 | Smart Hero Photo Picker — Column W accepts number (1-8), filename, or auto-detect |

### CONFIG Object

```javascript
var CONFIG = {
  SHEET_NAME: 'Basic Info',
  GITHUB_OWNER: 'cs627',
  GITHUB_REPO: 'Firebean-Website',
  GITHUB_BRANCH: 'main',
  IMAGES_PATH: 'data/images',
  JSON_PATH: 'data/projects.json',
  HASH_PATH: 'data/image-hashes.json',

  HERO_WIDTH: 1200,       // Hero banner resize width
  HERO_SM_WIDTH: 400,     // Hero small thumbnail width
  LOGO_WIDTH: 200,        // Logo resize width
  GALLERY_WIDTH: 1200,    // Gallery photo resize width

  COL: {
    TIMESTAMP: 1,        // A
    CLIENT: 2,           // B
    PROJECT: 3,          // C
    DATE: 4,             // D
    VENUE: 5,            // E
    CATEGORY: 6,         // F
    WHAT_WE_DO: 7,       // G
    SCOPE: 8,            // H
    YOUTUBE: 9,          // I
    OPEN_QUESTION: 10,   // J
    CHALLENGE: 11,       // K
    SOLUTION: 12,        // L
    GOOGLE_SLIDE: 13,    // M
    LINKEDIN: 14,        // N
    FACEBOOK: 15,        // O
    THREADS: 16,         // P
    INSTAGRAM: 17,       // Q
    WEB_EN: 18,          // R
    WEB_TC: 19,          // S
    WEB_JP: 20,          // T
    SYNC_STATUS: 21,     // U
    DRIVE_FOLDER: 22,    // V
    HERO_PHOTO: 23,      // W — Smart Hero Picker
    LOGO_BLACK: 24,      // X
    LOGO_WHITE: 25,      // Y
    PROJECT_ID: 26,      // Z
    SORT_DATE: 27        // AA
  }
};
```

### Sync Status Values (Column U)

| Status | Meaning | Behavior on sync |
|---|---|---|
| `Pending` | Text-only change detected | Re-reads text, skips image download |
| `Pending (images)` | Image column changed | Re-downloads all images from Drive |
| `Synced {datetime}` | Last successful sync | Skipped in "Changed Only" mode |
| (empty) | New row, never synced | Treated as "Pending (images)" |

### Image Trigger Columns

Changes to these columns set status to "Pending (images)":
- Column V (Drive Folder Link)
- Column W (Hero Photo Picker)
- Column X (Logo Black)
- Column Y (Logo White)

All other column edits set status to "Pending" (text-only).

### Menu Functions

| Menu Item | Function | Description |
|---|---|---|
| Sync Changed Only | `syncChangedToGitHub()` | Only processes rows with Pending/Pending (images) status |
| 🖼️ Re-sync Images for Selected Row | `markSelectedRowForImageSync()` | Force image re-download for selected rows |
| Sync ALL to Website | `syncAllToGitHub()` | Full rebuild — processes every row |
| Setup Auto-Sync Trigger | `setupTriggers()` | Installs onEdit and onOpen triggers |

### Core Sync Flow (`doSync`)

```
1. Read all Sheet data
2. Load existing image hashes from GitHub (data/image-hashes.json)
3. For each row:
   a. Parse project metadata (columns A-T, Z-AA)
   b. Determine if needsImageSync or needsTextSync
   c. If needsImageSync:
      - List all files in the Drive folder
      - Separate into: allFolderFiles, galleryFiles (exclude Hero_/Logo_ prefix)
      - Resolve hero photo using resolveHeroFileId_() — v3.2 smart picker
      - Download hero (1200px + 400px), logos (200px), gallery (1200px)
      - Compare MD5 hashes — only push changed images
   d. Build project object with all fields
4. Sort projects by sortDate descending
5. Generate projects.json
6. Push all changed files to GitHub in one commit via Git Tree API
7. Update sync status for all processed rows
```

### Key Helper Functions

| Function | Purpose |
|---|---|
| `resolveHeroFileId_(val, allFiles, gallery, name)` | v3.2 smart hero picker — resolves empty/number/filename/URL to Drive file ID |
| `extractDriveFileId_(url)` | Extracts Drive file ID from URLs like `/d/{id}/` or `?id={id}` |
| `extractDriveFolderId_(url)` | Extracts folder ID from Drive folder URLs |
| `downloadDriveImage_(fileId, width)` | Downloads and resizes image from Drive (3 fallback methods) |
| `pushIfChanged_(...)` | Hash-checks image, only adds to push list if changed |
| `pushToGitHubBatch_(token, images, json, hashes)` | Atomic commit via Git Tree API |
| `computeHash_(bytes)` | MD5 hash for change detection |
| `categoryToSlugs_(cat)` | Maps category names to URL-friendly filter slugs |

### Image Download Strategy (3 fallbacks)

```javascript
// 1. Google's image proxy (fastest, with resize)
"https://lh3.googleusercontent.com/d/{fileId}=w{width}"

// 2. Drive thumbnail API (with resize)
"https://drive.google.com/thumbnail?id={fileId}&sz=w{width}"

// 3. Direct DriveApp download (no resize, full file)
DriveApp.getFileById(fileId).getBlob()
```

### GitHub Push Strategy (Git Tree API)

The script uses GitHub's low-level Git Tree API for atomic multi-file commits:
1. GET current branch HEAD SHA
2. GET the tree SHA from HEAD commit
3. For each image: POST blob (base64)
4. POST new tree with all blobs + projects.json + hashes.json
5. POST new commit referencing the new tree
6. PATCH branch ref to point to new commit

This ensures all changes land in ONE commit, avoiding partial states.

### Setup Instructions

1. Open Google Sheet → Extensions → Apps Script
2. Delete default `Code.gs`
3. Paste entire `sync-to-github.gs` content
4. Go to Project Settings → Script Properties → Add:
   - Key: `GITHUB_TOKEN`
   - Value: Your GitHub Personal Access Token (needs `repo` scope)
5. Run `setupTriggers()` once (grants permissions)
6. Reload the Sheet — "🔥 Firebean CMS" menu should appear

---

## 6. Backend Logic — Apps Script: Newsletter Subscribe

**File:** `apps-script/newsletter-subscribe.gs`
**Deployed as:** Google Apps Script Web App (Execute as: Me, Access: Anyone)
**Backed up at:** https://github.com/cs627/Firebean-Website/blob/main/apps-script/newsletter-subscribe.gs

### Purpose

Handles newsletter subscription form submissions from the website. Writes to the "Contacts" sheet.

### Security Features

1. **Email validation** — RFC 5322 regex
2. **Honeypot field** — Hidden `website` field catches bots
3. **Rate limiting** — Max 5 submissions per IP per hour (Script Properties-based)
4. **Duplicate check** — Prevents same email subscribing twice
5. **Max row cap** — 5000 entries maximum
6. **CORS** — Restricted to allowed origins
7. **Input sanitization** — Strips HTML tags, limits to 200 chars

### Allowed Origins

```javascript
var ALLOWED_ORIGINS = [
  'https://cs627.github.io',
  'https://www.firebean.net',
  'https://firebean.net',
  'http://localhost',
  'http://127.0.0.1'
];
```

### API Endpoints

| Method | Action |
|---|---|
| POST | Subscribe email — body: `{ email, name, website (honeypot), _origin, _ip }` |
| GET | Health check — returns `{ status: "ok", service: "Firebean Newsletter" }` |

### Response Codes

```json
{ "success": true, "message": "subscribed" }
{ "success": false, "error": "invalid_email" }
{ "success": false, "error": "rate_limited" }
{ "success": false, "error": "already_subscribed" }
{ "success": false, "error": "capacity_full" }
```

---

## 7. Backend Logic — Apps Script: Sheet Receiver (Streamlit POST target)

**Deployed URL:** `https://script.google.com/macros/s/AKfycbzaQu2KpJ06I0yWL4dEwk0naB1FOlHkt7Ta340xH84IDwQI7jQNUI3eSmxrwKyQHNj5/exec`
**Location:** Inside the Google Sheet's Apps Script project (NOT in GitHub repo)
**Deployed as:** Web App (Execute as: Me, Access: Anyone)

### Purpose

Receives POST data from the Streamlit admin app. Handles two actions:

| Action | Method | Description |
|---|---|---|
| `get_row_count` | GET (query param) | Returns current row count for generating Project_id |
| `sync_project` | POST (JSON body) | Writes a new project row + uploads images to Drive |

### What It Does on `sync_project`

1. Creates a new Google Drive folder for the project
2. Uploads all base64 images as JPEG files to the folder
   - First image → named as hero (it's the one the user selected as hero)
   - Rest → named as gallery photos
3. Uploads logos (black/white) as PNG files
4. Writes a new row to the "Basic Info" sheet with all 27 columns
5. Sets Column W (Hero Photo) to the Drive URL of the hero image
6. Sets Column V (Drive Folder) to the folder URL
7. Returns success/failure response

### Important Note

**This script's source code is NOT in the GitHub repo.** It lives only inside the Google Sheet's Apps Script editor. To view or edit it:
1. Open the Google Sheet
2. Extensions → Apps Script
3. Look for the `doPost` function that handles `sync_project`

If you need to modify how the Streamlit app writes data, you must edit this script directly in the Apps Script editor.

### Slide Script (separate)

There's also a separate Apps Script that generates Google Slides:
- URL: `https://script.google.com/macros/s/AKfycbyZvtm8M8a5sLYF3vz9kLyAdimzzwpSlnTkzIeQ3DJxkklNYNlwSoJc5j5CkorM6w5V/exec`
- This creates a Google Slides presentation from the project data
- Also NOT in GitHub — lives in its own Apps Script project

---

## 8. Data File — projects.json Schema

**Path:** `data/projects.json`
**Auto-generated by:** sync-to-github.gs
**DO NOT edit manually** — it gets overwritten on every sync.

### Top-Level Structure

```json
{
  "lastSync": "2026-03-14T12:23:40.948Z",
  "projects": [ ... ]
}
```

### Project Object Schema

```json
{
  "index": 0,
  "client": "agnès b.",
  "project": "One day Shop Manager Joycelin",
  "date": "Wed Feb 01 2017 00:00:00 GMT+0800 (Hong Kong Standard Time)",
  "venue": "Image Optical @ MOSTown",
  "category": "GOVERNMENT & PUBLIC SECTOR",
  "whatWeDo": "SOCIAL & CONTENT, PR & MEDIA, EVENTS & CEREMONIES",
  "scope": "Event Coordination, Social Media Management, Artist Endorsement",
  "youtube": "",
  "challenge": "Past events primarily generated superficial celebrity interaction...",
  "solution": "Future strategies will pivot from mere celebrity appearances...",
  "linkedin": "The Evolution of Brand Engagement...",
  "facebook": "【一日店長體驗 × agnès b. LUNETTES】...",
  "threads": "大家參加呢類名人活動最怕遇到咩伏？...",
  "instagram": "✨ 幕後直擊 ✨...",
  "webEN": "Full 500-word English article...",
  "webTC": "Full 500-word Traditional Chinese article...",
  "webJP": "Full 500-word Japanese article...",
  "heroPhoto": "data/images/fb2017014-hero.webp",
  "heroPhotoSmall": "data/images/fb2017014-hero-sm.webp",
  "logoBlack": "data/images/fb2017014-logo-black.webp",
  "logoWhite": "data/images/fb2017014-logo-white.webp",
  "galleryPhotos": [
    "data/images/fb2017014-gallery-0.webp",
    "data/images/fb2017014-gallery-1.webp",
    "data/images/fb2017014-gallery-2.webp"
  ],
  "projectId": "FB2017014",
  "sortDate": "2017-02-01",
  "driveFolderId": "16_dAV1OlbGL_MwxHFed5MPPHYiVIfE8A",
  "categories": ["GOVERNMENT & PUBLIC SECTOR", "SOCIAL & CONTENT", "PR & MEDIA", "EVENTS & CEREMONIES"],
  "filterSlugs": ["government", "social", "pr", "events"]
}
```

### Field Reference

| Key | Type | Description |
|---|---|---|
| `index` | number | Position in sorted array (0-based) |
| `client` | string | Client company name |
| `project` | string | Project name/title |
| `date` | string | Raw date string from Sheet |
| `venue` | string | Event venue |
| `category` | string | Primary category (uppercase) |
| `whatWeDo` | string | Comma-separated services (uppercase) |
| `scope` | string | Scope of work items |
| `youtube` | string | YouTube URL (may be empty) |
| `challenge` | string | AI-generated challenge/pain point |
| `solution` | string | AI-generated solution |
| `linkedin` | string | LinkedIn post content |
| `facebook` | string | Facebook post content |
| `threads` | string | Threads post content |
| `instagram` | string | Instagram post content |
| `webEN` | string | English web article |
| `webTC` | string | Traditional Chinese web article |
| `webJP` | string | Japanese web article |
| `heroPhoto` | string | Path: `data/images/{pid}-hero.webp` |
| `heroPhotoSmall` | string | Path: `data/images/{pid}-hero-sm.webp` |
| `logoBlack` | string | Path: `data/images/{pid}-logo-black.webp` |
| `logoWhite` | string | Path: `data/images/{pid}-logo-white.webp` |
| `galleryPhotos` | string[] | Array of gallery image paths |
| `projectId` | string | e.g., "FB2024002" |
| `sortDate` | string | "YYYY-MM-01" for chronological sort |
| `driveFolderId` | string | Google Drive folder ID |
| `categories` | string[] | All category labels (for filtering) |
| `filterSlugs` | string[] | URL-friendly category slugs |

### Category → Slug Mapping

```javascript
'GOVERNMENT & PUBLIC SECTOR' → ['government']
'LIFESTYLE & CONSUMER'       → ['lifestyle']
'F&B & HOSPITALITY'          → ['hospitality']
'MALLS & VENUES'             → ['venues']
'ROVING EXHIBITIONS'         → ['exhibitions']
'SOCIAL & CONTENT'           → ['social']
'INTERACTIVE & TECH'         → ['tech']
'PR & MEDIA'                 → ['pr']
'EVENTS & CEREMONIES'        → ['events']
```

---

## 9. GitHub Actions — Image Conversion Workflow

**File:** `.github/workflows/convert-images.yml`

### Trigger

Runs on push to `data/images/**` on `main` branch.

### What It Does

1. Installs `cwebp` (WebP converter)
2. Scans `data/images/` for any `.jpg`, `.jpeg`, `.png` files
3. Converts each to `.webp` (quality 80, max width 1200px)
4. Deletes the original jpg/png source file
5. Commits the converted files back to `main`

### Concurrency

Only one conversion job runs at a time. Others queue (not cancelled).

```yaml
concurrency:
  group: convert-images
  cancel-in-progress: false
```

### Note

The sync script (v3.2) already pushes images as `.webp` format. This workflow is a safety net for any images that might arrive as jpg/png through other means.

---

## 10. Website — Frontend Pages

### Pages

| File | URL Path | Purpose |
|---|---|---|
| `index.html` | `/Firebean-Website/` | Homepage — hero carousel, featured work, about, clients, newsletter |
| `work.html` | `/Firebean-Website/work.html` | Portfolio page — filterable project grid with modals |
| `profile.html` | `/Firebean-Website/profile.html` | Agency profile — team, gallery, random Polaroid photos |

### Data Loading Pattern

All pages load data the same way:

```javascript
fetch('data/projects.json')
  .then(r => r.json())
  .then(data => {
    // data.projects is sorted by sortDate descending
    // index.html: hero = first 3, profile = next 6, newsletter = next 3
    // work.html: all projects, filterable by category slug
  });
```

### Project Distribution Across Pages (index.html)

| Section | Projects | Rule |
|---|---|---|
| Hero banner | projects[0..2] | Top 3 most recent — rotating carousel |
| Profile/Work section | projects[3..8] | Next 6 projects |
| Newsletter section | projects[9..11] | Next 3 projects |
| (No overlap between sections) | | |

### Key Website Features

- **Mega menu** — Full-width dropdown navigation with category links
- **Dark mode** — Toggleable, swaps client logos to white versions using `logoWhite` from JSON
- **Project modals** — Click a project card to see gallery, challenge/solution, social posts
- **Polaroid photos** — Random gallery photos displayed as Polaroid-style cards (excludes hero & logo images)
- **Newsletter form** — Submits to newsletter-subscribe.gs
- **Responsive** — Mobile-first with breakpoints
- **Filter** — work.html has category filters using `filterSlugs`

### Dark Mode Implementation

- Body gets class `dark-mode`
- CSS variables switch colors
- Client logos swap from `logoBlack` to `logoWhite` using `srcWhite` attribute
- Firebean nav logo does NOT change in dark mode (stays the same)
- `openClientModal()` checks `document.body.classList.contains('dark-mode')` to use `srcWhite`

### Matchstick Layout (index.html)

The hero section has decorative matchstick SVGs positioned around the "DRIVEN AGENCY" text:
- Left matchstick: 1 matchstick, red head points toward "DRIVEN"
- Right matchsticks: 2 matchsticks
  - Top: head from upper-right toward lower-left "AGENCY"
  - Bottom: head from lower-right toward Y of "AGENCY"
- Polaroid 2 bottom aligns with "DRIVEN" text baseline

### Base Href

```html
<base href="/Firebean-Website/">
```

Currently set to `/Firebean-Website/` for GitHub Pages. Will change to `/` when DNS switches to `www.firebean.net`.

---

## 11. Feature: Smart Hero Photo Picker (v3.2)

### Problem Solved

Staff needed to copy complex Google Drive URLs to set hero photos. The URLs contain encoded characters and are error-prone.

### Solution

Column W ("Hero Photo Picker") now accepts simple inputs:

| Input in Column W | What Happens |
|---|---|
| (empty) | Auto-detect: finds `Hero_*.jpg` in Drive folder, falls back to first gallery photo |
| `1` – `8` | Picks the Nth gallery photo (sorted alphabetically by filename) as hero |
| `Photo_03.jpg` | Matches by filename (case-insensitive) in the Drive folder |
| `https://drive.google.com/...` | Legacy Drive URL — fully backward compatible |
| Raw Drive file ID | Also works |

### Function: `resolveHeroFileId_()`

Located in `sync-to-github.gs`, this function handles all 5 cases:

1. **Empty** → scans `allFolderFiles` for any file with `Hero_` prefix. Falls back to `galleryFiles[0]`.
2. **Pure number** (`/^\d+$/`) → converts to 0-based index, returns `galleryFiles[idx].id`. If out of range, falls back to auto-detect.
3. **Filename** (has `.ext`) → case-insensitive match against `allFolderFiles[].name`. Also tries base name without extension.
4. **Drive URL or file ID** → delegates to `extractDriveFileId_()`.
5. **Unmatched string** → tries as filename without extension, then falls back to auto-detect.

### Drive Folder File Classification

When syncing images, the script lists all files in the Drive folder and classifies them:

```javascript
var entry = {
  name: fileName,
  id: file.getId(),
  updated: file.getLastUpdated().getTime(),
  isHero: !!fileName.match(/^Hero_/i),   // Files starting with "Hero_"
  isLogo: !!fileName.match(/^Logo_/i)    // Files starting with "Logo_"
};

// galleryFiles = all image files EXCEPT Hero_ and Logo_ prefixed ones
// galleryFiles are sorted alphabetically by name
```

### Google Sheet Enhancement

- Column W header renamed to "Hero Photo Picker"
- Data validation dropdown (1-8) applied to W2:W100
- Hover note on W1 explains usage

### Compatibility

- Streamlit app writes Drive URLs to Column W → works via Case 4 (legacy URL)
- Manual number entry → works via Case 2
- Both systems coexist — no conflicts

---

## 12. Feature: Dark Mode

### Toggle Mechanism

```javascript
// Toggle class on body
document.body.classList.toggle('dark-mode');
```

### Client Logo Swap

In dark mode, client logos swap from black to white versions:

```javascript
function openClientModal(el) {
  var isDark = document.body.classList.contains('dark-mode');
  var logoSrc = isDark ? el.getAttribute('data-src-white') : el.getAttribute('data-src-black');
  // Use logoSrc in modal
}
```

### Rules

- Firebean navigation logo: NO filter applied in dark mode (stays as-is)
- Client logos: swap to `logoWhite` field from projects.json
- All other images: no brightness filter

---

## 13. Feature: Newsletter Subscription

### Frontend (index.html)

```html
<form id="newsletter-form">
  <input type="email" name="email" required>
  <input type="text" name="name">
  <input type="text" name="website" style="display:none"> <!-- Honeypot -->
  <button type="submit">Subscribe</button>
</form>
```

### JavaScript Handler

```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const response = await fetch('NEWSLETTER_SCRIPT_URL', {
    method: 'POST',
    body: JSON.stringify({
      email: form.email.value,
      name: form.name.value,
      website: form.website.value, // honeypot
      _origin: window.location.origin,
      _ip: fingerprint
    })
  });
  const result = await response.json();
  // Handle success/error states
});
```

### Backend

See [Section 6: Newsletter Subscribe Apps Script](#6-backend-logic--apps-script-newsletter-subscribe)

---

## 14. Accounts & Credentials

| Service | Account | Purpose |
|---|---|---|
| GitHub (cs627) | cs@firebean.net | Hosts website repo, GitHub Pages |
| GitHub (dickson-crypto) | — | Hosts Streamlit app repo |
| Google Workspace | dickson@firebean.net | Owns Google Sheet, Drive folders |
| Streamlit Cloud | dickson@firebean.net | Hosts admin app |
| Gemini API | (API key in Streamlit secrets) | AI content generation |

### GitHub Token (for Apps Script)

Stored in Script Properties as `GITHUB_TOKEN`. Needs `repo` scope for pushing to the repository.

### Google Sheet Access

The Apps Scripts run as the Sheet owner (dickson@firebean.net) with full Drive and Sheets access via OAuth.

---

## 15. Common Tasks & Troubleshooting

### Add a New Project via Streamlit

1. Go to https://firebean-app-jfaads7deubxac5ha2qosx.streamlit.app/
2. Fill in all fields in "Project Collector" tab
3. Upload 4-8 photos, select hero
4. Generate AI diagnostic questions, answer all 15
5. Go to "Review & Multi-Sync" tab
6. Click "生成六大平台對接文案" to generate AI content
7. Review JSON output
8. Click "Confirm & Sync" to push to Sheet + Drive

### Change a Hero Photo (Staff, via Sheet)

1. Open the Google Sheet
2. Find the project row
3. In Column W, type a number (1-8) for which gallery photo to use
4. Click 🔥 Firebean CMS → Sync Changed Only
5. Wait ~1 min for GitHub Pages to update

### Force Re-sync All Images

1. Select project row(s) in the Sheet
2. Click 🔥 Firebean CMS → 🖼️ Re-sync Images for Selected Row
3. Then click Sync Changed Only

### Full Rebuild

1. Click 🔥 Firebean CMS → Sync ALL to Website
2. This re-processes every row — takes longer but ensures everything is fresh

### Debug: Images Not Showing

1. Check Column V has a valid Drive folder URL
2. Check the Drive folder is shared/accessible to the script owner
3. Check `data/images/` on GitHub — images should be `.webp`
4. Check `data/image-hashes.json` — the image path should have a hash entry
5. If all else fails, use "Re-sync Images for Selected Row"

### Debug: Sync Errors

1. In Apps Script editor, check Executions log
2. Common issues:
   - `GITHUB_TOKEN` expired → regenerate in GitHub Settings → Developer Settings
   - Drive API quota exceeded → wait and retry
   - Large images timing out → ensure Drive files are < 10MB

### Update the Website Code

1. Edit HTML files directly on GitHub or push via Git
2. Changes go live on GitHub Pages within ~1 minute
3. If changing `<base href>`, update ALL three HTML files

### Update the Sync Script

1. Edit in GitHub: `apps-script/sync-to-github.gs`
2. Copy the content
3. Open Google Sheet → Extensions → Apps Script
4. Replace the existing code with the new version
5. Save (Ctrl+S)
6. The script is now active

---

## Appendix: Complete File Inventory

### Apps Scripts (3 total)

| Script | Location | In GitHub? |
|---|---|---|
| sync-to-github.gs (v3.2) | Sheet's Apps Script editor | ✅ `apps-script/sync-to-github.gs` |
| newsletter-subscribe.gs | Separate Apps Script project | ✅ `apps-script/newsletter-subscribe.gs` |
| Sheet Receiver (doPost for Streamlit) | Sheet's Apps Script editor | ❌ Only in Apps Script editor |
| Slide Generator | Separate Apps Script project | ❌ Only in Apps Script editor |

### Website HTML (3 pages)

| File | Size | In GitHub? |
|---|---|---|
| index.html | ~116KB | ✅ |
| work.html | ~28KB | ✅ |
| profile.html | ~49KB | ✅ |

### Data Files

| File | Auto-generated? | In GitHub? |
|---|---|---|
| data/projects.json | ✅ by sync script | ✅ |
| data/image-hashes.json | ✅ by sync script | ✅ |
| data/images/*.webp | ✅ by sync script | ✅ (381+ files) |

### Streamlit App

| File | Repo |
|---|---|
| app.py | dickson-crypto/Firebean-app |
| requirements.txt | dickson-crypto/Firebean-app |
| .streamlit/secrets.toml | Streamlit Cloud (not in repo) |

---

*This document was generated on 2026-03-14 and reflects the state of all systems at that time. For the latest code, always check the GitHub repositories.*
