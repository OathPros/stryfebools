#!/usr/bin/env python3
"""Optional: copy the documented public-domain/CC0 artwork locally.

This site uses Wikimedia Commons-hosted image URLs by default. Run this script
from the repository root to download the images and replace remote references
in index.html, assets/site.css and assets/site.js with locally hosted files.
It does not generate, synthesize, or modify artwork.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import json

ROOT = Path(__file__).resolve().parent
SOURCES = json.loads((ROOT / 'art-sources.json').read_text(encoding='utf-8'))
DEST = ROOT / 'assets'
DEST.mkdir(exist_ok=True)

for index, item in enumerate(SOURCES, 1):
    name = f"sourced-scene-{index}.jpg"
    target = DEST / name
    url = item['image']
    if not target.exists():
        print(f"Downloading {index}/4: {item['artist']} — {item['work']}")
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; StryfeboolsArts/1.0; Wikimedia Commons art download)"})
        with urlopen(req, timeout=45) as response:
            content_type = response.headers.get('Content-Type', '').lower()
            if not content_type.startswith('image/'):
                raise RuntimeError(f"Unexpected content type for {name}: {content_type}")
            data = response.read()
            if len(data) < 1000:
                raise RuntimeError(f"Downloaded file looks too small: {name}")
            target.write_bytes(data)
    else:
        print(f"Already exists: {target.name}")

    for filepath in [ROOT / 'index.html', DEST / 'site.css', DEST / 'site.js']:
        text = filepath.read_text(encoding='utf-8')
        replacement = f'assets/{name}' if filepath.suffix == '.html' else (name if filepath.suffix == '.css' else f'assets/{name}')
        new_text = text.replace(url, replacement)
        if new_text != text:
            filepath.write_text(new_text, encoding='utf-8')

print('Done. Artworks are local; original sources and licenses remain in art-sources.json.')
