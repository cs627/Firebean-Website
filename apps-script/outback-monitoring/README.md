# Outback HK Monitoring — Apps Script Backend

Backs the Outback dashboard's **「＋ Submit Mention」** (manual mention submission with
auto metadata fetch) and **「✨ AI Analysis」** (PR insight report via OpenRouter).

> ⚠️ Source of truth note: like the Firebean CMS, the **live** Apps Script code lives in
> the Google Apps Script editor — these `.gs` files are the deployable reference copy.
> Any change you make here must be pasted into the editor and redeployed to take effect.

## What it does

| `type` | Purpose |
|---|---|
| `auto_fetch` | Fetch page metadata (`og:title` / `og:description` / `<title>`) + detect source from a URL — read only. |
| `manual_mention` | Append a `pending review` row to the `Social Listening Data` tab. |
| `ai_analysis` | Call OpenRouter with the selected date + records → PR insight report (繁體中文). |

## One-time setup

1. Go to <https://script.google.com> → **New project** (or reuse a monitoring project).
2. Paste the three files as separate scripts: `Code.gs`, `manual-mention.gs`, `ai-analysis.gs`.
3. Open **Project Settings → Script Properties** and add:
   - `OPENROUTER_API_KEY` → your OpenRouter key (required for AI analysis)
   - `MONITOR_SHEET_ID` → optional; defaults to the Outback sheet
     `1uj_3EYaeJFcIYOXJhECJXzmFb3643issOrKIB4WTSe4`
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the resulting `/exec` URL.

## Wire the URL into the dashboard

Open `outback-monitoring/outback_monitoring_dashboard.html` (and `index.html`), find:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

Replace `YOUR_DEPLOYMENT_ID` with the real deployment ID from step 5, then redeploy the
site (the Outback deploy script pushes to GitHub Pages, or `git push` directly).

## Security

- The OpenRouter key lives **only** in Apps Script Script Properties — never in the
  client HTML or this repo.
- `manual_mention` rows are marked `manual · pending review` in the 備註 column so they
  are not silently treated as verified.
