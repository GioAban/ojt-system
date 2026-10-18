import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useSemester } from "@/contexts/semesterContext";

const EVENT = "company-requests-changed";

/** Ipaalam sa sidebar na nagbago ang bilang (hal. pagkatapos mag-approve) */
export function notifyCompanyRequestsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

/** Bilang ng pending na hiling ng students, para sa badge ng sidebar (sa napiling semester) */
export function usePendingCompanyRequests(enabled = true) {
  const { semesterId } = useSemester();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (semesterId === null) return;
    try {
      const res = await api.get<{ count: number }>(
        "/coordinator/company-requests/pending-count",
        { params: { semesterId } },
      );
      setCount(res.data.count);
    } catch {
      // mananatili ang huling bilang
    }
  }, [semesterId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    window.addEventListener(EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, [enabled, load]);

  return count;
}
