import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const progressTrackVariants = cva("relative w-full overflow-hidden rounded-full", {
  variants: {
    variant: {
      default: "bg-primary/20",
      secondary: "bg-secondary/20",
      success: "bg-success/20",
      warning: "bg-warning/20",
      info: "bg-info/20",
      destructive: "bg-destructive/20",
    },
    size: {
      sm: "h-1",
      default: "h-2",
      lg: "h-3",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
const progressIndicatorVariants = cva("h-full w-full flex-1 transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      secondary: "bg-secondary",
      success: "bg-success",
      warning: "bg-warning",
      info: "bg-info",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Progress({ className, value, variant, size, ...props }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressTrackVariants({ variant, size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={progressIndicatorVariants({ variant })}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
