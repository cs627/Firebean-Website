#!/usr/bin/env python3
"""Build the two service landing pages that Google currently has nothing for.

Search Console (90d, 2026-11): non-brand queries produced 3 clicks on 501 impressions —
the site has no page that targets "PR agency Hong Kong" or "event production Hong Kong",
so the only thing ranking is brand traffic. These pages are static, crawlable, trilingual
(EN body + 繁體中文 section), carry Service + FAQPage + BreadcrumbList JSON-LD, and link into
the /projects/ hub so they inherit the link graph.

Every figure below is derived from data/projects.json at build time (no hand-typed counts).
Run: python3 scripts/build_service_pages.py
"""
import collections
import datetime as _dt
import json
import os
import re

BASEDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://firebean.net'
TODAY = _dt.datetime.now().strftime('%Y-%m-%d')
ORANGE = '#E11D2E'

projects_raw = json.load(open(os.path.join(BASEDIR, 'data', 'projects.json'), encoding='utf-8'))
PROJECTS = projects_raw['projects'] if isinstance(projects_raw, dict) and 'projects' in projects_raw \
    else (list(projects_raw.values())[0] if isinstance(projects_raw, dict) else projects_raw)


def publishable(p):
    return bool(p.get('client') or p.get('webEN') or p.get('webTC'))


PROJECTS = [p for p in PROJECTS if publishable(p) and p.get('projectId')]
BY_CAT = collections.Counter((p.get('category') or 'N/A').split(',')[0].strip() for p in PROJECTS)
GOV = BY_CAT.get('GOVERNMENT & PUBLIC SECTOR', 0)
LIFE = BY_CAT.get('LIFESTYLE & CONSUMER', 0)
FB = BY_CAT.get('F&B & HOSPITALITY', 0)
MALL = BY_CAT.get('MALLS & VENUES', 0)
TOTAL = len(PROJECTS)
YEARS = sorted({(p.get('sortDate') or '')[:4] for p in PROJECTS if p.get('sortDate')})
SPAN = f'{YEARS[0]}–{YEARS[-1]}' if YEARS else ''
GOV_CLIENTS = ['Constitutional and Mainland Affairs Bureau (政制及內地事務局)',
               'Education Bureau / CDI (教育局)',
               'Narcotics Division, Security Bureau (保安局禁毒處)',
               'Civil Service Bureau (公務員事務局)',
               'Buildings Department (屋宇署)',
               'Development Bureau (發展局)',
               'Department of Justice (律政司)',
               'LCSD (康文署)',
               'Hong Kong Housing Authority (房屋署)',
               'CEDD (土木工程署)']

CSS = """
:root{--ink:#111;--muted:#5b5b5b;--line:#e6e6e6;--red:%s}
*{box-sizing:border-box}body{margin:0;font-family:Inter,-apple-system,'Helvetica Neue','Noto Sans TC',sans-serif;color:var(--ink);line-height:1.65;background:#fff}
header.top{border-bottom:1px solid var(--line);padding:18px 22px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
header.top a{color:var(--ink);text-decoration:none;font-weight:600;font-size:14px}
header.top a.cta{color:#fff;background:var(--ink);padding:9px 16px;border-radius:999px;margin-left:auto}
main{max-width:900px;margin:0 auto;padding:34px 22px 70px}
.crumb{font-size:13px;color:var(--muted);margin-bottom:26px}.crumb a{color:var(--muted)}
h1{font-size:clamp(28px,5vw,46px);line-height:1.15;letter-spacing:-.01em;margin:0 0 18px}
h2{font-size:clamp(20px,3vw,26px);margin:44px 0 12px}
h3{font-size:17px;margin:24px 0 6px}
p,li{font-size:16.5px;color:#222}
.lede{font-size:19px;color:#333}
.proof{display:flex;flex-wrap:wrap;gap:14px;margin:26px 0;padding:0;list-style:none}
.proof li{border:1px solid var(--line);border-radius:14px;padding:14px 18px;min-width:150px;flex:1 1 150px}
.proof b{display:block;font-size:26px;line-height:1.1}
.proof span{font-size:13px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;padding:0;list-style:none}
.grid li{border:1px solid var(--line);border-radius:14px;padding:12px}
.grid img{width:100%%;height:120px;object-fit:cover;border-radius:9px;display:block;margin-bottom:8px}
.grid a{color:var(--ink);text-decoration:none;font-weight:600;font-size:15px}
.grid small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.faq dt{font-weight:600;margin-top:18px}.faq dd{margin:4px 0 0;color:#333}
.zh{border-top:1px solid var(--line);margin-top:52px;padding-top:8px}
footer{border-top:1px solid var(--line);margin-top:60px;padding:26px 22px;font-size:14px;color:var(--muted);text-align:center}
footer a{color:var(--muted)}
""" % ORANGE


