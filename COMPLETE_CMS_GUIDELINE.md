# 🔥 Firebean CMS Complete Guideline v10.8
## Master Reference for Google Sheets → GitHub → Website

**Version**: 10.8 (Master Integration)  
**Last Updated**: March 30, 2026  
**Status**: Production Ready

---

## 📑 Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow & Processing](#data-flow--processing)
3. [Google Sheet Structure](#google-sheet-structure)
4. [Apps Script v10.8 Functions](#apps-script-v108-functions)
5. [JSON Output Format](#json-output-format)
6. [Website Data Consumption](#website-data-consumption)
7. [Filtering & Categorization Logic](#filtering--categorization-logic)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FIREBEAN CMS SYSTEM                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Google Sheet    │
                    │  (Master DB)     │
                    │  30 Columns      │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Apps Script     │
                    │  v10.8 (3 Funcs) │
                    │  - doSync()      │
                    │  - Slides        │
                    │  - Hero Picker   │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ projects.json│    │ data/images/ │
            │ (GitHub)     │    │ (WebP files) │
            └──────────────┘    └──────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌──────────────────┐
                    │  cms.js          │
                    │  (Data Processor)│
                    │  - Path fixing   │
                    │  - filterSlugs   │
                    │  - logoCategory  │
                    └──────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
            index.html    work.html    profile.html
            (Homepage)    (Grid)       (Details)
```

---

## 🔄 Data Flow & Processing

### **Step 1: Google Sheet Input**
- User fills 30 columns in the "Basic Info" sheet
- Each row = 1 project
- Column 21 (SYNC_STATUS) tracks sync state

### **Step 2: Apps Script Sync (doSync)**
```
FOR each row in Google Sheet:
  1. Extract all 30 column values
  2. Generate Project ID (FB2026XXX format)
  3. Download images from Google Drive
  4. Convert images to WebP (rename with .webp extension)
  5. Push images to GitHub (data/images/)
  6. Build JSON object with all fields
  7. Create projects.json array
  8. Push projects.json to GitHub
  9. Update Column 21 to "✅ Synced"
  10. Show success popup
```

### **Step 3: GitHub Storage**
```
Repository: cs627/Firebean-Website
├── data/
│   ├── projects.json          (Main data file)
│   ├── image-hashes.json      (For change detection)
│   └── images/
│       ├── fb2026001-hero.webp
│       ├── fb2026001-logo-black.webp
│       ├── fb2026001-logo-white.webp
│       ├── fb2026001-img1.webp
│       └── ...
└── src/
    ├── cms.js                 (Data processor)
    ├── translations.js        (Language support)
    └── ...
```

### **Step 4: cms.js Processing**
```javascript
WHEN projects.json is loaded:
  FOR each project:
    1. Prepend BASE_PATH to image URLs
    2. Generate filterSlugs from categories (with mapping)
    3. Determine logoCategory (government/lifestyle)
    4. Dispatch 'cmsDataReady' event
```

### **Step 5: Website Rendering**
```
index.html:
  - Slider (top 3 projects)
  - Work Grid (projects 4-9)
  - Clients/Logo Flip (all projects)
  - Newsletter (projects 10-12)
  - Work Section (3D Parallax)

work.html:
  - Filter by category (using filterSlugs)
  - 3-column grid layout
  - 3D logo parallax background

profile.html:
  - Full project details
  - Multilingual content
  - FAQ sidebar
  - Gallery carousel
```

---

## 📊 Google Sheet Structure

### **Column Mapping (30 Columns)**

| Col | Name | Type | Source | Used By | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | ROW_NUM | Auto | System | Internal | 1, 2, 3... |
| 2 | CLIENT | Text | Manual | All pages | "Nike", "Apple" |
| 3 | PROJECT | Text | Manual | All pages | "Campaign Name" |
| 4 | YEAR | Number | Manual | Metadata | 2026 |
| 5 | VENUE | Text | Manual | Profile | "Hong Kong" |
| 6 | CATEGORY | Text | Manual | Filters, Marquee | "GOVERNMENT, EVENT PLANNING" |
| 7 | WHAT_WE_DO | Text | Manual | Hero text | "Event Planning" |
| 8 | SCOPE | Text | Manual | Profile sidebar | "Event Planning, PR, Social" |
| 9 | CHALLENGE | Text | Manual | Slides only | "Challenge description" |
| 10 | SOLUTION | Text | Manual | Slides only | "Solution description" |
| 11 | CHALLENGE_TC | Text | Manual | Slides only | "挑戰描述" |
| 12 | SOLUTION_TC | Text | Manual | Slides only | "解決方案描述" |
| 13 | CHALLENGE_JP | Text | Manual | Slides only | "チャレンジ説明" |
| 14 | SOLUTION_JP | Text | Manual | Slides only | "ソリューション説明" |
| 15 | SCOPE_TC | Text | Manual | Profile sidebar | "活動策劃、公關、社交媒體" |
| 16 | SCOPE_JP | Text | Manual | Profile sidebar | "イベント企画、PR、ソーシャル" |
| 17 | DRIVE_FOLDER | URL | Manual | Gallery sync | "https://drive.google.com/drive/folders/..." |
| 18 | WEB_EN | HTML/MD | Manual | Profile, Grid | "<h3>Title</h3><p>Content...</p>" |
| 19 | WEB_TC | HTML/MD | Manual | Profile, Grid | "<h3>標題</h3><p>內容...</p>" |
| 20 | WEB_JP | HTML/MD | Manual | Profile, Grid | "<h3>タイトル</h3><p>コンテンツ...</p>" |
| 21 | SYNC_STATUS | Auto | Script | Tracking | "Pending" / "✅ Synced" |
| 22 | HERO_PHOTO | URL | Manual | Hero banner | "https://drive.google.com/file/d/..." |
| 23 | LOGO_BLACK | URL | Manual | Logos | "https://drive.google.com/file/d/..." |
| 24 | LOGO_WHITE | URL | Manual | Logos | "https://drive.google.com/file/d/..." |
| 25 | FAQ_EN | Text | Manual | Profile FAQ | "Q: Question?\nA: Answer" |
| 26 | FAQ_TC | Text | Manual | Profile FAQ | "Q: 問題?\nA: 答案" |
| 27 | FAQ_JP | Text | Manual | Profile FAQ | "Q: 質問?\nA: 回答" |
| 28 | SORT_DATE | Date | Manual | Homepage order | "2026-03-30" |
| 29 | YOUTUBE | URL | Manual | Profile video | "https://youtube.com/watch?v=..." |
| 30 | PROJECT_ID | Auto | Script | Links | "FB2026001" |

---

## ⚙️ Apps Script v10.8 Functions

### **Function 1: doSync() - Main GitHub Sync**

**Purpose**: Sync all changed projects to GitHub  
**Trigger**: Manual (🔥 Firebean CMS > Sync Changed Only)  
**Time**: ~30-60 seconds

```javascript
function doSync() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    SpreadsheetApp.getUi().alert('❌ Error: GITHUB_TOKEN not set in Script Properties');
    return;
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var projects = [];
  var imagesToPush = [];
  var existingHashes = loadImageHashes_(token);
  var newHashes = {};
  
  // Process each row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var syncStatus = row[CONFIG.COL.SYNC_STATUS - 1];
    
    // Skip if already synced (unless forced)
    if (syncStatus === '✅ Synced') continue;
    
    var pid = generateProjectId_(row);
    
    // Build project object with ALL fields
    var project = {
      id: pid,
      projectId: pid,
      projectName: row[CONFIG.COL.PROJECT - 1],
      client: row[CONFIG.COL.CLIENT - 1],
      venue: row[CONFIG.COL.VENUE - 1],
      year: row[CONFIG.COL.YEAR - 1],
      categories: (row[CONFIG.COL.CATEGORY - 1] || '').split(',').map(s => s.trim()),
      whatWeDo: row[CONFIG.COL.WHAT_WE_DO - 1],
      scope: row[CONFIG.COL.SCOPE - 1],
      webEN: row[CONFIG.COL.WEB_EN - 1],
      webTC: row[CONFIG.COL.WEB_TC - 1],
      webJP: row[CONFIG.COL.WEB_JP - 1],
      faqEN: row[CONFIG.COL.FAQ_EN - 1],
      faqTC: row[CONFIG.COL.FAQ_TC - 1],
      faqJP: row[CONFIG.COL.FAQ_JP - 1],
      youtube: row[CONFIG.COL.YOUTUBE - 1],
      sortDate: row[CONFIG.COL.SORT_DATE - 1],
      heroPhoto: CONFIG.IMAGES_PATH + '/' + pid + '-hero.webp',
      logoBlack: CONFIG.IMAGES_PATH + '/' + pid + '-logo-black.webp',
      logoWhite: CONFIG.IMAGES_PATH + '/' + pid + '-logo-white.webp',
      galleryPhotos: []
    };
    
    // Sync images
    var heroFileId = extractDriveFileId_(row[CONFIG.COL.HERO_PHOTO - 1]);
    if (heroFileId) pushIfChanged_(imagesToPush, existingHashes, newHashes, 
                                   project.heroPhoto, heroFileId);
    
    var logoBlackFileId = extractDriveFileId_(row[CONFIG.COL.LOGO_BLACK - 1]);
    if (logoBlackFileId) pushIfChanged_(imagesToPush, existingHashes, newHashes,
                                        project.logoBlack, logoBlackFileId);
    
    var logoWhiteFileId = extractDriveFileId_(row[CONFIG.COL.LOGO_WHITE - 1]);
    if (logoWhiteFileId) pushIfChanged_(imagesToPush, existingHashes, newHashes,
                                        project.logoWhite, logoWhiteFileId);
    
    // Sync gallery images from Drive folder
    var folderUrl = row[CONFIG.COL.DRIVE_FOLDER - 1];
    var folderId = extractDriveFolderId_(folderUrl);
    if (folderId) {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFilesByType('image/webp').concat(
                  folder.getFilesByType('image/jpeg'),
                  folder.getFilesByType('image/png'));
      var imgCount = 0;
      while (files.hasNext() && imgCount < 8) {
        var file = files.next();
        var imgPath = CONFIG.IMAGES_PATH + '/' + pid + '-img' + (imgCount + 1) + '.webp';
        pushIfChanged_(imagesToPush, existingHashes, newHashes, imgPath, file.getId());
        project.galleryPhotos.push(imgPath);
        imgCount++;
      }
    }
    
    projects.push(project);
    
    // Update sync status
    sheet.getRange(i + 1, CONFIG.COL.SYNC_STATUS).setValue('✅ Synced');
    sheet.getRange(i + 1, CONFIG.COL.SYNC_STATUS).setBackground('#90EE90');
  }
  
  // Push to GitHub
  if (projects.length > 0) {
    pushToGitHub_(token, projects, imagesToPush, newHashes);
    SpreadsheetApp.getUi().alert('✅ Success!\n\n' + projects.length + 
                                 ' project(s) synced.\n' + imagesToPush.length + 
                                 ' image(s) pushed.');
  } else {
    SpreadsheetApp.getUi().alert('ℹ️ No changes to sync.');
  }
}
```

**What It Does**:
1. Reads all rows from the Google Sheet
2. Skips rows already marked as "✅ Synced"
3. Extracts all 30 column values
4. Generates Project ID (FB2026XXX)
5. Downloads and converts images to WebP
6. Builds JSON object with all fields
7. Pushes to GitHub
8. Updates Column 21 with sync timestamp

---

### **Function 2: createSlidesForSelectedRow() - Slide Generator**

**Purpose**: Generate Google Slides for a selected project  
**Trigger**: Manual (🔥 Firebean CMS > Create Slides for Selected Row)  
**Uses**: Columns 3, 9-14 (Project, Challenge, Solution in 3 languages)

```javascript
function createSlidesForSelectedRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  var range = sheet.getActiveRange();
  var row = range.getRow();
  
  if (row < 2) {
    SpreadsheetApp.getUi().alert('❌ Please select a row with project data');
    return;
  }
  
  var data = sheet.getRange(row, 1, 1, 30).getValues()[0];
  var pid = generateProjectId_(data);
  var projectName = data[CONFIG.COL.PROJECT - 1];
  var challenge = data[CONFIG.COL.CHALLENGE - 1];
  var solution = data[CONFIG.COL.SOLUTION - 1];
  var challengeTC = data[CONFIG.COL.CHALLENGE_TC - 1];
  var solutionTC = data[CONFIG.COL.SOLUTION_TC - 1];
  var challengeJP = data[CONFIG.COL.CHALLENGE_JP - 1];
  var solutionJP = data[CONFIG.COL.SOLUTION_JP - 1];
  
  if (!pid) {
    SpreadsheetApp.getUi().alert('❌ Project ID not found');
    return;
  }
  
  try {
    var masterDeck = SlidesApp.openById(CONFIG.MASTER_ID);
    var templateDeck = SlidesApp.openById(CONFIG.TEMPLATE_ID);
    
    // Copy template slides to master deck
    var templateSlides = templateDeck.getSlides();
    templateSlides.forEach(function(slide) {
      masterDeck.appendSlide(slide.duplicate());
    });
    
    // Update text in new slides
    var newSlides = masterDeck.getSlides().slice(-templateSlides.length);
    newSlides.forEach(function(slide) {
      var shapes = slide.getShapes();
      shapes.forEach(function(shape) {
        if (shape.hasText()) {
          var text = shape.getText().asString();
          if (text.indexOf('{{PROJECT}}') !== -1) {
            shape.getText().clear().appendText(projectName);
          }
          if (text.indexOf('{{CHALLENGE}}') !== -1) {
            shape.getText().clear().appendText(challenge);
          }
          if (text.indexOf('{{SOLUTION}}') !== -1) {
            shape.getText().clear().appendText(solution);
          }
        }
      });
    });
    
    SpreadsheetApp.getUi().alert('✅ Slides created!\n\nProject: ' + projectName + 
                                 '\nID: ' + pid);
  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + e.toString());
  }
}
```

---

### **Function 3: fixAllHeroPhotoPickers() - Validation**

**Purpose**: Verify all hero photo URLs are valid  
**Trigger**: Manual (🔥 Firebean CMS > Fix All Hero Photo Pickers)

```javascript
function fixAllHeroPhotoPickers() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  var lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('❌ No data found');
    return;
  }
  
  var verified = 0;
  for (var i = 2; i <= lastRow; i++) {
    var heroUrl = sheet.getRange(i, CONFIG.COL.HERO_PHOTO).getValue();
    if (heroUrl && heroUrl.indexOf('drive.google.com') !== -1) {
      verified++;
    }
  }
  
  SpreadsheetApp.getUi().alert('✅ Verification Complete\n\n' + verified + 
                               ' hero photos verified for ' + (lastRow - 1) + ' rows.');
}
```

---

## 📄 JSON Output Format

### **File Location**: `data/projects.json`

### **Structure**:
```json
{
  "projects": [
    {
      "id": "fb2026001",
      "projectId": "FB2026001",
      "projectName": "Campaign Name",
      "client": "Client Name",
      "venue": "Hong Kong",
      "year": 2026,
      "categories": ["GOVERNMENT", "EVENT PLANNING"],
      "whatWeDo": "Event Planning",
      "scope": "Event Planning, PR, Social Media",
      "webEN": "<h3>Challenge Title</h3><p>Content...</p>",
      "webTC": "<h3>挑戰標題</h3><p>內容...</p>",
      "webJP": "<h3>チャレンジタイトル</h3><p>コンテンツ...</p>",
      "faqEN": "Q: Question?\nA: Answer",
      "faqTC": "Q: 問題?\nA: 答案",
      "faqJP": "Q: 質問?\nA: 回答",
      "youtube": "https://youtube.com/watch?v=...",
      "sortDate": "2026-03-30",
      "heroPhoto": "data/images/fb2026001-hero.webp",
      "logoBlack": "data/images/fb2026001-logo-black.webp",
      "logoWhite": "data/images/fb2026001-logo-white.webp",
      "galleryPhotos": [
        "data/images/fb2026001-img1.webp",
        "data/images/fb2026001-img2.webp"
      ]
    }
  ],
  "lastSync": "2026-03-30T17:05:00Z"
}
```

### **Data Types**:

| Field | Type | Example | Required |
| :--- | :--- | :--- | :--- |
| id | String | "fb2026001" | ✅ Yes |
| projectId | String | "FB2026001" | ✅ Yes |
| projectName | String | "Campaign" | ✅ Yes |
| client | String | "Nike" | ✅ Yes |
| categories | Array | ["GOVERNMENT"] | ✅ Yes |
| heroPhoto | String (URL) | "data/images/..." | ✅ Yes |
| logoBlack | String (URL) | "data/images/..." | ✅ Yes |
| logoWhite | String (URL) | "data/images/..." | ✅ Yes |
| galleryPhotos | Array (URLs) | ["data/images/..."] | ✅ Yes |
| webEN/TC/JP | String (HTML) | "<h3>Title</h3>..." | ✅ Yes |
| faqEN/TC/JP | String | "Q: ?\nA: !" | ⚠️ Optional |
| youtube | String (URL) | "https://youtube.com/..." | ⚠️ Optional |
| sortDate | String (Date) | "2026-03-30" | ⚠️ Optional |

---

## 🌐 Website Data Consumption

### **index.html (Homepage)**

**Data Processing** (lines 2263-2586):
```javascript
window.addEventListener('cmsDataReady', function(e) {
  var projects = (e.detail && e.detail.projects) || [];
  
  // Section 1: Hero Slider (top 3 projects)
  var sliderProjects = projects.filter(p => p.heroPhoto).slice(0, 3);
  
  // Section 2: Work Grid (projects 4-9)
  var gridProjects = projects.slice(3, 9);
  
  // Section 3: Clients (all projects, separated by logoCategory)
  var lifestyleLogos = projects.filter(p => p.logoCategory === 'lifestyle');
  var govLogos = projects.filter(p => p.logoCategory === 'government');
  
  // Section 4: Newsletter (projects 10-12)
  var newsletterProjects = projects.slice(9, 12);
});
```

**Required Fields**:
- Hero Slider: `heroPhoto`, `projectName`, `category`, `id`
- Work Grid: `heroPhoto`, `projectName`, `client`, `webEN/TC/JP`
- Clients: `logoBlack`, `logoWhite`, `client`, `logoCategory`
- Newsletter: `heroPhoto`, `projectName`, `client`, `webEN/TC/JP`

---

### **work.html (Filter & Grid)**

**Data Processing** (lines 501-508):
```javascript
window.addEventListener('cmsDataReady', function(e) {
  var projects = (e.detail && e.detail.projects) || [];
  
  // Filter by category using filterSlugs
  var filtered = projects.filter(p => {
    if (activeFilter === 'all') return true;
    return p.filterSlugs && p.filterSlugs.indexOf(activeFilter) !== -1;
  });
});
```

**Required Fields**:
- `heroPhoto`, `projectName`, `client`, `filterSlugs`, `id`

---

### **profile.html (Details)**

**Data Processing** (lines 1-100):
```javascript
window.addEventListener('cmsDataReady', function(e) {
  var projects = (e.detail && e.detail.projects) || [];
  
  // Find project by ID from URL
  var projectId = new URLSearchParams(window.location.search).get('id');
  var project = projects.find(p => p.id === projectId || p.projectId === projectId);
  
  // Render full profile with all fields
  if (project) {
    renderProfile(project);
  }
});
```

**Required Fields**:
- All fields (complete project object)

---

## 🔀 Filtering & Categorization Logic

### **Category Mapping (cms.js)**

The `cms.js` file converts Google Sheet categories to filter slugs:

```javascript
var categoryMapping = {
  'government': 'government',
  'public': 'government',
  'public sector': 'government',
  'lifestyle': 'lifestyle',
  'consumer': 'lifestyle',
  'lifestyle & consumer': 'lifestyle',
  'f&b': 'hospitality',
  'hospitality': 'hospitality',
  'f&b & hospitality': 'hospitality',
  'malls': 'venues',
  'venues': 'venues',
  'malls & venues': 'venues',
  'exhibitions': 'exhibitions',
  'roving exhibitions': 'exhibitions',
  'social': 'social',
  'content': 'social',
  'social & content': 'social',
  'social media': 'social',
  'interactive': 'tech',
  'tech': 'tech',
  'technology': 'tech',
  'interactive & tech': 'tech',
  'pr': 'pr',
  'media': 'pr',
  'pr & media': 'pr',
  'pr consulting': 'pr',
  'media relations': 'pr',
  'events': 'events',
  'ceremonies': 'events',
  'events & ceremonies': 'events',
  'event planning': 'events',
  'event production': 'events'
};
```

### **Logo Category Logic**

```javascript
// Determines if project is "lifestyle" or "government"
if (categories contains "government" OR "public") {
  logoCategory = "government"
} else {
  logoCategory = "lifestyle"
}
```

### **FilterSlugs Generation**

```javascript
// Converts categories to filter-compatible slugs
categories: ["EVENT PLANNING", "PR CONSULTING"]
  ↓
