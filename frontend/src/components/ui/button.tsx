import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: reference-style soft surface + modern radius, icon-friendly
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium " +
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 " +
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ring-offset-background " +
    "[&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Neutral surface (matches buttons.png)
        default:
          "border border-border/60 bg-muted/20 text-foreground/90 shadow-xs hover:bg-muted/30 hover:shadow-sm " +
          "dark:bg-muted/15 dark:hover:bg-muted/25",

        // Secondary action (keep neutral)
        secondary:
          "border border-border/60 bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Success (submit) - neutral, non-annoying
        success:
          "border border-border/60 bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Warning - neutral, non-annoying
        warning:
          "border border-border/60 bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Info - neutral, non-annoying
        info:
          "border border-border/60 bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Destructive - subtle red outline (no fill)
        destructive:
          "border border-rose-500/30 bg-transparent text-rose-700 shadow-none hover:bg-rose-500/5 " +
          "dark:text-rose-400",

        // Alias used across the app
        danger:
          "border border-rose-500/30 bg-transparent text-rose-700 shadow-none hover:bg-rose-500/5 " +
          "dark:text-rose-400",

        // Premium: keep calm and mostly neutral
        premium:
          "border border-border/60 bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Calm outline
        outline:
          "border border-border/60 bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Very light action buttons (tables)
        ghost:
          "bg-transparent text-foreground/90 shadow-none hover:bg-muted/20",

        // Link
        link: "text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400",
      },
      size: {
        // Default: medium, not bulky
        default: "h-9 px-4 py-2",

        // Small: compact for tables/headers
        sm: "h-8 px-3 py-1.5",

        // Large: still not oversized
        lg: "h-10 px-5 py-2.5",

        // Icon: square, compact
        icon: "h-9 w-9",

        // Alias sizes used across the app
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "outline",   // ✅ make outline the default everywhere
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
