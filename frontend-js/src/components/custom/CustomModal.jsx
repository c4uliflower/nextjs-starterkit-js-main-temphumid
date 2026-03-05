"use client";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM MODAL — reusable wrapper only
//
// Two modes, chosen by the `fixedLayout` prop:
//
// ── STANDARD MODE (default, fixedLayout={false}) ─────────────────────────────
//   Use for regular modals: forms, confirmations, scan flows, etc.
//
//   <CustomModal open={open} onOpenChange={setOpen} title="My Modal" size="md">
//     <p>Content here</p>
//   </CustomModal>
//
// ── FIXED LAYOUT MODE (fixedLayout={true}) ───────────────────────────────────
//   Use when content owns its own pinned header, scrollable body, pinned footer.
//   CustomModal only provides the Dialog shell — no header, padding, or footer
//   is added. The content component owns 100% of the internal layout.
//
//   <CustomModal open={open} onOpenChange={setOpen} size="lg" fixedLayout>
//     <MyContentWithOwnHeaderAndFooter />
//   </CustomModal>
//
// Prop reference:
//   open          boolean       controls visibility
//   onOpenChange  fn(bool)      called on backdrop click / Esc
//   trigger       ReactNode     optional trigger element
//   title         string        header title (standard) or sr-only a11y label (fixedLayout)
//   description   string        header subtitle (standard mode only)
//   size          string        sm | md | lg | xl | full   (default: md)
//   footer        ReactNode     pinned footer (standard mode only)
//   children      ReactNode     modal content
//   className     string        extra classes on DialogContent
//   fixedLayout   boolean       enable fixed layout mode   (default: false)
//   height        string        optional maxHeight override (default: calc(100vh - 80px))
// ─────────────────────────────────────────────────────────────────────────────

const sizeClasses = {
  sm:   "sm:max-w-sm",
  md:   "sm:max-w-lg",
  lg:   "sm:max-w-2xl",
  xl:   "sm:max-w-4xl",
  full: "!max-w-none !w-screen !h-screen !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0",
};

export function CustomModal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
  fixedLayout = false,
  height,
}) {

  // ── FIXED LAYOUT MODE ───────────────────────────────────────────────────────
  if (fixedLayout) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          className={cn(sizeClasses[size], "p-0 gap-0 overflow-hidden flex flex-col", className)}
          style={{ maxHeight: height ?? "calc(100vh - 80px)" }}
          // Prevents Radix from auto-focusing the first focusable element on open
          // (e.g. the temperature number input getting highlighted immediately).
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {/* sr-only title satisfies Radix a11y without visible text */}
          <DialogTitle className="sr-only">{title ?? "Modal"}</DialogTitle>

          {/*
            Inner wrapper — solves BOTH layout problems in one place:

            Problem A (P1F2 / few sensors — content doesn't fill modal):
              DialogContent uses maxHeight, not a fixed height. Without an explicit
              height on the flex container, children won't stretch to fill it.
              Setting both flex:1 AND height:100% covers both cases:
              flex:1   → stretches when parent is taller than content
              height:100% → fills when parent has a definite size

            Problem B (P1F1 / many sensors — footer gets clipped):
              overflow:hidden here confines all overflow to this box.
              The body panel inside SensorLimitsContent uses overflowY:auto,
              so only the body scrolls — header and footer stay pinned.
              minHeight:0 lets this flex child shrink below its content size
              instead of overflowing.
          */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minHeight: 0, overflow: "hidden" }}>
            {children}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── STANDARD MODE ───────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(sizeClasses[size], size === "full" && "flex flex-col", className)}
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("py-2", size === "full" && "flex-1 overflow-y-auto")}>
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}