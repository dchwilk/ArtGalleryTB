# Museum connections in 0.5.0

Each museum has its own classic script in `app/museums/`. These run after
`apis.js` (request cancellation and streaming) and `museums/common.js`
(bounded object requests and sampled pages). No build step is needed to run
the gallery. Selection and image appearance are handled separately from adapters.

## Updated connections

- **Rijksmuseum:** current keyless Search API and Linked Art object records.
  Check rights on the digital image. Publish a small first batch, then follow
  opaque page tokens and sample the discovered identifiers. Discovery is bounded
  to 100 pages per type (10,000 identifiers); this covers the 4,504 illustrated
  paintings returned during verification, but is not a full harvest of every type.
- **Met:** `/public/collection/v1.1/search`; the former search endpoint now
  returns HTTP 410. Apply medium filters and sample pages inside its documented
  10,000-result search window. Fetch details with at most two concurrent requests.
- **Cleveland:** query the selected types and sample distinct pages across
  the reported total, rather than always taking the first 200 records. Use print
  JPEGs instead of small web previews; never download the original TIFF.
- **Getty:** query the collection through SPARQL, count matching objects and
  sample ordered pages. Do not use the recent change feed as a discovery list.
  Require independent public-domain/CC0 rights on the image record.
- **SMK:** push a single selected, supported object type into the search filter.
  Preserve its seeded random order, publish batches and retain image rights.
- **Chicago, Karlsruhe and museum-digital:** keep the established loading
  approach, with the shared vocabulary updated for separate drawings and prints.

## National Gallery of Art

Run `python scripts/build-nga-catalog.py` from the repository to refresh the
bundled catalogue. This downloads official CSVs; the TV never downloads them.
The script joins objects to image records, includes only `openaccess=1` and
`viewtype=primary`, excludes virtual objects, and keeps one primary image per
object. Artist nationalities come from artist relationships, never owners or
the museum's location. Catalogue metadata is CC0; the image's separate
Open Access flag determines image eligibility.

The generated manifest records the date, source, columns and shard counts.
Shards have content-derived names, are divided by kind and loaded on demand.
The gallery filters and shuffles each selected shard before publishing batches.
Images come directly from `api.nga.gov`.

Verified snapshot: 63,861 works, including 2,916 paintings, 6,791 drawings,
27,790 prints, 2,778 photographs, 3,495 sculptures and 20,091 other works.
These are catalogue counts, not counts after every gallery filter or image test.

## Filters and compatibility

- Multiple selections within a group use OR; different groups use AND.
- Date ranges overlap the recorded start/end interval. Labels describe numeric
  ranges instead of assigning an art movement to every work.
- Origin uses available place, culture or artist-nationality metadata. It is
  intentionally approximate; the museum's country is not substituted for origin.
- Missing type, date or origin can be included explicitly. This never relaxes
  image rights, orientation or resolution requirements.
- Screen-shaped images have a width/height ratio from 1.5 to 2.05; ordinary
  landscape means width greater than height. Both are checked against the image.
- High resolution means at least 1,600 actual decoded pixels on the long edge.
  A zoom flag or a large original cannot make a small delivered image pass.
- Existing settings remain in the same storage key. The old drawings/prints
  checkbox migrates to both choices once. Former Modern/Contemporary area
  selections migrate to the corresponding date ranges. If these were combined
  with origin filters, origin and time now apply together under the new groups.

## Candidates not enabled

**Belvedere:** Open Content and IIIF are promising, but direct collection requests
returned HTTP 403 with a human-verification page during implementation.
No verification bypass or untested source selector is included.

**KMSKA:** its DataHub failed during TLS connection setup. The alternative
Vlaamse Kunstcollectie DataHub returned HTTP 500 for record listing. Its reachable
general Imagehub does not establish access to a sufficient KMSKA painting
collection. This connection still needs a working catalogue and image test.

Paris Musées and Wikimedia are excluded as requested. Stockholm is deferred
because the earlier confirmed freely downloadable collection used Wikimedia.

## Official references

- https://data.rijksmuseum.nl/tutorials/search/
- https://metmuseum.github.io/
- https://openaccess-api.clevelandart.org/
- https://data.getty.edu/museum/collection/
- https://api.smk.dk/api/v1/docs/
- https://github.com/NationalGalleryOfArt/opendata
- https://www.nga.gov/artworks/free-images-and-open-access
- https://sammlung.belvedere.at/opencontent/images
- https://kmska.be/en/getting-started-with-collection-data
