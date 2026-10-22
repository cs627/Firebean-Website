#!/usr/bin/env python3
"""
Pre-render static project pages from projects.json for AI crawler visibility.

Generates:
  /projects/<projectId>.html   per-project page: static meta + JSON-LD CreativeWork/FAQPage
  /projects/index.html         human + crawler index of every project
  /sitemap.xml                 regenerated: keeps every non-project URL, rewrites project URLs
  /llms.txt                    appends a marker-wrapped complete project index
  /llms-full.txt               appends a marker-wrapped complete project index
  /roving-exhibitions/index.html   injects a static project list into #roving-main

Design notes (why it is written this way):
  * sitemap.xml, llms.txt and llms-full.txt were hand-maintained and drifted out of date
    (3 projects were missing from the sitemap). They are now derived from projects.json.
  * Hand-written prose in llms.txt / llms-full.txt is NEVER destroyed: generated content
    lives between AUTO-GENERATED markers and is replaced in place.
  * The roving page renders its cards with roving.js via innerHTML. Crawlers do not run JS,
    so a static list is injected into #roving-main as a fallback. roving.js still overwrites
    it at runtime, so the visitor experience is unchanged and the content is identical.

Run: python3 scripts/pre_render_projects.py
"""
import json, os, re, sys, html
from datetime import datetime, timezone

BASEDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASEDIR, 'data', 'projects.json')
OUT_DIR = os.path.join(BASEDIR, 'projects')
SITEMAP_PATH = os.path.join(BASEDIR, 'sitemap.xml')
LLMS_PATH = os.path.join(BASEDIR, 'llms.txt')
LLMS_FULL_PATH = os.path.join(BASEDIR, 'llms-full.txt')
ROVING_PATH = os.path.join(BASEDIR, 'roving-exhibitions', 'index.html')

CANONICAL_BASE = 'https://firebean.net/profile.html?id='
SITE = 'https://firebean.net'
PROJECT_CANONICAL = SITE + '/projects/'
PROJECT_PAGE = SITE + '/projects/%s.html'

START = '<!-- AUTO-GENERATED:PROJECTS:START -->'
END = '<!-- AUTO-GENERATED:PROJECTS:END -->'
ROV_START = '<!-- AUTO-GENERATED:ROVING:START -->'
ROV_END = '<!-- AUTO-GENERATED:ROVING:END -->'

TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')

os.makedirs(OUT_DIR, exist_ok=True)

with open(JSON_PATH, encoding='utf-8') as f:
    d = json.load(f)

projects = d.get('projects', [])
print(f"Processing {len(projects)} projects...")


def esc(s):
    return html.escape(str(s or ''), quote=True)


def is_publishable(p):
    """Thin-content guard. A row with no client and no case-study text is a draft
    (e.g. FB2026082/083 'Project Recap'). Publishing those to the sitemap and the
    llms index invites thin-content penalties, so they are noindex'd and excluded."""
    has_client = bool((p.get('client') or '').strip())
    has_text = bool((p.get('webEN') or '').strip() or (p.get('webTC') or '').strip())
    return has_client or has_text


def is_roving(p):
    """Mirror of isRoving() in src/roving.js so the static fallback matches the live page."""
    name = p.get('projectName', '') or ''
    if '巡迴' in name or 'roving' in name.lower():
        return True
    cats = p.get('categories') or []
    if isinstance(cats, str):
        cats = cats.split(',')
    if 'exhibitions' not in [str(c).strip() for c in cats]:
        return False
    desc = (p.get('webEN', '') or '') + ' ' + (p.get('webTC', '') or '')
    return '巡迴' in desc or 'roving' in desc.lower()


