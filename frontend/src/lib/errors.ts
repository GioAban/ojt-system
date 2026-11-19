import axios from "axios";
import { isOffline } from "@/offline/connection";

export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  if (axios.isAxiosError(err)) {
    // Walang sagot dahil offline: malinaw na mensahe sa halip na pangkalahatang "Couldn't ..."
    if (!err.response && err.code !== "ERR_CANCELED" && (isOffline() || !navigator.onLine)) {
      return "You're offline. This needs a connection. Try again when you're back online.";
    }
    const data = err.response?.data;
    if (typeof data === "string" && data) return data;
    if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
      return (data as { message: string }).message;
    }
    if (err.response?.status === 403)
      return "You don't have permission to do that.";
  }
  return fallback;
}

/** Mga error bawat field mula sa server ({ fieldErrors: { field: message } }); walang laman kung wala */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const data = err.response?.data as { fieldErrors?: unknown } | undefined;
  const fe = data && typeof data === "object" ? data.fieldErrors : undefined;
  if (!fe || typeof fe !== "object") return {};
  return Object.fromEntries(Object.entries(fe as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}
