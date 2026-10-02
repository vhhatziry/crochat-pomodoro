/** Serialize snapshots so a slow older write cannot replace newer edits. */
export function createWriteQueue<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  let failure: unknown;
  return {
    save(value: T): Promise<void> {
      const snapshot = structuredClone(value);
      tail = tail.catch(() => {}).then(() => write(snapshot));
      tail.then(() => { failure = undefined; }, (error) => { failure = error; });
      return tail;
    },
    async flush(): Promise<void> {
      let pending: Promise<void>;
      do {
        pending = tail;
        await pending;
      } while (pending !== tail);
      if (failure) throw failure;
    },
  };
}

export function uniqueLibraryPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = path.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function repairPatternIds<T extends { id: string }>(patterns: T[]): T[] {
  const seen = new Set<string>();
  return patterns.map((pattern) => {
    let id = pattern.id;
    if (!id?.trim() || seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    return { ...pattern, id };
  });
}
