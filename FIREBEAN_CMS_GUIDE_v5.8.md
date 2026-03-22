# Firebean CMS — Complete Technical Guide

Version: 5.8 | Last updated: 2026-03-22 HKT | Purpose: Full system documentation so any AI or developer can pick up, modify, and extend the Firebean website CMS.

## — Document Version History —

**v5.8 | 2026-03-22 HKT | Major Bug Fix: `syncProjectFromStreamlit` Complete Column Sync & FAQ Logic**
- **Apps Script Fix**: Rewrote `syncProjectFromStreamlit` (now v5.7 in script) to write ALL 30 columns instead of just 3.
- **FAQ Logic**: Ensured FAQ data (`faq_en`, `faq_tc`, `faq_jp`) correctly flows from Streamlit to dedicated Columns 28-30 (AB, AC, AD), strictly separated from Website Content (Columns 18-20).
- **Drive Upload**: Added `uploadImagesToNewDriveFolder_` to process base64 images directly from Streamlit and set the Drive Folder link in Column 22.
- **Streamlit Prompt Fix**: Updated `FIREBEAN_SYSTEM_PROMPT` in `app.py` to strictly enforce ENGLISH ONLY for both `challenge_summary` and `solution_summary`.

**v5.3 | 2026-03-22 HKT | Fixed Google Sheets clipboard noise in project/client/venue fields**
- Added `clean_field()` in Streamlit `app.py` and `cleanSheetValue_()` in Apps Script `sync-to-github.gs`.
- Both strip sheet name, zoom %, cell refs, screen-reader strings, and deduplicate copy artifacts. Two-layer protection: input sanitisation at Streamlit level + safety net at sync pipeline level.

**v5.2 | 2026-03-17 22:30 HKT | Confirmed newsletter GSAP pin working correctly**
- Left column (title, subtitle, email form) pins from the exact moment the `#newsletter` section reaches the top of the viewport (start: 'top top'). The big title stays fixed while right-side article cards scroll past. No code changes — documentation update only.

**v5.1 | 2026-03-17 22:00 HKT | Fixed newsletter left column pin**
- CSS `position:sticky` does NOT work with Lenis smooth scroll (Lenis uses CSS transforms, not native scroll position). Solution: (1) Added Lenis-ScrollTrigger bridge: `lenis.on('scroll', ScrollTrigger.update)` + `ScrollTrigger.update()` in RAF loop + `gsap.ticker.lagSmoothing(0)`; (2) Replaced CSS sticky with GSAP ScrollTrigger pin: `ScrollTrigger.create({ trigger: '#newsletter', pin: '.newsletter-left-col', pinSpacing: false, anticipatePin: 1 })`; (3) Removed inline `position:sticky` style from `.newsletter-left-col` div.

**v5.0 | 2026-03-17 21:30 HKT | Fixed newsletter section (index.html)**
- (1) Sticky left column — changed `height: 100vh` to `min-height: 100vh` so sticky activates correctly (fixed height fills parent exactly, preventing sticky); (2) Dark mode email input — added CSS rules for `#nl-email`, `#nl-email::placeholder`, `#nl-submit-btn` and wrapper `.bg-black/5` to use light grey colours in dark mode (was invisible against dark background).

**v4.9 | 2026-03-17 21:00 HKT | Fixed profile.html footer**
- Replaced old contact section (missing Google Map, wrong layout, separate `<footer>` tag) with exact copy of `index.html` contact section — Google Maps iframe (grayscale), address+phone with SVG icons, unified footer bar inside same `<section>`. Rule: `profile.html` footer must always match `index.html` contact section exactly.

**v4.8 | 2026-03-16 21:00 HKT | Fixed gallery photos not showing on all profile pages**
- Rebuilt `galleryPhotos` in `projects.json` from `image-hashes.json` (all 24 projects, 185 photos). Fixed literal `\n` rendering in `webEN` article body. Fixed FAST RECAP section appearing in article body (now stripped — FAQ handled exclusively by `faqEN` sidebar). Fixed `interleave()` photo insertion using block-index approach for reliable 8-photo interleaving between paragraphs.

**v4.7 | 2026-03-16 20:00 HKT | Fixed profile.html article rendering**
- Normalised literal `\n` escape sequences in `webEN` content; rewrote `interleave()` to use block-index insertion (h1-h6 + p elements) instead of fragile nextSibling approach; added FAST RECAP / FAQ heading removal from article body.

