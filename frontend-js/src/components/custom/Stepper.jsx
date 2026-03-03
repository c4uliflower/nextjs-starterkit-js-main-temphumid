import { cva } from "class-variance-authority";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/* ── Variant definitions ─────────────────────────── */
const stepperVariants = cva("", {
  variants: {
    variant: {
      default: "",
      success: "",
      info: "",
      warning: "",
      destructive: "",
    },
    size: {
      sm: "",
      default: "",
      lg: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
const indicatorSizeMap = {
  sm: "size-7 text-xs",
  default: "size-9 text-sm",
  lg: "size-11 text-base",
};
const iconSizeMap = {
  sm: "size-3.5",
  default: "size-4",
  lg: "size-5",
};
const variantColorMap = {
  default: {
    active: "border-primary bg-primary text-primary-foreground",
    completed: "border-primary bg-primary text-primary-foreground",
    upcoming: "border-muted-foreground/30 bg-background text-muted-foreground",
    connector: "bg-primary",
    connectorPending: "bg-muted-foreground/30",
  },
  success: {
    active: "border-success bg-success text-success-foreground",
    completed: "border-success bg-success text-success-foreground",
    upcoming: "border-muted-foreground/30 bg-background text-muted-foreground",
    connector: "bg-success",
    connectorPending: "bg-muted-foreground/30",
  },
  info: {
    active: "border-info bg-info text-info-foreground",
    completed: "border-info bg-info text-info-foreground",
    upcoming: "border-muted-foreground/30 bg-background text-muted-foreground",
    connector: "bg-info",
    connectorPending: "bg-muted-foreground/30",
  },
  warning: {
    active: "border-warning bg-warning text-warning-foreground",
    completed: "border-warning bg-warning text-warning-foreground",
    upcoming: "border-muted-foreground/30 bg-background text-muted-foreground",
    connector: "bg-warning",
    connectorPending: "bg-muted-foreground/30",
  },
  destructive: {
    active: "border-destructive bg-destructive text-destructive-foreground",
    completed: "border-destructive bg-destructive text-destructive-foreground",
    upcoming: "border-muted-foreground/30 bg-background text-muted-foreground",
    connector: "bg-destructive",
    connectorPending: "bg-muted-foreground/30",
  },
};

/* ── Component ────────────────────────────────────── */
export function Stepper({
  steps,
  currentStep,
  orientation = "horizontal",
  variant = "default",
  size = "default",
  onStepClick,
  className,
}) {
  const v = variant ?? "default";
  const s = size ?? "default";
  const colors = variantColorMap[v];
  const isVertical = orientation === "vertical";

  return (
    <div className={cn("flex", isVertical ? "flex-col" : "flex-row items-start", className)}>
      {steps.map((step, index) => {
        const status =
          index < currentStep ? "completed" : index === currentStep ? "active" : "upcoming";
        const isLast = index === steps.length - 1;
        const clickable = onStepClick !== undefined;
        const StepIcon = step.icon;

        return (
          <div
            key={index}
            className={cn(
              "flex",
              isVertical ? "flex-row" : "flex-1 flex-col items-center",
              isLast && !isVertical && "flex-none",
            )}
          >
            {/* Step indicator row */}
            <div
              className={cn(
                "flex items-center",
                isVertical ? "flex-col" : "flex-row w-full",
                isLast && !isVertical && "w-auto",
              )}
            >
              {/* Circle */}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(index)}
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border-2 font-medium transition-colors",
                  indicatorSizeMap[s],
                  colors[status],
                  clickable && "cursor-pointer hover:opacity-80",
                  !clickable && "cursor-default",
                )}
              >
                {status === "completed" ? (
                  <Check className={iconSizeMap[s]} />
                ) : StepIcon ? (
                  <StepIcon className={iconSizeMap[s]} />
                ) : (
                  index + 1
                )}
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "transition-colors",
                    isVertical
                      ? cn(
                          "mx-auto my-1 w-0.5",
                          s === "sm" ? "min-h-6" : s === "lg" ? "min-h-10" : "min-h-8",
                        )
                      : "mx-2 h-0.5 flex-1",
                    index < currentStep ? colors.connector : colors.connectorPending,
                  )}
                />
              )}
            </div>

            {/* Label + description */}
            <div
              className={cn(
                isVertical ? "ml-3 pb-8 last:pb-0" : "mt-2 text-center",
                isLast && isVertical && "pb-0",
              )}
            >
              <p
                className={cn(
                  "font-medium leading-tight",
                  s === "sm" ? "text-xs" : s === "lg" ? "text-base" : "text-sm",
                  status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p
                  className={cn(
                    "mt-0.5 text-muted-foreground",
                    s === "sm" ? "text-[10px]" : s === "lg" ? "text-sm" : "text-xs",
                  )}
                >
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
