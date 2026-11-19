import { useCallback, useEffect, useState } from "react";

/** Pabilang pababa (segundo) para sa mga "Resend" button. start(60) = hindi muna puwede sa loob ng 60 segundo. */
export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => (initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + Math.max(0, seconds) * 1000);
  }, []);

  return { left: Math.max(0, Math.ceil((until - now) / 1000)), start };
}
