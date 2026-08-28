#!/usr/bin/env python3
"""
Pre-render static project pages from projects.json for AI crawler visibility.
Generates /projects/<projectId>.html with hard-coded JSON-LD schema + full text content.
Run: python3 scripts/pre_render_projects.py
"""
import json, os, sys

BASEDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASEDIR, 'data', 'projects.json')
OUT_DIR = os.path.join(BASEDIR, 'projects')
CANONICAL_BASE = 'https://firebean.net/profile.html?id='

os.makedirs(OUT_DIR, exist_ok=True)

with open(JSON_PATH) as f:
    d = json.load(f)

projects = d.get('projects', [])
print(f"Processing {len(projects)} projects...")

# Generate index page listing all projects
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

    # Build individual project page
    lines = []
    lines.append('<!DOCTYPE html>')
    lines.append('<html lang="en">')
    lines.append('<head>')
    lines.append(f'<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">')
    lines.append(f'<title>{name} — {client} | Firebean Agency Hong Kong</title>')
    desc = f'Firebean project: {name} for {client}. Category: {category}. {scope[:150]}'
    lines.append(f'<meta name="description" content="{desc}">')
    lines.append('<meta name="robots" content="index,follow">')
    lines.append(f'<link rel="canonical" href="{CANONICAL_BASE}{pid}">')

    # Hard-coded CreativeWork JSON-LD
    creative_work = {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        'identifier': pid,
        'name': name,
        'author': {
            '@type': 'Organization',
            'name': 'Firebean Limited',
            'url': 'https://firebean.net'
        },
        'provider': {
            '@type': 'Organization',
            'name': category
        },
        'dateCreated': sort_date,
        'inLanguage': ['en', 'zh-HK', 'ja']
    }
    if scope:
        creative_work['description'] = scope
    if venue:
        creative_work['locationCreated'] = {'@type': 'Place', 'name': venue}
    lines.append(f'<script type="application/ld+json">{json.dumps(creative_work, ensure_ascii=False)}</script>')

    # FAQPage JSON-LD
    faq_en = proj.get('faqEN', '')
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
                            'acceptedAnswer': {
                                '@type': 'Answer',
                                'text': faq['a'][:500]
                            }
                        })
                if main_entity:
                    faq_page = {
                        '@context': 'https://schema.org',
                        '@type': 'FAQPage',
                        'mainEntity': main_entity
                    }
                    lines.append(f'<script type="application/ld+json">{json.dumps(faq_page, ensure_ascii=False)}</script>')
        except:
            pass

    lines.append('</head>')
    lines.append('<body>')
    lines.append('<article>')
    lines.append(f'<h1>{name}</h1>')
    lines.append(f'<p><strong>Client:</strong> {client}</p>')
    lines.append(f'<p><strong>Project ID:</strong> {pid}</p>')
    lines.append(f'<p><strong>Category:</strong> {category}</p>')
    lines.append(f'<p><strong>Date:</strong> {sort_date}</p>')
    if venue:
        lines.append(f'<p><strong>Venue:</strong> {venue}</p>')
    lines.append(f'<p><strong>Scope:</strong> {scope}</p>')

    # Full text content (English + Chinese)
    if web_en:
        lines.append('<section><h2>English</h2>')
        lines.append(web_en)
        lines.append('</section>')
    if web_tc:
        lines.append('<section><h2>繁體中文</h2>')
        lines.append(web_tc)
        lines.append('</section>')

    faq_html = ''
    if faq_en:
        try:
            faqs = json.loads(faq_en) if isinstance(faq_en, str) else faq_en
            if faqs and isinstance(faqs, list):
                faq_html = '<section><h2>FAQ</h2>'
                for faq in faqs:
                    if faq.get('q') and faq.get('a'):
                        faq_html += f'<h3>{faq["q"]}</h3><p>{faq["a"]}</p>'
                faq_html += '</section>'
        except:
            pass

    if faq_html:
        lines.append(faq_html)

    lines.append(f'<p><a href="{CANONICAL_BASE}{pid}">View full profile with images on firebean.net</a></p>')
    lines.append('</article>')
    lines.append('</body>')
    lines.append('</html>')

    out_path = os.path.join(OUT_DIR, f'{pid.lower()}.html')
    with open(out_path, 'w') as f:
        f.write('\n'.join(lines))
    generated += 1

    # Add to index
    index_lines.append(f'<li><a href="projects/{pid.lower()}.html">{pid}: {name}</a> — {client} | {category}</li>')

index_lines.append('</ul>')
stats = {}
for proj in projects:
    cat = (proj.get('category', '') or 'N/A').split(',')[0].strip()
    stats[cat] = stats.get(cat, 0) + 1
for cat, count in sorted(stats.items(), key=lambda x: -x[1]):
    index_lines.append(f'<p>{cat}: {count}</p>')
index_lines.append('</body></html>')

with open(os.path.join(OUT_DIR, 'index.html'), 'w') as f:
    f.write('\n'.join(index_lines))

print(f"Generated {generated} project pages + index in {OUT_DIR}/")
print("Done.")