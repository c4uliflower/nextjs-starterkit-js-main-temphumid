import * as React from "react";
import { CircleIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const radioItemVariants = cva(
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
  {
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
        sm: "size-3.5",
        default: "size-4",
        lg: "size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
const radioIndicatorVariants = cva("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", {
  variants: {
    variant: {
      default: "fill-primary",
      secondary: "fill-secondary",
      success: "fill-success",
      warning: "fill-warning",
      info: "fill-info",
      destructive: "fill-destructive",
    },
    size: {
      sm: "size-1.5",
      default: "size-2",
      lg: "size-2.5",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function RadioGroup({ className, ...props }) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}
function RadioGroupItem({ className, variant, size, ...props }) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(radioItemVariants({ variant, size }), className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className={radioIndicatorVariants({ variant, size })} />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
