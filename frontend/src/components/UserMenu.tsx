import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  variant?: "sidebar" | "topnav";
}

export function UserMenu({ variant = "sidebar" }: UserMenuProps) {
  const navigate = useNavigate();
  const fullname = localStorage.getItem("fullname") || "User";
  const email = localStorage.getItem("email") || "";
  const role = localStorage.getItem("role") || "";

  const initials = fullname
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const isSidebar = variant === "sidebar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          isSidebar
            ? "flex w-full items-center gap-3 rounded-md p-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
            : "flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        {isSidebar && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-none">
                {fullname}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {role}
              </p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={isSidebar ? "top" : "bottom"}
        align={isSidebar ? "start" : "end"}
        className="w-56"
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{fullname}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onClick={() => navigate("/profile")}
        >
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onClick={() => navigate("/settings")}
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
