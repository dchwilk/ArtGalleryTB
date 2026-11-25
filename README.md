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

## Choose artwork and adjust the display

Press **Back** to open the menu. You can select several museums and filter by artwork type, period or region. To show only landscape images, enable **Nur Querformat** under **Eigenschaften**.

Select **Filter anwenden & neu laden** to apply your filters and load a new selection. When several museums are selected, their images are mixed so the same collection doesn't keep coming up.

Under **Einstellungen**, you can:

- make the slideshow faster or slower,
- change the frame and mat color,
- dim the artwork and mat together,
- shuffle the order,
- move to the previous or next image.

You'll also find buttons for artwork information and fullscreen, along with a remote control guide. Fullscreen works where the browser or TV supports it.

**Neu mischen** shuffles the images already loaded. Your settings are saved automatically.

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

The Rijksmuseum is also still included through its older connection.

The number of matching images depends on the museum and your filters. Some artworks have incomplete information. museum-digital can currently be slow or unavailable.

## If no images appear

Try another museum or remove a few filters, then select **Filter anwenden & neu laden**. Combining several narrow filters can leave you with no matching images.

Collections aren't always reachable. Check **Einstellungen**, below the number of loaded artworks, for messages about unavailable sources. Images that fail to load are skipped.

If something doesn't work, [report it here](https://github.com/dchwilk/ArtGalleryTB/issues). Please include your TV model or browser and describe what happened.

## License

The code is licensed under [GPL-3.0](LICENSE). Museum images have their own rights information. ArtGalleryTB is an independent project and is not affiliated with Samsung or the museums listed above.
