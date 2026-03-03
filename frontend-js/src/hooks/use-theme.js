"use client";
import { useTheme as useNextTheme } from "next-themes";
import { useCallback } from "react";

/**
 * @returns {{ theme: "light" | "dark"; toggleTheme: () => void }}
 */
export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const theme = resolvedTheme ?? "light";
  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return { theme, toggleTheme };
}
