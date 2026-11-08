import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { notify } from "@/lib/notify";
import { deleteReportDraft, loadReportDraft, saveReportDraft } from "@/lib/reportDraftStore";
import type { ReportSource, SavedReportDetail } from "@/types/reports";

export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

export const SYNC_TEXT: Record<SyncStatus, string> = {
  local: "Saving...",
  syncing: "Saving...",
  synced: "Saved",
  offline: "Offline, will sync",
  error: "Couldn't save to your account. Saved on this device, will retry",
};

const RETRY_MS = 15000;

interface SaveResult {
  saved: boolean;
  title: string;
  content: string;
  clientUpdatedAt: number;
}

interface Options<C> {
  reportId: number;
  /** Bagong laman mula sa datos ng system kung sira ang naka-save (dapat stable: module-level) */
  build: (source: ReportSource) => C;
  /** Sinusuri ang na-load na JSON; null kung sira */
  parse: (raw: unknown) => C | null;
}

const statusOf = (err: unknown) => (err as { response?: { status?: number } }).response?.status;

/**
 * Parehong paraan ng weekly report maker, para sa isang naka-save na report: unang kopya sa device
 * (IndexedDB), isine-save din sa account. Sa pag-load, ang mas bago sa dalawa ang gagamitin; kapag
 * mas bago ang nasa account (ibang device), iyon ang kukunin at may abiso.
 */
