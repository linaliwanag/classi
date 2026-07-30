/**
 * Guarded access to localStorage.
 *
 * Every touch of localStorage can throw outright — Safari private browsing,
 * disabled cookies, exhausted quota — so nothing here is allowed to take the
 * page down. Callers get null and degrade to "not persisted".
 */

/** The slice of the Storage interface this app needs. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Read and JSON-parse a key. Returns null on any failure. */
export function readJson(key: string, storage: StorageLike | null): unknown {
  if (storage === null) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Serialise and write a key. Returns false if storage was unavailable or full. */
export function writeJson(key: string, value: unknown, storage: StorageLike | null): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
