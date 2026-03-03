"use client";
import { createContext, useState, useCallback, useEffect } from "react";
const MOBILE_BREAKPOINT = 768;

/**
 * @typedef {Object} SidebarContextValue
 * @property {boolean} collapsed
 * @property {boolean} mobileOpen
 * @property {boolean} isMobile
 * @property {() => void} toggleCollapsed
 * @property {() => void} toggleMobile
 * @property {() => void} closeMobile
 */

/** @type {import("react").Context<SidebarContextValue | null>} */
export const SidebarContext = createContext(null);

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);
  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);
  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), []);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        mobileOpen,
        isMobile,
        toggleCollapsed,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
