import { Navigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import api from "@/lib/api";
import type { StudentProfile } from "@/types/studentProfile";
import { isPasswordOk, isProfileOk, markPasswordOk, markProfileOk, rememberProfile } from "@/lib/studentSession";
import { isPrivacyOk, markPrivacyOk } from "@/lib/privacy";
import { PrivacyAcknowledge } from "@/components/privacy/PrivacyAcknowledge";
import { CompleteProfile } from "@/components/profile/CompleteProfile";

type Gate = "checking" | "ok" | "change" | "privacy" | "profile";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("token");
  const isStudent = localStorage.getItem("role") === "STUDENT";

  // Ang student na default password pa ang gamit ay ipapalit muna bago makapasok kahit saan
  // Pagkatapos nito, ipinapakilala ang Privacy Notice (isang beses, o kapag nagbago ang bersyon), at saka
  // ang "Complete your profile" ng mga nag-register sa link (isang beses). Student lang; hindi sa staff.
  const needsCheck = Boolean(token) && isStudent && (!isPasswordOk() || !isPrivacyOk() || !isProfileOk());
  const [gate, setGate] = useState<Gate>(needsCheck ? "checking" : "ok");
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;

    api
      .get<StudentProfile>("/student/profile")
      .then((res) => {
        if (cancelled) return;
        rememberProfile(res.data);
        setProfile(res.data);
        if (res.data.mustChangePassword) {
          setGate("change");
        } else if (!res.data.privacyAcknowledged) {
          markPasswordOk();
          setGate("privacy");
        } else if (res.data.profileRequired) {
          markPasswordOk();
          markPrivacyOk();
          setGate("profile");
        } else {
          markPasswordOk();
          markPrivacyOk();
          markProfileOk();
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

  if (gate === "privacy") {
    return (
      <PrivacyAcknowledge
        onDone={() => {
          markPrivacyOk();
          if (profile?.profileRequired) {
            setGate("profile");
          } else {
            markProfileOk();
            setGate("ok");
          }
        }}
      />
    );
  }

  if (gate === "profile" && profile) {
    return (
      <CompleteProfile
        profile={profile}
        onDone={() => {
          markProfileOk();
          setGate("ok");
        }}
      />
    );
  }

  return <>{children}</>;
}
