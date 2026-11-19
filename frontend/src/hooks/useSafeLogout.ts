import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutAndClear, unsyncedCount } from "@/offline/logout";

/**
 * Logout na may babala: kapag may hindi pa naipapadala, magtatanong muna (Stay and sync / Log out and delete).
 * Sa logout, binubura ang lahat ng personal na datos ng user sa device.
 */
export function useSafeLogout() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    await logoutAndClear();
    setBusy(false);
    setPending(null);
    navigate("/login", { replace: true });
  }

  async function request() {
    const n = await unsyncedCount();
    if (n > 0) setPending(n);
    else await finish();
  }

  return {
    request: () => void request(),
    pending,
    busy,
    confirm: () => void finish(),
    cancel: () => setPending(null),
  };
}
