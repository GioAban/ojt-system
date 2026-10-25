import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Layers, Mail, MapPin, Phone, UserRound } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface MyCompany {
  assigned: boolean;
  status: string;
  companyName: string | null;
  nature: string | null;
  address: string | null;
  location: string | null;
  companyContact: string | null;
  departmentName: string | null;
  supervisorFullname: string | null;
  supervisorPosition: string | null;
  supervisorEmail: string | null;
  supervisorContact: string | null;
}

function Item({ label, value, icon: Icon }: { label: string; value: string | null; icon?: React.ElementType }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm">{value}</dd>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export default function StudentMyCompany() {
  const [data, setData] = useState<MyCompany | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<MyCompany>("/student/company/mine")
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your company.")));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold tracking-tight">My Company</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Where you are doing your OJT.</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!data && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {data && !data.assigned && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You don't have a company yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/student/companies")}>
            Browse companies
          </Button>
        </div>
      )}

      {data && data.assigned && (
        <div className="flex flex-col gap-4">
          <Card title="Company" icon={Building2}>
            <Item label="Name" value={data.companyName} />
            <Item label="Nature" value={data.nature} />
            <Item label="Address" value={data.address} icon={MapPin} />
            <Item label="Location" value={data.location} />
            <Item label="Contact number" value={data.companyContact} icon={Phone} />
          </Card>

          <Card title="Department" icon={Layers}>
            <Item label="Department" value={data.departmentName} />
          </Card>

          <Card title="Supervisor" icon={UserRound}>
            <Item label="Name" value={data.supervisorFullname} />
            <Item label="Position" value={data.supervisorPosition} />
            <Item label="Email" value={data.supervisorEmail} icon={Mail} />
            <Item label="Contact number" value={data.supervisorContact} icon={Phone} />
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
