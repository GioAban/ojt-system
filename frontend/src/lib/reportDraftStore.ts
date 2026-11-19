// Offline na draft ng mga report ng coordinator. Hiwalay na IndexedDB database:
// hindi ginagalaw ang "practicum-offline" ng weekly report at DTR maker.

import type { ReportSource, SignatoryOverrides } from "@/types/reports";

export interface StoredReportDraft<C = unknown> {
  /** <email>:saved:<report id> */
  key: string;
  owner: string;
  title: string;
  content: C;
  source: ReportSource | null;
  clientUpdatedAt: number;
  dirty: boolean;
}

export interface StoredSignatories {
  /** email ng coordinator */
  key: string;
  saved: SignatoryOverrides | null;
  dirty: boolean;
}

const DB_NAME = "practicum-coordinator-reports";
const DRAFTS = "reportDrafts";
const SIGNATORIES = "signatories";
/** Mga pirmahang tina-type ng coordinator sa bawat report (sa device lang; hindi ipinapadala sa server) */
export const MANUAL_SIGNATORIES = "manualSignatories";
/** Mga dating nagamit na pangalan sa pirmahan (para sa mungkahi habang nagta-type) */
export const SIGNATORY_PEOPLE = "signatoryPeople";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    // Bersyon 2: dagdag ang manualSignatories at signatoryPeople (hindi ginagalaw ang dating laman)
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      for (const store of [DRAFTS, SIGNATORIES, MANUAL_SIGNATORIES, SIGNATORY_PEOPLE]) {
        if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(store: string, key: string): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(store, "readonly").objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function put(store: string, value: unknown): Promise<boolean> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export function loadReportDraft<C>(key: string) {
  return get<StoredReportDraft<C>>(DRAFTS, key);
}

export function saveReportDraft<C>(draft: StoredReportDraft<C>) {
  return put(DRAFTS, draft);
}

export function deleteReportDraft(key: string) {
  return deleteRecord(DRAFTS, key);
}

/** Pangkalahatang pagkuha, pag-save at pagbura sa isang store (para sa ibang bahagi ng Reports) */
export function getRecord<T>(store: string, key: string) {
  return get<T>(store, key);
}

export function putRecord(store: string, value: unknown) {
  return put(store, value);
}

export async function deleteRecord(store: string, key: string) {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // walang IndexedDB: wala ring buburahin
  }
}

export function loadSignatories(key: string) {
  return get<StoredSignatories>(SIGNATORIES, key);
}

export function saveSignatories(value: StoredSignatories) {
  return put(SIGNATORIES, value);
}