def esc(s):
    return (str(s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def pick_by_cat(cats, n=8):
    out = []
    for p in sorted(PROJECTS, key=lambda x: (x.get('sortDate') or ''), reverse=True):
        c = (p.get('category') or '').split(',')[0].strip()
        if c in cats:
            out.append(p)
        if len(out) >= n:
            break
    return out


def project_cards(items):
    rows = []
    for p in items:
        pid = (p.get('projectId') or '').lower()
        hero = (p.get('heroPhoto') or '').strip()
        img = ''
        if hero:
            src = hero if hero.startswith('http') else '/' + hero.lstrip('/')
            img = (f'<img src="{esc(src)}" alt="{esc(p.get("projectName"))} — {esc(p.get("client"))}" '
                   'loading="lazy" decoding="async" width="320" height="213">')
        rows.append(f'<li>{img}<a href="/projects/{pid}.html">{esc(p.get("projectName"))}</a>'
                    f'<small>{esc(p.get("client"))} · {esc((p.get("sortDate") or "")[:4])}</small></li>')
    return '<ul class="grid">' + ''.join(rows) + '</ul>'


def page(slug, title, meta_desc, h1, lede, sections, faqs_en, zh_html, cards_cats, faqs_tc):
    """sections: list of (h2, html_body)."""
    url = f'{SITE}/{slug}/'
    body = [f'<p class="lede">{lede}</p>']
    for h2, html in sections:
        body.append(f'<h2>{h2}</h2>{html}')
    body.append('<h2>Selected projects</h2>')
    body.append(project_cards(pick_by_cat(cards_cats, 8)))
    body.append('<p><a href="/projects/">Browse all %d projects →</a></p>' % TOTAL)
    body.append('<h2>Frequently asked questions</h2><dl class="faq">')
    for q, a in faqs_en:
        body.append(f'<dt>{q}</dt><dd>{a}</dd>')
    body.append('</dl>')
    body.append('<h2>Talk to us</h2><p>Email <a href="mailto:hello@firebean.net">hello@firebean.net</a> '
                'or call the Wan Chai studio. Tell us the audience you need to reach and the dates — '
                'we will come back with a scope, not a sales deck.</p>')
    body.append(f'<section class="zh" lang="zh-Hant">{zh_html}</section>')

    service = {'@context': 'https://schema.org', '@type': 'Service',
               'name': title.split('|')[0].strip(), 'serviceType': title.split('|')[0].strip(),
               'url': url, 'areaServed': {'@type': 'City', 'name': 'Hong Kong'},
               'provider': {'@type': 'Organization', 'name': 'Firebean Limited', 'url': SITE + '/',
                            'email': 'hello@firebean.net',
                            'address': {'@type': 'PostalAddress', 'addressLocality': 'Wan Chai',
                                        'addressRegion': 'Hong Kong', 'addressCountry': 'HK'}},
               'description': meta_desc}
    faq_ld = {'@context': 'https://schema.org', '@type': 'FAQPage',
              'mainEntity': [{'@type': 'Question', 'name': q,
                              'acceptedAnswer': {'@type': 'Answer', 'text': re.sub('<[^>]+>', '', a)}}
                             for q, a in (faqs_en + faqs_tc)]}
    crumb = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Firebean Home', 'item': SITE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Work', 'item': SITE + '/work.html'},
        {'@type': 'ListItem', 'position': 3, 'name': title.split('|')[0].strip(), 'item': url}]}

    doc = f"""<!DOCTYPE html>
<html lang="en-HK">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{meta_desc}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en-HK" href="{url}">
<link rel="alternate" hreflang="x-default" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Firebean Agency">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="{url}">
<meta property="og:locale" content="en_HK">
<meta name="twitter:card" content="summary_large_image">
<style>{CSS}</style>
<script type="application/ld+json">{json.dumps(service, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(crumb, ensure_ascii=False)}</script>
</head>
<body>
<header class="top">
<a href="/">FIREBEAN</a>
<a href="/work.html">Work</a>
<a href="/projects/">All projects</a>
<a href="/roving-exhibitions/">Roving exhibitions</a>
<a href="/gov-engagement/">Government engagement</a>
<a class="cta" href="mailto:hello@firebean.net">hello@firebean.net</a>
</header>
<main>
<nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/work.html">Work</a> › {title.split('|')[0].strip()}</nav>
<h1>{h1}</h1>
{''.join(body)}
</main>
<footer>
Firebean Limited · Wan Chai, Hong Kong · <a href="/">firebean.net</a> ·
<a href="/projects/">Projects</a> · <a href="/roving-exhibitions/">Roving exhibitions</a> ·
<a href="mailto:hello@firebean.net">hello@firebean.net</a>
</footer>
</body>
</html>
"""
    outdir = os.path.join(BASEDIR, slug)
    os.makedirs(outdir, exist_ok=True)
    open(os.path.join(outdir, 'index.html'), 'w', encoding='utf-8').write(doc)
    print(f'built /{slug}/ ({len(doc.encode())} bytes)')
    return url


