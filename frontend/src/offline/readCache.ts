import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { getCached, pruneCache, putCached } from "@/offline/db";
import { reportReachable, reportUnreachable, setAuthExpired } from "@/offline/connection";
import { noteFresh, noteMissing, noteServedFromCache } from "@/offline/pageCache";
import { OFFLINE_VIEW_MS, cachingAllowed, currentOwner, offlineViewExpired } from "@/offline/session";

/**
 * Read cache para mabuksan offline ang mga page na nabuksan na: ang bawat matagumpay na GET ng
 * student/coordinator ay itinatabi sa IndexedDB (bawat user). Kapag walang koneksyon, ang naka-save na
 * kopya ang ibinabalik at may tala ang page ("Showing saved data from ...").
 * Hindi nito binabago ang sagot kapag online. Hindi kailanman itinatabi ang mga file at signed link.
 */

const CACHEABLE = [/^\/student\//, /^\/coordinator\//, /^\/semesters(\/|$|\?)/];
/** Mga file, download at signed link: hindi itinatabi */
const NEVER = [/\/file(-url)?(\/|$|\?)/, /\/files?\/\d+/, /\/download/, /\/logo(\/|$|\?)/, /\/export/];
const MAX_BYTES = 1_500_000;
const MAX_PER_OWNER = 300;
/** Patay ang server sa likod ng Caddy: parang offline */
const GATEWAY = new Set([502, 503, 504]);

export const CACHED_AT_HEADER = "x-offline-cached-at";

function pathOf(config: InternalAxiosRequestConfig): string | null {
  const url = config.url ?? "";
  if (!url || /^https?:\/\//i.test(url)) return null;
  return url.startsWith("/") ? url : `/${url}`;
}

function cacheable(config: InternalAxiosRequestConfig | undefined): string | null {
  if (!config || (config.method ?? "get").toLowerCase() !== "get") return null;
  if (config.responseType && config.responseType !== "json") return null;
  const path = pathOf(config);
  if (!path || !CACHEABLE.some((r) => r.test(path)) || NEVER.some((r) => r.test(path))) return null;
  const owner = currentOwner();
  if (!owner) return null;
  const params = config.params ? JSON.stringify(sortKeys(config.params as Record<string, unknown>)) : "";
  return `${owner}|${path}${params ? `?${params}` : ""}`;
}

function sortKeys(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

function authHeader(headers: unknown): string | undefined {
  const h = headers as { get?: (k: string) => unknown; [k: string]: unknown } | undefined;
  if (!h) return undefined;
  const v = typeof h.get === "function" ? h.get("x-auth-error") : h["x-auth-error"];
  return typeof v === "string" ? v : undefined;
}

let writes = 0;

function store(key: string, res: AxiosResponse) {
  if (!cachingAllowed()) return;
  let size: number;
  try {
    size = JSON.stringify(res.data ?? null).length;
  } catch {
    return;
  }
  if (size > MAX_BYTES) return;
  const owner = currentOwner();
  if (!owner) return;
  void putCached({ key, owner, url: res.config.url ?? "", data: res.data, cachedAt: Date.now() });
  // Paminsan-minsang paglilinis
  if (++writes % 25 === 0) void pruneCache(OFFLINE_VIEW_MS, MAX_PER_OWNER);
}

export function installReadCache(api: AxiosInstance) {
  // Paglilinis sa pagbukas ng app: luma sa 7 araw at sobra sa limit
  void pruneCache(OFFLINE_VIEW_MS, MAX_PER_OWNER);

  api.interceptors.response.use(
    (res) => {
      reportReachable();
      if (authHeader(res.headers) === "TOKEN_EXPIRED") setAuthExpired(true);
      const key = cacheable(res.config);
      if (key) {
        noteFresh();
        store(key, res);
      }
      return res;
    },
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) throw error;
      const status = error.response?.status;
      if (error.response && !GATEWAY.has(status ?? 0)) {
        reportReachable();
        if (authHeader(error.response.headers) === "TOKEN_EXPIRED") setAuthExpired(true);
        throw error;
      }
      // Walang sagot (offline) o patay ang server: suriin ang koneksyon at subukan ang naka-save na kopya
      if (error.code === "ERR_CANCELED") throw error;
      reportUnreachable();
      const key = cacheable(error.config);
      if (!key || !cachingAllowed() || offlineViewExpired()) {
        if (key) noteMissing();
        throw error;
      }
      const hit = await getCached(key);
      if (!hit || Date.now() - hit.cachedAt > OFFLINE_VIEW_MS) {
        noteMissing();
        throw error;
      }
      noteServedFromCache(hit.cachedAt);
      const response: AxiosResponse = {
        data: hit.data,
        status: 200,
        statusText: "OK",
        headers: { [CACHED_AT_HEADER]: String(hit.cachedAt) },
        config: error.config!,
        request: undefined,
      };
      return response;
    },
  );
}
