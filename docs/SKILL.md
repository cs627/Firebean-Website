---
name: firebean-website
description: Guidelines, architecture, and design rules for maintaining and modifying the Firebean Agency Website (cs627/Firebean-Website). Use this skill whenever the user requests changes to the Firebean website layout, animations, styles, or logic.
---

# Firebean Website Guidelines

This skill provides the architectural overview, design system, and historical modification rules for the Firebean Agency Website. Always refer to these guidelines before making changes to ensure consistency.

## 1. Architecture Overview

- **Hosting**: GitHub Pages (`cs627/Firebean-Website`)
- **Domain Plan**: Currently on `cs627.github.io/Firebean-Website/`. Once all profiles are ready, it will migrate to `www.firebean.net`. (Requires updating `<base href="/">` in all HTML files).
- **Stack**: Pure HTML/CSS/JS (No build step, no bundler).
- **Styling**: Tailwind CSS (via CDN).
- **Animations**: GSAP & ScrollTrigger.
- **Scrolling**: Lenis (Smooth scroll).
- **Data Source**: `data/projects.json` (synced from Google Sheets via Apps Script), loaded dynamically via `fetch()`.
- **Core Pages**:
  - `index.html` (Homepage)
  - `work.html` (Portfolio Grid)
  - `profile.html` (Individual Project Detail)

## 2. Design System & Conventions

- **Colors**:
  - Brand Black: `#0a0a0a`
  - Brand Gray: `#f4f4f4`
  - Brand Red: `#ff3333`
- **Typography**:
  - Display/Headlines: `Anton`, `Oswald`
  - Body/UI: `Inter`
  - Serif Accents: `Libre Baskerville`, `Playfair Display`
- **Layout**: Mobile-first responsive design using Tailwind utility classes (`md:`, `lg:`).

## 3. Established Animation Rules (From Iterations)

When modifying animations, adhere to these established behaviors:

### 3.1 Hero Carousel (`index.html`)
- **Speed**: Fast-paced.
  - Slide interval: 3s
  - Crossfade transition: 0.4s
  - Entrance flow-in: 0.5s
  - Slow zoom: 3s

### 3.2 Hero Matchsticks (`index.html`)
- **Positioning**: Must be visible on screen. Resting positions: Left (`left: 2%`), Right Top (`right: 2%`), Right Bottom (`right: 2%`).
- **Behavior**: Fly-in on load, pushed outward (±280px) on scroll-down.

### 3.3 Hero Polaroids (`index.html`)
- **Flip Behavior**: Scroll-driven (left-to-right). As the user scrolls down, `rotateY` smoothly transitions from negative to positive. No auto-flip, no spring-back.
- **Content**: 3-second random photo slideshow (fade-in/fade-out, 1.5s transition).
- **Source**: Randomly selected from `galleryPhotos` (excluding hero banners and logos).

### 3.4 3D Parallax Background Logos
Used on `index.html` (Work section) and `work.html` (Full page). **Not used** on `profile.html`.
Consists of 3 independent layers using `requestAnimationFrame` (not CSS sticky/GSAP pin, to avoid overflow clipping):
- **Logo 1 (Right)**: Large (36vw), fast rotation (`0.055°/px`), right-to-left flip (negative `rotateY`).
- **Logo 2 (Left)**: Extra Large (55vw), very slow rotation (`0.008°/px`), left-to-right flip (positive `rotateY`).
- **Logo 3 (Right Lower)**: Small (13vw), medium rotation (`0.015°/px`), right-to-left flip.
- **Behavior**: Rotation accumulates with scroll distance and *holds* when scrolling stops (no bounce-back).

## 4. Profile Page Layout Rules

### 4.1 Two-Column Layout (12-col grid)
- **Article** (left): `col-span-12 lg:col-span-8 order-2 lg:order-1` — 8 cols on desktop
- **Sidebar** (right): `col-span-12 lg:col-span-4 order-1 lg:order-2` — 4 cols on desktop, sticky
- Sidebar contains: SCOPE (red left-border) and Q&A (black/10 left-border, hidden until populated)

### 4.2 Q&A Sidebar — v4.6 Parser
The `faqEN`, `faqTC`, `faqJP` fields in `projects.json` are stored as **Python-style single-quoted arrays** (e.g. `[{'Q1': '...', 'A1': '...'}]`). JavaScript's `JSON.parse()` cannot parse these directly.

**Fix (v4.6)**: `parsePythonStyleFaq(str)` helper + 3-tier fallback in `extractQA()`:
1. **Standard JSON.parse** (for properly double-quoted data)
2. **Python-style parser** — uses `/\{([^{}]+)\}/g` to extract each `{...}` block, then `new RegExp("['\"]Q" + n + "['\"]\\s*:\\s*")` to find Q/A values
3. **Line-by-line fallback** — regex `^['"']?Q(\d)['"']?\s*[:.]['"']?\s*(.+)$`

The `hidden` class on `#profile-qa` is removed by JS when Q&A pairs are found.

### 4.3 Gallery Photo Interleaving (8 Photos) — v4.7
When a project has 8+ gallery photos, the `interleave()` function places them as pairs (2 per row) between article sections.