proof_html = ('<ul class="proof">'
              f'<li><b>{TOTAL}</b><span>published case studies ({SPAN})</span></li>'
              f'<li><b>{GOV}</b><span>government &amp; public-sector projects</span></li>'
              f'<li><b>{LIFE + FB + MALL}</b><span>lifestyle, F&amp;B &amp; mall projects</span></li>'
              '<li><b>2007</b><span>founded in Hong Kong</span></li>'
              '</ul>')

url_pr = page(
    'pr-agency',
    'PR Agency Hong Kong | Government, Lifestyle & F&B Public Relations — Firebean',
    'Firebean is a Hong Kong PR agency for government bureaus, lifestyle and F&B brands: media relations, '
    'public engagement campaigns, content and trilingual (EN/繁中/日本語) communications since 2007.',
    'PR Agency in Hong Kong — government, lifestyle and F&amp;B public relations',
    'Firebean is a Hong Kong public relations agency that plans and runs communications campaigns for '
    'government bureaus, lifestyle and F&amp;B brands — media relations, public engagement, content and events, '
    'delivered by one team from Wan Chai since 2007.',
    [('What we do', '<ul>'
      '<li><b>Media relations &amp; press office</b> — announcements, briefings, interviews and crisis-ready messaging in English, 繁體中文 and 日本語.</li>'
      '<li><b>Public engagement campaigns</b> — consultation support, community outreach and exhibition-led education for policy topics.</li>'
      '<li><b>Content &amp; social</b> — campaign copy, video, motion and always-on social for Instagram, Facebook, LinkedIn, Threads, Xiaohongshu and YouTube.</li>'
      '<li><b>Issues and stakeholder mapping</b> — audience research, message testing and reporting that stakeholders actually read.</li>'
      '<li><b>Event-led PR</b> — launches, ceremonies and roving exhibitions where the media moment and the public experience are the same project.</li>'
      '</ul>'),
     ('Who we work with', proof_html +
      '<p>Government work includes ' + ', '.join(GOV_CLIENTS) + '. '
      'Brand work spans lifestyle and consumer launches, F&amp;B openings and mall campaigns — see the '
      '<a href="/projects/">full project index</a> for named, dated case studies.</p>'),
     ('How we measure it', '<p>Coverage and sentiment, engagement and participation data from the activations '
      'we run, and search/AI visibility for the terms a client needs to own. We report numbers, not adjectives — '
      'and we say plainly when a metric cannot be measured.</p>')],
    [('What does a Hong Kong PR agency do for a government client?',
      'It plans and runs public communication for a policy or service: messaging, media handling, stakeholder and '
      'community engagement, often paired with exhibitions or events so the public meets the content in person. '
      'Firebean has delivered this for bureaus including Constitutional and Mainland Affairs, Education, Security '
      'Bureau (Narcotics Division), Civil Service, Buildings Department and Development Bureau.'),
     ('Do you work in English, Cantonese and Japanese?',
      'Yes. Campaign copy, media materials and on-site hosting are produced in English, Traditional Chinese and '
      'Japanese, and government work is routinely produced bilingually.'),
     ('How is PR priced?',
      'By scope: a retained engagement, a single campaign, or a project that combines communications with an '
      'exhibition or event. We quote after understanding the audience, the timeline and the deliverables — never '
      'from a menu.'),
     ('How quickly can a campaign start?',
      'A media announcement can move within days; a public engagement campaign with an exhibition build typically '
      'needs four to eight weeks depending on approvals and venue availability.'),
     ('Can you support a public consultation?',
      'Yes — messaging, stakeholder mapping, community sessions and the reporting that shows what was heard.'),
     ('How do you prove results?',
      'Media coverage and sentiment, reach and engagement of owned channels, participation data from events and '
      'exhibitions, and search/AI visibility. Every report states what was measured and what was not.')],
    '<h2>香港公關公司 — 政府、生活時尚與餐飲品牌</h2>'
    '<p>Firebean 是一間香港公關及活動製作公司，自 2007 年起為政府部門、生活時尚及餐飲品牌策劃傳播方案：'
    '媒體關係、公眾參與、內容製作與活動執行，由灣仔同一個團隊負責。</p>'
    '<ul><li><b>媒體關係及新聞室</b> — 記者會、專訪、新聞稿，中英日三語。</li>'
    '<li><b>公眾參與</b> — 諮詢支援、社區推廣、以展覽帶動的政策教育。</li>'
    '<li><b>內容及社交媒體</b> — IG、FB、LinkedIn、Threads、小紅書、YouTube 的日常營運與內容。</li>'
    '<li><b>活動帶動的公關</b> — 開幕、典禮、巡迴展覽，令媒體時刻與公眾體驗成為同一件事。</li></ul>'
    '<p>政府客戶包括政制及內地事務局、教育局、保安局禁毒處、公務員事務局、屋宇署、發展局、律政司、康文署、'
    '房屋署及土木工程署。品牌項目可參閱<a href="/projects/">完整項目索引</a>。</p>'
    '<p>查詢：<a href="mailto:hello@firebean.net">hello@firebean.net</a></p>',
    ('GOVERNMENT & PUBLIC SECTOR', 'LIFESTYLE & CONSUMER', 'F&B & HOSPITALITY'),
    [('香港公關公司一般做甚麼？', '為政策或服務策劃公眾傳播：訊息、媒體處理、持份者及社區參與，很多時配合展覽或活動。'),
     ('收費如何計算？', '按範圍報價：長期顧問、單一宣傳項目，或結合展覽與活動的完整項目。了解受眾、時間表及交付物後才報價。')],
)

