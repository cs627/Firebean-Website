// Netlify Edge Function: /api/sync-cms
// Fetches Google Sheets data, converts to JSON, pushes to GitHub repo.
// Trigger: POST /api/sync-cms with header X-Sync-Secret or from Apps Script webhook.

const SHEET_ID = '1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc';
const BASIC_INFO_GID = '0';
const GITHUB_REPO = 'cs627/Firebean-Website';
const JSON_PATH = 'data/projects.json';
const BRANCH = 'main';

// Column indices (0-based)
const COL = {
  TIMESTAMP: 0, CLIENT: 1, PROJECT: 2, DATE: 3, VENUE: 4,
  CATEGORY: 5, WHAT_WE_DO: 6, SCOPE: 7, YOUTUBE: 8,
  OPEN_QUESTION: 9, CHALLENGE: 10, SOLUTION: 11,
  WEB_EN: 17, WEB_TC: 18, WEB_JP: 19, SYNC_STATUS: 20,
  DRIVE_FOLDER: 21, HERO_PHOTO: 22, LOGO_BLACK: 23, LOGO_WHITE: 24,
  PROJECT_ID: 25, SORT_DATE: 26
};

function driveToThumbnail(url, size) {
  size = size || 800;
  if (!url || typeof url !== 'string') return '';
  url = url.trim();
  let m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + size;
  if (url.includes('drive.google.com/thumbnail')) return url;
  return url;
}

function extractFolderId(url) {
  if (!url) return '';
  const m = url.trim().match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function getFilterSlug(cat) {
  const lower = cat.toLowerCase();
  if (lower.includes('government') || lower.includes('public sector')) return 'government';
  if (lower.includes('lifestyle') || lower.includes('consumer')) return 'lifestyle';
  if (lower.includes('f&b') || lower.includes('hospitality')) return 'hospitality';
  if (lower.includes('mall') || lower.includes('venue')) return 'venues';
  if (lower.includes('roving') || lower.includes('exhibition')) return 'exhibitions';
  if (lower.includes('social') || lower.includes('content')) return 'social';
  if (lower.includes('interactive') || lower.includes('tech')) return 'tech';
  if (lower.includes('pr') || lower.includes('media')) return 'pr';
  if (lower.includes('event') || lower.includes('ceremon')) return 'events';
  return lower.replace(/[^a-z0-9]/g, '');
}

// Simple CSV parser handling quoted fields
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        field = '';
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowToProject(row, index) {
  const get = (col) => (row[col] || '').trim();
  const category = get(COL.CATEGORY);
  const whatWeDo = get(COL.WHAT_WE_DO);

  const categories = [];
  if (category) categories.push(category);
  if (whatWeDo) {
    whatWeDo.split(',').forEach(p => {
      const t = p.trim();
      if (t) categories.push(t);
    });
  }

  return {
    index,
    client: get(COL.CLIENT),
    project: get(COL.PROJECT),
    date: get(COL.DATE),
    venue: get(COL.VENUE),
    category,
    whatWeDo,
    scope: get(COL.SCOPE),
    youtube: get(COL.YOUTUBE),
    challenge: get(COL.CHALLENGE),
    solution: get(COL.SOLUTION),
    webEN: get(COL.WEB_EN),
    webTC: get(COL.WEB_TC),
    webJP: get(COL.WEB_JP),
    heroPhoto: driveToThumbnail(get(COL.HERO_PHOTO), 1200),
    heroPhotoSmall: driveToThumbnail(get(COL.HERO_PHOTO), 400),
    logoBlack: driveToThumbnail(get(COL.LOGO_BLACK), 200),
    logoWhite: driveToThumbnail(get(COL.LOGO_WHITE), 200),
    projectId: get(COL.PROJECT_ID),
    sortDate: get(COL.SORT_DATE),
    categories,
    filterSlugs: categories.map(getFilterSlug),
    driveFolderId: extractFolderId(get(COL.DRIVE_FOLDER))
  };
}

export default async (request) => {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Optional: check sync secret
  const secret = Deno.env.get('SYNC_SECRET');
  if (secret) {
    const provided = request.headers.get('X-Sync-Secret');
    if (provided !== secret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    // 1. Fetch CSV from Google Sheets
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${BASIC_INFO_GID}`;
    const csvRes = await fetch(csvUrl, { redirect: 'follow' });
    if (!csvRes.ok) throw new Error('Sheets CSV fetch failed: HTTP ' + csvRes.status);
    const csvText = await csvRes.text();

    // 2. Parse into projects
    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error('No data rows in CSV');

    const projects = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[COL.PROJECT] || !row[COL.PROJECT].trim()) continue;
      projects.push(rowToProject(row, i - 1));
    }

    // Sort by sortDate descending
    projects.sort((a, b) => {
      if (!a.sortDate && !b.sortDate) return 0;
      if (!a.sortDate) return 1;
      if (!b.sortDate) return -1;
      return b.sortDate.localeCompare(a.sortDate);
    });

    const jsonData = {
      lastSync: new Date().toISOString(),
      projects
    };
    const jsonStr = JSON.stringify(jsonData, null, 2);

    // 3. Push to GitHub
    const ghToken = Deno.env.get('GITHUB_TOKEN');
    if (!ghToken) throw new Error('GITHUB_TOKEN env var not set');

    // Get current file SHA (for update)
    let sha = null;
    const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${JSON_PATH}?ref=${BRANCH}`, {
      headers: { 'Authorization': `token ${ghToken}`, 'User-Agent': 'Firebean-CMS-Sync' }
    });
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // Base64 encode
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonStr);
    // Deno-compatible base64
    const base64Content = btoa(String.fromCharCode(...bytes));

    const putBody = {
      message: `sync: update projects.json (${projects.length} projects)`,
      content: base64Content,
      branch: BRANCH
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${JSON_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Firebean-CMS-Sync'
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error('GitHub push failed: ' + putRes.status + ' ' + errText);
    }

    return new Response(JSON.stringify({
      success: true,
      projectCount: projects.length,
      lastSync: jsonData.lastSync
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: "/api/sync-cms" };
