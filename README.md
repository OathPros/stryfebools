# STRYFEBOOLS

Artist website with a cinematic homepage, and embedded SoundCloud and Spotify players. The site is static HTML, CSS, and JavaScript.

## Develop locally

Run `python3 -m http.server 8080` from the checkout, then open `http://localhost:8080`. A local HTTP server gives the artwork and shader textures the same origin.

The hero uses local, responsive WebP images. With WebGL and motion enabled, television static starts immediately and builds automatically on desktop and mobile. The artwork changes after about 5.5 seconds while the hero is visible. Hovering speeds up the buildup. Pressing or dragging concentrates static under the pointer or fingertip. Vertical swipes scroll the page. The browser’s reduced-motion preference leaves the opening image still.

## Update the content

- **Artwork:** Add an entry to the `#hero-scenes` template in `index.html` with `data-full` and `data-small` image paths. The sequence follows the order of the entries. The hero uses the 16:9 desktop and 4:5 portrait editions in `STRYFE_assets`. Keep the opening picture in sync with the first entry and record provenance in `STRYFE_assets/SOURCES_AND_RIGHTS.json`. Optional `data-focus-x` sets the horizontal crop focus from 0 at the left to 1 at the right. Optional `data-focus-y` sets the vertical crop focus from 0 at the bottom to 1 at the top. Use `data-zoom` for an optional hero crop.
- **Music:** The latest-track list in `index.html` contains a native SoundCloud player and a direct link for each track. When updating it, use the artist’s [SoundCloud tracks page](https://soundcloud.com/stryfebools/tracks) for the release order and [SoundCloud oEmbed](https://soundcloud.com/oembed) for the track IDs. Keep autoplay off. Update the featured cover and its alt text when the artwork changes.
- **Artist information and links:** Update the About and Links sections in `index.html` when the artist provides additional details or platform URLs.
- **Fonts:** The local Pirata One and Archivo WOFF2 files come from Google Fonts. Their SIL Open Font License files are in `assets/fonts/`.

The five hero illustrations are Harry Clarke works from the supplied `STRYFE_assets` collection. Earlier artwork sources are recorded in `art-sources.json`. The music cover is served by SoundCloud and belongs to its artist or rights holder.

## Deploy on GitHub Pages

In **Settings → Pages**, set **Source** to **GitHub Actions**. The Pages workflow runs on pushes to `main` and can also be run manually from the Actions tab. No build or dependency installation is required. Relative asset paths work at both the domain root and a repository subpath. The social preview uses a grayscale copy of the opening artwork. Update the absolute `og:image` URL if the site moves to a different domain.

SoundCloud audio and cover art require access to SoundCloud. The type and hero use files in this checkout.
