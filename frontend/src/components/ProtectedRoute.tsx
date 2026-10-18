import { Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import api from "@/lib/api";
import type { StudentProfile } from "@/types/studentProfile";
import { isPasswordOk, markPasswordOk, rememberProfile } from "@/lib/studentSession";

type Gate = "checking" | "ok" | "change";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("token");
  const isStudent = localStorage.getItem("role") === "STUDENT";

  // Ang student na default password pa ang gamit ay ipapalit muna bago makapasok kahit saan
  const needsCheck = Boolean(token) && isStudent && !isPasswordOk();
  const [gate, setGate] = useState<Gate>(needsCheck ? "checking" : "ok");

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;

    api
      .get<StudentProfile>("/student/profile")
      .then((res) => {
        if (cancelled) return;
        rememberProfile(res.data);
        if (res.data.mustChangePassword) {
          setGate("change");
        } else {
          markPasswordOk();
          setGate("ok");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const blocked =
          axios.isAxiosError(err) &&
          err.response?.status === 403 &&
          err.response.data === "PASSWORD_CHANGE_REQUIRED";
        setGate(blocked ? "change" : "ok");
      });

    return () => {
      cancelled = true;
    };
  }, [needsCheck]);

  useEffect(() => {
    if (!token) return;

    // Magdagdag ng dummy history entry para "matrap" ang back button
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Kapag pinindot ang back, itulak ulit pasulong para manatili dito
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !localStorage.getItem("token")) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (gate === "change") {
    return <Navigate to="/change-password" replace />;
  }

  if (gate === "checking") {
    return null;
  }

  return <>{children}</>;
}
