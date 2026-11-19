import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { loadSignatories, saveSignatories } from "@/lib/reportDraftStore";
import type {
  ReportContext, Signatory, SignatoryOverrides, SignatoryRole, SignatorySet,
} from "@/types/reports";

export const SIGNATORY_ROLES: SignatoryRole[] = ["prepared", "programHead", "dean", "chair"];

function parseOverrides(raw: string | null | undefined): SignatoryOverrides | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as SignatoryOverrides;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** Ang binago ng coordinator kung mayroon (kahit blangko), kung wala ay ang default ng system */
export function resolveSignatories(defaults: SignatorySet, saved: SignatoryOverrides | null): SignatorySet {
  const out = {} as SignatorySet;
  for (const role of SIGNATORY_ROLES) {
    const d = defaults[role] ?? { name: "", title: "" };
    const s = saved?.[role] ?? {};
    out[role] = {
      name: s.name !== undefined ? s.name : d.name,
      title: s.title !== undefined ? s.title : d.title,
    };
  }
  return out;
}

/**
 * Pirmahan na tanda bawat coordinator: naka-save sa account (at sa device habang offline).
 * Pareho sa lahat ng report, kaya hindi na kailangang i-type ulit.
 */
export function useSignatories(context: ReportContext | null) {
  const owner = localStorage.getItem("email") ?? "";
  const [saved, setSaved] = useState<SignatoryOverrides | null>(null);
  const [loaded, setLoaded] = useState(false);
  const savedRef = useRef<SignatoryOverrides | null>(null);
  const dirtyRef = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const push = useCallback(async () => {
    if (!dirtyRef.current || !navigator.onLine) return;
    try {
      const body = { content: savedRef.current ? JSON.stringify(savedRef.current) : null };
      await api.put("/coordinator/reports/signatories", body);
      dirtyRef.current = false;
      await saveSignatories({ key: owner, saved: savedRef.current, dirty: false });
    } catch {
      // susubukan ulit sa susunod na pagbabago o pagbalik online
    }
  }, [owner]);

  // Unang kuha: ang nasa device kung may hindi pa naipapadala, kung wala ay ang nasa account
  useEffect(() => {
    if (!context) return;
    let cancelled = false;
    (async () => {
      const local = await loadSignatories(owner);
      if (cancelled) return;
      if (local?.dirty) {
        savedRef.current = local.saved;
        dirtyRef.current = true;
        setSaved(local.saved);
        void push();
      } else {
        const fromServer = parseOverrides(context.savedSignatories);
        savedRef.current = fromServer;
        setSaved(fromServer);
        void saveSignatories({ key: owner, saved: fromServer, dirty: false });
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [context, owner, push]);

  useEffect(() => {
    const goOnline = () => void push();
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.clearTimeout(timer.current);
    };
  }, [push]);

  const store = useCallback((next: SignatoryOverrides | null) => {
    savedRef.current = next;
    dirtyRef.current = true;
    setSaved(next);
    void saveSignatories({ key: owner, saved: next, dirty: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void push(), 800);
  }, [owner, push]);

  const set = useCallback((role: SignatoryRole, field: keyof Signatory, value: string) => {
    const current = savedRef.current ?? {};
    store({ ...current, [role]: { ...(current[role] ?? {}), [field]: value } });
  }, [store]);

  const reset = useCallback(() => store(null), [store]);

  /** Pagkatapos maisulat ang pirmahan mula sa report: kunin ang nasa account (walang ipinapadala) */
  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ content: string | null }>("/coordinator/reports/signatories");
      const next = parseOverrides(res.data.content);
      savedRef.current = next;
      dirtyRef.current = false;
      setSaved(next);
      await saveSignatories({ key: owner, saved: next, dirty: false });
    } catch {
      // mananatili ang huling alam; makukuha sa susunod na pagbukas
    }
  }, [owner]);

  const values = context ? resolveSignatories(context.defaults, saved) : null;
  const getSaved = useCallback(() => savedRef.current, []);
  return { values, saved, getSaved, loaded, set, reset, replace: store, refresh, customized: saved !== null };
}
