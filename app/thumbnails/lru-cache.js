/**
 * Bounded insertion-ordered cache for generated thumbnail data URLs.
 * Reads refresh recency; writes evict the least recently used key.
 */
export function createLruCache(maxEntries) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError('maxEntries must be a positive integer');
  }

  const entries = new Map();

  return {
    get size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },

    delete(key) {
      return entries.delete(key);
    },

    get(key) {
      const value = entries.get(key);
      if (value === undefined) return undefined;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },

    keys() {
      return entries.keys();
    },

    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value);
      }
      return value;
    },
  };
}
