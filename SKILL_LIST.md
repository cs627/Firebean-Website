# Firebean Website — Developer Skill List

**Version**: v1.2
**Last Updated**: 2026-03-15
**Maintained by**: Development Team + Manus AI

> This document is automatically updated after every code change or problem-solving session. It is the single source of truth for all development patterns, known pitfalls, and architectural decisions for the Firebean Agency Website.

---

## Changelog

| Version | Date | Summary |
| :--- | :--- | :--- |
| v1.0 | 2026-03-14 | Initial skill list created from Google Doc guidelines and session history |
| v1.1 | 2026-03-15 | Added Polaroid flip fix (inner frame targeting), 3-logo parallax system, domain migration plan |
| v1.2 | 2026-03-15 | Added Polaroid slideshow fix (single-image fade-swap), live-update workflow established |

---

## Skill 1 — Architecture & Deployment

The Firebean Website is a pure static HTML/CSS/JS site hosted on GitHub Pages. There is no build step, no bundler, and no framework. All three pages (`index.html`, `work.html`, `profile.html`) load content dynamically at runtime by calling `fetch()` on `data/projects.json`, which is synced from Google Sheets via an Apps Script pipeline.

| Item | Detail |
| :--- | :--- |
| **Repo** | `cs627/Firebean-Website` |
| **Live URL** | `https://cs627.github.io/Firebean-Website/` |
| **Future Domain** | `www.firebean.net` (pending all profiles being submitted) |
| **Local Dev** | Run `python3.11 -m http.server 8080` from the **parent directory** of `Firebean-Website/` so `<base href="/Firebean-Website/">` resolves correctly |
| **Deploy** | Push to `main` branch → GitHub Pages auto-deploys in ~1 minute |
| **Domain Migration** | Change `<base href="/Firebean-Website/">` to `<base href="/">` in all 3 HTML files. Add CNAME `www → cs627.github.io`. Add GitHub Pages custom domain in repo settings. |

**Rule**: Never manually edit `data/projects.json`. It is managed by the client via Google Sheets.

---

## Skill 2 — Dual Breakpoint DOM Structure

Many visual elements have **two separate DOM instances** in the HTML — one for mobile (`block md:hidden`) and one for desktop (`hidden md:block`). This is most critical for the Polaroid photos on the homepage.

**Pattern to follow**: Always use `querySelectorAll` to select all matching elements, or assign unique `id` attributes (e.g., `id="polaroid-frame-1"`) to the specific target elements. Never use `querySelector` alone, as it only selects the first match and the animation will silently fail on one breakpoint.

---

## Skill 3 — Tailwind CSS vs. JS Transform Conflicts

**Problem**: Tailwind static transform classes (e.g., `-rotate-6`, `rotate-[4deg]`) compile to `transform: rotate(...)` inline styles. When JS writes to `element.style.transform`, it overwrites or gets overwritten by Tailwind's value, causing animations to silently fail.

**Symptom**: JS animation code runs without errors, but the element does not visually move.

**Solution**: Remove the Tailwind transform class from the HTML element. Apply the base rotation value in JS during initialization, then add the dynamic animation delta on top of it. This was the root cause of the Polaroid flip animation being invisible for multiple iterations.

---

## Skill 4 — Three Scroll Animation Patterns

Three distinct patterns are used in this project, each suited to a different type of interaction:

| Pattern | How it Works | Use Case in This Site |
| :--- | :--- | :--- |
| **GSAP ScrollTrigger** | Triggers once when element enters viewport | Matchstick fly-in, Polaroid entrance |
| **rAF + `getBoundingClientRect()`** | Runs every frame, tracks element position relative to viewport | 3D Logo vertical parallax drift |
| **scroll event + delta** | Captures the pixel difference between each scroll event | Polaroid flip, 3D Logo rotateY tilt |

**Critical Warning**: CSS `position: sticky` and GSAP `pin` both fail silently when the parent container has `overflow: hidden`. The element gets clipped and disappears at the bottom of the section. Always use the rAF + `translateY` pattern in these cases.

---

## Skill 5 — 3D Parallax Logo Background System

Three independent logo layers create a depth illusion across the Work section (`index.html`) and the full Work page (`work.html`). The `profile.html` individual project page does **not** use this effect.

