# 🔥 Firebean CMS & Website User Manual (v10.8)

This guide explains how to manage the **Firebean Master Database** (Google Sheets) and sync it with the **Firebean Website** (GitHub) and **Google Slides Generator**.

---

## 1. The Master Database (Google Sheets)
The Google Sheet is the "brain" of the entire system. Each column is mapped to a specific feature on the website or the slides.

### 📋 Key Columns & Their Roles
| Col | Name | Role | Website / Slide Usage |
| :--- | :--- | :--- | :--- |
| **2** | **CLIENT** | Client Name | Shows in Hero, Work Grid, and Slides. |
| **3** | **PROJECT** | Project Title | The main heading for the profile and slides. |
| **6** | **CATEGORY** | Categories | Comma-separated (e.g., `PR, EVENT`). Used for filtering. |
| **7** | **WHAT WE DO** | Running Text | Powers the high-energy scrolling text on the Hero Banner. |
| **8** | **SCOPE** | Scope of Work | Displayed in the right-hand sidebar of the profile page. |
| **9** | **YOUTUBE** | Video URL | Embeds a YouTube player in the profile page. |
| **11** | **CHALLENGE** | Slide Content | **Slide Generator only.** Not shown on website. |
| **12** | **SOLUTION** | Slide Content | **Slide Generator only.** Not shown on website. |
| **18-20**| **WEB EN/TC/JP**| Article Content | The main story. Supports Markdown (e.g., `##` for headings). |
| **22** | **DRIVE FOLDER**| Gallery Folder | Scans this folder for the **8 Polaroid Flip** photos. |
| **23** | **HERO PHOTO** | Main Banner | The large background image for the website. |
| **24-25**| **LOGO B/W** | Client Logos | **Black** for Client Wall; **White** for Dark Backgrounds. |
| **26** | **PROJECT ID** | Unique ID | Must be unique (e.g., `FB2026001`). Used for URLs. |
| **27** | **SORT DATE** | Sorting | Determines the order in the "Latest Work" grid. |
| **28-30**| **FAQ EN/TC/JP**| Q&A Sidebar | Uses Python-style `{'Q1': '...', 'A1': '...'}` format. |

---

## 2. Visual Assets Management

### 🖼️ Hero & Logos
- **Hero Photo**: Use the "Hero Photo Picker" or paste a direct Google Drive link.
- **Logos**: Provide both Black and White versions for maximum visibility across different sections.

### 📸 The Gallery (Drive Folder)
- Paste the URL of a Google Drive folder containing the project photos.
- The script will automatically pick the **first 8 images** (excluding logos).
- These photos power the **Polaroid Flip animations** on the homepage and the **Interleaved Gallery** on profile pages.

---

## 3. The "🔥 Firebean CMS" Menu
Once the Apps Script is installed, you will see a custom menu in your Google Sheet.

### ⚡ Sync Functions
1.  **Sync Changed Only**: Scans all rows and only pushes projects with new changes to GitHub.
2.  **⚡ Sync Selected Project**: Only syncs the row you have currently selected. Use this for quick updates!
3.  **Status Update**: After a successful sync, Column 21 will update to `✅ Synced (YYYY-MM-DD)`.

### 🎬 Slide Generation
1.  Select a row.
2.  Click **Create Slides for Selected Row**.
3.  The script will generate two slides (Title & Challenge/Solution) and append them to your **Master Deck**.
4.  The link to the Master Deck will be saved in Column 13.

---

## 4. Troubleshooting & Tips
- **Nothing Shows on Website?**: Ensure you have a valid `PROJECT_ID` and at least one `WEB_EN` content.
- **Photos Not Loading?**: Ensure the Google Drive files/folders are shared as "Anyone with the link can view".
- **Wrong Order?**: Check the **SORT_DATE** (Column 27). The website shows the newest dates first.
- **Broken FAQ?**: Ensure the FAQ column follows the `{'Q1': '...', 'A1': '...'}` structure.

---
*Version 10.8 - Created for Firebean Agency by Manus.*
