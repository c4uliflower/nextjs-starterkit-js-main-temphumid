"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export function ThemeProvider({ children }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
