"use client";
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const switchVariants = cva(
  "peer data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[size=lg]:h-6 data-[size=lg]:w-11",
  {
    variants: {
      variant: {
        default: "data-[state=checked]:bg-primary",
        secondary: "data-[state=checked]:bg-secondary",
        success: "data-[state=checked]:bg-success",
        warning: "data-[state=checked]:bg-warning",
        info: "data-[state=checked]:bg-info",
        destructive: "data-[state=checked]:bg-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
const thumbVariants = cva(
  "bg-background dark:data-[state=unchecked]:bg-foreground pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=lg]/switch:size-5 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
  {
    variants: {
      variant: {
        default: "dark:data-[state=checked]:bg-primary-foreground",
        secondary: "dark:data-[state=checked]:bg-secondary-foreground",
        success: "dark:data-[state=checked]:bg-success-foreground",
        warning: "dark:data-[state=checked]:bg-warning-foreground",
        info: "dark:data-[state=checked]:bg-info-foreground",
        destructive: "dark:data-[state=checked]:bg-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Switch({ className, size = "default", variant, ...props }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(switchVariants({ variant }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={thumbVariants({ variant })} />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
