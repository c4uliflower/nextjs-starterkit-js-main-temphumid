"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { resolveIcon } from "@/lib/resolve-icon";

function isActiveRoute(href, pathname) {
  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(href + "/");
}
function hasActiveChild(item, pathname) {
  if (item.href && isActiveRoute(item.href, pathname)) return true;

  if (item.children) {
    return item.children.some((child) => hasActiveChild(child, pathname));
  }

  return false;
}
export default function SidebarMenuItem({ item, depth = 0 }) {
  const pathname = usePathname() ?? "/";
  const { collapsed, isMobile, closeMobile } = useSidebar();
  const Icon = resolveIcon(item.icon);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href
    ? hasChildren
      ? isActiveRoute(item.href, pathname)
      : pathname === item.href
    : false;
  const isChildActive = hasChildren ? hasActiveChild(item, pathname) : false;
  const [open, setOpen] = useState(isChildActive);

  // Auto-expand when a child route becomes active
  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);
  const isTopLevel = depth === 0;
  const showIconOnly = collapsed && !isMobile && isTopLevel;

  // Divider
  if (item.type === "divider") {
    return <div className="mx-3 my-2 border-t border-sidebar-border" />;
  }
  // Header
  if (item.type === "header") {
    if (showIconOnly) return null;

    return (
      <div className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {item.title}
      </div>
    );
  }
  // Item with children (submenu)
  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-sm font-medium transition-all duration-300",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isChildActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground",
            showIconOnly ? "justify-center px-0 gap-0" : "gap-3 px-3",
          )}
          title={showIconOnly ? item.title : undefined}
        >
          {Icon && (
            <Icon className={cn("size-5 shrink-0", isChildActive && "text-sidebar-primary")} />
          )}
          <span
            className={cn(
              "flex-1 text-left overflow-hidden whitespace-nowrap transition-all duration-300",
              showIconOnly ? "max-w-0 opacity-0 flex-none" : "max-w-[200px] opacity-100",
            )}
          >
            {item.title}
          </span>
          {item.badge && (
            <span
              className={cn(
                "rounded-full bg-primary py-0.5 text-[10px] font-semibold text-primary-foreground overflow-hidden whitespace-nowrap transition-all duration-300 shrink-0",
                showIconOnly ? "max-w-0 opacity-0 px-0" : "max-w-[80px] opacity-100 px-2",
              )}
            >
              {item.badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              "shrink-0 transition-all duration-300",
              open && "rotate-180",
              showIconOnly ? "size-0 opacity-0" : "size-4 opacity-100",
            )}
          />
        </button>

        {/* Submenu */}
        {!showIconOnly && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-200",
              open ? "max-h-[2000px]" : "max-h-0",
            )}
          >
            <div
              className={cn(
                "ml-4 border-l border-sidebar-border pl-2 space-y-1 mt-1",
                depth > 0 && "ml-2",
              )}
            >
              {item.children.map((child, i) => (
                <SidebarMenuItem key={i} item={child} depth={depth + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Leaf item (link)
  return (
    <Link
      href={item.href || "#"}
      onClick={() => {
        if (isMobile) closeMobile();
      }}
      className={cn(
        "flex items-center rounded-lg py-2 text-sm font-medium transition-all duration-300",
        isActive
          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        showIconOnly ? "justify-center px-0 gap-0" : "gap-3 px-3",
      )}
      title={showIconOnly ? item.title : undefined}
    >
      {Icon ? (
        <Icon className={cn("size-5 shrink-0", isActive && "text-primary-foreground")} />
      ) : isTopLevel ? (
        <div className="size-5 shrink-0" />
      ) : null}
      <span
        className={cn(
          "flex-1 overflow-hidden whitespace-nowrap transition-all duration-300",
          showIconOnly ? "max-w-0 opacity-0 flex-none" : "max-w-[200px] opacity-100",
        )}
      >
        {item.title}
      </span>
      {item.badge && (
        <span
          className={cn(
            "rounded-full bg-primary py-0.5 text-[10px] font-semibold text-primary-foreground overflow-hidden whitespace-nowrap transition-all duration-300 shrink-0",
            showIconOnly ? "max-w-0 opacity-0 px-0" : "max-w-[80px] opacity-100 px-2",
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
