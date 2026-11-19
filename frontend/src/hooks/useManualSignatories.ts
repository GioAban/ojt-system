import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_SIGNATORIES, loadPeople, loadReportSignatories, rememberPerson, savePeople, saveReportSignatories,
  type ReportSignatories, type SignatoryPerson,
} from "@/lib/manualSignatories";

/**
 * Pirmahan ng isang report na naka-save sa device lang (IndexedDB), at ang listahan ng dating nagamit na tao.
 * Bawat pagbabago ay agad na isine-save sa device; walang ipinapadala sa server.
 */
export function useManualSignatories(reportId: number) {
  const [value, setValue] = useState<ReportSignatories>(EMPTY_SIGNATORIES);
  const [people, setPeopleState] = useState<SignatoryPerson[]>([]);
  const valueRef = useRef(value);
  const peopleRef = useRef(people);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadReportSignatories(reportId), loadPeople()]).then(([sig, list]) => {
      if (cancelled) return;
      valueRef.current = sig;
      peopleRef.current = list;
      setValue(sig);
      setPeopleState(list);
    });
    return () => { cancelled = true; };
  }, [reportId]);

  const update = useCallback((next: ReportSignatories) => {
    valueRef.current = next;
    setValue(next);
    void saveReportSignatories(reportId, next);
  }, [reportId]);

  const setPeople = useCallback((next: SignatoryPerson[]) => {
    peopleRef.current = next;
    setPeopleState(next);
    void savePeople(next);
  }, []);

  /** Pagsara ng panel: tandaan ang mga pangalang ginamit (hindi bawat titik habang nagta-type) */
  const rememberUsed = useCallback(() => {
    let list = peopleRef.current;
    for (const s of valueRef.current.items) {
      if (s.name.trim()) list = rememberPerson(list, { name: s.name, position: s.position, align: s.align });
    }
    if (JSON.stringify(list) !== JSON.stringify(peopleRef.current)) setPeople(list);
  }, [setPeople]);

  return { value, update, people, setPeople, rememberUsed };
}
