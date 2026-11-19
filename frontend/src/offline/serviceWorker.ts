import { registerSW } from "virtual:pwa-register";
import { API_BASE } from "@/lib/apiBase";
import { createStore, useStore } from "@/offline/store";

/**
 * Service worker (vite-plugin-pwa): nakatabi ang app mismo (HTML, JS, CSS, mga icon) para mabuksan
 * offline. Hindi nito itinatabi ang datos ng API.
 *
 * Kill switch: bago mag-register, tinatanong ang /api/public/client-config. Kapag serviceWorker=false
 * (APP_SW_ENABLED=false sa server), inaalis ang service worker at ang cache ng app. Kapag offline at
 * hindi matanong, nananatili ang dati.
 */

interface UpdateState {
  available: boolean;
}

const update = createStore<UpdateState>({ available: false });
export const useAppUpdate = () => useStore(update);

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export function reloadToUpdate() {
  if (applyUpdate) void applyUpdate(true);
  else window.location.reload();
}

export function dismissUpdate() {
  update.set({ available: false });
}

const HOUR = 60 * 60 * 1000;

async function serviceWorkerAllowed(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/public/client-config`, { cache: "no-store" });
    if (!res.ok) return true;
    const body = (await res.json()) as { serviceWorker?: boolean };
    return body.serviceWorker !== false;
  } catch {
    // Offline o hindi maabot: huwag galawin
    return true;
  }
}

/** Inaalis ang lahat ng service worker at cache ng app sa origin na ito */
export async function removeServiceWorker(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // hindi kritikal
  }
}

export async function setupServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  if (!(await serviceWorkerAllowed())) {
    await removeServiceWorker();
    return;
  }

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      update.set({ available: true });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Tinitingnan kung may bagong bersyon: bawat oras at sa pagbalik sa tab
      window.setInterval(() => void registration.update().catch(() => undefined), HOUR);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
      });
    },
  });
}
