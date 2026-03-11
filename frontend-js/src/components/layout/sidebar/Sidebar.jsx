"use client";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { useAuthContext } from "@/lib/auth/AuthHook";
import { menuConfig } from "@/config/menu";
import SidebarMenu from "./SidebarMenu";
const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export default function Sidebar() {
  const { collapsed, mobileOpen, isMobile, closeMobile } = useSidebar();
  const { user } = useAuthContext();
  const sidebarGroups = user?.data.sidebar?.length ? user.data.sidebar : menuConfig;
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / Brand */}
      <div
        className={cn(
          "flex h-[60px] shrink-0 items-center border-b border-sidebar-border transition-all duration-300",
          collapsed && !isMobile ? "px-5" : "px-4",
        )}
      >
        <div
          className={cn(
            "flex items-center overflow-hidden transition-all duration-300",
            collapsed && !isMobile ? "gap-0" : "gap-2",
          )}
        >
          <img
            src="/logo/logo.png"
            alt="Mazer"
            className="size-10 shrink-0 rounded-lg object-contain"
          />
          <span
            className={cn(
              "text-lg font-bold text-sidebar-foreground whitespace-nowrap overflow-hidden transition-all duration-300",
              collapsed && !isMobile ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100",
            )}
          >
            TempHumid
          </span>
        </div>
      </div>

      {/* Scrollable menu area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <SidebarMenu groups={sidebarGroups} />
      </div>
    </div>
  );

  // ── Mobile: overlay drawer ─────────────────────
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={closeMobile}
          />
        )}

        {/* Drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ width: SIDEBAR_WIDTH }}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // ── Desktop: fixed sidebar ─────────────────────
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 overflow-hidden bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
    >
      {sidebarContent}
    </aside>
  );
}
