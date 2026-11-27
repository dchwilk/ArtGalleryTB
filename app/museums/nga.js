// Small local catalogue shards; image files come directly from the museum.
async function loadNGAData(onBatch = () => {}, options = {}) {
  const root = 'data/nga/';
  const manifest = await museumJSON(root + 'manifest.json?v=0-5-0', options);
  const types = options.filters?.includeUnknown ? [] : options.filters?.types || [];
  const available = manifest.shards.filter(shard => !types.length || types.includes(shard.type));
  const results = [];
  // Read one random shard from each selected kind before taking extra samples.
  const selected = [];
  for (const type of [...new Set(available.map(shard => shard.type))]) {
    selected.push(shuffleArray(available.filter(shard => shard.type === type))[0]);
  }
  selected.push(...shuffleArray(available.filter(shard => !selected.includes(shard))).slice(0, Math.max(0, 4-selected.length)));
  for (const shard of selected) {
    if (!/^[a-z]+-[a-f0-9]{12}\.json$/.test(shard.file)) continue;
    const rows = await museumJSON(root + shard.file, options);
    const works = rows.map(row => {
      const work = {};
      manifest.columns.forEach((name, index) => { work[name] = row[index]; });
      return Object.assign(work, { source: 'nga', is_public_domain: true,
        imageUrl: work.imageService + '/full/!1920,1080/0/default.jpg' });
    }).filter(work => !options.filters || matchesFilters(work, options.filters));
    await publishMuseumBatch(results, shuffleArray(works).slice(0, 100), onBatch, options);
  }
  return results;
}
