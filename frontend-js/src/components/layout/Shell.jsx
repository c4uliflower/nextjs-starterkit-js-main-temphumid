"use client";
import { Suspense, useState, useEffect } from "react";
import { useSidebar } from "@/hooks/use-sidebar";
import Sidebar from "./sidebar/Sidebar";
import Navbar from "./Navbar";
import CommandPalette from "@/components/custom/CommandPalette";
const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export default function Shell({ children }) {
  const { collapsed, isMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handler);

    return () => document.removeEventListener("keydown", handler);
  }, []);
  const marginLeft = isMobile ? 0 : collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main area */}
      <div
        className="flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft }}
      >
        <Navbar onSearchClick={() => setSearchOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-12">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
