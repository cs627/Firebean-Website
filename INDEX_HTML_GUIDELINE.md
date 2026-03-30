# 🔥 Firebean Index.html Data Guideline

This document explains how the **index.html** homepage works, which data fields are required for each section, and how the JSON from the Apps Script is consumed.

---

## 📊 Data Flow Overview

```
Google Sheet (Master DB)
    ↓
Apps Script v10.8 (Sync)
    ↓
projects.json (GitHub)
    ↓
cms.js (Load & Process)
    ↓
index.html (Render Sections)
```

The **cms.js** file loads `projects.json` and:
1. Prepends the base path to all image URLs
2. Generates `filterSlugs` from the `categories` array (for work.html filtering)
3. Determines `logoCategory` (lifestyle or government) based on categories

---

## 🎨 Section-by-Section Data Requirements

### **Section 1: Hero Slider (Top 3 Projects)**
**Location**: Lines 2270-2326 in index.html

| Field | Source | Purpose | Required? |
| :--- | :--- | :--- | :--- |
| `heroPhoto` | Column 23 | Hero banner background image | ✅ Yes |
| `projectName` | Column 3 | Project title (top-left) | ✅ Yes |
| `category` | Column 6 | Scrolling marquee text (center) | ✅ Yes |
| `id` / `projectId` | Column 26 | Link to profile page | ✅ Yes |

**How It Works**:
- The first 3 projects with `heroPhoto` are displayed
- The `category` field is **translated** based on the current language (EN/CH/JP)
- The marquee text scrolls horizontally and repeats 6 times
- Clicking the hero image links to the profile page using `id` or `projectId`

**Example JSON**:
```json
{
  "id": "fb2026001",
  "projectId": "FB2026001",
  "projectName": "Campaign Name",
  "category": "EVENT PLANNING, PR CONSULTING",
  "heroPhoto": "data/images/fb2026001-hero.webp"
}
```

---

### **Section 2: Work Profiles Grid (Projects 4-9)**
**Location**: Lines 2328-2390 in index.html

| Field | Source | Purpose | Required? |
| :--- | :--- | :--- | :--- |
| `heroPhoto` | Column 23 | Grid card image | ✅ Yes |
| `projectName` | Column 3 | Card title | ✅ Yes |
| `client` | Column 2 | Card subtitle (italic) | ✅ Yes |
| `webEN/TC/JP` | Columns 18-20 | Extract title & description | ✅ Yes |
| `id` / `projectId` | Column 26 | Link to profile | ✅ Yes |

**How It Works**:
- Projects 4-9 are displayed in a 3-column grid
- The **first heading** and **first paragraph** are extracted from the multilingual web content
- The grid is language-aware (shows CH or JP content if selected)
- Hover effect: image scales up 105%

**Example JSON**:
```json
{
  "id": "fb2026002",
  "projectName": "Project Title",
  "client": "Client Name",
  "heroPhoto": "data/images/fb2026002-hero.webp",
  "webEN": "<h3>Challenge Title</h3><p>First paragraph of content...</p>",
  "webTC": "<h3>挑戰標題</h3><p>內容的第一段...</p>",
  "webJP": "<h3>チャレンジタイトル</h3><p>コンテンツの最初の段落...</p>"
}
```

---

### **Section 3: Clients (Narrative + Logo Flip)**
**Location**: Lines 950-1100 in index.html

| Field | Source | Purpose | Required? |
| :--- | :--- | :--- | :--- |
| `logoBlack` | Column 24 | Logo image (light backgrounds) | ✅ Yes |
| `logoWhite` | Column 25 | Logo image (dark backgrounds) | ✅ Yes |
| `client` | Column 2 | Logo description/hover text | ✅ Yes |
| `categories` | Column 6 | Determines if "lifestyle" or "government" | ✅ Yes |
| `projectId` | Column 26 | Links to project profile | ✅ Yes |

**How It Works**:
- Projects are separated into two pools: **"lifestyle"** and **"government"**
- The categorization is **automatic**: if `categories` contains "Government" or "Public", it's marked as government; otherwise, it's lifestyle
- 3 logo slots flip every 3 seconds (2 lifestyle, 1 government)
- The logo automatically switches between black and white based on dark mode
- Clicking a logo opens a modal showing the project details

**Example JSON**:
```json
{
  "id": "fb2026003",
  "client": "Client Brand Name",
  "categories": ["GOVERNMENT", "EVENT PLANNING"],
  "logoCategory": "government",
  "logoBlack": "data/images/fb2026003-logo-black.webp",
  "logoWhite": "data/images/fb2026003-logo-white.webp",
  "projectId": "FB2026003"
}
```

**Logo Category Logic**:
```
IF categories contains "government" OR "public"
  → logoCategory = "government"
ELSE
  → logoCategory = "lifestyle"
```

---

### **Section 4: Newsletter Cards (Projects 10-12)**
**Location**: Lines 2515-2586 in index.html

