import { pendingDrafts, type PendingDraft } from "@/offline/drafts";
import { currentOwner } from "@/offline/session";
import { createStore, useStore } from "@/offline/store";

/**
 * Buod ng mga hindi pa naipapadala para sa status indicator at Sync center.
 * Sa Phase 1: ang mga dati nang draft (weekly, DTR, report, pirmahan). Sa susunod: pati ang outbox.
 */
export interface SyncSummary {
  drafts: PendingDraft[];
  /** Mga kailangang ayusin (outbox na pumalya; wala pa sa Phase 1) */
  failed: number;
  loaded: boolean;
}

export const syncSummary = createStore<SyncSummary>({ drafts: [], failed: 0, loaded: false });
export const useSyncSummary = () => useStore(syncSummary);

let running: Promise<void> | null = null;

export function refreshSyncSummary(): Promise<void> {
  if (running) return running;
  const owner = currentOwner();
  if (!owner) {
    syncSummary.set({ drafts: [], failed: 0, loaded: true });
    return Promise.resolve();
  }
  running = pendingDrafts(owner)
    .then((drafts) => {
      syncSummary.set((s) => ({ ...s, drafts, loaded: true }));
    })
    .finally(() => {
      running = null;
    });
  return running;
}

let started = false;

/** Paminsan-minsang pagbasa (bawat 10 segundo habang nakikita ang tab, at sa pagbalik sa tab) */
export function startSyncSummary() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshSyncSummary();
  window.setInterval(() => {
    if (document.visibilityState === "visible") void refreshSyncSummary();
  }, 10_000);
  window.addEventListener("focus", () => void refreshSyncSummary());
}
