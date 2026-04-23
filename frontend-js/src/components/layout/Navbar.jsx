"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, Bell, LogOut, Settings, User, Sun, Moon, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { useTheme } from "@/hooks/use-theme";
import { useAuthContext } from "@/lib/auth/AuthHook";
import { useEscalatedFacilitiesAlerts } from "@/features/temphumid/facilities-alerts/hooks/use-escalated-facilities-alerts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// ── Breadcrumb generator ─────────────────────────
function generateBreadcrumbs(pathname) {
  if (pathname === "/") return [{ label: "Dashboard", href: "/" }];
  const segments = pathname.split("/").filter(Boolean);

  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));
}

// ── Facilities delay notification bell ──────────────
function FacilitiesNotificationBell() {
  const { escalated, count } = useEscalatedFacilitiesAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Facilities delay notifications"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, zIndex: 50,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,.14)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 14px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
              Notifications
            </span>
            {count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                background: "#fee2e2", color: "#b91c1c",
              }}>
                {count} delayed
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {count === 0 ? (
              <div style={{ padding: "24px 14px", textAlign: "center" }}>
                <Bell style={{ margin: "0 auto 8px", opacity: .3, display: "block" }} size={22} />
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
                  No delayed alerts
                </p>
              </div>
            ) : (
              escalated.map((alert) => (
                <Link
                  key={alert.id}
                  href="/pages/temphumid-facilities"
                  onClick={() => setOpen(false)}
                  style={{ display: "block", textDecoration: "none" }}
                >
                  <div style={{
                    padding: "10px 14px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "flex-start", gap: 10,
                    transition: "background .1s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <TriangleAlert size={14} style={{ color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 600, color: "var(--foreground)",
                        margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {alert.lineName}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                        {alert.areaId} · Delayed {alert.delayedHours}h
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          {count > 0 && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
              <Link
                href="/pages/temphumid-facilities"
                onClick={() => setOpen(false)}
                style={{ fontSize: 12, color: "#435ebe", textDecoration: "none", fontWeight: 600 }}
              >
                View all in dashboard →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Navbar({ onSearchClick }) {
  const { isMobile, toggleMobile, toggleCollapsed } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthContext();
  const pathname = usePathname() ?? "/";
  const breadcrumbs = generateBreadcrumbs(pathname);
  const profile = user?.data.profile;
  const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "";
  const initials = profile ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}` : "";

  return (
    <header className="sticky top-0 z-20 flex h-60px items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      {/* Hamburger */}
      <button
        onClick={isMobile ? toggleMobile : toggleCollapsed}
        className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle sidebar"
      >
        <Menu className="size-5" />
      </button>

      {/* Breadcrumbs */}
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Search trigger — desktop */}
        <button
          onClick={onSearchClick}
          className="hidden items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground md:inline-flex"
        >
          <Search className="size-4" />
          <span>Search...</span>
          <kbd className="pointer-events-none ml-4 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </button>

        {/* Search trigger — mobile */}
        <button
          onClick={onSearchClick}
          className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Open search"
        >
          <Search className="size-5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </button>

        {/* Notifications — facilities delay alerts */}
        <FacilitiesNotificationBell />

        {/* 
        <button className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <Bell className="size-5" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            3
          </span>
        </button>
        */}

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground md:block">
                {fullName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="size-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn("flex items-center gap-2 text-destructive focus:text-destructive")}
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
              Mat Gallery Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}