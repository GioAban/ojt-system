/** Ang ?token= ng link sa email (walang binabago) */
export function readUrlToken(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

/**
 * Alisin ang ?token= sa address bar at history, para hindi makita sa screenshot, sa history, o sa kinopyang address.
 * Tawagin sa useEffect (hindi sa render).
 */
export function hideUrlToken() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("token")) return;
  params.delete("token");
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
}
