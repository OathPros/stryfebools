# STRYFEBOOLS

Artist website with a cinematic homepage, SoundCloud listening, and a curated archive of historical artwork. The site is static HTML, CSS, and JavaScript.

## Develop locally

Run `python3 -m http.server 8080` from the checkout, then open `http://localhost:8080`. A local HTTP server gives the artwork and shader textures the same origin.

The hero uses local, responsive WebP images. With WebGL and motion enabled, the artwork changes through monochrome television snow, scanlines, and a rolling tracking band. Hover adds light interference. Press or drag to concentrate the snow under the pointer or fingertip. Vertical swipes scroll the page. **Next artwork** advances the scene by button or keyboard. **Motion** pauses the effect. Reduced-motion preferences start the hero in its still-image mode.

## Update the content

- **Artwork:** Add a figure to the archive in `index.html` with `data-scene`, an image, a responsive `srcset` with the small variant first, a heading, attribution, and a `.view-scene` button. The sequence follows the order of the figures. Keep the opening picture and initial caption in sync with the first figure. Set the image's intrinsic dimensions and alt text. Keep the license, original source URL, and local files in `art-sources.json`. Optional `data-focus-y` sets the vertical crop focus for panoramic screens, from 0 at the bottom to 1 at the top. Use `data-zoom` for an optional hero-only crop.
- **Music:** Track rows in `index.html` pair an official SoundCloud track ID in `data-track` with the public track permalink. These come from SoundCloud's [oEmbed endpoint](https://soundcloud.com/oembed). Update the featured cover and its alt text with a verified artist image when the selection changes. The embedded SoundCloud player starts on Leeching and switches tracks from the track list. Direct track links work with JavaScript disabled and when the player is unavailable.
- **Artist information and links:** Update the About and Links sections in `index.html` when the artist provides additional details or platform URLs.
- **Fonts:** The local Pirata One and Archivo WOFF2 files come from Google Fonts. Their SIL Open Font License files are in `assets/fonts/`.

The four historical works are the sources recorded by this project's original checkout. Local WebP files are resized copies of those reproductions. The music cover is served by SoundCloud and belongs to its artist or rights holder.

## Deploy on GitHub Pages

In **Settings → Pages**, set **Source** to **GitHub Actions**. The Pages workflow runs on pushes to `main` and can also be run manually from the Actions tab. No build or dependency installation is required. Relative asset paths work at both the domain root and a repository subpath. The social preview uses a grayscale copy of the opening artwork. Update the absolute `og:image` URL if the site moves to a different domain.

SoundCloud audio and cover art require access to SoundCloud. The archive, type, and hero use files in this checkout.
