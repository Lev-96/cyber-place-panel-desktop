import { useAuth } from "@/auth/AuthContext";
import { can, Permission } from "@/auth/permissions";
import { ReactElement } from "react";
import { Navigate } from "react-router-dom";

interface Props {
  perm: Permission;
  children: ReactElement;
  /** If denied, redirect here. Default: "/" */
  redirectTo?: string;
}

const RoleGuard = ({ perm, children, redirectTo = "/" }: Props) => {
  const { user } = useAuth();
  if (!can(user?.role, perm)) return <Navigate to={redirectTo} replace />;
  return children;
};

export default RoleGuard;
