#!/usr/bin/env python3
"""Shrink Firebean's committed WebP assets without touching layout or markup.

Why: the homepage was transferring 13.8 MB / 155 requests because every project card
loaded its full-size hero (average 126 KB, largest 613 KB) and only 2 of 37 <img> tags
were lazy. Search Console can't see this, but Core Web Vitals and mobile bounces do.

Two passes, both idempotent (safe to re-run):
  1. re-encode anything over THRESHOLD bytes at QUALITY, capped at MAX_SIDE px;
  2. write a `-800.webp` variant next to every project hero so the card grid can use
     srcset and browsers stop downloading 1200px images for a 400px card.

Run: python3 scripts/optimize_images.py [--dry-run]
"""
import glob
import os
import sys

from PIL import Image

BASEDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(BASEDIR, 'data', 'images')
THRESHOLD = 150 * 1024          # only touch files bigger than this
QUALITY = 80                    # visually safe for photographic WebP
MAX_SIDE = 1920
VARIANT_WIDTH = 800
DRY = '--dry-run' in sys.argv

saved_total = 0
reencoded = 0
variants = 0

for path in sorted(glob.glob(os.path.join(IMG_DIR, '*.webp'))):
    size = os.path.getsize(path)
    if size > THRESHOLD:
        try:
            with Image.open(path) as im:
                im.load()
                w, h = im.size
                if max(w, h) > MAX_SIDE:
                    scale = MAX_SIDE / max(w, h)
                    im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
                if im.mode in ('RGBA', 'LA', 'P'):
                    im = im.convert('RGBA')
                else:
                    im = im.convert('RGB')
                if not DRY:
                    im.save(path, 'WEBP', quality=QUALITY, method=6)
                new = os.path.getsize(path) if not DRY else size // 2
                if new < size:
                    saved_total += size - new
                    reencoded += 1
        except Exception as e:
            print('skip', os.path.basename(path), e)

# 800px variants for the project hero images only — those are what the card grid renders,
# so a srcset there stops browsers pulling 1200px files for a 400px card. Doing it for all
# 2197 assets would add hundreds of MB to the repo for no benefit.
import json
proj_raw = json.load(open(os.path.join(BASEDIR, 'data', 'projects.json'), encoding='utf-8'))
proj_list = proj_raw['projects'] if isinstance(proj_raw, dict) and 'projects' in proj_raw \
    else (list(proj_raw.values())[0] if isinstance(proj_raw, dict) else proj_raw)
heroes = {(p.get('heroPhoto') or '').strip() for p in proj_list if p.get('heroPhoto')}
hero_paths = [os.path.join(BASEDIR, h) for h in heroes if h.startswith('data/images/')]

for path in sorted(hero_paths):
    if not os.path.exists(path):
        continue
    variant = path.replace('.webp', '-800.webp')
    if os.path.exists(variant):
        continue
    try:
        with Image.open(path) as im:
            im.load()
            w, h = im.size
            if w <= VARIANT_WIDTH:
                continue
            scale = VARIANT_WIDTH / w
            small = im.resize((VARIANT_WIDTH, max(1, round(h * scale))), Image.LANCZOS)
            if small.mode not in ('RGBA', 'RGB'):
                small = small.convert('RGBA' if 'A' in small.mode else 'RGB')
            if not DRY:
                small.save(variant, 'WEBP', quality=78, method=6)
            variants += 1
    except Exception:
        pass

print(f're-encoded {reencoded} files, saved {saved_total / 1e6:.1f} MB; new variants {variants}'
      + ('  (dry run)' if DRY else ''))
