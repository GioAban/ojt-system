import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { SemesterContext } from "@/contexts/semesterContext";
import type { Semester } from "@/types/semester";

const STORAGE_KEY = "selectedSemesterId";

function readStoredId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

function hasToken() {
  return Boolean(localStorage.getItem("token"));
}

export function SemesterProvider({ children }: { children: ReactNode }) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(readStoredId);
  const [loaded, setLoaded] = useState(() => !hasToken());
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!hasToken()) return;
    let cancelled = false;

    api
      .get<Semester[]>("/semesters")
      .then((res) => {
        if (cancelled) return;
        setSemesters(res.data.filter((s) => !s.isArchived));
        setError("");
      })
      .catch((err) => {
        if (!cancelled)
          setError(getErrorMessage(err, "Failed to load server | semesters."));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Ang napili kung valid pa; kung hindi, ang default na semester; kung wala, ang una
  const semesterId = useMemo(() => {
    if (selectedId !== null && semesters.some((s) => s.id === selectedId))
      return selectedId;
    const fallback = semesters.find((s) => s.isDefault) ?? semesters[0];
    return fallback ? fallback.id : null;
  }, [selectedId, semesters]);

  const setSemesterId = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setSelectedId(id);
  }, []);

  const value = useMemo(
    () => ({
      semesters,
      semesterId,
      semester: semesters.find((s) => s.id === semesterId) ?? null,
      setSemesterId,
      loaded,
      error,
      reload: () => setReloadToken((t) => t + 1),
    }),
    [semesters, semesterId, setSemesterId, loaded, error],
  );

  return (
    <SemesterContext.Provider value={value}>
      {children}
    </SemesterContext.Provider>
  );
}
