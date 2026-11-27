// Each adapter publishes small batches using the same artwork model.
// New adapters use public APIs without registration or proxy services.
async function museumJSON(url, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort(); }, options.timeout || 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (error) {
    if (timedOut && !options.signal?.aborted) throw new Error('Museum request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

function checkCollectionRequest(options) {
  if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

async function publishMuseumBatch(results, batch, onBatch, options) {
  checkCollectionRequest(options);
  const usable = batch.filter(work => work.imageUrl && work.title).map(normalizeArtwork);
  results.push(...usable);
  await onBatch(usable);
}

