# ArtGalleryTB – Museum Art Slideshow for Samsung TVs

ArtGalleryTB is a TizenBrew app inspired by Samsung's The Frame art mode. It
displays artworks from public museum collections, with adjustable frames and mats.

## Version 0.4.0

- Add Staatliche Kunsthalle Karlsruhe and the German museum-digital catalogue,
  both optional and without account, key or third-party proxy.
- Check the main image's rights independently of metadata rights. These two
  sources use only CC0 / Public Domain images, even if the general rights filter
  is disabled. Versos, previews and external HTML catalogue pages are excluded.
- A first metadata batch is followed by bounded random pages from the catalogue.
  A later request failure keeps already loaded works and reports the source.
- museum-digital keeps the same overall share as each selected source; contributing
  museums are additionally interleaved within its artwork queue.
- Settings now offers faster/slower playback, mat color, frame style, reshuffle,
  previous/next image, artwork information and optional fullscreen as buttons.
  These use the same actions as the remote and do not reload the catalogue.
- A German remote/keyboard legend can be read row by row using the D-pad.
  Focus scrolls into view on both TV layouts.

## Features retained from 0.3.0

- Samsung remote OK explicitly toggles checkboxes, including on engines where a
  programmatic click does not activate them. Both keydown and keyup defaults are handled.
- Menu navigation follows the visible control layout: side-by-side action buttons
  use Left/Right; wrapped buttons use Up/Down. The brightness slider uses Left/Right.
- Optional landscape-only display, verified against actual image pixels when
  the source provides no dimensions. Landscape means width greater than height;
  it does not crop images to 16:9.
- Optional brightness from 20–100%, applied once to the complete artwork, mat,
  frame and surrounding frame background. Menus and status text stay readable.
  This adjusts the rendered app content, not the physical TV backlight.
- Persistent preferences, retaining existing 0.2.0 settings.
- Unified artwork types, dates, regions, public-domain flags and pixel dimensions
  across sources. Missing metadata remains unknown; restrictive filters may exclude it.
- Progressive metadata batches: display the first matching image immediately,
  then extend the collection without resetting the displayed image.
- One bounded lookahead image is prefetched silently; it is reused on the next
  slide. No spinner is shown for background loading.
- Museum-balanced randomness: each museum gets the same number of slots per
  generated cycle, independently of collection size. Each museum has its own
  shuffled artwork queue. Small collections repeat only after their own queue
  is exhausted. Random pairs/triples of a museum are allowed; long runs inside
  a cycle are avoided. Failed/incompatible images are skipped.

## Collections

