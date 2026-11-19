/**
 * IndexedDB ng offline mode ("practicum-sync"). Bawat record ay may owner (email) para hindi maghalo ang mga user.
 * Bersyon 1: readCache (naka-save na sagot ng GET para mabasa offline).
 * (Ang outbox at mga file na naghihintay ay idaragdag sa susunod na bersyon.)
 */

export const SYNC_DB = "practicum-sync";
export const READ_CACHE = "readCache";

export interface CachedResponse {
  /** owner|url?params */
  key: string;
  owner: string;
  url: string;
  data: unknown;
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openSyncDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(SYNC_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(READ_CACHE)) {
        const store = db.createObjectStore(READ_CACHE, { keyPath: "key" });
        store.createIndex("owner", "owner");
        store.createIndex("cachedAt", "cachedAt");
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Isasara kapag may ibang tab na nag-a-upgrade, para hindi ito maharangan
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function putCached(entry: CachedResponse): Promise<boolean> {
  try {
    const db = await openSyncDb();
    const tx = db.transaction(READ_CACHE, "readwrite");
    tx.objectStore(READ_CACHE).put(entry);
    return await done(tx);
  } catch {
    return false;
  }
}

export async function getCached(key: string): Promise<CachedResponse | null> {
  try {
    const db = await openSyncDb();
    return await new Promise((resolve) => {
      const req = db.transaction(READ_CACHE, "readonly").objectStore(READ_CACHE).get(key);
      req.onsuccess = () => resolve((req.result as CachedResponse | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Binubura ang lahat ng naka-save na sagot ng isang user */
export async function deleteCachedForOwner(owner: string): Promise<void> {
  try {
    const db = await openSyncDb();
    const tx = db.transaction(READ_CACHE, "readwrite");
    const index = tx.objectStore(READ_CACHE).index("owner");
    const req = index.openCursor(IDBKeyRange.only(owner));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    await done(tx);
  } catch {
    // hindi kritikal
  }
}

/**
 * Paglilinis: binubura ang mas luma sa maxAgeMs (lahat ng user, kaya nawawala rin ang naiwan ng ibang
 * account pagkalipas ng 7 araw), at iniiwan lang ang pinakabagong maxPerOwner bawat user.
 */
export async function pruneCache(maxAgeMs: number, maxPerOwner: number): Promise<void> {
  try {
    const db = await openSyncDb();
    const cutoff = Date.now() - maxAgeMs;
    const tx = db.transaction(READ_CACHE, "readwrite");
    const store = tx.objectStore(READ_CACHE);
    const perOwner = new Map<string, number>();
    // Mula pinakabago papunta sa pinakaluma
    const req = store.index("cachedAt").openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const entry = cursor.value as CachedResponse;
      const seen = (perOwner.get(entry.owner) ?? 0) + 1;
      perOwner.set(entry.owner, seen);
      if (entry.cachedAt < cutoff || seen > maxPerOwner) cursor.delete();
      cursor.continue();
    };
    await done(tx);
  } catch {
    // hindi kritikal
  }
}
