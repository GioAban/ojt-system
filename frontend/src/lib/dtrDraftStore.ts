// Maliit na wrapper ng IndexedDB para sa offline na draft ng DTR (hiwalay na database, walang dagdag na library).

export interface DtrRow {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  worked: boolean;
  /** 24-oras na "HH:MM"; walang laman kung hindi pa nilalagay */
  amIn: string;
  amOut: string;
  pmIn: string;
  pmOut: string;
}

export interface DtrSchedule { amIn: string; amOut: string; pmIn: string; pmOut: string; }

export interface DtrContent {
  studentName: string;
  courseYear: string;
  company: string;
  department: string;
  semester: string;
  monthLabel: string;
  rows: DtrRow[];
  supervisorName?: string;
  supervisorPosition?: string;
  schedule: DtrSchedule;
  /** Ilang araw ang bawat pahina sa print/PDF; 0 o wala = lahat sa isang pahina */
  rowsPerPage?: number;
}

export interface DtrHeader {
  studentName: string;
  course: string;
  year: string;
  company: string;
  department: string;
  semester: string;
  collegeAbbreviation: string;
  collegeLogoPath?: string;
  monthLabel: string;
  /** YYYY-MM-DD; walang laman kung hindi mabasa ang buwan */
  monthStart: string;
  monthEnd: string;
  supervisorName: string;
  supervisorPosition: string;
}

export interface StoredDtr {
  key: string;
  owner: string;
  content: DtrContent;
  header: DtrHeader | null;
  clientUpdatedAt: number;
  dirty: boolean;
}

const DB_NAME = "practicum-dtr";
const STORE = "dtrDrafts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDtr(key: string): Promise<StoredDtr | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as StoredDtr | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveDtr(draft: StoredDtr): Promise<boolean> {
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
