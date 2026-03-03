import { ServerCrash } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ServerErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-muted">
          <ServerCrash className="size-12 text-muted-foreground" />
        </div>
        <h1 className="text-7xl font-bold text-warning">500</h1>
        <p className="mt-4 text-xl font-semibold text-foreground">Internal Server Error</p>
        <p className="mt-2 text-muted-foreground">
          Something went wrong on our end. Please try again later.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