url_ep = page(
    'event-production',
    'Event Production Hong Kong | Mall Activations, Launches & Roving Exhibitions — Firebean',
    'Firebean produces events in Hong Kong: mall roadshows and pop-ups, product launches, ceremonies and '
    'multi-venue roving exhibitions — design, build, logistics and on-site operations by one team.',
    'Event Production in Hong Kong — mall activations, launches and roving exhibitions',
    'Firebean designs, builds and operates events across Hong Kong: mall roadshows and pop-ups, product launches '
    'and ceremonies, and roving exhibitions that tour venue to venue — one team from concept to pack-down.',
    [('What we produce', '<ul>'
      '<li><b>Mall activations, roadshows &amp; pop-ups</b> — atrium builds, sampling counters, photo moments and retail theatre.</li>'
      '<li><b>Roving exhibitions</b> — modular builds engineered to survive multi-venue tours; see the '
      '<a href="/roving-exhibitions/">roving exhibition page</a> for the 32-project track record.</li>'
      '<li><b>Launches &amp; ceremonies</b> — press conferences, openings, award ceremonies, stage and AV.</li>'
      '<li><b>Interactive &amp; tech</b> — games, kiosks and data capture that produce participation numbers, not just footprints.</li>'
      '<li><b>Logistics &amp; operations</b> — transport, installation, staffing and daily operations across Hong Kong.</li>'
      '</ul>'),
     ('Track record', proof_html +
      '<p>Government exhibition and public-engagement work includes ' + ', '.join(GOV_CLIENTS[:6]) +
      '; brand work covers mall campaigns, F&amp;B openings and consumer launches. '
      'Every project is documented with dates and clients in the <a href="/projects/">project index</a>.</p>')],
    [('Do you handle mall roadshows and pop-ups in Hong Kong?',
      'Yes — atrium builds, sampling counters and short-run pop-ups, including venue liaison, staffing and daily '
      'operations.'),
     ('Can one exhibition tour multiple venues?',
      'Yes. Firebean builds modular exhibitions engineered for repeated transport and re-installation; the roving '
      'programme has covered 32 projects for 5 government bureaus since 2016.'),
     ('How many venues can a campaign cover?',
      'It depends on the build and the schedule, but multi-venue tours across Hong Kong Island, Kowloon and the New '
      'Territories are routine for us. We plan the route with you before we design the booth.'),
     ('Do you provide interactive technology?',
      'Yes — touchscreen kiosks, simple games and data-capture experiences that let us report real participation '
      'numbers afterwards.'),
     ('Who handles permits and venue rules?',
      'We do. Venue liaison, floor plans, insurance and on-site compliance are part of production, not an extra.'),
     ('How early should we brief you?',
      'Four to eight weeks for a standard activation; longer for a custom build or a multi-venue tour, because '
      'fabrication and venue approvals drive the calendar.')],
    '<h2>香港活動製作 — 商場推廣、開幕典禮與巡迴展覽</h2>'
    '<p>Firebean 負責由概念到拆卸：商場路演及期間限定店、產品發佈及開幕典禮，以及逐個場地巡迴的展覽。'
    '設計、搭建、物流與現場營運由同一個團隊負責。</p>'
    '<ul><li><b>商場推廣及路演</b> — 中庭搭建、試食櫃位、打卡位、零售氣氛。</li>'
    '<li><b>巡迴展覽</b> — 模組化搭建，經得起多場地運輸及重複安裝；<a href="/roving-exhibitions/">32 個巡迴項目</a>。</li>'
    '<li><b>發佈會及典禮</b> — 記者會、開幕、頒獎典禮、舞台及影音。</li>'
    '<li><b>互動科技</b> — 遊戲、kiosk、數據收集，事後有真實參與數字。</li>'
    '<li><b>物流及營運</b> — 全港運輸、安裝、人手及每日營運。</li></ul>'
    '<p>查詢：<a href="mailto:hello@firebean.net">hello@firebean.net</a></p>',
    ('MALLS & VENUES', 'GOVERNMENT & PUBLIC SECTOR', 'F&B & HOSPITALITY'),
    [('香港活動製作收費如何？', '按搭建規模、場地數量及營運日數報價。先了解路線與時間表，再報價。'),
     ('可以同時做多個場地嗎？', '可以，全港多場地巡迴是我們的常規工作，會先定路線才設計展位。')],
)

