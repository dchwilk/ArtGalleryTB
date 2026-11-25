// A fast first batch, followed by bounded random pages from the full catalogue.
// Later failures keep already published works; the collection owner reports them.
async function loadSampledMuseum(makeURL, readPage, onBatch, options = {}) {
  const results = [];
  const rows = 40;
  const maxPages = options.maxPages || 8;
  async function load(offset) {
    checkCollectionRequest(options);
    const page = readPage(await museumJSON(makeURL(offset, rows), options));
    await publishMuseumBatch(results, page.works, onBatch, options);
    return page;
  }
  const first = await load(0);
  const pageCount = Math.ceil(Number(first.total) / rows);
  if (!Number.isFinite(pageCount) || pageCount < 2) return results;
  const pages = new Set();
  while (pages.size < Math.min(maxPages - 1, pageCount - 1)) {
    pages.add(1 + Math.floor(Math.random() * (pageCount - 1)));
  }
  for (const page of pages) await load(page * rows);
  return results;
}

function museumPlainText(value) {
  const document = new DOMParser().parseFromString(String(value || ''), 'text/html');
  return document.body.textContent.trim();
}
