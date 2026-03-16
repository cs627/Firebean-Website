# Firebean Agency Style Guide

This document outlines the visual identity and design system for the Firebean Agency website.

---

## 1. Visual Mood & Aesthetic
**Mood:** Professional, Bold, Editorial, Dynamic.
**Concept:** "We Move Beyond the Scroll". The design celebrates structure, massive typography, and interactive 3D elements.

---

## 2. Color Palette
| Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **Brand Black** | `#0A0A0A` | Primary text, backgrounds, buttons. |
| **Brand Gray** | `#F4F4F4` | Secondary backgrounds, section dividers. |
| **Brand Red** | `#FF3333` | Accents, hover states, micro-labels. |
| **White** | `#FFFFFF` | Contrast text, card backgrounds. |

---

## 3. Typography
The site uses a sophisticated mix of sans-serif, display, and serif fonts to create hierarchy.

### Fonts
- **Primary Sans:** `Inter` (UI, body, navigation).
- **Display (Bold):** `Anton` (Logo, high-impact headings).
- **Display (Condensed):** `Oswald` (Section titles, buttons).
- **Serif (Editorial):** `Playfair Display` (Subtitles, italic accents).
- **Serif (Body):** `Libre Baskerville` (Long-form content).
- **Geometric Sans:** `League Spartan` (Alternative bold headings).

### Type Hierarchy
| Element | Font | Size (Tailwind) | Attributes |
| :--- | :--- | :--- | :--- |
| **Main Title (H1)** | Oswald | `text-[10vw]` to `text-[12vw]` | Bold, Uppercase, Leading 0.9 |
| **Section Title (H2)** | Oswald | `text-[8vw]` | Bold, Uppercase |
| **Sub-heading (H3)** | Playfair | `text-xl` to `text-2xl` | Italic, Medium weight |
| **Project Title** | Oswald | `text-3xl` to `text-5xl` | Bold, Uppercase |
| **Body Content** | Playfair / Inter | `text-lg` | Leading relaxed |
| **Micro-labels** | Inter | `text-xs` | Uppercase, Tracking widest |

---

## 4. Spacing & Layout
The layout uses generous white space to maintain an editorial feel.

### Global Standards
- **Container Padding (Horizontal):** `px-6` (24px) on mobile, `md:px-12` (48px) on desktop.
- **Max Width:** `max-w-7xl` (1280px) for centered content.

### Section & Element Padding
| Element | Standard Padding / Margin | Notes |
| :--- | :--- | :--- |
| **Section (Vertical)** | `py-16` (64px) to `py-32` (128px) | Use larger padding for high-impact sections. |
| **Section Spacing** | `mb-24` (96px) to `mb-32` (128px) | Vertical gap between major sections. |
| **Header Title Area** | `mb-24` (96px) | Gap between the main header title and the first content block. |
| **Title to Subtitle** | `mb-6` (24px) to `mb-8` (32px) | Spacing between a heading and its secondary text. |
| **Content Paragraphs** | `space-y-6` (24px) | Vertical gap between paragraphs in a text block. |
| **Content Block** | `mb-12` (48px) | Gap after a text block before the next component. |
| **Profile Card (Grid)** | `mb-12` (48px) | Gap between project profile cards in a list. |
| **Profile Image** | `mb-1` (4px) | Gap between the project image and its title. |
| **Profile Title** | `mb-2` (8px) | Gap between the project title and its description. |
| **Client Logo Padding** | `p-[0.15em]` | Internal padding within the interactive logo slots. |
| **Client Logo Margin** | `mx-[0.15em]` | Horizontal margin between text and logo slots in narrative text. |

---

## 5. Component & Asset Specifications

### Imagery & Media
| Type | Aspect Ratio | Min. Dimensions (Pixels) | Notes |
| :--- | :--- | :--- | :--- |
| **Hero Banner (Wide)** | `16:9` | `1920 x 1080 px` | High contrast, grayscale filters often applied. |
| **Hero Banner (Tall)** | `4:5` | `1200 x 1500 px` | Used for mobile or split layouts. |
| **Project Profile (Portrait)** | `4:5` | `800 x 1000 px` | Used in scattered grids. |
| **Project Profile (Landscape)** | `16:9` | `1200 x 675 px` | Used for wide impact. |
| **Detail Shots (Square)** | `1:1` | `800 x 800 px` | Used in multi-column grids. |
| **Newsletter / Footer Photo** | `16:9` | `1920 x 1080 px` | Background for contact/footer sections. |
| **Client Logos** | Variable | `400 x 200 px` | High-DPI clarity for 3D flip cards. |
| **3D Background Logo** | `1:1` | `1000 x 1000 px` | High resolution for large scale scroll effects. |

### Logos
- **Main Logo:** Text-based (`Anton`), tracking wider.
- **3D Background Logo:** Large fixed/absolute element (`w-[40vw]`), rotated via GSAP.

### Client Logo Standard (Interactive Slots)
| Property | Specification | Notes |
| :--- | :--- | :--- |
| **Slot Dimensions** | `w-[2.5em] h-[0.8em]` | Relative to parent font size. |
| **Internal Padding** | `p-[0.15em]` | Ensures logo doesn't touch the brackets. |
| **Visual Filter** | `grayscale contrast-200` | Maintains a unified, high-contrast editorial look. |
| **Object Fit** | `object-contain` | Prevents logo distortion. |
| **Interaction** | 3D Flip (X-axis) | Triggered via `setInterval` or `hover`. |
| **Brackets** | Red L-Brackets | Positioned at all 4 corners of the slot. |

### Interactive Elements
- **Buttons:** `px-6 py-3`, font-xs, bold, uppercase, tracking-widest.
- **Hover States:** Transitions (0.3s), opacity changes (50%), or color shifts to Brand Red.
- **3D Effects:** GSAP-powered rotation on scroll (90-degree vertical axis flip).

---

## 6. Implementation Notes
- **Styling Engine:** Tailwind CSS.
- **Animations:** GSAP (GreenSock) for scroll-triggered parallax and rotations.
- **Image Handling:** Always include `referrerpolicy="no-referrer"` for external assets.