**v4.6 | 2026-03-16 19:00 HKT | Fixed Q&A sidebar not rendering**
- Added `parsePythonStyleFaq()` to handle Python-style single-quoted arrays in `faqEN`/`faqTC`/`faqJP` fields (Google Sheets exports single quotes, not JSON double quotes). Q&A sidebar now correctly displays all 3 FAQ pairs on all profile pages.

**v4.5 | 2026-03-16 18:00 HKT | Diagnosed faqEN/faqTC/faqJP field format issue**
- Confirmed Google Sheets Apps Script exports Python-style dicts with single quotes, incompatible with `JSON.parse()`. Identified need for custom parser.

---

## Table of Contents

1. System Architecture Overview
2. Repository Structure (GitHub)
3. Database — Google Sheet Structure
4. Frontend — Streamlit Admin App
5. Backend Logic — Apps Script: CMS → GitHub Sync (v5.7)
6. Backend Logic — Apps Script: Newsletter Subscribe
7. Backend Logic — Apps Script: Sheet Receiver (Streamlit POST target)
8. Data File — projects.json Schema
9. GitHub Actions — Image Conversion Workflow
10. Website — Frontend Pages
11. Feature: Smart Hero Photo Picker (v3.2)
12. Feature: Dark Mode
13. Feature: Newsletter Subscription
14. Accounts & Credentials
15. Common Tasks & Troubleshooting

---

## 1. System Architecture Overview

```text
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
│                                  │  github.gs (v5.7)        │       │
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
```

### Data Flow Summary

1. Staff enters project data via Streamlit app OR directly in Google Sheet
2. Streamlit app POSTs to a server-side Apps Script (`SHEET_SCRIPT_URL`) which writes row data + uploads images to Google Drive
3. Staff clicks "Sync Changed Only" in the Sheet's custom menu (🔥 Firebean CMS)
4. `sync-to-github.gs` reads all rows, downloads images from Drive, resizes them, builds `projects.json`, and pushes everything to GitHub in one commit
5. GitHub Actions auto-converts any new `.jpg/.png` to `.webp`
6. GitHub Pages serves the static site, which fetches `projects.json` at runtime

---

## 2. Repository Structure (GitHub)

**Repo**: `cs627/Firebean-Website` — PUBLIC, main branch
**GitHub Pages URL**: https://cs627.github.io/Firebean-Website/
**Account**: cs@firebean.net (GitHub user: cs627)

### Image Naming Convention
All images in `data/images/` follow this pattern:
- `{pid}` = lowercase project ID with special chars removed (e.g., fb2024002)
- **Hero**: `{pid}-hero.webp` (1200px) and `{pid}-hero-sm.webp` (400px)
- **Logos**: `{pid}-logo-black.webp` and `{pid}-logo-white.webp` (200px)
- **Gallery**: `{pid}-gallery-0.webp`, `{pid}-gallery-1.webp`, ... (1200px)

**Streamlit Admin App Repo**: `dickson-crypto/Firebean-app` — PUBLIC
**URL**: https://firebean-app-jfaads7deubxac5ha2qosx.streamlit.app/

---

## 3. Database — Google Sheet Structure

**Spreadsheet ID**: `1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc`
**Owner**: dickson@firebean.net

