// Maliit na wrapper ng IndexedDB para sa offline na draft ng weekly report (walang dagdag na library).

export interface WeeklyRow { id?: string; date: string; text: string; }

export interface WeeklyContent {
  studentName: string;
  course: string;
  company: string;
  department: string;
  semester: string;
  rows: WeeklyRow[];
  supervisorName?: string;
  supervisorPosition?: string;
  /** YYYY-MM-DD */
  supervisorDate?: string;
  /** Ilang araw ang bawat pahina sa print/PDF; 0 o wala = lahat sa isang pahina */
  rowsPerPage?: number;
}

export interface WeeklyHeader {
  studentName: string;
  course: string;
  company: string;
  department: string;
  semester: string;
  collegeAbbreviation: string;
  weekFrom: string;
  weekTo: string;
  supervisorName: string;
  supervisorPosition: string;
  /** Landas ng na-upload na logo ng college (galing sa admin); walang laman kung wala */
  collegeLogoPath?: string;
}

export interface StoredDraft {
  key: string;
  owner: string;
  content: WeeklyContent;
  header: WeeklyHeader | null;
  clientUpdatedAt: number;
  dirty: boolean;
  /** Email ng may-ari (para sa logout at Sync center); wala sa mga lumang draft */
  ownerEmail?: string;
}

const DB_NAME = "practicum-offline";
const STORE = "weeklyDrafts";
const IMAGES = "weeklyImages";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "key" });
      if (!req.result.objectStoreNames.contains(IMAGES)) req.result.createObjectStore(IMAGES, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDraft(key: string): Promise<StoredDraft | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as StoredDraft | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveDraft(draft: StoredDraft): Promise<boolean> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(draft);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function removeDraft(key: string): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
  } catch {
    // hindi kritikal
  }
}