export function useReportDraft<C>({ reportId, build, parse }: Options<C>) {
  const owner = localStorage.getItem("email") ?? "";
  const key = `${owner}:saved:${reportId}`;

  const [source, setSource] = useState<ReportSource | null>(null);
  const [content, setContent] = useState<C | null>(null);
  const [title, setTitleState] = useState("");
  const [status, setStatus] = useState<SyncStatus>("local");
  const [loadError, setLoadError] = useState("");
  /** Nabura ang report (hal. sa ibang device) */
  const [gone, setGone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const contentRef = useRef<C | null>(null);
  const titleRef = useRef("");
  const sourceRef = useRef<ReportSource | null>(null);
  const stampRef = useRef(0);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const pushTimer = useRef<number | undefined>(undefined);
  /** Para matawag ulit ang push mula sa sarili nitong timer */
  const pushRef = useRef<() => Promise<boolean>>(async () => false);

  const persist = useCallback(async (dirty: boolean) => {
    const c = contentRef.current;
    if (c === null) return;
    await saveReportDraft<C>({
      key, owner, title: titleRef.current, content: c, source: sourceRef.current,
      clientUpdatedAt: stampRef.current, dirty,
    });
  }, [key, owner]);

  const schedulePush = (ms: number) => {
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void pushRef.current(), ms);
  };

  /** Totoo kung nasa account na ang huling kopya */
  const push = useCallback(async (): Promise<boolean> => {
    const c = contentRef.current;
    if (c === null) return false;
    if (!dirtyRef.current) return true;
    if (!navigator.onLine) { setStatus("offline"); return false; }
    const sent = stampRef.current;
    setStatus("syncing");
    try {
      const res = await api.put<SaveResult>(`/coordinator/reports/saved/${reportId}`, {
        title: titleRef.current, content: JSON.stringify(c), clientUpdatedAt: sent,
      });
      if (!res.data.saved) {
        // Mas bago ang nasa account (galing sa ibang device)
        const remote = parseJson(res.data.content, parse);
        if (remote !== null) {
          contentRef.current = remote;
          titleRef.current = res.data.title;
          stampRef.current = res.data.clientUpdatedAt;
          setContent(remote);
          setTitleState(res.data.title);
          dirtyRef.current = false;
          await persist(false);
          notify.success("Updated with your newer copy from another device.");
        }
        setStatus("synced");
        return true;
      }
      if (stampRef.current === sent) {
        dirtyRef.current = false;
        await persist(false);
        setStatus("synced");
      } else {
        schedulePush(800);
      }
      return true;
    } catch (err) {
      const code = statusOf(err);
      if (code === 404) {
        dirtyRef.current = false;
        window.clearTimeout(pushTimer.current);
        window.clearTimeout(saveTimer.current);
        void deleteReportDraft(key);
        setGone(true);
        return false;
      }
      setStatus(navigator.onLine ? "error" : "offline");
      // Sira ang kahilingan (hal. masyadong mahaba): walang saysay ulitin nang hindi binabago
      if (navigator.onLine && (!code || code >= 500)) schedulePush(RETRY_MS);
      return false;
    }
  }, [key, persist, parse, reportId]);

  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  const touched = useCallback(() => {
    stampRef.current = Date.now();
    dirtyRef.current = true;
    setStatus(navigator.onLine ? "local" : "offline");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(true), 300);
    schedulePush(1500);
  }, [persist]);

  const update = useCallback((next: C) => {
    contentRef.current = next;
    setContent(next);
    touched();
  }, [touched]);

  const setTitle = useCallback((next: string) => {
    titleRef.current = next;
    setTitleState(next);
    touched();
  }, [touched]);

  /** Pagkatapos sumulat sa system: bagong datos, parehong letterhead at pirmahan */
  const replaceSource = useCallback((next: ReportSource) => {
    const merged = { ...next, context: sourceRef.current?.context ?? next.context };
    sourceRef.current = merged;
    setSource(merged);
    void persist(dirtyRef.current);
  }, [persist]);

  /** Ang Save button: ise-save agad sa device at sa account */
  const saveNow = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    window.clearTimeout(pushTimer.current);
    await persist(dirtyRef.current);
    const ok = await pushRef.current();
    if (ok) notify.success("Saved.");
    else if (!navigator.onLine) notify.success("Saved on this device. It will sync when you're back online.");
    else notify.error("Couldn't save to your account. Your copy is safe on this device.");
  }, [persist]);

  // Pag-load: pinaghahambing ang kopya sa device at sa account; ang mas bago ang gagamitin
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadReportDraft<C>(key);
      let server: SavedReportDetail | null = null;
      let failure = "";
      try {
        server = (await api.get<SavedReportDetail>(`/coordinator/reports/saved/${reportId}`)).data;
      } catch (err) {
        const code = statusOf(err);
        if (code === 404) {
          if (cancelled) return;
          void deleteReportDraft(key);
          setGone(true);
          return;
        }
        if (code) failure = "Couldn't load this report. Please try again.";
      }
      if (cancelled) return;

      if (!server) {
        if (local && local.source && !failure) {
          sourceRef.current = local.source;
          contentRef.current = local.content;
          titleRef.current = local.title;
          stampRef.current = local.clientUpdatedAt;
          dirtyRef.current = local.dirty;
          setSource(local.source);
          setContent(local.content);
          setTitleState(local.title);
          setLoadError("");
          setStatus(local.dirty ? "offline" : "synced");
        } else {
          setLoadError(failure || "Open this report once while online so it can be saved on this device.");
        }
        return;
      }

      const localUsable = local && local.owner === owner ? local : null;
      const useLocal = localUsable !== null && (localUsable.dirty || localUsable.clientUpdatedAt >= server.clientUpdatedAt);
      const chosen = (useLocal ? parse(localUsable.content) : parseJson(server.content, parse)) ?? build(server.source);
      sourceRef.current = server.source;
      contentRef.current = chosen;
      titleRef.current = useLocal ? localUsable.title : server.title;
      stampRef.current = useLocal ? localUsable.clientUpdatedAt : server.clientUpdatedAt;
      dirtyRef.current = useLocal && localUsable.dirty;
      setSource(server.source);
      setContent(chosen);
      setTitleState(titleRef.current);
      setLoadError("");
      setStatus(dirtyRef.current ? "local" : "synced");
      await persist(dirtyRef.current);
      if (dirtyRef.current) void push();
    })();
    return () => { cancelled = true; };
  }, [key, owner, reportId, attempt, build, parse, persist, push]);

  // Balik sa online -> i-sync ang hindi pa na-save sa account
  useEffect(() => {
    const goOnline = () => {
      if (dirtyRef.current) void pushRef.current();
      else setStatus("synced");
    };
    const goOffline = () => setStatus("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Siguradong na-save sa device bago isara ang tab
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) void persist(true); };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [persist]);

  // Paglabas sa editor: huwag iwanan ang hindi pa naise-save
  useEffect(() => () => {
    window.clearTimeout(saveTimer.current);
    window.clearTimeout(pushTimer.current);
    if (dirtyRef.current) {
      void persist(true);
      void pushRef.current();
    }
  }, [persist]);

  const ready = content !== null && source !== null && !gone;
  return {
    ready,
    source: ready ? source : null,
    content: ready ? content : null,
    title,
    setTitle,
    update,
    saveNow,
    replaceSource,
    /** Ang pinakabagong laman (kahit hindi pa nare-render); para sa sunod-sunod na pagbabago */
    get: () => contentRef.current,
    status,
    loadError,
    gone,
    retry: () => setAttempt((n) => n + 1),
  };
}

function parseJson<C>(raw: string, parse: (raw: unknown) => C | null): C | null {
  try {
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
