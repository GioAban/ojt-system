import { API_BASE } from "@/lib/apiBase";
import { markOnline } from "@/offline/session";
import { createStore, useStore } from "@/offline/store";

/**
 * Totoong kalagayan ng koneksyon: navigator.onLine at isang ping sa API (dahil "online" pa rin ang
 * navigator.onLine kahit naputol ang Wi-Fi sa labas o patay ang server).
 */
export interface ConnectionState {
  online: boolean;
  /** Kasalukuyang nagpi-ping */
  checking: boolean;
  /** Nag-expire ang login (galing sa server: X-Auth-Error: TOKEN_EXPIRED) */
  authExpired: boolean;
  /** Kailan huling nagbago ang online/offline */
  changedAt: number;
}

const PING_TIMEOUT_MS = 5000;
const ONLINE_INTERVAL_MS = 30_000;
const OFFLINE_INTERVAL_MS = 10_000;

export const connection = createStore<ConnectionState>({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  checking: false,
  authExpired: false,
  changedAt: Date.now(),
});

export const useConnection = () => useStore(connection);

export function isOffline(): boolean {
  return !connection.get().online;
}

function setOnline(online: boolean) {
  connection.set((s) => (s.online === online && !s.checking ? s : { ...s, online, checking: false, changedAt: s.online === online ? s.changedAt : Date.now() }));
  if (online) markOnline();
}

let pinging: Promise<boolean> | null = null;

/** Sinusuri kung naaabot ang server ngayon. Iisang ping lang ang tumatakbo sa isang pagkakataon. */
export function checkNow(): Promise<boolean> {
  if (pinging) return pinging;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setOnline(false);
    return Promise.resolve(false);
  }
  connection.set((s) => ({ ...s, checking: true }));
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  pinging = fetch(`${API_BASE}/public/ping`, { cache: "no-store", signal: controller.signal })
    .then((res) => res.ok)
    .catch(() => false)
    .then((ok) => {
      window.clearTimeout(timer);
      pinging = null;
      setOnline(ok);
      return ok;
    });
  return pinging;
}

/** May sagot mula sa server (kahit anong status maliban sa 502/503/504): naaabot ito */
export function reportReachable() {
  if (!connection.get().online) setOnline(true);
  else markOnline();
}

/** Walang sagot (network error) o patay ang server sa likod ng Caddy: suriin agad */
export function reportUnreachable() {
  void checkNow();
}

export function setAuthExpired(expired: boolean) {
  connection.set((s) => (s.authExpired === expired ? s : { ...s, authExpired: expired }));
}

let started = false;
let timer: number | undefined;

function schedule() {
  window.clearTimeout(timer);
  const ms = connection.get().online ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS;
  timer = window.setTimeout(() => {
    if (document.visibilityState === "visible") void checkNow().finally(schedule);
    else schedule();
  }, ms);
}

/** Sinisimulan isang beses (main.tsx) */
export function startConnectionMonitor() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void checkNow());
  // Agad na offline: hindi na kailangang hintayin ang ping
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("focus", () => void checkNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkNow();
  });
  connection.subscribe(schedule);
  void checkNow().finally(schedule);
}
