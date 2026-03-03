import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const spinnerVariants = cva("animate-spin", {
  variants: {
    variant: {
      default: "text-primary",
      secondary: "text-secondary",
      success: "text-success",
      warning: "text-warning",
      info: "text-info",
      destructive: "text-destructive",
    },
    size: {
      sm: "size-4",
      default: "size-6",
      lg: "size-8",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function Spinner({ className, variant, size, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(spinnerVariants({ variant, size }), className)}
      {...props}
    >
      <circle cx="12" cy="12" r="10" className="opacity-20" strokeWidth="2" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="2" />
    </svg>
  );
}

export { Spinner, spinnerVariants };