**v4.7 logic:**
1. Collect all `h1-h6` + `p` elements from `challengeEl` into a `blocks[]` array
2. Insert `pairs[0]` after `blocks[1]`, `pairs[1]` after `blocks[3]`, `pairs[2]` after `blocks[5]`
3. Refresh `blocks[]` after each insertion to keep indices accurate
4. `pairs[3]` inserted before `#profile-solution`; `pairs[4]+` appended at the end
5. Uses `nextElementSibling` (not `nextSibling`) to skip text nodes

Each photo pair is a `grid grid-cols-2 gap-3 md:gap-6 my-8 interleaved-photo-pair` div. Photos animate in via ScrollTrigger (`opacity-0 translate-y-8` → visible on scroll).

### 4.4 Article Rendering — v4.7 Literal \n Normalisation
Some Google Sheets rows export `webEN`/`webTC`/`webJP` with **literal backslash-n** (`\n` as two chars) instead of real newlines. This causes the line-splitter to fail, resulting in `\n\n` showing as text in the browser.

**Fix**: Before splitting, normalise with `webContent.replace(/\\n/g, '\n')`. This must be applied to all three language fields.

### 4.5 FAST RECAP / FAQ Section Removal — v4.7
After rendering the article HTML, scan all block elements for headings containing `fast recap`, `faq`, `q&a`, `常見問題`, or `よくある質問`. Remove that heading and all following siblings. The dedicated `faqEN`/`faqTC`/`faqJP` sidebar handles Q&A exclusively — never render it in the article body.

### 4.6 Gallery Photos Sync (v4.8)
The Google Apps Script syncs `galleryPhotos` in two modes:
- **"Pending (images)"**: Downloads photos from Drive and builds the gallery list.
- **Text-only sync**: Reconstructs gallery paths from `data/image-hashes.json`.
**Bug (Fixed in v4.8)**: If a text-only sync runs before the project has ever had an image sync, `galleryPhotos` will be empty `[]`.
**Fix/Prevention**: Always ensure at least one full image sync is run for a project before relying on text-only syncs. If `projects.json` is missing gallery photos but images exist in `data/images/`, rebuild the JSON `galleryPhotos` arrays from `image-hashes.json`.

### 4.7 Footer / Contact Section — v4.9 (Shared with index.html)
The `profile.html` footer **must exactly match** the `index.html` contact section. They share the same HTML block — do NOT create a separate layout for `profile.html`.

**Correct structure** (copy verbatim from `index.html`):
- Outer: `<section class="relative bg-brand-black text-white py-32 px-6 overflow-hidden">` (no separate `<footer>` tag)
- Left column: Oswald headline (`Ready To Talk? / Get In Touch.`) + 2-col grid (New Business + Careers) + address with pin SVG + phone with phone SVG
- Right column: Google Maps `<iframe>` with `min-h-[400px]`, `filter: grayscale(100%) contrast(110%)`, hover opacity transition
- Footer bar: inside same `<section>`, `border-t border-white/10`, Copyright + Disclaimer/Privacy/Terms buttons
- **No** separate `<footer>` HTML element on `profile.html`

**Dark mode**: `html.dark iframe[src*="google.com/maps"] { filter: invert(0.9) hue-rotate(180deg); }` already in `profile.html` CSS.

### 4.8 Newsletter Section — v5.2 (index.html)

**CRITICAL: CSS `position: sticky` does NOT work with Lenis smooth scroll.** Lenis intercepts native scroll events and moves elements via CSS transforms — the browser's native scroll position never changes, so `sticky` never activates. Do NOT use CSS sticky for any pinned element on this page.

**Correct approach — GSAP ScrollTrigger pin**: The left column must be pinned using `ScrollTrigger.create({ pin: '.newsletter-left-col', ... })`. This requires the Lenis-ScrollTrigger bridge to be set up first:

```js
// In the Lenis RAF loop:
function raf(time) {
  lenis.raf(time);
  ScrollTrigger.update(); // Keep GSAP in sync every frame
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
// Bridge Lenis scroll events to GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0); // Prevent GSAP timing compensation

// Newsletter pin (after gsap.registerPlugin(ScrollTrigger)):
ScrollTrigger.create({
  trigger: '#newsletter',
  start: 'top top',
  end: () => '+=' + (document.querySelector('#newsletter').offsetHeight - window.innerHeight),
  pin: '.newsletter-left-col',
  pinSpacing: false,
  anticipatePin: 1,
});
```

The `.newsletter-left-col` div must NOT have `position: sticky` inline style — GSAP pin handles positioning entirely. The pin correctly starts exactly when the `#newsletter` section hits the top of the viewport (`start: 'top top'`), keeping the big title pinned while the right-side cards scroll past.

**Dark mode email input**: The input wrapper uses `bg-black/5` which is invisible in dark mode. The following CSS rules MUST be present in `<style>`:
```css
html.dark #newsletter-form .bg-black\/5 { background-color: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; }
html.dark #nl-email { color: #e5e5e5 !important; }
html.dark #nl-email::placeholder { color: rgba(229,229,229,0.45) !important; }
html.dark #nl-submit-btn { background-color: #e5e5e5 !important; color: #0a0a0a !important; }
html.dark #nl-submit-btn:hover { background-color: #ff3333 !important; color: #ffffff !important; }
```

