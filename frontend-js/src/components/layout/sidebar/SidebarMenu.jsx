"use client";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import SidebarMenuItem from "./SidebarMenuItem";

export default function SidebarMenu({ groups }) {
  const { collapsed, isMobile } = useSidebar();
  const showIconOnly = collapsed && !isMobile;

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {groups.map((group, gi) => (
        <div key={gi}>
          {/* Group label */}
          <div
            className={cn(
              "overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-all duration-300",
              showIconOnly
                ? "max-h-0 opacity-0 py-0"
                : "max-h-10 opacity-100 px-1 pt-4 pb-1 first:pt-0",
            )}
          >
            {group.label}
          </div>
          {showIconOnly && gi > 0 && (
            <div className="mx-auto my-2 w-6 border-t border-sidebar-border" />
          )}

          {/* Group items */}
          <div className="flex flex-col gap-1">
            {group.items.map((item, ii) => (
              <SidebarMenuItem key={ii} item={item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