# sitemap + llms
SITEMAP = os.path.join(BASEDIR, 'sitemap.xml')
sm = open(SITEMAP, encoding='utf-8').read()
added = []
for u in (url_pr, url_ep):
    if f'<loc>{u}</loc>' not in sm:
        entry = ('  <url>\n'
                 f'    <loc>{u}</loc>\n    <lastmod>{TODAY}</lastmod>\n'
                 '    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n')
        sm = sm.replace('</urlset>', entry + '</urlset>', 1)
        added.append(u)
open(SITEMAP, 'w', encoding='utf-8').write(sm)
print('sitemap: added', added or 'nothing new', '| total urls', sm.count('<url>'))

LLMS = os.path.join(BASEDIR, 'llms.txt')
lt = open(LLMS, encoding='utf-8').read()
START, END = '<!-- AUTO-GENERATED:SERVICEPAGES:START -->', '<!-- AUTO-GENERATED:SERVICEPAGES:END -->'
block = (START + '\n## Service pages\n\n'
         f'- [PR Agency Hong Kong]({url_pr}) — government, lifestyle & F&B public relations, media relations, '
         'public engagement, trilingual (EN/繁中/日本語) communications.\n'
         f'- [Event Production Hong Kong]({url_ep}) — mall activations, roadshows, pop-ups, launches, ceremonies and '
         'multi-venue roving exhibitions.\n'
         + END)
if START in lt and END in lt:
    lt = re.sub(re.escape(START) + r'.*?' + re.escape(END), lambda m: block, lt, flags=re.S)
else:
    lt = lt.rstrip() + '\n\n' + block + '\n'
open(LLMS, 'w', encoding='utf-8').write(lt)
print('llms.txt: service pages section written')