| Field | Source | Purpose | Required? |
| :--- | :--- | :--- | :--- |
| `heroPhoto` | Column 23 | Card background image | ✅ Yes |
| `projectName` | Column 3 | Card title | ✅ Yes |
| `client` | Column 2 | Card subtitle | ✅ Yes |
| `webEN/TC/JP` | Columns 18-20 | Extract description | ✅ Yes |
| `id` / `projectId` | Column 26 | Link to profile | ✅ Yes |

**How It Works**:
- Projects 10-12 are displayed as "Latest Work" newsletter cards
- The **first heading** and **first 200 characters** of the first paragraph are extracted
- Text is truncated with "......" at the end
- Language-aware: shows CH or JP content if selected
- Clicking the card links to the full profile

**Example JSON**:
```json
{
  "id": "fb2026010",
  "projectName": "Newsletter Project",
  "client": "Client Name",
  "heroPhoto": "data/images/fb2026010-hero.webp",
  "webEN": "<h3>Project Story</h3><p>This is the first paragraph that will be shown in the newsletter card...</p>",
  "summary": "This is the first paragraph that will be shown in the newsletter card..."
}
```

---

### **Section 5: Work Section (3D Logo Parallax)**
**Location**: Lines 1380-1440 in index.html

| Field | Source | Purpose | Required? |
| :--- | :--- | :--- | :--- |
| `logoBlack` | Column 24 | 3D parallax background logo | ✅ Yes |
| `logoWhite` | Column 25 | Alternative for dark mode | ✅ Yes |
| `categories` | Column 6 | Determines logo pool | ✅ Yes |
| `projectId` | Column 26 | Links to project | ✅ Yes |

**How It Works**:
- 3 large logos (one per project) are displayed behind the "Work" section title
- Each logo has a different **scroll-driven 3D rotation** effect
- Logo 1: Drifts at 0.25x scroll speed, rotates -70° to +70° on Y-axis
- Logo 2: Drifts at 0.40x scroll speed, rotates -70° to +70° on Y-axis
- Logo 3: Drifts at 0.60x scroll speed, rotates -70° to +70° on Y-axis
- The logos are separated by category (lifestyle/government)

---

## 🔧 How cms.js Processes Data

### **Image Path Fixing**
```javascript
// Converts relative paths to absolute (for GitHub Pages)
heroPhoto: "data/images/fb2026001-hero.webp" 
  → "https://cs627.github.io/Firebean-Website/data/images/fb2026001-hero.webp"
```

### **FilterSlugs Generation**
```javascript
categories: ["EVENT PLANNING", "PR CONSULTING"]
  → filterSlugs: ["eventplanning", "prconsulting"]
  // Used by work.html for category filtering
```

### **Logo Category Determination**
```javascript
categories: ["GOVERNMENT", "EVENT PLANNING"]
  → logoCategory: "government"

categories: ["LIFESTYLE", "BRANDING"]
  → logoCategory: "lifestyle"
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: Logos Not Showing in Clients Section**
**Cause**: Missing `logoBlack` or `logoWhite` in the JSON
**Solution**: Ensure Columns 24-25 have valid Google Drive file links

### **Issue 2: Newsletter Cards Show Empty Descriptions**
**Cause**: `webEN/TC/JP` columns are empty or don't contain proper HTML/Markdown
**Solution**: Fill Columns 18-20 with content that starts with a heading (`<h3>` or `##`)

### **Issue 3: Hero Slider Marquee Text Not Translating**
**Cause**: Category not in the translation dictionary
**Solution**: Check `translations.js` for the category name; add if missing

### **Issue 4: Wrong Logos in Government vs. Lifestyle**
**Cause**: Categories don't contain "government" keyword
**Solution**: Ensure Column 6 includes "Government" or "Public" for government projects

### **Issue 5: 3D Logo Parallax Not Working**
**Cause**: `logoBlack` or `logoWhite` paths are broken
**Solution**: Verify image paths in the browser's Network tab

---

## 📝 Google Sheet Column Checklist

For the homepage to work perfectly, ensure these columns are filled:

| Col | Name | Status | Notes |
| :--- | :--- | :--- | :--- |
| 2 | CLIENT | ✅ Required | Shows in grid, newsletter, and logo descriptions |
| 3 | PROJECT | ✅ Required | Main title for all sections |
| 6 | CATEGORY | ✅ Required | Powers marquee text, filtering, and logo categorization |
| 18-20 | WEB EN/TC/JP | ✅ Required | Content for grid descriptions and newsletter |
| 23 | HERO PHOTO | ✅ Required | Hero banner and grid/newsletter images |
| 24-25 | LOGO B/W | ✅ Required | Client logos for narrative and parallax sections |
| 26 | PROJECT ID | ✅ Required | Links to profile pages |

---

## 🎯 Best Practices

1. **Always fill the top 12 projects**: The homepage uses projects 1-12 for different sections
2. **Use consistent category names**: Match them against the translation dictionary in `translations.js`
3. **Provide both Black and White logos**: The site switches automatically based on dark mode
4. **Write compelling web content**: The first heading and paragraph are extracted for previews
5. **Use high-quality hero images**: They're displayed at large sizes (1200x1080px or larger)

---

*Version 1.0 - Created for Firebean Agency by Manus.*