filterSlugs: ["events", "pr"]
  ↓
// Used by work.html filter buttons
```

---

## 🛠️ Troubleshooting

### **Issue 1: "0 results found" on work.html filters**

**Cause**: `filterSlugs` don't match filter button values  
**Solution**: Ensure categories are in the mapping dictionary

**Check**:
```javascript
// In browser console:
console.log(window.cmsData.projects[0].filterSlugs);
// Should output: ["events", "pr", "government", etc.]
```

---

### **Issue 2: Logos not showing on homepage**

**Cause**: Missing `logoBlack` or `logoWhite` in JSON  
**Solution**: Ensure Columns 23-24 have valid Google Drive URLs

**Check**:
```javascript
console.log(window.cmsData.projects[0].logoBlack);
// Should output: "data/images/fb2026001-logo-black.webp"
```

---

### **Issue 3: Newsletter cards show empty descriptions**

**Cause**: `webEN/TC/JP` columns are empty or don't contain HTML  
**Solution**: Fill with content starting with `<h3>` or `##`

**Example**:
```html
<h3>Project Story</h3>
<p>First paragraph that will be extracted...</p>
```

---

### **Issue 4: Sync status stays "Pending"**

**Cause**: Apps Script didn't update Column 21  
**Solution**: Check if `GITHUB_TOKEN` is set in Script Properties

