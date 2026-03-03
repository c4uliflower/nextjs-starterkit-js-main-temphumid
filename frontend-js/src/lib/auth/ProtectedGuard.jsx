"use client";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import ForbiddenPage from "@/components/custom/ErrorPages/ForbiddenPage";
import { hasSidebarRouteAccess } from "@/lib/navigation/sidebar-access";
import { useAuthContext } from "./AuthHook";

export function ProtectedGuard({ children }) {
  const pathname = usePathname();
  const { loading, user, hasPermission } = useAuthContext();
  const canAccessPath = useMemo(() => {
    if (loading || !pathname) {
      return true;
    }

    const sidebarGroups = user?.data.sidebar ?? [];

    return hasSidebarRouteAccess(sidebarGroups, pathname, hasPermission);
  }, [hasPermission, loading, pathname, user?.data.sidebar]);

  if (!canAccessPath) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
