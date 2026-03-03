"use client";
import { AuthGuard } from "@/lib/auth/AuthGuard";
import { ProtectedGuard } from "@/lib/auth/ProtectedGuard";
import Shell from "@/components/layout/Shell";

export default function ProtectedLayout({ children }) {
  return (
    <AuthGuard>
      <ProtectedGuard>
        <Shell>{children}</Shell>
      </ProtectedGuard>
    </AuthGuard>
  );
}
