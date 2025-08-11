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

---

## 🖥 Controls

| Action                                | Remote / Keyboard |
|---------------------------------------|-------------------|
| Next artwork                          | →                 |
| Previous artwork                      | ←                 |
| Toggle artwork info                   | ↑ (short press)   |
| Toggle fullscreen                     | ↑ (hold 3 sec)    |
| Hide info                             | ↓                 |
| Change passepartout color             | Green / Space     |
| Increase slideshow time               | Yellow / D        |
| Decrease slideshow time               | Blue / A          |
| Change passepartout style             | OK / Enter        |
| Open/close menu                       | Red / M           |
| Reload with new random order          | - / N             |

---

## 🔧 Installation (TizenBrew)

TizenBrew is a community application for Samsung TVs running TizenOS that allows installing additional web apps and tools.

0. Enable **Developer Mode** on your TV and install [TizenBrew](https://github.com/reisxd/TizenBrew).
1. Launch **TizenBrew**.
2. Add Developer Module with `@dchwilk/artgallerytb`.
3. Launch **ArtGalleryTB** from TizenBrew.

---

## 📦 API Keys

- **Rijksmuseum** – Get a free key from [https://data.rijksmuseum.nl/](https://data.rijksmuseum.nl/)
- **Cleveland Museum of Art** – Some features may require registration.

---

## 📜 License

This project is licensed under the [GPL-3.0-only License](https://github.com/dchwilk/ArtGalleryTB/blob/master/LICENSE).

It also uses free and open museum APIs.  
Check each museum’s API terms for allowed usage and attribution requirements.
I am not affiliated with any of the museums and have neither influence nor responsibility for the content and representations.
