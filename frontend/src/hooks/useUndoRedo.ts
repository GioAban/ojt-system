import { useCallback, useRef, useState } from "react";

const LIMIT = 100;
/** Sunod-sunod na pag-type sa iisang cell sa loob nito ay iisang hakbang */
const COALESCE_MS = 1000;

interface Entry<S> {
  state: S;
  key?: string;
  at: number;
}

/**
 * Undo/Redo para sa sesyong ito. Itinatala ang estado BAGO ang bawat pagbabago.
 * Gumagamit ng ref para tama ang pagkakasunod kahit sunod-sunod ang pagbabago bago mag-render.
 */
export function useUndoRedo<S>() {
  const past = useRef<Entry<S>[]>([]);
  const future = useRef<S[]>([]);
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });

  const sync = useCallback(() => setCounts({ undo: past.current.length, redo: future.current.length }), []);

  /** Tawagin bago baguhin ang estado; key = pangalan ng cell para pagsamahin ang tuloy-tuloy na pag-type */
  const record = useCallback((before: S, key?: string) => {
    const now = Date.now();
    const last = past.current[past.current.length - 1];
    if (key && last && last.key === key && now - last.at < COALESCE_MS) {
      last.at = now;
    } else {
      past.current.push({ state: before, key, at: now });
      if (past.current.length > LIMIT) past.current.shift();
    }
    future.current = [];
    sync();
  }, [sync]);

  const undo = useCallback((current: S): S | null => {
    const entry = past.current.pop();
    if (!entry) return null;
    future.current.push(current);
    sync();
    return entry.state;
  }, [sync]);

  const redo = useCallback((current: S): S | null => {
    const next = future.current.pop();
    if (next === undefined) return null;
    past.current.push({ state: current, at: 0 });
    sync();
    return next;
  }, [sync]);

  return { record, undo, redo, canUndo: counts.undo > 0, canRedo: counts.redo > 0 };
}
