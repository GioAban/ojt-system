import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type { NotificationsData } from "@/types/studentProfile";

const EVENT = "student-notifications-changed";

export function notifyStudentNotificationsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

/** Bilang ng hindi pa nababasang abiso ng student. Nagre-refresh kada minuto. */
export function useStudentUnread(enabled: boolean) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) return;
    api
      .get<NotificationsData>("/student/notifications")
      .then((res) => setUnread(res.data.unread))
      .catch(() => {
        // hindi kritikal: manatili ang huling bilang
      });
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return;
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(EVENT, refresh);
    };
  }, [enabled, refresh]);

  return unread;
}
