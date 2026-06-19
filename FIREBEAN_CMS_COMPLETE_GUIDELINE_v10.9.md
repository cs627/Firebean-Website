# Firebean CMS + GitHub Sync + Slide Generator v10.9
## Complete Technical Guideline

**Version**: v10.9 (Complete Production Release)  
**Last Updated**: March 30, 2026  
**Status**: ✅ Production Ready

> ⚠️ **SOURCE OF TRUTH (June 2026):** The live Apps Script code is maintained **inside the
> Google Apps Script project** bound to the Master DB Sheet — NOT in this repo:
> - **GitHub.gs** `v12.2.0` — `doSync` / 🔥 CMS Sync (self-healing photo paths; never blanks heroPhoto/galleryPhotos).
> - **handlers.gs** `v12.1.0` — `doPost` web-app endpoint that receives data from the Streamlit app.
>
> Older `sync-to-github*.gs` / `sheet-receiver.gs` reference copies were removed from this repo
> to avoid confusion. To change sync logic, edit it in the Apps Script editor and redeploy the Web App.
> Streamlit `/exec` endpoint: `https://script.google.com/macros/s/AKfycbw6UuXZqhoFYtEiGYPJmFAWCis9IN-M-NVYN8hEo-Ux6UKKloihhv4yScS6ocGEJ9Em/exec`

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Google Sheet Structure (30 Columns)](#google-sheet-structure-30-columns)
3. [Apps Script v10.9 Functions](#apps-script-v109-functions)
4. [App.py Integration (doGet)](#apppy-integration-doget)
5. [GitHub Sync Process](#github-sync-process)
6. [JSON Output Format](#json-output-format)
7. [Website Data Consumption](#website-data-consumption)
8. [Data Flow & Mapping](#data-flow--mapping)
9. [Deployment Instructions](#deployment-instructions)
10. [Troubleshooting](#troubleshooting)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIREBEAN CMS SYSTEM                      │
└─────────────────────────────────────────────────────────────┘

App.py (Streamlit)
    │
    ├─ doGet() Request
    │  └─ Gets next Project ID
    │
    └─ Writes Profile Data
       │
       ▼
Google Sheet (Master DB)
    │
    ├─ 30 Columns of Data
    │  (Client, Project, Category, Content, Images, etc.)
    │
    └─ Stores all project information
       │
       ▼
Apps Script v10.9
    │
    ├─ Function 1: doGet() - Receives App.py requests
    ├─ Function 2: doSync() - Syncs to GitHub
    ├─ Function 3: createSlidesForSelectedRow() - Generates slides
    └─ Function 4: fixAllHeroPhotoPickers() - Validates photos
       │
       ▼
GitHub Repository
    │
    ├─ data/projects.json (All project data)
    ├─ data/image-hashes.json (Image hash tracking)
    └─ data/images/ (All images: heroes, logos, gallery)
       │
       ▼
Website (index.html, work.html, profile.html)
    │
    ├─ Loads projects.json from GitHub
    ├─ Displays homepage with carousel, grid, logos
    ├─ Filters by category
    └─ Shows full profile pages with content, FAQ, scope
```

---

## Google Sheet Structure (30 Columns)

### Column Mapping Table

| Col | Name | Type | Source | Usage | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | TIMESTAMP | DateTime | Auto | Audit trail | 3/14/2026 15:27:19 |
| 2 | CLIENT | Text | App.py | Project client name | Levi's |
| 3 | PROJECT | Text | App.py | Project title | Graffiti Workshop |
| 4 | DATE | Date | App.py | Event/project date | 2016 Nov |
| 5 | VENUE | Text | App.py | Location | California Tower |
| 6 | CATEGORY | Text (CSV) | App.py | Categories (comma-separated) | LIFESTYLE & CONSUMER, EVENTS & CEREMONIES |
| 7 | WHAT_WE_DO | Text | App.py | Hero banner text | Social & Content, PR & Media |
| 8 | SCOPE | Text (CSV) | App.py | Services provided | Event Planning, Social Media Management |
| 9 | YOUTUBE | URL | Manual | YouTube video link | https://youtube.com/watch?v=... |
| 10 | OPEN_QUESTION | Text | Manual | FAQ question | What was the challenge? |
| 11 | CHALLENGE | Text | App.py | Challenge description | Limited budget |
| 12 | SOLUTION | Text | App.py | Solution description | Creative approach |
| 13 | GOOGLE_SLIDE | URL | Auto | Master Deck link | https://docs.google.com/presentation/d/... |
| 14 | LINKEDIN | URL | Manual | LinkedIn post | https://linkedin.com/... |
| 15 | FACEBOOK | URL | Manual | Facebook post | https://facebook.com/... |
| 16 | THREADS | URL | Manual | Threads post | https://threads.net/... |
| 17 | INSTAGRAM | URL | Manual | Instagram post | https://instagram.com/... |
| 18 | WEB_EN | Text (HTML) | App.py | English content | `<h2>Challenge</h2><p>...</p>` |
| 19 | WEB_TC | Text (HTML) | App.py | Traditional Chinese | `<h2>挑戰</h2><p>...</p>` |
| 20 | WEB_JP | Text (HTML) | App.py | Japanese | `<h2>チャレンジ</h2><p>...</p>` |
| 21 | SYNC_STATUS | Text | Auto | Sync indicator | ✅ Synced |
| 22 | DRIVE_FOLDER | URL | Manual | Drive folder with images | https://drive.google.com/drive/folders/... |
| 23 | HERO_PHOTO | URL | Manual | Main hero image | https://drive.google.com/file/d/... |
| 24 | LOGO_BLACK | URL | Manual | Black logo | https://drive.google.com/file/d/... |
| 25 | LOGO_WHITE | URL | Manual | White logo | https://drive.google.com/file/d/... |
| 26 | PROJECT_ID | Text | Manual/Auto | Unique project ID | FB2026001 |
| 27 | SORT_DATE | Date | Manual | Display order date | 2026-03-14 |
| 28 | FAQ_EN | Text | App.py | English Q&A | Q: What was the scope?\nA: Full campaign |
| 29 | FAQ_TC | Text | App.py | Traditional Chinese Q&A | Q: 範圍是什麼?\nA: 完整活動 |
| 30 | FAQ_JP | Text | App.py | Japanese Q&A | Q: スコープは?\nA: フルキャンペーン |

---

## Apps Script v10.9 Functions

### Function 1: doGet() - App.py Data Receiving

**Purpose**: Receives HTTP GET requests from App.py (Streamlit) to query the Google Sheet.

**Call Method**:
```
GET https://script.google.com/macros/d/{SCRIPT_ID}/usercopy?action=get_row_count
```

**Parameters**:
- `action` (string): The action to perform
  - `get_row_count`: Returns the next available Project ID number

**Returns**:
```
Text: "001" or "002" or "003" (next sequential number)
```

**Example Usage (from App.py)**:
```python
import requests

script_url = "https://script.google.com/macros/d/{SCRIPT_ID}/usercopy"
response = requests.get(script_url, params={"action": "get_row_count"})
next_id = response.text.strip()
project_id = f"FB2026{next_id}"
print(f"Next Project ID: {project_id}")
```

**Code**:
```javascript
function doGet(e) {
  try {
    if (e.parameter.action === 'get_row_count') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
      var data = sheet.getDataRange().getValues();
      var year = new Date().getFullYear().toString();
      var maxIndex = 0;
      for (var i = 1; i < data.length; i++) {
        var pid = String(data[i][CONFIG.COL.PROJECT_ID - 1] || '').trim().toUpperCase();
        if (pid.indexOf('FB' + year) === 0) {
          var numStr = pid.substring(6);
          var num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxIndex) maxIndex = num;
        }
      }
      return ContentService.createTextOutput((maxIndex + 1).toString()).setMimeType(ContentService.MimeType.TEXT);
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}
```

---

### Function 2: doSync() - GitHub Synchronization

**Purpose**: Reads all project data from the Google Sheet and syncs to GitHub (projects.json + images).

**Call Methods**:
```
Menu: 🔥 Firebean CMS > Sync Changed Only
Menu: 🔥 Firebean CMS > ⚡ Sync Selected Project
```

**Parameters**:
- `changedOnly` (boolean): If true, only syncs rows with "Pending" status
- `targetRowOnly` (number, optional): If set, only syncs that specific row

**Process**:
1. Reads all rows from "Basic Info" sheet
2. Skips rows with "✅ Synced" status (if changedOnly=true)
3. For each row:
   - Generates or retrieves Project ID (Column 26)
   - Builds complete project object with all 18 fields
   - Downloads hero photo, logos, and gallery images from Google Drive
   - Calculates MD5 hash for each image (to avoid re-uploading unchanged files)
   - Pushes changed images to GitHub
4. Creates/updates `data/projects.json` with all project data
5. Updates `data/image-hashes.json` for future change detection
6. Sets SYNC_STATUS to "✅ Synced" and highlights row green

**Example Output**:
```
✅ Success!

43 project(s) synced.
12 image(s) pushed.
```

---

### Function 3: createSlidesForSelectedRow() - Slide Generation

**Purpose**: Generates Google Slides for a selected project using the Template and Master Deck.

**Call Method**:
```
Menu: 🔥 Firebean CMS > 🎬 Create Slides for Selected Row
```

**Process**:
1. Gets the currently selected row
2. Retrieves all project data from that row
3. Scans the Drive Folder (Column 22) for images
4. Appends 2 new slides to the Master Deck (CONFIG.MASTER_ID)
5. Replaces template placeholders with project data:
   - `{{CLIENT_NAME}}` → Client name
   - `{{PROJECT_NAME}}` → Project title
   - `{{CATEGORY}}` → Categories
   - `{{VENUE}}` → Venue
   - `{{CHALLENGE}}` → Challenge description
   - `{{SOLUTION}}` → Solution description
   - `{{PHOTO1}}`, `{{PHOTO2}}`, etc. → Gallery images
6. Updates Column 13 (GOOGLE_SLIDE) with Master Deck link

**Example Output**:
```
✅ Slides created!

Project: Levi's x Szabotage Graffiti Workshop
ID: FB2026001
```

---

### Function 4: fixAllHeroPhotoPickers() - Photo Validation

**Purpose**: Validates that all hero photos are correctly linked and accessible.

**Call Method**:
```
Menu: 🔥 Firebean CMS > 🖼️ Fix Hero Photo Pickers (all rows)
```

**Process**:
1. Scans all rows in the sheet
2. Verifies that Column 23 (HERO_PHOTO) has valid Google Drive links
3. Ensures all photo URLs are accessible

**Example Output**:
```
✅ Verification Complete

Hero Photo Pickers verified for 43 rows.
```

---

## App.py Integration (doGet)

### How App.py Writes to Google Sheet

When App.py (Streamlit) creates a new project profile, it:

1. **Calls doGet() to get the next Project ID**:
   ```python
   response = requests.get(script_url, params={"action": "get_row_count"})
   next_number = response.text.strip()
   project_id = f"FB2026{next_number}"
   ```

2. **Writes project data to Google Sheet** (using Google Sheets API or gspread):
   ```python
   # Columns 2-30 are populated with project data
   sheet.append_row([
       timestamp,           # Col 1
       client_name,         # Col 2
       project_name,        # Col 3
       event_date,          # Col 4
       venue,               # Col 5
       category,            # Col 6
       what_we_do,          # Col 7
       scope,               # Col 8
       youtube_url,         # Col 9
       open_question,       # Col 10
       challenge,           # Col 11
       solution,            # Col 12
       "",                  # Col 13 (Google Slide - auto-filled)
       linkedin_url,        # Col 14
       facebook_url,        # Col 15
       threads_url,         # Col 16
       instagram_url,       # Col 17
       web_en_content,      # Col 18
       web_tc_content,      # Col 19
       web_jp_content,      # Col 20
       "Pending",           # Col 21 (SYNC_STATUS)
       drive_folder_url,    # Col 22
       hero_photo_url,      # Col 23
       logo_black_url,      # Col 24
       logo_white_url,      # Col 25
       project_id,          # Col 26
       sort_date,           # Col 27
       faq_en,              # Col 28
       faq_tc,              # Col 29
       faq_jp               # Col 30
   ])
   ```

3. **User clicks "Sync Changed Only"** in the Apps Script menu
4. **Apps Script syncs to GitHub** and updates SYNC_STATUS to "✅ Synced"

---

## GitHub Sync Process

### Step-by-Step Sync Flow

```
1. Read Google Sheet
   ├─ Get all rows from "Basic Info" sheet
   └─ Filter by SYNC_STATUS (if changedOnly=true)

2. For Each Row:
   ├─ Generate/Retrieve Project ID (Column 26)
   ├─ Build Project Object (18 fields)
   ├─ Download Images from Google Drive
   │  ├─ Hero Photo (Column 23)
   │  ├─ Logo Black (Column 24)
   │  ├─ Logo White (Column 25)
   │  └─ Gallery Images (from Drive Folder, Column 22)
   ├─ Calculate MD5 Hash for each image
   └─ Compare with existing hashes
      └─ If changed: Add to imagesToPush array

3. Push to GitHub:
   ├─ Create blob for each changed image
   ├─ Create blob for projects.json
   ├─ Create blob for image-hashes.json
   ├─ Create tree with all blobs
   ├─ Create commit
   └─ Update branch reference

4. Update Google Sheet:
   ├─ Set SYNC_STATUS = "✅ Synced"
   └─ Highlight row green
```

### Image Naming Convention

All images are named with the Project ID prefix:

```
data/images/
├─ FB2026001-hero.webp          (Hero banner image)
├─ FB2026001-logo-black.webp    (Black logo)
├─ FB2026001-logo-white.webp    (White logo)
├─ FB2026001-img1.webp          (Gallery image 1)
├─ FB2026001-img2.webp          (Gallery image 2)
├─ FB2026001-img3.webp          (Gallery image 3)
├─ FB2026001-img4.webp          (Gallery image 4)
├─ FB2026001-img5.webp          (Gallery image 5)
├─ FB2026001-img6.webp          (Gallery image 6)
├─ FB2026001-img7.webp          (Gallery image 7)
└─ FB2026001-img8.webp          (Gallery image 8)
```

---

## JSON Output Format

### projects.json Structure

The `data/projects.json` file contains all project data in this format:

```json
{
  "projects": [
    {
      "id": "FB2026001",
      "projectId": "FB2026001",
      "projectName": "Levi's x Szabotage Graffiti Workshop",
      "client": "Levi's",
      "venue": "California Tower",
      "year": "2016 Nov",
      "category": "LIFESTYLE & CONSUMER, EVENTS & CEREMONIES",
      "categories": [
        "LIFESTYLE & CONSUMER",
        "EVENTS & CEREMONIES"
      ],
      "whatWeDo": "Social & Content, PR & Media, Events & Ceremonies",
      "scope": "Event Planning, Event Coordination, Social Media Management",
      "webEN": "<h2>Challenge</h2><p>Limited budget with high impact requirement...</p><h2>Solution</h2><p>Creative approach combining...</p>",
      "webTC": "<h2>挑戰</h2><p>預算有限但需要高影響力...</p><h2>解決方案</h2><p>創意方法結合...</p>",
      "webJP": "<h2>チャレンジ</h2><p>限られた予算で高い影響...</p><h2>ソリューション</h2><p>創造的なアプローチ...</p>",
      "faqEN": "Q: What was the scope?\nA: Full event production and social media campaign\nQ: How many people attended?\nA: Over 500 participants",
      "faqTC": "Q: 範圍是什麼?\nA: 完整活動製作和社交媒體活動\nQ: 有多少人參加?\nA: 超過500人",
      "faqJP": "Q: スコープは?\nA: 完全なイベント制作とソーシャルメディアキャンペーン\nQ: 参加者数は?\nA: 500人以上",
      "youtube": "https://youtube.com/watch?v=...",
      "sortDate": "2026-03-14",
      "heroPhoto": "data/images/FB2026001-hero.webp",
      "logoBlack": "data/images/FB2026001-logo-black.webp",
      "logoWhite": "data/images/FB2026001-logo-white.webp",
      "galleryPhotos": [
        "data/images/FB2026001-img1.webp",
        "data/images/FB2026001-img2.webp",
        "data/images/FB2026001-img3.webp",
        "data/images/FB2026001-img4.webp",
        "data/images/FB2026001-img5.webp",
        "data/images/FB2026001-img6.webp",
        "data/images/FB2026001-img7.webp",
        "data/images/FB2026001-img8.webp"
      ]
    }
  ],
  "lastSync": "2026-03-30T06:10:41.123Z"
}
```

### Field Descriptions

| Field | Type | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `id` | String | Unique project identifier | `FB2026001` |
| `projectId` | String | Same as id (for compatibility) | `FB2026001` |
| `projectName` | String | Project title | `Levi's x Szabotage Graffiti Workshop` |
| `client` | String | Client name | `Levi's` |
| `venue` | String | Event location | `California Tower` |
| `year` | String | Date/year | `2016 Nov` |
| `category` | String | Categories (comma-separated, for marquee) | `LIFESTYLE & CONSUMER, EVENTS & CEREMONIES` |
| `categories` | Array | Categories as array (for filtering) | `["LIFESTYLE & CONSUMER", "EVENTS & CEREMONIES"]` |
| `whatWeDo` | String | Hero banner text | `Social & Content, PR & Media` |
| `scope` | String | Services provided | `Event Planning, Social Media Management` |
| `webEN` | String | English HTML content | `<h2>Challenge</h2><p>...</p>` |
| `webTC` | String | Traditional Chinese HTML content | `<h2>挑戰</h2><p>...</p>` |
| `webJP` | String | Japanese HTML content | `<h2>チャレンジ</h2><p>...</p>` |
| `faqEN` | String | English Q&A (newline-separated) | `Q: ?\nA: ` |
| `faqTC` | String | Traditional Chinese Q&A | `Q: ?\nA: ` |
| `faqJP` | String | Japanese Q&A | `Q: ?\nA: ` |
| `youtube` | String | YouTube video URL | `https://youtube.com/watch?v=...` |
| `sortDate` | String | Display order (ISO date) | `2026-03-14` |
| `heroPhoto` | String | Path to hero image | `data/images/FB2026001-hero.webp` |
| `logoBlack` | String | Path to black logo | `data/images/FB2026001-logo-black.webp` |
| `logoWhite` | String | Path to white logo | `data/images/FB2026001-logo-white.webp` |
| `galleryPhotos` | Array | Paths to gallery images (max 8) | `["data/images/FB2026001-img1.webp", ...]` |

---

## Website Data Consumption

### index.html (Homepage)

**Sections that use projects.json**:

1. **Hero Slider (Top 3 projects)**
   - Uses: `heroPhoto`, `projectName`, `category`, `id`
   - Displays: Hero image with marquee category text

2. **Work Grid (Projects 4-9)**
   - Uses: `heroPhoto`, `projectName`, `client`, `webEN/TC/JP`, `id`
   - Displays: Grid cards with extracted title and description

3. **Clients Section (Logo Flip)**
   - Uses: `logoBlack`, `logoWhite`, `client`, `categories`, `projectId`
   - Displays: Flipping logos separated by category (lifestyle/government)

4. **Newsletter Cards (Projects 10-12)**
   - Uses: `heroPhoto`, `projectName`, `client`, `webEN/TC/JP`, `id`
   - Displays: Newsletter preview cards with hero image and summary

5. **Work Section (3D Parallax Logos)**
   - Uses: `logoBlack`, `logoWhite`, `categories`, `projectId`
   - Displays: 3D parallax logo wall

---

### work.html (Portfolio Page)

**Features**:

1. **Category Filtering**
   - Uses: `categories` array
   - Maps to filter buttons: government, lifestyle, hospitality, venues, exhibitions, social, tech, pr, events

2. **Project Grid**
   - Uses: `heroPhoto`, `projectName`, `client`, `webEN/TC/JP`
   - Displays: Filterable grid of all projects

---

### profile.html (Project Detail Page)

**Sections**:

1. **Hero Banner**
   - Uses: `heroPhoto`, `projectName`, `client`
   - Displays: Large hero image with project title

2. **Logos**
   - Uses: `logoBlack`, `logoWhite`
   - Displays: Client logos at top and bottom

3. **Main Content**
   - Uses: `webEN`, `webTC`, `webJP`
   - Displays: Multilingual HTML content

4. **Scope Sidebar**
   - Uses: `scope`
   - Displays: Services provided (comma-separated, translated)

5. **FAQ Sidebar**
   - Uses: `faqEN`, `faqTC`, `faqJP`
   - Displays: Q&A pairs (newline-separated)

6. **Gallery Carousel**
   - Uses: `galleryPhotos` array
   - Displays: 8 gallery images in carousel

7. **YouTube Player**
   - Uses: `youtube`
   - Displays: Embedded YouTube video (if URL provided)

---

## Data Flow & Mapping

### Complete Data Journey

```
Google Sheet Column → Apps Script Field → JSON Field → Website Display
─────────────────────────────────────────────────────────────────────

Col 2 (CLIENT)
  → vals[CONFIG.COL.CLIENT - 1]
  → project.client
  → index.html: Work grid, Newsletter cards
  → profile.html: Hero banner, Logo display

Col 3 (PROJECT)
  → vals[CONFIG.COL.PROJECT - 1]
  → project.projectName
  → index.html: Hero slider, Work grid, Newsletter
  → profile.html: Hero banner title

Col 6 (CATEGORY)
  → vals[CONFIG.COL.CATEGORY - 1]
  → project.category (string) + project.categories (array)
  → index.html: Marquee text, Logo categorization
  → work.html: Filter buttons and filtering

Col 8 (SCOPE)
  → vals[CONFIG.COL.SCOPE - 1]
  → project.scope
  → profile.html: Right sidebar "Scope" section

Col 18-20 (WEB_EN/TC/JP)
  → vals[CONFIG.COL.WEB_EN/TC/JP - 1]
  → project.webEN/TC/JP
  → index.html: Work grid descriptions (extracted)
  → profile.html: Main content area

Col 22 (DRIVE_FOLDER)
  → extractDriveFolderId_()
  → Scans folder for images
  → project.galleryPhotos array
  → profile.html: Gallery carousel

Col 23 (HERO_PHOTO)
  → extractDriveFileId_()
  → Downloaded and pushed to GitHub
  → project.heroPhoto
  → index.html: Hero slider, Work grid
  → profile.html: Hero banner

Col 24-25 (LOGO_BLACK/WHITE)
  → extractDriveFileId_()
  → Downloaded and pushed to GitHub
  → project.logoBlack/White
  → index.html: Logo sections
  → profile.html: Top and bottom logos

Col 26 (PROJECT_ID)
  → generateProjectId_() checks this first
  → Used as ID for all image files
  → project.id, project.projectId
  → All image paths, filtering, routing

Col 27 (SORT_DATE)
  → vals[CONFIG.COL.SORT_DATE - 1]
  → project.sortDate
  → index.html: Sorting (newest first)

Col 28-30 (FAQ_EN/TC/JP)
  → vals[CONFIG.COL.FAQ_EN/TC/JP - 1]
  → project.faqEN/TC/JP
  → profile.html: Right sidebar Q&A section
```

---

## Deployment Instructions

### Step 1: Deploy Apps Script

1. **Open Google Apps Script Editor**:
   - Go to your Google Sheet
   - Click `Extensions > Apps Script`

2. **Replace the Code**:
   - Delete all existing code
   - Paste the complete v10.9 script
   - Click `Save` (Ctrl+S)

3. **Set GitHub Token**:
   - Click the **gear icon** (Project Settings)
   - Scroll to **Script Properties**
   - Click **Add property**
   - **Key**: `GITHUB_TOKEN`
   - **Value**: Your GitHub personal access token (with `repo` scope)
   - Click **Save**

4. **Deploy as Web App** (for App.py):
   - Click `Deploy > New deployment`
   - Select type: `Web app`
   - Execute as: Your account
   - Who has access: Anyone
   - Click `Deploy`
   - Copy the deployment URL
   - Share with your App.py developer

5. **Refresh Google Sheet**:
   - Go back to your Google Sheet
   - Refresh the page (F5)
   - You should see the **🔥 Firebean CMS** menu

### Step 2: Configure GitHub

1. **Create GitHub Personal Access Token**:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Click "Generate new token"
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - Copy the token

2. **Add to Apps Script**:
   - Go back to Apps Script Project Settings
   - Add the token to Script Properties as `GITHUB_TOKEN`

### Step 3: Test the Sync

1. **Click 🔥 Firebean CMS > Sync Changed Only**
2. **Wait for the success popup**
3. **Check GitHub**:
   - Go to your repository
   - Navigate to `data/projects.json`
   - Verify all projects are there with all 18 fields

### Step 4: Verify Website

1. **Go to your website**
2. **Check homepage**:
   - Hero slider displays (top 3 projects)
   - Category marquee text shows
   - Work grid displays (projects 4-9)
   - Logo sections show
   - All filters work

3. **Check work.html**:
   - All 9 category filters work
   - Projects display correctly
   - Filtering works

4. **Check profile.html**:
   - Hero banner shows
   - Logos display
   - Content shows
   - Scope sidebar shows
   - FAQ shows
   - Gallery carousel works

---

## Troubleshooting

### Issue 1: "GITHUB_TOKEN not set in Script Properties"

**Solution**:
1. Go to Apps Script Project Settings
2. Add `GITHUB_TOKEN` to Script Properties
3. Refresh Google Sheet
4. Try sync again

### Issue 2: Website shows "0 results found" for filters

**Solution**:
1. Check that Column 6 (CATEGORY) has values
2. Run "Sync Changed Only"
3. Check `projects.json` to verify categories are exported
4. Refresh website

### Issue 3: Images not showing on website

**Solution**:
1. Check that Column 23 (HERO_PHOTO) has Google Drive links
2. Run "Sync Changed Only"
3. Check GitHub to verify images were pushed
4. Check browser console for 404 errors

### Issue 4: App.py can't get next Project ID

**Solution**:
1. Verify Apps Script is deployed as Web App
2. Check deployment URL is correct
3. Verify `action=get_row_count` parameter is being sent
4. Check Column 26 (PROJECT_ID) has values in format `FB2026XXX`

### Issue 5: Slides not generating

**Solution**:
1. Verify TEMPLATE_ID and MASTER_ID in CONFIG are correct
2. Verify Google Slides files exist and are accessible
3. Select a data row before clicking "Create Slides"
4. Check that Column 22 (DRIVE_FOLDER) has a valid folder URL

### Issue 6: Sync takes too long

**Solution**:
1. Use "Sync Selected Project" instead of "Sync Changed Only"
2. Reduce number of gallery images (currently 8)
3. Compress images before uploading to Google Drive
4. Check internet connection speed

---

## Version History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v10.0 | Mar 30 2026 (Morning) | Original merge with GitHub sync |
| v10.1 | Mar 30 2026 (Noon) | Added logo categorization |
| v10.2 | Mar 30 2026 (Afternoon) | Added status update alerts |
| v10.3 | Mar 30 2026 (Afternoon) | Fixed sync status column update |
| v10.4 | Mar 30 2026 (Afternoon) | Fixed JSON path and FAQ format |
| v10.5 | Mar 30 2026 (Afternoon) | Added scope and summary fields |
| v10.6 | Mar 30 2026 (Afternoon) | Added sort date and YouTube |
| v10.7 | Mar 30 2026 (Afternoon) | Added category mapping |
| v10.8 | Mar 30 2026 (Evening) | Fixed hero marquee text |
| v10.9 | Mar 30 2026 (Evening) | Fixed Project ID reading + Restored doGet() |

---

## Support & Contact

For issues or questions:
1. Check the Troubleshooting section above
2. Review the GitHub repository README
3. Contact the development team

---

**Last Updated**: March 30, 2026  
**Status**: ✅ Production Ready  
**Maintained By**: Firebean Agency
