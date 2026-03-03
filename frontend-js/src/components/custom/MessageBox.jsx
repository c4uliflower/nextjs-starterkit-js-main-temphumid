import { useState } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
const variantConfig = {
  info: {
    icon: Info,
    classes: "bg-info/10 border-info/30 text-info [&_svg]:text-info",
  },
  success: {
    icon: CheckCircle2,
    classes: "bg-success/10 border-success/30 text-success [&_svg]:text-success",
  },
  warning: {
    icon: AlertTriangle,
    classes: "bg-warning/10 border-warning/30 text-warning-foreground [&_svg]:text-warning",
  },
  error: {
    icon: AlertCircle,
    classes: "bg-destructive/10 border-destructive/30 text-destructive [&_svg]:text-destructive",
  },
};

export function MessageBox({ variant = "info", title, children, dismissible = false, className }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "relative flex gap-3 rounded-lg border px-4 py-3 text-sm",
        config.classes,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div className="text-foreground/80">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