| Source | Access | Notes |
|---|---|---|
| [Art Institute of Chicago](https://api.artic.edu/docs/) | No account/key | Randomized search with small batches and native image dimensions. |
| [SMK, Copenhagen](https://api.smk.dk/api/v1/docs/) | No account/key | New adapter, translated metadata, open-image filters and highlight-weighted random search. |
| [J. Paul Getty Museum](https://data.getty.edu/museum/collection/docs/) | No account/key | New adapter. Paintings use the public catalogue query; other selections use a bounded recent-change feed. The image's own rights are checked separately from metadata rights. |
| [Staatliche Kunsthalle Karlsruhe](https://www.kunsthalle-karlsruhe.de/alle-werke/) | No account/key | Public BSZ catalogue and IIIF images; main-image Public Domain/CC0 rights and pixel dimensions. Catalogue analysis found 2,413 freely marked painting main images, including 1,142 landscape images with width ≥1920px, on 25 November 2026. |
| [museum-digital Germany](https://nat.museum-digital.de/swagger/) | No account/key | Public batch API; each selected type is queried separately and only CC0 / Public Domain Mark main images with full-size image URLs are accepted. Some external resources point at HTML pages and are intentionally omitted. Availability and image resolution vary by museum. |
| [Cleveland Museum of Art](https://openaccess-api.clevelandart.org/) | No account/key | Correct skip-based pagination; CC0 status is taken from the museum's record. |
| [Metropolitan Museum of Art](https://metmuseum.github.io/) | No account/key | Randomized object selection, two detail requests at a time; no third-party CORS proxies. |
| [Rijksmuseum](https://data.rijksmuseum.nl/docs/) | Legacy adapter retained | The previous adapter remains for compatibility and is not selected by default. Migration to the new keyless Linked Art service is separate. |

New installations select **Chicago and SMK, paintings, public domain, with
images**, 30 seconds per slide, classic mat and full brightness. Getty and the
slower object-by-object sources are not started automatically. Previously saved
selections, including explicitly disabled filters, take precedence over these defaults.

Collection and image requests are independent: a source that fails does not
discard successful results from another source. A source failure is shown in
Settings. Browser CORS policies can restrict particular APIs; no proxy is used
to bypass them. Tests against localhost on 25 November 2026 successfully loaded
SMK artworks and Getty painting metadata/media; Chicago and Cleveland requests
were blocked by missing CORS headers in that test environment.

For 0.4.0, 98 automated browser checks pass at 1920×1080 and 1280×720.
Karlsruhe was also loaded through the real app with a displayed artwork and
background metadata batches. museum-digital was checked against genuine API
records captured during research and simulated availability/abort scenarios;
the final live service check timed out. Its current end-to-end availability
therefore remains unverified, and it is optional rather than a first-run default.

## Filters

The same filter vocabulary applies to all sources:

- Types: paintings, photography, sculpture, drawings/prints and decorative arts.
- Periods: before 500, 500–1399, 1400–1599, 1600–1749, 1750–1949 and 1950 onwards.
- Areas: Europe, Americas, Asia, modern (1750–1949) and contemporary (1950 onwards).
  Regions use available collection/origin/nationality metadata; they are not
  a claim that every museum has matching organizational departments.
- Properties: public domain, high resolution (at least 1600 pixels on the long
  edge or a source indicating zoom capability), an image, and landscape-only.

Selections within a group use OR. Different groups use AND. All filters are
captured when applying/reloading; background batches use that same snapshot.
New image sizes are checked before display if orientation/quality was unknown.

## Controls

| Action | Remote / keyboard |
|---|---|
| Next / previous artwork | Right / Left |
| Toggle artwork info | Up |
| Hide artwork info | Down |
| Change mat color | Play, Play/Pause, Green, Space, G |
| Increase / decrease display time | Channel Up / Down, Yellow / Blue, D / A |
| Change frame style | OK / Enter |
| Open / close menu | Back, Red, M, Escape |
| Generate a new shuffled order | N |

All slideshow actions are also available as buttons in Settings, including
reshuffle on remotes without letter keys. Faster subtracts 15 seconds and slower
adds 15 seconds. The existing remote mapping stays the same: Yellow / Channel Up
adds display time, Blue / Channel Down subtracts it. The in-app legend describes
the display time explicitly to avoid confusing time and speed.

For horizontal tabs (up to 1280px), Left/Right selects a tab and Down or OK
enters its content. For vertical tabs, Up/Down selects a tab and Right or OK
enters its content. Content controls follow their displayed positions. Left
from the first control returns to the selected tab; on horizontal layouts,
Up from the top content row also returns to the tabs. A range slider consumes
Left/Right while focused; use Up/Down to leave it.

Holding Up for more than three seconds retains the optional fullscreen action.
Unsupported/rejected fullscreen requests do not interrupt navigation.

## Installation

1. Install [TizenBrew](https://github.com/reisxd/TizenBrew) on your Samsung TV.
2. Add the ArtGalleryTB GitHub module / package `@dchwilk/artgallerytb`.
3. Launch ArtGalleryTB.

The app is plain static HTML/CSS/JavaScript; no runtime framework or build step
is required. A package version in this repository does not by itself publish
an npm release.

## Saved preferences and loading

Preferences use `artgallerytb.settings.v1` in localStorage. Source/filter changes,
frame/color/time changes, brightness input and closing the menu are saved.
Corrupt or inaccessible storage falls back to defaults. Preferences belong to
the browser origin (including port); clearing app data or changing origin resets them.
Display time is bounded between 5 seconds and 24 hours.

Image loads time out after 20 seconds. Failed images are skipped until the next
collection reload. If no usable image remains, playback stops with a message,
and the menu remains accessible. Reloading invalidates pending images, cancels
background prefetch and aborts current adapter requests where supported.
Obsolete results cannot replace a newer collection. Each successfully displayed
image receives its full display time. The centered loading indicator respects
reduced-motion preferences and stops animating when it displays an error.

## Code layout

Classic scripts are loaded after the markup, in this order; do not add `async`:

1. `dom.js`: shared DOM references.
2. `passepartout.js`: mat colors and styles.
3. `settings.js`: validated local preferences and display brightness.
4. `loading.js`: bounded image loads, preload and status indicator.
5. `filters.js`: normalization and shared filtering.
6. `random.js`: shuffled museum/artwork queues.
7. `apis.js`: shared request helpers and existing museum adapters.
8. `museums/common.js`, `museums/karlsruhe.js`, `museums/museumdigital.js`:
   bounded paged loading and the new museum adapters.
9. `script.js`: collection state, ingestion, escaped metadata and slideshow.
10. `actions.js`: shared slideshow actions used by the menu and remote.
11. `menu.js`: menu state, layout-aware focus and scrolling.
12. `navi.js`: remote/keyboard mapping and one input handler.
13. `app.js`: startup after every dependency has loaded.

## Tests

Use Node.js 20 or newer:

```sh
npm ci
npx playwright install chromium
npm test
```

Alternatively, run with installed Microsoft Edge in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm test
```

Tests use controlled API and image fixtures at 1920×1080 and 1280×720. They cover
remote codes, Tizen checkbox activation, button layout, brightness persistence,
first-run defaults, normalized filters, source rights, balanced randomness,
progressive loading, prefetch reuse, image failures/timeouts and stale requests.
They do not replace a test on the physical TV or guarantee live API availability.

## License

[GPL-3.0-only](LICENSE). Museum images have their own rights; only use images
whose source permits the intended display and retain museum attribution.
This project is not affiliated with the museums or Samsung.
