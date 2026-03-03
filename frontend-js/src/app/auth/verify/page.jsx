"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { setSession } from "@/lib/auth/AuthSession";
import { useAuthContext } from "@/lib/auth/AuthHook";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function extractErrorMessage(error) {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    const apiMessage = response?.data?.message;

    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to validate your session token.";
}
function AuthenticationCallbackView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);
  const { checkUserSession } = useAuthContext();
  const [status, setStatus] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const ssoLogin = useMemo(
    () => process.env.NEXT_PUBLIC_MAT_GALLERY ?? process.env.NEXT_PUBLIC_MAT_GALLERY_URL ?? "",
    [],
  );
  const redirectTo = useMemo(() => {
    const redirectParam = searchParams.get("redirect");

    if (redirectParam && redirectParam.startsWith("/")) {
      return redirectParam;
    }

    return "/";
  }, [searchParams]);
  const authenticateByToken = useCallback(async () => {
    const token = searchParams.get("token")?.trim();

    if (!token) {
      setStatus("error");
      setErrorMessage("Missing token in URL. Please sign in again.");

      return;
    }
    try {
      setStatus("checking");
      setErrorMessage("");
      await setSession(token);
      const isAuthenticated = await checkUserSession?.();

      if (!isAuthenticated) {
        throw new Error("Session validation failed. Please sign in again.");
      }

      setStatus("success");
      window.setTimeout(() => {
        router.replace(redirectTo);
        router.refresh();
      }, 700);
    } catch (error) {
      await setSession(null);
      setStatus("error");
      setErrorMessage(extractErrorMessage(error));
    }
  }, [checkUserSession, redirectTo, router, searchParams]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void authenticateByToken();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [authenticateByToken]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute -left-28 -top-28 size-80 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-36 size-[22rem] rounded-full bg-info/15 blur-3xl" />

      <Card className="relative w-full max-w-md border-border/80">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-extrabold tracking-tight text-primary-foreground">
            M
          </div>
          <Badge variant="secondary" className="mx-auto">
            Authentication
          </Badge>
          <CardTitle className="text-xl">Checking your access</CardTitle>
          <CardDescription>We are validating your token and loading your session.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "checking" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
                <div className="h-2 w-5/6 animate-pulse rounded-full bg-muted [animation-delay:120ms]" />
                <div className="h-2 w-2/3 animate-pulse rounded-full bg-muted [animation-delay:240ms]" />
              </div>
            </div>
          )}

          {status === "success" && (
            <Alert variant="success">
              <ShieldCheck />
              <AlertTitle>Authentication successful</AlertTitle>
              <AlertDescription>Redirecting you to your workspace now.</AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>Authentication failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="justify-center gap-2">
          {status === "error" ? (
            <>
              <Button variant="outline" onClick={() => void authenticateByToken()}>
                Retry
              </Button>
              <Button onClick={() => (window.location.href = ssoLogin)}>
                Sign In
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <Button disabled className="min-w-36">
              {status === "success" ? "Redirecting..." : "Authenticating..."}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
export default function AuthenticationPage() {
  return (
    <Suspense>
      <AuthenticationCallbackView />
    </Suspense>
  );
}
