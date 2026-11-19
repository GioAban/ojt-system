import { createStore, useStore } from "@/offline/store";

/**
 * Para sa banner ng page: may ipinakitang naka-save na datos (at kailan ito na-save), o may hindi
 * nabuksan dahil wala pang naka-save. Nakatali sa pathname para hindi madala sa ibang page.
 */
export interface PageCacheState {
  path: string;
  /** Pinakaluma sa mga naka-save na sagot na ipinakita sa page na ito */
  servedAt: number | null;
  /** May hiling na walang naka-save na kopya */
  missing: boolean;
}

const pageCache = createStore<PageCacheState>({ path: "", servedAt: null, missing: false });

const here = () => (typeof window === "undefined" ? "" : window.location.pathname);

function forHere(s: PageCacheState): PageCacheState {
  const path = here();
  return s.path === path ? s : { path, servedAt: null, missing: false };
}

export function noteServedFromCache(cachedAt: number) {
  pageCache.set((s) => {
    const cur = forHere(s);
    return { ...cur, servedAt: cur.servedAt === null ? cachedAt : Math.min(cur.servedAt, cachedAt) };
  });
}

export function noteMissing() {
  pageCache.set((s) => ({ ...forHere(s), missing: true }));
}

/** Bagong datos mula sa server: wala nang ipinapakitang lumang kopya sa page na ito */
export function noteFresh() {
  pageCache.set((s) => {
    const cur = forHere(s);
    return cur.servedAt === null && !cur.missing && s.path === cur.path ? s : { path: cur.path, servedAt: null, missing: false };
  });
}

export function usePageCache(pathname: string): PageCacheState {
  const s = useStore(pageCache);
  return s.path === pathname ? s : { path: pathname, servedAt: null, missing: false };
}
