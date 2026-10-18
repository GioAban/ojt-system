import { DashboardLayout } from "@/components/DashboardLayout";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is coming soon.
      </p>
    </DashboardLayout>
  );
}
