import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Detalye ng Privacy Notice mula sa server (app.privacy.* sa application.properties).
 * Iisang pinagkukunan ito ng pangalan at email ng DPO at ng retention period.
 */
export interface PrivacyInfo {
  dpoName: string;
  dpoEmail: string;
  retention: string;
  version: string;
}

/** Ipinapakita habang naglo-load o kapag hindi maabot ang server */
const FALLBACK: PrivacyInfo = {
  dpoName: "[DPO NAME - TO BE FILLED]",
  dpoEmail: "[DPO EMAIL - TO BE FILLED]",
  retention: "[RETENTION PERIOD - TO BE FILLED]",
  version: "",
};

let cached: PrivacyInfo | null = null;

export function usePrivacyInfo(): PrivacyInfo {
  const [info, setInfo] = useState<PrivacyInfo>(cached ?? FALLBACK);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    api
      .get<PrivacyInfo>("/public/privacy")
      .then((res) => {
        cached = res.data;
        if (!cancelled) setInfo(res.data);
      })
      .catch(() => {
        // mananatili ang placeholder
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}

/** Maikling paalala sa tabi ng mga field ng supervisor */
export const SUPERVISOR_PRIVACY_NOTE =
  "These details are used only for OJT coordination and supervision.";

/** Alalahanin sa session na nakilala na ng student ang Privacy Notice */
function privacyKey() {
  return `privacy_ok:${localStorage.getItem("email") ?? ""}`;
}

export function markPrivacyOk() {
  try {
    sessionStorage.setItem(privacyKey(), "1");
  } catch {
    // walang storage: titingnan na lang ulit
  }
}

export function isPrivacyOk() {
  try {
    return sessionStorage.getItem(privacyKey()) === "1";
  } catch {
    return false;
  }
}
