import type { NavigateFunction } from "react-router-dom";

/**
 * Nag-expire ang login: tinatanggal lang ang token (hindi ang datos sa device) at pumupunta sa login.
 * Ang mga naka-save sa device ay naiiwan; magsi-sync lang ito kapag parehong user ang nag-login.
 */
export function startRelogin(navigate: NavigateFunction) {
  try {
    localStorage.removeItem("token");
  } catch {
    // walang storage
  }
  navigate("/login", { replace: true, state: { relogin: true } });
}
