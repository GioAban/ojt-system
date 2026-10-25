import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
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
    // May company na: "My Company" na lang, wala nang listahan ng ibang company
    hasCompany
      ? { icon: Building2, text: "My Company", link: "/student/company" }
      : { icon: Building, text: "Companies", link: "/student/companies" },
    { icon: Megaphone, text: "Announcements", link: "/student/announcements" },
    { icon: TrendingUp, text: "Progress", link: "/student/progress" },
  ];
}

function getLinksForRole(
  role: string | null,
  studentHasCompany: boolean,
): SidebarLink[] {
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
      return getStudentLinks(studentHasCompany);
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

  // Student: itinatanong sa server kung may company na, para laging tama ang menu
  const [studentHasCompany, setStudentHasCompany] = useState(
    () => localStorage.getItem("has_company") === "true",
  );
  useEffect(() => {
    if (role !== "STUDENT") return;
    api
      .get<{ assigned: boolean }>("/student/company/mine")
      .then((res) => {
        setStudentHasCompany(res.data.assigned);
        try {
          localStorage.setItem("has_company", String(res.data.assigned));
        } catch {
          // hindi kritikal
        }
      })
      .catch(() => {
        // mananatili ang huling alam
      });
  }, [role]);

  const menuItems = getLinksForRole(role, studentHasCompany);

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
                          className={cn(
                            "ml-auto",
                            isActive && "bg-white text-primary",
                          )}
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
