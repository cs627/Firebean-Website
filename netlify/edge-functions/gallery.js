// Netlify Edge Function: /api/gallery?folderId=xxx
// Fetches public Drive folder page and returns image file IDs as JSON

export default async (request) => {
  const url = new URL(request.url);
  const folderId = url.searchParams.get('folderId');
  
  if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    return new Response(JSON.stringify({ error: 'Invalid folderId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const embedUrl = 'https://drive.google.com/embeddedfolderview?id=' + folderId;
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Drive returned ' + res.status }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const html = await res.text();
    
    // Parse entries: id="entry-{FILE_ID}" with title in flip-entry-title
    const entries = [];
    const regex = /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?flip-entry-title">([^<]+)</g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      entries.push({ id: m[1], name: m[2] });
    }

    // Filter to image files only, exclude logos
    const photos = entries.filter(e => {
      const lower = e.name.toLowerCase();
      if (lower.indexOf('logo') !== -1) return false;
      if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) return false;
      return true;
    }).map(e => e.id);

    return new Response(JSON.stringify({ photos }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

export const config = { path: "/api/gallery" };
