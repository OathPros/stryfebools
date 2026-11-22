# STRYFEBOOLS — existing artists' artwork edition

A cinematic, interactive music homepage prototype. The artwork was **not AI-generated**. Each scene uses an existing artwork by a named human artist. The smoke, cursor smudge, and image transitions are procedural WebGL effects applied to those images.

## Included art

| Scene | Artist | Original work | Licensing |
|---|---|---|---|
| Cinder City | John Martin | *The Destruction of Sodom and Gomorrah* (1852) | Public Domain Mark 1.0 |
| Fallen Span | J. M. W. Turner | *The Burning of the Houses of Lords and Commons, October 16, 1834* (c. 1835) | Public Domain Mark 1.0 |
| The Witness | Odilon Redon | *The Vague Glimmer of a Head Suspended in Space* (1891) | CC0 1.0, Metropolitan Museum of Art |
| Blackout | Philip James de Loutherbourg | *Coalbrookdale by Night* (1801) | Public Domain Mark 1.0 |

**Source pages, direct image URLs and attribution are recorded in `art-sources.json`**. The full credits also appear on the website. The webpage uses public-domain reproduction imagery provided on Wikimedia Commons.

## Important: hosted images versus local copies

The site **currently loads the artwork directly from Wikimedia Commons**. This means an internet connection is required. The project ZIP does not contain any artwork image files; it only contains references and credits. 

To obtain an independent website that doesn't depend on Wikimedia serving the images, run this command on your computer from the project root:

```bash
python download_artworks.py
```

The script downloads the original sourced files (without editing them) and replaces the external image URLs with local asset paths. All artwork credits and source links are retained. You should review Wikimedia Commons' reuse documentation for your jurisdiction and respect any relevant rights notices before publication.

## Launch

This is a plain HTML, CSS, JavaScript project with no build process.

For local testing:

```bash
python -m http.server 8080
```

Open `http://localhost:8080` in a browser.

## GitHub Pages

1. Upload `index.html`, `assets/`, `art-sources.json` and the remaining source files to a GitHub repo.
2. Visit **Settings → Pages**, choose **Deploy from a branch**, `main` and `/ (root)`.
3. The homepage will load from your repo's Pages URL.
4. For reliability, run `download_artworks.py` and commit the downloaded artwork files before publishing. This prevents Wikimedia URL/CORS/dependency issues.

## Implementation notes

- WebGL is used for animated turbulence, trailing pointer distortion, simulated smoke, an accumulation mask and organic reveal/bleed between scenes.
- The site's scripted Rorschach effect is mathematical image distortion, not AI-generated artwork.
- On unsupported devices, the site shows a static-image fallback with manual scene switching.
- The artist biographies and music track names have **not** been invented. The listening section points to `https://soundcloud.com/stryfebools`.
- The portrait Redon artwork is positioned and mirrored **in the animated hero presentation**, while the artwork credit/source link preserves the original's identity and source file.
- If the artwork images are blocked by an image host or CORS policy, use the local download script to make the site self-contained.
