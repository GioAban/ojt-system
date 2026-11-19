/** Base URL ng API. Sa production, same-origin "/api" (Caddy ang nagpo-proxy). Sa laptop, localhost. */
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080/api";