## 5. Development Workflow

1. **Local Testing**: Run `python3 -m http.server 8080` from the parent directory of `Firebean-Website` so the `<base href="/Firebean-Website/">` resolves correctly. Always do a **hard reload (Ctrl+Shift+R)** to bypass cached `projects.json`.
2. **Commits**: Make atomic commits directly to the `main` branch. GitHub Pages will auto-deploy within ~1 minute.
3. **Data Updates**: Do not manually edit `data/projects.json` unless fixing a critical bug. It is managed by the client via Google Sheets.

## 6. Data Input Sanitisation (v5.3)

### 6.1 Google Sheets Clipboard Noise Problem

When a user copies a cell from Google Sheets on Mac and pastes it into the Streamlit CMS app, the Mac clipboard sometimes captures surrounding Google Sheets UI text alongside the actual cell value. This produces polluted project names like:

```
Firebean_Master_DB Firebean_Master_DB 100% C20 Stride Ahead Into A Drug-free Future Summarize this data Stride Ahead Into A Drug-free Future Turn on screen reader support To enable screen reader support, press ⌘+Option+Z
```

The actual value (`Stride Ahead Into A Drug-free Future`) appears **twice** in the noise.

### 6.2 Fix: Two-Layer Sanitisation

**Layer 1 — Streamlit app (`app.py`)**: `clean_field()` function wraps `client_name`, `project_name`, and `venue` inputs:
- Strips known noise patterns: sheet name, zoom %, cell refs, screen-reader strings, keyboard shortcut hints
- Deduplicates repeated text (copy artifact)
- Applied on every keystroke via `clean_field(b1.text_input(...))`

**Layer 2 — Apps Script (`sync-to-github.gs`)**: `cleanSheetValue_()` function applied to `projectName` before writing to `projects.json`:
- Same noise pattern stripping as Layer 1
- Safety net in case polluted data was already saved to the Sheet before the Streamlit fix

### 6.3 Known Noise Patterns to Strip

| Pattern | Example |
|---|---|
| Sheet name | `Firebean_Master_DB` |
| Zoom percentage | `100%` |
| Cell reference | `C20`, `AB3` |
| Summarize prompt | `Summarize this data` |
| Screen reader toggle | `Turn on screen reader support` |
| Screen reader instruction | `To enable screen reader support, press ⌘+Option+Z` |
| Keyboard shortcut hint | `To learn about keyboard shortcuts, press ⌘slash` |

**Repos updated**: `dickson-crypto/Firebean-app` (commit `e18bff1`) and `cs627/Firebean-Website` (commit `89063df`).

## 7. Streamlit CMS App Enhancements (v5.4)

### 7.1 Dark Mode Support with User Toggle

**Feature**: The Streamlit CMS app now supports dark mode, with an automatic time-based switch and a manual user toggle.

**Implementation Details**:
- **Automatic Mode**: `get_is_dark_mode()` function automatically sets dark mode between 8 PM and 8 AM (Hong Kong time).
- **Manual Toggle**: A new UI toggle (☀️/🌙) and a reset (🔄) button are added to the top right of the app. Users can override the automatic setting.
- **Session State**: User preferences are stored in `st.session_state.user_dark_mode`.
- **Styling**: `apply_styles()` function dynamically applies Neumorphism-inspired dark/light themes based on the active mode.

### 7.2 Auto-Save to Google Sheet (Drafts)

**Feature**: The Streamlit app now automatically saves input data as a draft to the Google Sheet (`Raw_Input_DB`) as the user types or uploads content.

**Implementation Details**:
- **`should_autosave()`**: Implements a debounce mechanism, saving drafts at a minimum interval of 3 seconds to prevent excessive calls.
- **`trigger_autosave_draft()`**: This function is called after changes to key input fields such as Client Name, Project Name, Venue, YouTube Link, Category, What We Do, Scope of Work, Photo Uploads, and Open Question Answer.
- **Data Handling**: Images are processed (resized and base64 encoded) before being sent to the Google Sheet for draft storage.

### 7.3 Auto-Sync to GitHub (projects.json)

**Feature**: After AI content generation (e.g., for social media posts or website articles), the generated content, along with all other project data, is automatically synced to GitHub (`projects.json`).

**Implementation Details**:
- **`trigger_autosync_github()`**: This new function is called immediately after `st.session_state.ai_content` is populated.
- **Comprehensive Sync**: It gathers all current project data, including processed images and AI-generated content, and sends it to both the Google Sheet Script (`SHEET_SCRIPT_URL`) and the Slide Script (`SLIDE_SCRIPT_URL`) for full synchronization.
- **Debounce**: This auto-sync also respects the `should_autosave()` debounce mechanism to avoid rapid, redundant updates.

**Repos updated**: `dickson-crypto/Firebean-app` (commit `146dbcf`).
