# ArtGalleryTB

ArtGalleryTB displays artwork from different museums as a slideshow on your Samsung TV. The idea is similar to the art mode on The Frame: artwork on your TV, with a frame and mat. No Samsung Art Store subscription needed.

You choose the museums and the kinds of artwork you want to see. Everything can be controlled with your regular TV remote.

## Try it in your browser

[Open the gallery](https://dchwilk.github.io/ArtGalleryTB/app/index.html)

The slideshow starts automatically. On the first launch, paintings from Chicago and SMK are selected, with 30 seconds per image. You can change this in the menu.

A browser is enough to try it out. You don't need a museum account or your own API keys. An internet connection is required because the images are loaded directly from the collections.

## Add it to TizenBrew

On a Samsung TV, you need [TizenBrew](https://github.com/reisxd/TizenBrew). If you haven't installed it yet, follow the [TizenBrew installation guide](https://github.com/reisxd/TizenBrew/blob/main/docs/README.md#installation).

Once TizenBrew is running:

1. Open the **Module Manager**.
2. Select **Add GitHub Module**.
3. Enter exactly `dchwilk/ArtGalleryTB` as the module name.
4. Confirm the entry and wait for the module to be added.
5. Return to the TizenBrew home screen.
6. Select **ArtGalleryTB** and press OK to launch it.

Choose **Add GitHub Module** for this step. The name field only needs `dchwilk/ArtGalleryTB`, without a full web address.

The gallery's menus are currently in German. The steps below include the labels you'll see on screen.

## Updates in TizenBrew

TizenBrew loads GitHub modules through jsDelivr. Updates can take a while to appear because its copies of the files are cached. Restarting the TV does not clear that cache.

To load a specific published release, add the GitHub module with its tag, for example `dchwilk/ArtGalleryTB@v0.5.0`. That release tag must already exist in this repository. An exact commit ID can be used instead of a tag as well.

The gallery version is shown in its menu bar. Close and relaunch TizenBrew after changing the module.

## Choose artwork and adjust the display

Press **Back** to open the menu. You can select several museums and filter by artwork type, date range or origin. Drawings and prints have separate choices. Several choices within one group are combined; different groups narrow the selection together. An empty group allows everything in that group.

Under **Eigenschaften**, **Nur Querformat** selects images wider than they are tall. **Ungefähr TV-Format** narrows that down to images closer to the shape of a TV, without changing how they are framed. The quality option requires at least 1600 pixels on the long edge of the image actually loaded.

Some works have no known origin, type or date. You can include those with **Werke mit unbekannter Kunstart, Herkunft oder Datierung einschließen**. Otherwise they are left out when the corresponding filter is selected. Image rights are still checked. If no works match, the gallery suggests filters to loosen; it does not change your choices.

Select **Speichern** to apply your filters and return to the slideshow. Pressing Back does the same. Save and Back are in the menu bar, on the left on a TV and at the top on a phone. Both close the settings and apply changes. When several museums are selected, their images are mixed so the same collection doesn't keep coming up.

Under **Einstellungen**, you can:

- make the slideshow faster or slower,
- change the frame and mat color,
- dim the artwork and mat together,
- shuffle the order,
- move to the previous or next image.

You'll also find buttons for artwork information and fullscreen, along with a remote control guide. Fullscreen works where the browser or TV supports it.

**Neu mischen** shuffles the images already loaded. **Neue Auswahl laden** loads another selection from the museums. Your settings are saved automatically.

The additional frame style **Bildfüllend ohne weißen Rahmen** fills the screen without the white border. The existing frame styles are still available.

## Touch controls

On a phone or a touchscreen such as a Nest Hub, open the gallery page in a browser. The artwork has invisible touch zones; there are no extra buttons over the image.

| Gesture on the artwork | Action |
|---|---|
| Swipe left / right | Next / previous image |
| Tap the left / right quarter | Previous / next image |
| Tap the middle or swipe down | Open the menu |
| Tap the bottom quarter or swipe up | Show or hide artwork information |

The bottom zone takes priority over the side zones. In the menu, tap the visible controls and scroll normally. You can also toggle artwork information with its button in Settings.

Switching between portrait and landscape keeps the current image, selections and open menu. If you turn the device during a gesture, that gesture is cancelled. Opening the page on a Nest Hub depends on the device's browser support; this does not add a casting feature.

On phones, artwork information uses larger text in both orientations. Long titles and IDs wrap, and the information panel scrolls when it needs more space. Turning the phone keeps the panel open.

## Remote controls

While the slideshow is running:

| Button | Action |
|---|---|
| Left / Right | Previous / next image |
| Up | Show or hide artwork information |
| Down | Hide artwork information |
| OK | Change frame style |
| Green or Play / Play-Pause | Change mat color |
| Yellow or Channel Up | Show each image for 15 seconds longer |
| Blue or Channel Down | Show each image for 15 seconds less |
| Back or Red | Open / close the menu |

In the menu, use the arrow buttons to move around and OK to select an item or toggle a checkbox. The slideshow controls are also available as buttons in **Einstellungen**, including shuffle. You can use those if your remote has no color buttons.

On a computer, the arrow keys and Enter work the same way. Use **M** or **Esc** for the menu, **G** to change the mat color and **N** to shuffle.

## Museums and collections

Available sources:

- Art Institute of Chicago
- Metropolitan Museum of Art, New York
- Cleveland Museum of Art
- SMK – Statens Museum for Kunst, Copenhagen
- J. Paul Getty Museum
- Staatliche Kunsthalle Karlsruhe
- German collections through museum-digital
- Rijksmuseum, Amsterdam
- National Gallery of Art, Washington

The Rijksmuseum uses its current service without an API key. The National Gallery of Art uses a bundled catalogue of over 63,000 freely reusable primary images, including over 2,900 paintings. Its images load directly from the museum. The catalogue is a snapshot and is refreshed with app updates.

The number of matching images depends on the museum and your filters. Some artworks have incomplete information. museum-digital can currently be slow or unavailable.

## If no images appear

Try another museum or remove a few filters, then select **Speichern**. Combining several narrow filters can leave you with no matching images.

Collections aren't always reachable. Check **Einstellungen**, below the number of loaded artworks, for messages about unavailable sources. Images that fail to load are skipped.

If something doesn't work, [report it here](https://github.com/dchwilk/ArtGalleryTB/issues). Please include your TV model or browser and describe what happened.

## License

The code is licensed under [GPL-3.0](LICENSE). Museum images have their own rights information. ArtGalleryTB is an independent project and is not affiliated with Samsung or the museums listed above.
