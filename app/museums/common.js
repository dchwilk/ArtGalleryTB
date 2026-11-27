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

// Keep TV connections bounded; publish every small group as soon as it arrives.
async function loadMuseumObjects(ids, readObject, onBatch, options = {}) {
  const results = [];
  let failures = 0, lastError;
  for (let i = 0; i < ids.length; i += 2) {
    checkCollectionRequest(options);
    const batch = await Promise.all(ids.slice(i, i + 2).map(async id => {
      try { return await readObject(id); }
      catch (error) { checkCollectionRequest(options); failures++; lastError = error; return null; }
    }));
    await publishMuseumBatch(results, batch.filter(Boolean), onBatch, options);
  }
  if (ids.length && failures === ids.length) throw lastError;
  return results;
}

function sampledOffsets(total, rows, maxPages = 5, windowLimit = Infinity) {
  const pages = Math.ceil(Math.min(Number(total) || 0, windowLimit) / rows);
  const offsets = new Set([0]);
  while (offsets.size < Math.min(maxPages, pages)) offsets.add(Math.floor(Math.random() * pages) * rows);
  return [...offsets];
}
