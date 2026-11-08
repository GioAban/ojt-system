import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2 } from "lucide-react";
import { CoordinatorDashboard } from "@/components/dashboard/CoordinatorDashboard";

const stats = [
  { title: "Total Students", value: "0", icon: Users },
  { title: "Partner Companies", value: "0", icon: Building2 },
];

export default function Dashboard() {
  const fullname = localStorage.getItem("fullname");

  if (localStorage.getItem("role") === "COORDINATOR") {
    return (
      <DashboardLayout>
        <CoordinatorDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Welcome, {fullname}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's an overview of your practicum system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent activity yet.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
