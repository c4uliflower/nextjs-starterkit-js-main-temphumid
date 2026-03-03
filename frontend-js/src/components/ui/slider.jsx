"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const sliderRangeVariants = cva(
  "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
  {
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
  },
);
const sliderThumbVariants = cva(
  "ring-ring/50 block shrink-0 rounded-full bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-primary border",
        secondary: "border-secondary border",
        success: "border-success border",
        warning: "border-warning border",
        info: "border-info border",
        destructive: "border-destructive border",
      },
      size: {
        sm: "size-3",
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
const sliderTrackSize = {
  sm: "data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1",
  default: "data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5",
  lg: "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:w-2",
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  variant,
  size = "default",
  ...props
}) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
          sliderTrackSize[size ?? "default"],
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={sliderRangeVariants({ variant })}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={sliderThumbVariants({ variant, size })}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
