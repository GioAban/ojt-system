import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface RoleRouteProps {
  roles: string[];
  children: ReactNode;
}

export default function RoleRoute({ roles, children }: RoleRouteProps) {
  const role = localStorage.getItem("role");

  if (!role || !roles.includes(role)) {
    return (
      <Navigate
        to={role === "STUDENT" ? "/student/home" : "/dashboard"}
        replace
      />
    );
  }

  return <>{children}</>;
}
