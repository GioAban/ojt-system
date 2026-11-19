import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopNav } from "@/components/TopNav";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  wide?: boolean;
}

export function DashboardLayout({
  children,
  wide = false,
}: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-clip bg-muted/30">
        <TopNav />
        <OfflineBanner />
        <main className={cn("min-w-0 flex-1 px-4 py-5 sm:p-6", wide ? "md:p-4" : "md:p-8")}>
          <div
            className={cn("mx-auto min-w-0", wide ? "max-w-none" : "max-w-8xl")}
          >
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
