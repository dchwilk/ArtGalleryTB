# ArtGalleryTB – Multi-Museum Art Slideshow for Samsung TVs (TizenBrew)

**ArtGalleryTB** is a Tizen module inspired by Samsung’s *The Frame* art mode — but instead of showing paid Samsung Art Store content, it displays artworks from free, public museum APIs.

---

## ✨ Features

- **Multiple museum sources** – Supports artworks from:
  - [Art Institute of Chicago](https://www.artic.edu/open-access/public-api)
  - [Metropolitan Museum of Art](https://metmuseum.github.io/)
  - [Rijksmuseum](https://data.rijksmuseum.nl/) *(API key required)*
  - [Cleveland Museum of Art](https://openaccess-api.clevelandart.org/) *(API key required for some features)*
- **Advanced filtering** by:
  - Art types (paintings, sculptures, photographs, etc.)
  - Historical periods
  - Museum departments
  - Properties (public domain, high resolution, with images)
- **Passepartout & frame styles** – Multiple styles and colors, similar to Samsung’s presentation
- **Randomized slideshow** – Random ordering with adjustable display time
- **Artwork info overlay** – Toggle detailed artwork metadata (title, artist, origin, materials, source tags, etc.)
- **Saved preferences** – Museum and filter selections, display time, mat color and frame style survive restarts on the same browser origin.
- **Resilient image loading** – Failed or stalled images are skipped, with a centered loading indicator.

---

## 🖥 Controls

| Action                                | Remote / Keyboard    |
|---------------------------------------|----------------------|
| Next artwork                          | →                    |
| Previous artwork                      | ←                    |
| Toggle artwork info                   | ↑                    |
| Hide info                             | ↓                    |
| Change passepartout color             | PLAY / Green / Space |
| Increase slideshow time               | Chan_UP / Yellow / D |
| Decrease slideshow time               | Chan_DOWN / Blue / A |
| Change passepartout style             | OK / Enter           |
| Open/close menu                       | BACK / Red / M       |
| Reload with new random order          | - / N                |

---

## 🔧 Installation (TizenBrew)

TizenBrew is a community application for Samsung TVs running TizenOS that allows installing additional web apps and tools.

0. Enable **Developer Mode** on your TV and install [TizenBrew](https://github.com/reisxd/TizenBrew).
1. Launch **TizenBrew**.
2. Add GitHub-Modul `@dchwilk/artgallerytb`.
3. Launch **ArtGalleryTB** from TizenBrew.

---

## 📦 API Keys

- **Rijksmuseum** – Get a free key from [https://data.rijksmuseum.nl/](https://data.rijksmuseum.nl/)
- **Cleveland Museum of Art** – Some features may require registration.

## Development and remote navigation

Scripts are loaded after the page markup in this order:

1. `dom.js`: shared DOM references.
2. `passepartout.js`: existing frame styles and colors.
3. `settings.js`: validated local preferences.
4. `loading.js`: loading status and bounded image requests.
5. `apis.js`: existing museum loaders.
6. `script.js`: filtering, artwork state and slideshow navigation.
7. `menu.js`: active section, menu actions and focus movement.
8. `navi.js`: one remote/keyboard event handler and key normalization.
9. `app.js`: startup after all dependencies are available.

These are classic scripts sharing page scope; keep their order and do not add
`async`. Top-level `const` and `let` work across these scripts; assigning every
variable to `window` is unnecessary. No runtime framework or build step is needed.

The menu follows the existing CSS breakpoint: at up to 1280px, Left/Right selects
tabs and Down or OK enters their content. Above 1280px, Up/Down selects tabs and
Right or OK enters their content. Left returns to the selected tab; in the narrow
layout, Up from the first item also returns. OK activates a checkbox or button.
Back, Red, Escape and M open/close the menu. Closing blurs hidden controls.
Dedicated Play (415) and Play/Pause (10252) both change the mat color.
Holding Up longer than three seconds retains the optional fullscreen action;
unsupported fullscreen APIs are ignored. Existing artwork sources and frame
rendering are retained. Only the loading indicator and its stacking order add CSS.

TizenBrew registers additional remote keys from `package.json`; the four color
keys are explicitly included alongside the existing media and channel keys.
Basic arrows, OK and Back need no registration. The old spatial navigation
polyfill is no longer loaded, because this menu has its own explicit focus rules.

### Preferences, filtering and image loading (0.2.0)

Preferences are saved automatically on checkbox changes, color/style/time
changes, closing the menu and applying filters. They are restored before the
first museum request. The storage key is `artgallerytb.settings.v1`; corrupt,
unsupported or unavailable storage falls back to defaults. Removing the stored
entry resets preferences on the next launch. Saved settings belong to the
browser origin, so a different host/port or cleared TV app storage resets them.
Display durations range from 5 seconds to 24 hours.

Filter selections take effect when applying/reloading or on the next startup.
Multiple department selections are combined with OR; departments and other
filter groups are combined with AND. Department matching uses the museum's
department names (Europe, Americas, Asia and the corresponding named Asian
collections, Modern, Contemporary). Combined Modern/Contemporary collections
match either selection. Missing/unrecognized department metadata cannot match;
the Rijks loader currently provides only `Rijksmuseum` as the department, so it
cannot match a department filter. No new image sources or requests were added.

While an image loads, the preceding artwork and metadata remain visible.
The new image and its metadata appear together after successful loading, then
the full display duration starts. Requests time out after 20 seconds. Failed
entries are skipped until the next collection reload; if every entry fails,
automatic playback stops and a message appears with the menu still available.
Newer image or museum loads supersede older results. Museum API requests retain
their existing implementation; obsolete museum requests are ignored rather than
being aborted. The centered status shows a spinner while busy and static text
on failure, with reduced-motion preferences respected.

### Tests

Use Node.js 20 or newer:

```sh
npm ci
npx playwright install chromium
npm test
```

Alternatively, use installed Microsoft Edge in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm test
```

Browser tests run at 1920×1080 and 1280×720 with local museum/image fixtures.
They cover numeric TV codes, real keyboard defaults, menu traversal, checkboxes,
filter reload, slideshow controls, startup, interrupted Up holds, preference
persistence, department matching, image failures/timeouts and loading centering.
They do not
replace a check on the actual Samsung TV or validate live museum API availability.

---

## 📜 License

This project is licensed under the [GPL-3.0-only License](https://github.com/dchwilk/ArtGalleryTB/blob/master/LICENSE).

It also uses free and open museum APIs.  
Check each museum’s API terms for allowed usage and attribution requirements.
I am not affiliated with any of the museums and have neither influence nor responsibility for the content and representations.
