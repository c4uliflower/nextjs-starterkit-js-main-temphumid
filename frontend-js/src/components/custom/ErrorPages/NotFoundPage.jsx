import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-12 text-muted-foreground" />
        </div>
        <h1 className="text-7xl font-bold text-destructive">404</h1>
        <p className="mt-4 text-xl font-semibold text-foreground">Page Not Found</p>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
