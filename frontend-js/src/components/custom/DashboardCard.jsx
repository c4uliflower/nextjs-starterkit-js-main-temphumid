import { CircleArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
const variantStyles = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  warning: "bg-warning text-warning-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  info: "bg-info text-info-foreground",
  default: "bg-muted text-muted-foreground",
};

export function DashboardCard({
  value,
  label,
  icon: Icon,
  variant = "primary",
  filterHref,
  onFilterClick,
  className,
}) {
  const hasFilter = !!filterHref || !!onFilterClick;
  const filterContent = (
    <>
      Filter <CircleArrowRight className="size-4" />
    </>
  );

  return (
    <div className={cn("overflow-hidden rounded-lg", variantStyles[variant], className)}>
      {/* Body */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="mt-1 text-sm font-medium uppercase tracking-wide">{label}</p>
        </div>
        <Icon className="size-16 opacity-25" />
      </div>

      {/* Optional filter bar */}
      {hasFilter &&
        (filterHref ? (
          <a
            href={filterHref}
            className="flex items-center justify-center gap-1.5 bg-black/15 py-2.5 text-sm font-medium transition-colors hover:bg-black/25"
          >
            {filterContent}
          </a>
        ) : (
          <button
            type="button"
            onClick={onFilterClick}
            className="flex w-full items-center justify-center gap-1.5 bg-black/15 py-2.5 text-sm font-medium transition-colors hover:bg-black/25"
          >
            {filterContent}
          </button>
        ))}
    </div>
  );
}
