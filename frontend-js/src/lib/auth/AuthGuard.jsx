"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthHook";

function AuthGuardLoading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="pointer-events-none absolute -left-28 -top-28 size-80 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-32 size-[24rem] rounded-full bg-primary/10 blur-3xl" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-primary/10"
        role="status"
        aria-live="polite"
      >
        <div className="mb-5 flex items-center justify-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-extrabold tracking-tight text-primary-foreground">
            M
          </div>
        </div>

        <div className="relative mx-auto mb-5 flex size-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="size-14 animate-spin rounded-full border-4 border-transparent border-r-primary border-t-primary" />
        </div>

        <div className="space-y-1 text-center">
          <p className="text-lg font-bold text-card-foreground">Securing your workspace</p>
          <p className="text-sm text-muted-foreground">Validating your session and permissions.</p>
        </div>

        <div className="mt-6 space-y-2">
          <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-muted [animation-delay:120ms]" />
          <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-muted [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
export function AuthGuard({ children }) {
  const router = useRouter();
  const { authenticated, loading } = useAuthContext();
  const [isChecking, setIsChecking] = useState(true);

  const checkPermissions = async () => {
    if (loading) {
      return;
    }
    if (!authenticated) {
      router.replace(process.env.NEXT_PUBLIC_MAT_GALLERY ?? "");

      return;
    }

    setIsChecking(false);
  };

  useEffect(() => {
    checkPermissions();
  }, [authenticated, loading]);

  if (isChecking) {
    return <AuthGuardLoading />;
  }

  return <>{children}</>;
}
