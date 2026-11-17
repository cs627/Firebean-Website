#!/usr/bin/env python3
"""Generate one real profile page per project: /profile/<id>.html

WHY THIS EXISTS
---------------
`profile.html?id=<id>` is the profile page Dickson shows clients, but its <title>
and Open Graph tags are written by JavaScript after it reads the query string.
A browser runs that JS; LinkedIn's preview scraper does not, so a post linking
there renders a bare card with the generic Firebean logo.

The earlier stopgap was a text-only page at `/projects/<id>.html`. It fixed the
preview card but it was a DIFFERENT page from the profile — no design, no gallery,
none of the interactive profile — which is exactly what Dickson reported when he
clicked a post link and saw an unstyled document.

This generator emits a copy of `profile.html` per project into `profile/`:

  * the head carries that project's real <title>, description, og:* and twitter:*
    tags in STATIC HTML, so every crawler sees them;
  * `?id=` is pre-seeded, so the page opens directly on that project;
  * asset paths are rewritten to root-absolute, because the copy lives one
    directory down (`/profile/`) and would otherwise look for `/profile/src/...`.

The result is the same app, the same design, the same interactions — a URL that
both a human and a preview scraper handle correctly.

Run after editing profile.html or projects.json:
    python3 scripts/pre_render_profiles.py
"""
import html
import json
import os
import re

BASEDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASEDIR, 'profile.html')
OUT_DIR = os.path.join(BASEDIR, 'profile')
DATA = os.path.join(BASEDIR, 'data', 'projects.json')
SITE = 'https://firebean.net'


def load_projects():
    with open(DATA, encoding='utf-8') as f:
        raw = json.load(f)
    projects = raw.get('projects', raw) if isinstance(raw, dict) else raw
    return [p for p in projects if (p.get('projectId') or p.get('id'))]


def esc(s):
    return html.escape(str(s or ''), quote=True)


def build_page(tpl, proj):
    pid = (proj.get('projectId') or proj.get('id') or '').lower()
    name = proj.get('projectName') or proj.get('project') or pid.upper()
    client = proj.get('client') or ''
    venue = proj.get('venue') or ''
    hero = proj.get('heroPhoto') or ''

    title = f'{name} | Firebean Agency'
    desc = (f'{name} — {client}' + (f', {venue}' if venue else '') +
            ' | Firebean Agency Hong Kong') if client else f'{name} | Firebean Agency Hong Kong'
    image = (hero if hero.startswith('http') else f'{SITE}/{hero.lstrip("/")}') if hero \
        else f'{SITE}/data/images/firebean-logo-w1000.webp'
    url = f'{SITE}/profile/{pid}.html'

    page = tpl

    # --- head: bake the project-specific metadata into static HTML ------------
    page = re.sub(r'<title>.*?</title>', f'<title>{esc(title)}</title>', page,
                  count=1, flags=re.S)
    page = re.sub(r'(<meta\s+name="description"\s+content=")[^"]*(")',
                  lambda m: m.group(1) + esc(desc) + m.group(2), page, count=1)

    def set_meta(page, key, value):
        """Replace content of <meta property="key"> or <meta name="key">."""
        pat = (r'(<meta\s+(?:property|name)="' + re.escape(key) +
               r'"\s+content=")[^"]*(")')
        new, n = re.subn(pat, lambda m: m.group(1) + esc(value) + m.group(2),
                         page, count=1)
        return new, n

    for key, value in (
        ('og:url', url), ('og:title', title), ('og:description', desc),
        ('og:image', image),
        ('twitter:url', url), ('twitter:title', title),
        ('twitter:description', desc), ('twitter:image', image),
    ):
        page, _ = set_meta(page, key, value)

    page = re.sub(r'(<link\s+rel="canonical"\s+href=")[^"]*(")',
                  lambda m: m.group(1) + url + m.group(2), page, count=1)

    # --- pre-seed the project id so no query string is needed ------------------
    # The app does: var params = new URLSearchParams(...); var projectId = params.get('id');
    # Then falls back to projects[0] when it is null — which would silently show the
    # WRONG project, so the seed has to land before that fallback.
    page, n = re.subn(r"(var\s+projectId\s*=\s*params\.get\('id'\);)",
                      r"\1 if (!projectId) projectId = '" + pid + "';",
                      page, count=1)
    if n != 1:
        raise RuntimeError('could not inject the project-id seed — profile.html changed?')

    # --- root-absolute asset paths (the copy lives in /profile/) --------------
    for rel in ('src/', 'data/'):
        page = page.replace(f'src="{rel}', f'src="/{rel}')
    page = page.replace('href="projects/', 'href="/projects/')
    # Navigational links too: from /profile/ a bare "index.html" resolves to
    # /profile/index.html and 404s, taking the site menu with it.
    page = page.replace('href="index.html', 'href="/index.html')
    # hreflang alternates must point at THIS page, not the generic profile.
    page = re.sub(r'(<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href=")[^"]*(")',
                  lambda m: m.group(1) + url + m.group(2), page)

    # Guard: nothing may still point at a path that breaks from /profile/.
    for bad in ('src="src/', 'src="data/', 'href="projects/', 'href="index.html'):
        if bad in page:
            raise RuntimeError(f'unrewritten relative path survived: {bad}')

    return pid, page


def main():
    tpl = open(SRC, encoding='utf-8').read()
    os.makedirs(OUT_DIR, exist_ok=True)
    projects = load_projects()
    index_items = []
    for proj in projects:
        pid, page = build_page(tpl, proj)
        with open(os.path.join(OUT_DIR, f'{pid}.html'), 'w', encoding='utf-8') as f:
            f.write(page)
        index_items.append((pid, proj.get('projectName') or pid.upper(),
                            proj.get('client') or ''))
    print(f'generated {len(index_items)} profile pages into {OUT_DIR}')


if __name__ == '__main__':
    main()
