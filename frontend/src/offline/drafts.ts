/**
 * Tingin (at paglilinis) sa mga dati nang offline na draft: weekly report, DTR, report ng coordinator at
 * pirmahan. Hindi nito binabago kung paano gumagana ang mga editor; binabasa lang nito ang IndexedDB nila.
 * Hindi ito gumagawa ng database na wala pa (para hindi masira ang sariling upgrade ng mga editor).
 */

export type DraftKind = "weekly" | "dtr" | "report" | "signatories";

export interface PendingDraft {
  /** db|store|key */
  id: string;
  kind: DraftKind;
  label: string;
  detail: string;
  updatedAt: number | null;
  /** Saan bubuksan para mag-sync */
  link: string;
}

interface Source {
  db: string;
  store: string;
  kind: DraftKind;
}

const WEEKLY: Source = { db: "practicum-offline", store: "weeklyDrafts", kind: "weekly" };
const DTR: Source = { db: "practicum-dtr", store: "dtrDrafts", kind: "dtr" };
const REPORTS: Source = { db: "practicum-coordinator-reports", store: "reportDrafts", kind: "report" };
const SIGNATORIES: Source = { db: "practicum-coordinator-reports", store: "signatories", kind: "signatories" };

/** Mga store na may personal na datos na binubura sa logout (kasama ang hindi pending) */
const REPORT_EXTRA_STORES = ["manualSignatories", "signatoryPeople"];

/** Binubuksan lang kung mayroon na; kung wala, null (at hindi ito nililikha) */
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let created = false;
    const req = indexedDB.open(name);
    req.onupgradeneeded = () => {
      // Wala pa ito: huwag likhain (ina-abort para walang matirang database na bersyon 1)
      created = true;
      req.transaction?.abort();
    };
    req.onsuccess = () => {
      if (created) {
        req.result.close();
        resolve(null);
      } else resolve(req.result);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

interface Raw {
  key: string;
  owner?: string;
  ownerEmail?: string;
  dirty?: boolean;
  clientUpdatedAt?: number;
  updatedAt?: number;
  title?: string;
  header?: { weekFrom?: string; weekTo?: string; month?: string; monthLabel?: string } | null;
}

async function readAll(src: Source): Promise<Raw[]> {
  const db = await openExisting(src.db);
  if (!db) return [];
  try {
    if (!db.objectStoreNames.contains(src.store)) return [];
    return await new Promise((resolve) => {
      const req = db.transaction(src.store, "readonly").objectStore(src.store).getAll();
      req.onsuccess = () => resolve((req.result as Raw[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/**
 * Sa user ba ito? Ang weekly at DTR ay may ownerEmail mula ngayon; ang mas luma (walang ownerEmail)
 * ay itinuturing na sa kasalukuyang user, dahil iisang draft lang bawat gawain ang naitatabi ng editor.
 */
function mine(src: Source, r: Raw, owner: string): boolean {
  switch (src.kind) {
    case "weekly":
    case "dtr":
      return !r.ownerEmail || r.ownerEmail.toLowerCase() === owner;
    case "report":
      return (r.owner ?? "").toLowerCase() === owner;
    case "signatories":
      return r.key.toLowerCase() === owner;
  }
}

function refIdOf(key: string) {
  return key.split(":").slice(1).join(":");
}

function describe(src: Source, r: Raw): PendingDraft {
  const id = `${src.db}|${src.store}|${r.key}`;
  const updatedAt = r.clientUpdatedAt ?? r.updatedAt ?? null;
  switch (src.kind) {
    case "weekly": {
      const range = r.header?.weekFrom ? `${r.header.weekFrom} – ${r.header.weekTo ?? ""}` : "";
      return { id, kind: "weekly", label: "Weekly report", detail: range, updatedAt, link: `/student/work/weekly/${refIdOf(r.key)}` };
    }
    case "dtr":
      return { id, kind: "dtr", label: "Daily time record", detail: r.header?.monthLabel ?? r.header?.month ?? "", updatedAt, link: `/student/work/dtr/${refIdOf(r.key)}` };
    case "report":
      return { id, kind: "report", label: "Report", detail: r.title ?? "", updatedAt, link: "/coordinator/reports" };
    case "signatories":
      return { id, kind: "signatories", label: "Report signatories", detail: "", updatedAt, link: "/coordinator/reports" };
  }
}

/** Mga draft ng user na hindi pa naipapadala sa server */
export async function pendingDrafts(owner: string): Promise<PendingDraft[]> {
  const out: PendingDraft[] = [];
  for (const src of [WEEKLY, DTR, REPORTS, SIGNATORIES]) {
    for (const r of await readAll(src)) {
      if (r.dirty && mine(src, r, owner)) out.push(describe(src, r));
    }
  }
  return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

async function deleteWhere(dbName: string, store: string, match: (r: Raw) => boolean): Promise<void> {
  const db = await openExisting(dbName);
  if (!db) return;
  try {
    if (!db.objectStoreNames.contains(store)) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(store, "readwrite");
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (match(cursor.value as Raw)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}

/** Binubura ang isang draft (Discard sa Sync center) */
export async function discardDraft(id: string): Promise<void> {
  const [dbName, store, ...rest] = id.split("|");
  const key = rest.join("|");
  await deleteWhere(dbName, store, (r) => r.key === key);
}

/** Logout: binubura ang lahat ng draft at personal na datos ng user sa device (synced man o hindi) */
export async function deleteAllDraftsOf(owner: string): Promise<void> {
  for (const src of [WEEKLY, DTR, REPORTS, SIGNATORIES]) {
    await deleteWhere(src.db, src.store, (r) => mine(src, r, owner));
  }
  for (const store of REPORT_EXTRA_STORES) {
    // manualSignatories: <email>:saved:<id>; signatoryPeople: <email>
    await deleteWhere(REPORTS.db, store, (r) => {
      const k = (r.key ?? "").toLowerCase();
      return k === owner || k.startsWith(`${owner}:`);
    });
  }
}
