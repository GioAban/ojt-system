import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { StudentProfile } from "@/types/studentProfile";
import { rememberProfile } from "@/lib/studentSession";
import { DashboardLayout } from "@/components/DashboardLayout";
import ComingSoon from "@/pages/ComingSoon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatHours(value: number | null) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function StudentProfileView() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<StudentProfile>("/student/profile")
      .then((res) => {
        setProfile(res.data);
        rememberProfile(res.data);
      })
      .catch((err) => setError(getErrorMessage(err, "Failed to load your profile.")));
  }, []);

  const rows: [string, string][] = profile
    ? [
        ["Student Number", profile.studentNumber],
        ["Email", profile.email],
        ["Status", profile.status],
        ["Semester", profile.semester ?? "—"],
        ["Coordinator", profile.coordinatorName ?? "—"],
        ["Company", profile.companyName ?? "Not yet assigned"],
        ["Department", profile.departmentName ?? "Not yet assigned"],
        [
          "Hours",
          `${formatHours(profile.renderedHours ?? 0)} / ${formatHours(profile.trainingDuration)}`,
        ],
      ]
    : [];

  return (
    <DashboardLayout>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Profile</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>
              {profile.firstname} {profile.lastname}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  if (localStorage.getItem("role") === "STUDENT") return <StudentProfileView />;
  return <ComingSoon title="Profile" />;
}
