import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useSemester } from "@/contexts/semesterContext";

/** Ang semester na napili sa top nav */
export function useSemesterSelection() {
  const { semesters, loaded, error, semesterId, setSemesterId } = useSemester();
  return { semesters, loaded, error, semesterId, setSemesterId };
}

interface SectionResult<T> {
  key: string;
  data: T | null;
  error: string;
}

export function useSectionData<T>(
  path: string,
  semesterId: number | null,
  params?: Record<string, string>,
) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<SectionResult<T> | null>(null);

  const paramsKey = params ? JSON.stringify(params) : "";
  const key =
    semesterId === null
      ? ""
      : `${path}:${semesterId}:${paramsKey}:${reloadToken}`;

  useEffect(() => {
    if (semesterId === null) return;
    let cancelled = false;
    const extra: Record<string, string> = paramsKey
      ? JSON.parse(paramsKey)
      : {};

    api
      .get<T>(path, { params: { semesterId, ...extra } })
      .then((res) => {
        if (!cancelled) setResult({ key, data: res.data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key,
            data: null,
            error: getErrorMessage(err, "Failed to load the data."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, semesterId, paramsKey, key]);

  const current = result && result.key === key ? result : null;

  function update(updater: (data: T) => T) {
    setResult((prev) =>
      prev && prev.data ? { ...prev, data: updater(prev.data) } : prev,
    );
  }

  /** Kinukuha ulit ang data nang hindi ipinapakita ang skeleton */
  async function refresh() {
    if (semesterId === null) return;
    const extra: Record<string, string> = paramsKey
      ? JSON.parse(paramsKey)
      : {};

    try {
      const res = await api.get<T>(path, { params: { semesterId, ...extra } });
      setResult({ key, data: res.data, error: "" });
    } catch {
      // mananatili ang kasalukuyang data; pwedeng mag-refresh ang user
    }
  }

  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loading: semesterId !== null && current === null,
    reload: () => setReloadToken((t) => t + 1),
    refresh,
    update,
  };
}