# ---------------------------------------------------------------- project pages
index_lines = []
index_lines.append('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">')
index_lines.append('<title>Firebean Project Index — AI Search Reference</title>')
index_lines.append('<meta name="robots" content="index,follow">')
index_lines.append('<link rel="canonical" href="https://firebean.net/work.html">')
index_lines.append('</head><body>')
index_lines.append('<h1>Firebean Agency — Complete Project Index</h1>')
index_lines.append(f'<p>{len(projects)} projects since 2007. Hong Kong Lifestyle PR & Event Production agency.</p>')
index_lines.append('<ul>')

generated = 0
for proj in projects:
    pid = proj.get('projectId', '')
    name = proj.get('projectName', '')
    client = proj.get('client', '')
    category = (proj.get('category', '') or 'N/A').split(',')[0].strip()
    venue = proj.get('venue', '')
    scope = proj.get('scope', '') or ''
    sort_date = proj.get('sortDate', '')
    web_en = proj.get('webEN', '') or ''
    web_tc = proj.get('webTC', '') or ''

    lines = []
    lines.append('<!DOCTYPE html>')
    lines.append('<html lang="en">')
    lines.append('<head>')
    lines.append('<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">')
    lines.append(f'<title>{esc(name)} — {esc(client)} | Firebean Agency Hong Kong</title>')
    desc = f'Firebean project: {name} for {client}. Category: {category}. {scope[:150]}'
    lines.append(f'<meta name="description" content="{esc(desc)}">')
    lines.append('<meta name="robots" content="%s">' % ('index,follow' if is_publishable(proj) else 'noindex,follow'))
    lines.append(f'<link rel="canonical" href="{PROJECT_CANONICAL}{pid.lower()}.html">')

    creative_work = {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        'identifier': pid,
        'name': name,
        'author': {'@type': 'Organization', 'name': 'Firebean Limited', 'url': SITE},
        'provider': {'@type': 'Organization', 'name': category},
        'dateCreated': sort_date,
        'inLanguage': ['en', 'zh-HK', 'ja'],
    }
    if scope:
        creative_work['description'] = scope
    if venue:
        creative_work['locationCreated'] = {'@type': 'Place', 'name': venue}
    lines.append(f'<script type="application/ld+json">{json.dumps(creative_work, ensure_ascii=False)}</script>')

    faq_en = proj.get('faqEN', '')
    faqs = None
    if faq_en:
        try:
            faqs = json.loads(faq_en) if isinstance(faq_en, str) else faq_en
            if faqs and isinstance(faqs, list):
                main_entity = []
                for faq in faqs:
                    if faq.get('q') and faq.get('a'):
                        main_entity.append({
                            '@type': 'Question',
                            'name': faq['q'],
                            'acceptedAnswer': {'@type': 'Answer', 'text': faq['a'][:500]},
                        })
                if main_entity:
                    faq_page = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': main_entity}
                    lines.append(f'<script type="application/ld+json">{json.dumps(faq_page, ensure_ascii=False)}</script>')
        except Exception:
            pass

    lines.append('</head>')
    lines.append('<body>')
    lines.append('<article>')
    lines.append(f'<h1>{esc(name)}</h1>')
    lines.append(f'<p><strong>Client:</strong> {esc(client)}</p>')
    lines.append(f'<p><strong>Project ID:</strong> {esc(pid)}</p>')
    lines.append(f'<p><strong>Category:</strong> {esc(category)}</p>')
    lines.append(f'<p><strong>Date:</strong> {esc(sort_date)}</p>')
    if venue:
        lines.append(f'<p><strong>Venue:</strong> {esc(venue)}</p>')
    lines.append(f'<p><strong>Scope:</strong> {esc(scope)}</p>')

    if web_en:
        lines.append('<section><h2>English</h2>')
        lines.append(web_en)
        lines.append('</section>')
    if web_tc:
        lines.append('<section><h2>繁體中文</h2>')
        lines.append(web_tc)
        lines.append('</section>')

    if faqs and isinstance(faqs, list):
        faq_html = '<section><h2>FAQ</h2>'
        any_faq = False
        for faq in faqs:
            if faq.get('q') and faq.get('a'):
                faq_html += f'<h3>{esc(faq["q"])}</h3><p>{esc(faq["a"])}</p>'
                any_faq = True
        faq_html += '</section>'
        if any_faq:
            lines.append(faq_html)

    lines.append(f'<p><a href="{CANONICAL_BASE}{pid}">View full profile with images on firebean.net</a></p>')
    lines.append('</article>')
    lines.append('</body>')
    lines.append('</html>')

    with open(os.path.join(OUT_DIR, f'{pid.lower()}.html'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    generated += 1

    index_lines.append(
        f'<li><a href="projects/{pid.lower()}.html">{esc(pid)}: {esc(name)}</a> — {esc(client)} | {esc(category)}</li>')

index_lines.append('</ul>')
stats = {}
for proj in projects:
    cat = (proj.get('category', '') or 'N/A').split(',')[0].strip()
    stats[cat] = stats.get(cat, 0) + 1
for cat, count in sorted(stats.items(), key=lambda x: -x[1]):
    index_lines.append(f'<p>{esc(cat)}: {count}</p>')
index_lines.append('</body></html>')

with open(os.path.join(OUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(index_lines))

print(f"Generated {generated} project pages + index in {OUT_DIR}/")


# ---------------------------------------------------------------- sitemap.xml
def build_sitemap():
    """Keep every non-project URL exactly as authored; regenerate project URLs."""
    if os.path.exists(SITEMAP_PATH):
        old = open(SITEMAP_PATH, encoding='utf-8').read()
    else:
        old = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
               '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n</urlset>\n')

    blocks = re.findall(r'\s*<url>.*?</url>', old, re.S)
    kept, seen = [], set()
    for b in blocks:
        loc = re.search(r'<loc>(.*?)</loc>', b, re.S)
        if not loc:
            continue
        u = loc.group(1).strip()
        if '/projects/' in u:          # project entries are regenerated below
            continue
        if u in seen:
            continue
        seen.add(u)
        kept.append(b.rstrip())

    proj_blocks = []
    for proj in sorted(projects, key=lambda p: (p.get('sortDate') or ''), reverse=True):
        pid = proj.get('projectId', '')
        if not pid or not is_publishable(proj):
            continue
        lm = (proj.get('sortDate') or '')[:10] or TODAY
        proj_blocks.append(
            '  <url>\n'
            f'    <loc>{PROJECT_PAGE % pid.lower()}</loc>\n'
            f'    <lastmod>{lm}</lastmod>\n'
            '    <changefreq>monthly</changefreq>\n'
            '    <priority>0.6</priority>\n'
            '  </url>')

    head = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n')
    out = head + '\n' + '\n\n'.join(kept) + '\n\n' + '\n'.join(proj_blocks) + '\n\n</urlset>\n'
    with open(SITEMAP_PATH, 'w', encoding='utf-8') as f:
        f.write(out)
    return len(kept), len(proj_blocks)


n_static, n_proj = build_sitemap()
print(f"sitemap.xml: {n_static} static + {n_proj} project URLs")


# ---------------------------------------------------------------- llms.txt / llms-full.txt
def project_index_md(full=False):
    lines = [START, '']
    if full:
        lines.append(f'## Complete Project Index ({len(projects)} projects, auto-generated {TODAY})')
        lines.append('')
        for proj in sorted(projects, key=lambda p: (p.get('sortDate') or ''), reverse=True):
            pid = proj.get('projectId', '')
            if not is_publishable(proj):
                continue
            lines.append(f'### {proj.get("projectName", "")}')
            lines.append(f'- **Client:** {proj.get("client", "")}')
            lines.append(f'- **Category:** {(proj.get("category", "") or "N/A").split(",")[0].strip()}')
            if proj.get('venue'):
                lines.append(f'- **Venue:** {proj["venue"]}')
            if proj.get('scope'):
                lines.append(f'- **Scope:** {proj["scope"]}')
            lines.append(f'- **Page:** [{PROJECT_PAGE % pid.lower()}]({PROJECT_PAGE % pid.lower()})')
            lines.append('')
    else:
        lines.append(f'## Complete Project Index ({len(projects)} projects)')
        lines.append('')
        lines.append('Every project has a crawlable static page with full case study, scope and FAQ.')
        lines.append('')
        for proj in sorted(projects, key=lambda p: (p.get('sortDate') or ''), reverse=True):
            pid = proj.get('projectId', '')
            if not is_publishable(proj):
                continue
            cat = (proj.get('category', '') or 'N/A').split(',')[0].strip()
            lines.append(f'- [{proj.get("projectName", "")}]({PROJECT_PAGE % pid.lower()}) — {proj.get("client", "")} | {cat}')
        lines.append('')
    lines.append(END)
    return '\n'.join(lines)


def upsert_block(path, block):
    if os.path.exists(path):
        txt = open(path, encoding='utf-8').read()
    else:
        txt = ''
    if START in txt and END in txt:
        txt = re.sub(re.escape(START) + r'.*?' + re.escape(END), lambda m: block, txt, flags=re.S)
    else:
        if txt and not txt.endswith('\n'):
            txt += '\n'
        txt += '\n' + block + '\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(txt)


upsert_block(LLMS_PATH, project_index_md(full=False))
upsert_block(LLMS_FULL_PATH, project_index_md(full=True))
print("llms.txt + llms-full.txt: project index updated")


# ---------------------------------------------------------------- roving static fallback
def inject_roving():
    if not os.path.exists(ROVING_PATH):
        print("roving page not found - skipped")
        return 0
    txt = open(ROVING_PATH, encoding='utf-8').read()
    rov = [p for p in projects if is_roving(p) and is_publishable(p)]

    cards = [ROV_START, '<section id="roving-static-index" aria-label="Roving exhibition projects">',
             '<h2>Roving Exhibition Projects</h2>',
             f'<p>Firebean has delivered {len(rov)} roving exhibition projects across Hong Kong '
             'government bureaus, malls, schools and community venues.</p>', '<ul>']
    for proj in sorted(rov, key=lambda p: (p.get('sortDate') or ''), reverse=True):
        pid = proj.get('projectId', '')
        cards.append(
            f'<li><a href="{PROJECT_PAGE % pid.lower()}">{esc(proj.get("projectName", ""))}</a>'
            f' — {esc(proj.get("client", ""))}'
            + (f' ({esc(proj["venue"])})' if proj.get('venue') else '')
            + '</li>')
    cards.append('</ul>')

    item_list = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': 'Firebean Roving Exhibition Projects',
        'numberOfItems': len(rov),
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1,
             'url': PROJECT_PAGE % (p.get('projectId', '') or '').lower(),
             'name': p.get('projectName', '')}
            for i, p in enumerate(sorted(rov, key=lambda p: (p.get('sortDate') or ''), reverse=True))
        ],
    }
    cards.append(f'<script type="application/ld+json">{json.dumps(item_list, ensure_ascii=False)}</script>')
    cards.append('</section>')
    cards.append(ROV_END)
    block = '\n'.join(cards)

    if ROV_START in txt and ROV_END in txt:
        txt = re.sub(re.escape(ROV_START) + r'.*?' + re.escape(ROV_END), lambda m: block, txt, flags=re.S)
    else:
        m = re.search(r'(<main[^>]*id="roving-main"[^>]*>)', txt)
        if not m:
            print("roving-main container not found - skipped")
            return 0
        txt = txt[:m.end()] + '\n' + block + '\n' + txt[m.end():]

    with open(ROVING_PATH, 'w', encoding='utf-8') as f:
        f.write(txt)
    return len(rov)


n_rov = inject_roving()
print(f"roving-exhibitions/index.html: {n_rov} roving projects pre-rendered into #roving-main")
print("Done.")
