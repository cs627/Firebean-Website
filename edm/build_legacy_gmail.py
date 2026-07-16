#!/usr/bin/env python3
"""Generate legacy-email-safe, table-based Gmail EDM files from the web EDM files.

The web files (edm_00X.html) are already ~90% legacy-safe table layouts. This
script applies the small set of Gmail/legacy-client transformations required to
make edm_00X_gmail.html render correctly in Outlook Express, Apple Mail (OS X),
Thunderbird/Mozilla and Yahoo Mail:

  1. WebP -> committed JPEG (GitHub Pages) for the 6 issues using firebean.net
     .webp images. Legacy clients cannot render WebP.
  2. Strip `object-fit` (unsupported; harmless to drop, sizing kept via width/height).
  3. Replace the hero `linear-gradient` overlay with a solid dark block
     (readable fallback beats a broken gradient in legacy clients).
  4. Convert the magazine-wrap `<img align="right" style="float:right">` into a
     nested `<table align="right" width="250">` (most legacy-safe wrap).

Run from the `edm/` directory:  python3 build_legacy_gmail.py
"""
import os
import re

PAGES = "https://firebean.net/edm/email-img/"
WEBP_RE = re.compile(r"https://firebean\.net/data/images/([^\"\'\s)]+)\.webp")
GRADIENT_RE = re.compile(r"background:linear-gradient[^;]*;background-color:rgba[^;]*;")
FLOAT_IMG_RE = re.compile(r'<img align="right"(?P<rest>[^>]*?)/>')


def wrap_float_img(m):
    rest = m.group("rest")
    margin_match = re.search(r"margin:([^;]*);", rest)
    margin = margin_match.group(1) if margin_match else "4px 0 12px 18px"
    img = "<img" + rest + "/>"
    img = img.replace("float:right;", "")
    img = re.sub(r"margin:[^;]*;", "", img)
    return (
        '<table align="right" border="0" cellpadding="0" cellspacing="0" width="250" '
        f'style="margin:{margin};"><tr>'
        '<td style="padding:0;font-size:0;line-height:0;">'
        f"{img}</td></tr></table>"
    )


def transform(html):
    # 1. WebP -> committed JPEG on GitHub Pages
    html = WEBP_RE.sub(lambda m: PAGES + m.group(1) + ".jpg", html)
    # 2. object-fit is unsupported in legacy clients
    html = html.replace("object-fit:contain;", "").replace("object-fit:cover;", "")
    # 3. hero gradient overlay -> solid dark block (readable fallback)
    html = GRADIENT_RE.sub("background-color:#111111;", html)
    # 4. floated magazine-wrap image -> nested align="right" table
    html = FLOAT_IMG_RE.sub(wrap_float_img, html)
    return html


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    # Only process edm_002.html for now
    n = 2 # Process Issue 002
    src = os.path.join(here, f"edm_{n:03d}.html")
    dst = os.path.join(here, f"edm_{n:03d}_gmail.html")
    with open(src, encoding="utf-8") as f:
        html = f.read()
    out = transform(html)
    with open(dst, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"generated {os.path.basename(dst)}")


if __name__ == "__main__":
    main()
