"use client";
import { useTheme } from "@/hooks/use-theme";
import { Toaster } from "@/components/ui/sonner";

export function ThemedToaster() {
  const { theme } = useTheme();

  return <Toaster position="top-right" richColors closeButton theme={theme} />;
}
