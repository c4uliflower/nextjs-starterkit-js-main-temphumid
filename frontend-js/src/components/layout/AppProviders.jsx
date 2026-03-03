"use client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThemedToaster } from "@/components/layout/ThemedToaster";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { SWRConfig } from "swr";

export function AppProviders({ children }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <ThemeProvider>
        <AuthProvider>
          <SidebarProvider>
            {children}
            <ThemedToaster />
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}