### Basic Info — Column Map (30 columns)

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
| 11 | K | Boring Challenge | AI-generated challenge summary (ENGLISH ONLY, ~50 words) | Streamlit AI |
| 12 | L | Creative Solution | AI-generated solution summary (ENGLISH ONLY) | Streamlit AI |
| 13 | M | Google Slide | Link to generated Google Slide | Streamlit sync |
| 14 | N | LinkedIn Post | AI-generated LinkedIn post (EN+TC, 150-300 words) | Streamlit AI |
| 15 | O | Facebook Post | AI-generated Facebook post (TC, 100-250 words) | Streamlit AI |
| 16 | P | Threads Post | AI-generated Threads post (Cantonese, <50 words) | Streamlit AI |
| 17 | Q | Instagram Post | AI-generated IG post (TC, <150 words) | Streamlit AI |
| 18 | R | Web EN | AI-generated 500-word English article | Streamlit AI |
| 19 | S | Web TC | AI-generated 500-word Traditional Chinese article | Streamlit AI |
| 20 | T | Web JP | AI-generated 500-word Japanese article | Streamlit AI |
| 21 | U | Sync Status | Auto-set: "Pending", "Pending (images)", "Synced {datetime}" | Apps Script trigger |
| 22 | V | Drive Folder Link | Google Drive folder URL containing project photos | Streamlit sync / Manual |
| 23 | W | Hero Photo Picker | Smart picker: empty, "1"-"8", filename, or Drive URL | Manual / v3.2 feature |
| 24 | X | Logo Black | Google Drive file URL for black logo | Streamlit sync / Manual |
| 25 | Y | Logo White | Google Drive file URL for white logo | Streamlit sync / Manual |
| 26 | Z | Project_id | Format: FB{YEAR}{###} e.g., "FB2024002" | Streamlit auto-gen |
| 27 | AA | Sort_date | Format: YYYY-MM-01 for sorting | Streamlit auto-gen |
| 28 | AB | FAQ_EN | Dedicated English FAQ | Streamlit / Manual |
| 29 | AC | FAQ_TC | Dedicated Traditional Chinese FAQ | Streamlit / Manual |
| 30 | AD | FAQ_JP | Dedicated Japanese FAQ | Streamlit / Manual |

---

## 4. Frontend — Streamlit Admin App

**File**: `app.py`
**Purpose**: Staff-facing web app for creating new project entries.

### Key Updates (v5.8)
- `FIREBEAN_SYSTEM_PROMPT` now strictly enforces that both `challenge_summary` and `solution_summary` MUST be generated in **ENGLISH ONLY**.
- Added `clean_field()` to remove Google Sheets clipboard noise.

### Payload Structure (POST to SHEET_SCRIPT_URL)
The app sends a comprehensive JSON payload to the Google Apps Script endpoint. This payload includes base64-encoded images and all text fields.
The `syncProjectFromStreamlit` function in Apps Script receives this and writes all 30 columns to the Google Sheet.

---

## 5. Backend Logic — Apps Script: CMS → GitHub Sync (v5.7)

**File**: `apps-script/sync-to-github.gs`

### Major Fixes in v5.7
The `syncProjectFromStreamlit` function was completely rewritten. Previously, it only updated 3 columns (Client, Project, Sync Status). It now writes **all 30 columns** correctly:
1. **Basic Info**: Columns 2-10, 27
2. **Challenge & Solution**: Columns 11-12
3. **Social Media**: Columns 13-17
4. **Website Content**: Columns 18-20 (`WEB_EN`, `WEB_TC`, `WEB_JP`)
5. **Dedicated FAQ**: Columns 28-30 (`FAQ_EN`, `FAQ_TC`, `FAQ_JP`). This data is safely extracted from the `ai_content['7_faq']` object or direct Streamlit payload.
6. **Images**: Added `uploadImagesToNewDriveFolder_` to handle base64 image uploads from Streamlit directly to Google Drive, and sets the Drive Folder Link in Column 22.

### Sync Status Values (Column U)
- `Pending`: Text-only change detected (fast sync)
- `Pending (images)`: Image column changed (re-downloads from Drive)
- `Synced {datetime}`: Last successful sync

---

## 6. Website — Frontend Pages

### Key Website Features
- **Dark Mode**: Toggleable, swaps client logos to white versions using `logoWhite` from JSON.
- **Mega Menu**: Full-width dropdown navigation.
- **Project Modals**: Display gallery, challenge/solution, and social posts.
- **Polaroid Photos**: Random gallery photos displayed as Polaroid-style cards (excludes hero & logo images).
- **Q&A Sidebar**: On `profile.html`, the FAQ section automatically extracts content from the `faqEN`/`faqTC`/`faqJP` JSON fields and displays it on the right sidebar.

---

## 7. Common Tasks & Troubleshooting

### Add a New Project via Streamlit
1. Go to https://firebean-app-jfaads7deubxac5ha2qosx.streamlit.app/
2. Fill in all fields, upload photos, answer AI diagnostic questions.
3. Generate AI content and review.
4. Click "Confirm & Sync" to push to Sheet + Drive.
5. In the Google Sheet, click **🔥 Firebean CMS → Sync Changed Only** to push to the live website.

### Debug: Images Not Showing
1. Check Column V has a valid Drive folder URL.
2. Check the Drive folder is shared/accessible to the script owner.
3. Check `data/images/` on GitHub — images should be `.webp`.
4. If all else fails, use "Re-sync Images for Selected Row" from the custom menu.

### Update the Sync Script
1. Edit in GitHub: `apps-script/sync-to-github.gs`
2. Open Google Sheet → Extensions → Apps Script
3. Replace the existing code with the new version and Save.

---
*This document was updated by Manus AI on 2026-03-22.*
