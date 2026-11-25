function shuffleArray(array) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Equal museum share, independent of collection size. Refill each museum's
// shuffled queue only after all its eligible works have been used.
function buildRandomizedOrder(exclude = -1) {
  const groups = {};
  artworks.forEach((work, index) => {
    const source = work.source || 'unknown';
    if (!failedImages.has(index)) (groups[source] || (groups[source] = [])).push(index);
  });
  const sources = Object.keys(groups);
  if (!sources.length) return [];
  if (sources.length === 1) {
    const order = shuffleArray(groups[sources[0]]);
    if (order.length > 1 && order[0] === exclude) [order[0], order[1]] = [order[1], order[0]];
    return order;
  }
  const rounds = Math.max(...sources.map(source => groups[source].length));
  const slots = [];
  for (let round = 0; round < rounds; round += 2) {
    slots.push(...shuffleArray(sources.flatMap(source => Array(Math.min(2, rounds - round)).fill(source))));
  }
  // Prevent long single-museum runs while retaining random pairs and triples.
  for (let i = 3; i < slots.length; i++) {
    if (slots[i] === slots[i-1] && slots[i] === slots[i-2] && slots[i] === slots[i-3]) {
      const swap = slots.findIndex((source, j) => j > i && source !== slots[i]);
      if (swap >= 0) [slots[i], slots[swap]] = [slots[swap], slots[i]];
    }
  }
  const queues = {};
  const last = {};
  const order = slots.map(source => {
    if (!queues[source]?.length) {
      queues[source] = shuffleArray(groups[source]);
      const avoid = last[source] ?? exclude;
      if (queues[source].length > 1 && queues[source][queues[source].length-1] === avoid) {
        [queues[source][0], queues[source][queues[source].length-1]] = [queues[source][queues[source].length-1], queues[source][0]];
      }
    }
    last[source] = queues[source].pop();
    return last[source];
  });
  if (order[0] === exclude) {
    const alternative = order.findIndex(index => index !== exclude);
    if (alternative > 0) [order[0], order[alternative]] = [order[alternative], order[0]];
  }
  return order;
}

function createRandomizedOrder() {
  const previous = randomizedOrder[currentIndex];
  randomizedOrder = buildRandomizedOrder(previous);
  currentIndex = 0;
}