**Implementation**: Pure JS `requestAnimationFrame` loop. Each frame reads `workSection.getBoundingClientRect().top`, calculates the required `translateY` to keep the logo within the section bounds, and applies it directly via `element.style.transform`. Rotation is accumulated from scroll delta and held when scrolling stops.

| Layer | Position | Size | Parallax Speed | Flip Direction | Flip Speed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Logo 1 | Right (`right: -4%`, top 5%) | `36vw` / max 480px | Slow (0.25×) | Right → Left | Fast (`0.055°/px`) |
| Logo 2 | Left (`left: -4%`, top 30%) | `55vw` / max 730px | Medium (0.45×) | Left → Right | Very Slow (`0.008°/px`) |
| Logo 3 | Right Lower (`right: 2%`, top 62%) | `13vw` / max 180px | Fast (0.70×) | Right → Left | Medium (`0.015°/px`) |

---

## Skill 6 — Polaroid Photo System

The two Polaroid frames on the homepage combine two independent animations that must not interfere with each other.

**Flip Animation**: Targets the inner white frame `div` directly via `id="polaroid-frame-1"` and `id="polaroid-frame-2"`. This bypasses the outer `.polaroid-flow-in` wrapper which is controlled by GSAP entrance animations. Driven by scroll event delta. Polaroid 1 rotates right (+rotateY) on scroll down; Polaroid 2 rotates left (−rotateY). Max ±45°. Holds position when scrolling stops.

**Photo Slideshow**: Uses a single `<img>` element per frame (not dual-layer). The swap sequence is: fade out (0.7s) → swap `src` → fade in. Dual-layer (`img0`/`img1`) swapping was tested and abandoned because async initialization timing caused one layer's opacity to get permanently locked at 0.

Photo pool: All `galleryPhotos` from all projects, shuffled with Fisher-Yates, top 20 selected. Strictly excludes `heroPhoto` and `logoUrl`. Frame 2 starts 1.5s after Frame 1. `getUniqueNext()` ensures the two frames never show the same image simultaneously.

---

## Skill 7 — Multi-language Content Rendering

The site supports EN, CH (Traditional Chinese), and JP. All dynamically rendered text must respect the active language stored in `localStorage` (`lang` key, values: `en`, `tc`, `jp`).

Profile Card subtitles are extracted from the first heading of the corresponding language's web content field (`webEN`, `webTC`, `webJP`). The extraction logic tries HTML parsing first (`<h1>`, `<h2>`, `<h3>`), then Markdown heading (`# ...`), then falls back to the first non-empty line of text.

---

## Skill 8 — Design System Compliance

All visual changes must conform to the established brand system. Do not introduce new fonts, colors, or animation styles without explicit client approval.

| Category | Specification |
| :--- | :--- |
| **Brand Black** | `#0a0a0a` |
| **Brand Gray** | `#f4f4f4` |
| **Brand Red** | `#ff3333` |
| **Display Font** | `Anton` (hero headlines), `Oswald` (section titles) |
| **Body Font** | `Inter` |
| **Serif Accent** | `Libre Baskerville`, `Playfair Display` (italic quotes) |
| **Animation Feel** | All animations must feel physical — use easing, inertia, and decay. Avoid instant cuts. |

---

## Appendix — Known Pitfalls Quick Reference

| Pitfall | Symptom | Fix |
| :--- | :--- | :--- |
| Tailwind transform conflict | JS animation runs but element doesn't move | Remove Tailwind transform class; apply base value in JS |
| `overflow:hidden` clips sticky/pin | Logo/element disappears at section bottom | Use rAF + `translateY` instead of CSS sticky or GSAP pin |
| Dual DOM only selects one | Animation works on desktop but not mobile (or vice versa) | Use `querySelectorAll` or unique `id` |
| Dual-layer slideshow opacity lock | One Polaroid photo permanently invisible | Use single-image fade-swap pattern |
| `querySelector` returns null on async init | Slideshow never starts | Add `setTimeout` retry loop; check element exists before proceeding |
| `base href` breaks local paths | Images/JS/CSS 404 on local server | Serve from parent directory of `Firebean-Website/`, not from inside it |