**Fix**:
1. Go to Apps Script editor
2. Click "Project Settings" (gear icon)
3. Add property: `GITHUB_TOKEN` = your GitHub personal access token
4. Re-run sync

---

### **Issue 5: Images not loading on website**

**Cause**: Image paths are broken or images weren't synced  
**Solution**: Check browser Network tab for 404 errors

**Check**:
```javascript
// In browser console:
console.log(window.cmsData.projects[0].heroPhoto);
// Should be: "https://cs627.github.io/Firebean-Website/data/images/fb2026001-hero.webp"
```

---

## 📋 Deployment Checklist

- [ ] Google Sheet has all 30 columns filled
- [ ] Apps Script v10.8 is deployed
- [ ] `GITHUB_TOKEN` is set in Script Properties
- [ ] GitHub repository is configured (owner, repo, branch)
- [ ] First sync runs successfully
- [ ] `projects.json` appears in GitHub
- [ ] Images appear in `data/images/`
- [ ] Website loads without errors
- [ ] Filters work on work.html
- [ ] Profile pages load correctly
- [ ] Homepage displays all sections

---

## 📞 Support & Updates

**Version History**:
- v8.1: Original Slide Generator + Project ID logic
- v10.0: GitHub Sync (basic)
- v10.1: Full data mapping (Logos, Gallery, Multilingual)
- v10.2: Status popups added
- v10.3: Column 21 auto-update
- v10.4: JSON format fixes
- v10.5: Complete homepage support
- v10.6: Sort date + summary
- v10.7: YouTube + final fields
- v10.8: **MASTER** - Category mapping + filterSlugs fix

**Last Updated**: March 30, 2026  
**Maintained By**: Manus CMS Team

---

*This is the definitive reference for the Firebean CMS system. Keep this document updated as new features are added.*
