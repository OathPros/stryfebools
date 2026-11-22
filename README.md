# STRYFEBOOLS

Artist website with a cinematic homepage, SoundCloud listening, and live show announcements. The site is static HTML, CSS, and JavaScript.

## Develop locally

Run `python3 -m http.server 8080` from the checkout, then open `http://localhost:8080`. A local HTTP server gives the artwork and shader textures the same origin.

The hero uses local, responsive WebP images. With WebGL and motion enabled, keeping a pointer over the hero builds television static and changes the artwork after about 3.5 seconds. Pressing or dragging concentrates static under the pointer or fingertip. Vertical swipes scroll the page. The browser’s reduced-motion preference leaves the opening image still.

## Update the content

- **Artwork:** Add an entry to the `#hero-scenes` template in `index.html` with `data-full` and `data-small` image paths. The sequence follows the order of the entries. Keep the opening picture in sync with the first entry and record provenance in `art-sources.json`. Optional `data-focus-y` sets the vertical crop focus from 0 at the bottom to 1 at the top. Use `data-zoom` for an optional hero crop.
- **Live shows:** Replace the empty-state paragraph in `#shows` with a list of confirmed dates. Use a `<time datetime="YYYY-MM-DD">` element for each date and include the venue, city, and official ticket link if available.
- **Music:** Track rows in `index.html` pair an official SoundCloud track ID in `data-track` with the public track permalink. These come from SoundCloud's [oEmbed endpoint](https://soundcloud.com/oembed). Update the featured cover and its alt text with a verified artist image when the selection changes. The embedded SoundCloud player starts on Leeching and switches tracks from the track list. Direct track links work with JavaScript disabled and when the player is unavailable.
- **Artist information and links:** Update the About and Links sections in `index.html` when the artist provides additional details or platform URLs.
- **Fonts:** The local Pirata One and Archivo WOFF2 files come from Google Fonts. Their SIL Open Font License files are in `assets/fonts/`.

The four historical works are the sources recorded by this project's original checkout. Local WebP files are resized copies of those reproductions. The music cover is served by SoundCloud and belongs to its artist or rights holder.

## Deploy on GitHub Pages

In **Settings → Pages**, set **Source** to **GitHub Actions**. The Pages workflow runs on pushes to `main` and can also be run manually from the Actions tab. No build or dependency installation is required. Relative asset paths work at both the domain root and a repository subpath. The social preview uses a grayscale copy of the opening artwork. Update the absolute `og:image` URL if the site moves to a different domain.

SoundCloud audio and cover art require access to SoundCloud. The type and hero use files in this checkout.
