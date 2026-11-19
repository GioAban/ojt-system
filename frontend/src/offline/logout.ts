import { deleteCachedForOwner } from "@/offline/db";
import { deleteAllDraftsOf } from "@/offline/drafts";
import { setAuthExpired } from "@/offline/connection";
import { currentOwner } from "@/offline/session";
import { refreshSyncSummary, syncSummary } from "@/offline/syncSummary";

/** Ilang pagbabago ang hindi pa naipapadala (para sa babala bago mag-logout) */
export async function unsyncedCount(): Promise<number> {
  await refreshSyncSummary();
  const s = syncSummary.get();
  return s.drafts.length + s.failed;
}

/**
 * Logout: binubura ang lahat ng personal na datos ng user sa device (read cache, mga draft, pirmahan),
 * pagkatapos ang session (localStorage at sessionStorage). Ang app mismo (service worker) ay naiiwan;
 * wala itong personal na datos.
 */
export async function logoutAndClear(): Promise<void> {
  const owner = currentOwner();
  if (owner) {
    await Promise.all([deleteCachedForOwner(owner), deleteAllDraftsOf(owner)]);
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // walang storage
  }
  setAuthExpired(false);
  syncSummary.set({ drafts: [], failed: 0, loaded: true });
}
