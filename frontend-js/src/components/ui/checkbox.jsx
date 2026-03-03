import * as React from "react";
import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const checkboxVariants = cva(
  "peer border-input data-[state=unchecked]:dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary",
        secondary:
          "data-[state=checked]:bg-secondary data-[state=checked]:text-secondary-foreground data-[state=checked]:border-secondary data-[state=indeterminate]:bg-secondary data-[state=indeterminate]:text-secondary-foreground data-[state=indeterminate]:border-secondary",
        success:
          "data-[state=checked]:bg-success data-[state=checked]:text-success-foreground data-[state=checked]:border-success data-[state=indeterminate]:bg-success data-[state=indeterminate]:text-success-foreground data-[state=indeterminate]:border-success",
        warning:
          "data-[state=checked]:bg-warning data-[state=checked]:text-warning-foreground data-[state=checked]:border-warning data-[state=indeterminate]:bg-warning data-[state=indeterminate]:text-warning-foreground data-[state=indeterminate]:border-warning",
        info: "data-[state=checked]:bg-info data-[state=checked]:text-info-foreground data-[state=checked]:border-info data-[state=indeterminate]:bg-info data-[state=indeterminate]:text-info-foreground data-[state=indeterminate]:border-info",
        destructive:
          "data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground data-[state=checked]:border-destructive data-[state=indeterminate]:bg-destructive data-[state=indeterminate]:text-destructive-foreground data-[state=indeterminate]:border-destructive",
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
const checkboxIconSize = {
  sm: "size-3",
  default: "size-3.5",
  lg: "size-4",
};

function Checkbox({ className, variant, size = "default", checked, ...props }) {
  const iconCn = cn(checkboxIconSize[size ?? "default"], "text-current");

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ variant, size }), className)}
      checked={checked}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {checked === "indeterminate" ? (
          <MinusIcon className={iconCn} />
        ) : (
          <CheckIcon className={iconCn} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
