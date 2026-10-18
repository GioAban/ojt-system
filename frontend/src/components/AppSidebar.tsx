import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";
import { BrandMark } from "@/components/BrandMark";
import { usePendingCompanyRequests } from "@/hooks/usePendingCompanyRequests";
import { CountBadge } from "@/components/companies/CountBadge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  TrendingUp,
  Calendar,
  Building,
  Book,
  User,
  ClipboardMinus,
  Archive,
  Tags,
  GraduationCap,
  Megaphone,
  Building2,
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

interface SidebarLink {
  icon: React.ElementType;
  text: string;
  link: string;
  adminOnly?: boolean;
  /** Ipinapakita ang bilang ng pending na hiling ng students sa tabi ng label */
  showPending?: boolean;
}

const adminLinks: SidebarLink[] = [
  { icon: LayoutDashboard, text: "Dashboard", link: "/dashboard" },
  {
    icon: TrendingUp,
    text: "Prediction",
    link: "/admin/employability-prediction",
  },
  { icon: Calendar, text: "Semester Management", link: "/admin/semesters" },
  { icon: Building, text: "Colleges", link: "/admin/colleges" },
  { icon: Book, text: "Programs", link: "/admin/programs" },
  { icon: User, text: "Coordinators", link: "/admin/coordinators" },
  { icon: ClipboardMinus, text: "Reports", link: "/admin/reports" },
  { icon: Archive, text: "Archives", link: "/admin/archives" },
];

const coordinatorLinks: SidebarLink[] = [
  { icon: LayoutDashboard, text: "Dashboard", link: "/dashboard" },
  { icon: GraduationCap, text: "Students", link: "/coordinator/students" },
  {
    icon: Building,
    text: "Host Training Estab.",
    link: "/coordinator/host-training-establishments",
    showPending: true,
  },
  {
    icon: Book,
    text: "Requirements",
    link: "/coordinator/document-requirements",
  },
  { icon: Tags, text: "Tracking", link: "/coordinator/tracking" },
  {
    icon: Megaphone,
    text: "Announcements",
    link: "/coordinator/announcements",
  },
  {
    icon: TrendingUp,
    text: "Prediction",
    link: "/coordinator/employability-prediction",
  },

  {
    icon: ClipboardMinus,
    text: "Reports",
    link: "/coordinator/reports",
    adminOnly: true,
  },
  {
    icon: Archive,
    text: "Archives",
    link: "/coordinator/archives",
    adminOnly: true,
  },
];

function getStudentLinks(hasCompany: boolean): SidebarLink[] {
  return [
    { icon: LayoutDashboard, text: "Home", link: "/student/home" },
    { icon: Building, text: "Companies", link: "/student/companies" },
    { icon: Megaphone, text: "Announcements", link: "/student/announcements" },
    ...(hasCompany
      ? [{ icon: Building2, text: "Company", link: "/student/company" }]
      : []),
  ];
}

function getLinksForRole(role: string | null): SidebarLink[] {
  switch (role) {
    case "ADMIN":
      return adminLinks;
    case "COORDINATOR": {
      const isAdminCoordinator =
        localStorage.getItem("coordinatorType") === "ADMIN";
      return coordinatorLinks.filter(
        (item) => !item.adminOnly || isAdminCoordinator,
      );
    }
    case "STUDENT": {
      const hasCompany = localStorage.getItem("has_company") === "true";
      return getStudentLinks(hasCompany);
    }
    default:
      return [];
  }
}

export function AppSidebar() {
  const pendingRequests = usePendingCompanyRequests(
    localStorage.getItem("role") === "COORDINATOR",
  );
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem("role");

  const menuItems = getLinksForRole(role);

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <BrandMark className="h-8 w-8 text-xs" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">
              {brand.systemName}
            </p>
            <p className="text-xs text-muted-foreground">{brand.shortName}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive =
                  location.pathname === item.link ||
                  location.pathname.startsWith(item.link + "/");

                return (
                  <SidebarMenuItem key={item.text}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.link)}
                      isActive={isActive}
                      className={
                        isActive
                          ? "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                          : ""
                      }
                    >
                      <item.icon />
                      <span>{item.text}</span>
                      {item.showPending && (
                        <CountBadge
                          count={pendingRequests}
                          className={cn("ml-auto", isActive && "bg-white text-primary")}
                        />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <UserMenu variant="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );
}
