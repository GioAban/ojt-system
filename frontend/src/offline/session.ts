/**
 * Sino ang naka-login at ang mga tuntunin ng offline mode para sa kaniya.
 * Lahat ng naka-save sa device ay may "owner" (email) para hindi maghalo ang mga user sa iisang computer.
 */

/** Ilang araw puwedeng tingnan ang naka-save na datos habang offline (at gaano katagal itinatago ang read cache) */
export const OFFLINE_VIEW_DAYS = 7;
export const OFFLINE_VIEW_MS = OFFLINE_VIEW_DAYS * 24 * 60 * 60 * 1000;

const SHARED_KEY = "shared_device";
const lastOnlineKey = (owner: string) => `offline_last_online:${owner}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Email ng naka-login (ito ang owner ng lahat ng naka-save sa device); null kung walang naka-login */
export function currentOwner(): string | null {
  const token = read("token");
  const email = read("email");
  return token && email ? email.trim().toLowerCase() : null;
}

/** Pinili sa login: "This is a shared computer" */
export function isSharedDevice(): boolean {
  return read(SHARED_KEY) === "1";
}

export function setSharedDevice(shared: boolean) {
  try {
    if (shared) localStorage.setItem(SHARED_KEY, "1");
    else localStorage.removeItem(SHARED_KEY);
  } catch {
    // walang storage
  }
}

/** Puwedeng mag-save ng datos ng user sa device (hindi kapag shared computer) */
export function cachingAllowed(): boolean {
  return currentOwner() !== null && !isSharedDevice();
}

let lastWrite = 0;

/** Tinatawag kapag naabot ang server; isinusulat nang hindi hihigit sa isang beses kada minuto */
export function markOnline() {
  const owner = currentOwner();
  if (!owner) return;
  const now = Date.now();
  if (now - lastWrite < 60_000) return;
  lastWrite = now;
  try {
    localStorage.setItem(lastOnlineKey(owner), String(now));
  } catch {
    // walang storage
  }
}

export function lastOnlineAt(): number | null {
  const owner = currentOwner();
  if (!owner) return null;
  const v = Number(read(lastOnlineKey(owner)));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Lumampas na sa 7 araw mula nang huling naabot ang server: hindi na ipinapakita ang naka-save na datos */
export function offlineViewExpired(): boolean {
  const last = lastOnlineAt();
  return last !== null && Date.now() - last > OFFLINE_VIEW_MS;
}
