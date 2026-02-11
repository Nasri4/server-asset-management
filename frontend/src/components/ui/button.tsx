import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: Soft Green Design System - modern radius, icon-friendly
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-colors duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 ring-offset-background " +
    "[&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary: Soft Green (#22C55E)
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600 active:bg-primary-700",

        // Secondary action (outline with soft green)
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-blue-600",

        // Success (submit) - uses soft green
        success:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600",

        // Warning
        warning:
          "bg-sam-warning text-white shadow-sm hover:bg-amber-600",

        // Info
        info:
          "bg-sam-info text-white shadow-sm hover:bg-sky-600",

        // Destructive
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-red-600 active:bg-red-700",

        // Alias used across the app
        danger:
          "bg-destructive text-white shadow-sm hover:bg-red-600 active:bg-red-700",

        // Premium: soft green themed
        premium:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600",

        // Outline: soft green border
        outline:
          "border border-primary bg-transparent text-primary-600 shadow-none hover:bg-primary-50 active:bg-primary-100",

        // Very light action buttons (tables)
        ghost:
          "bg-transparent text-foreground shadow-none hover:bg-gray-100 active:bg-gray-200",

        // Link
        link: "text-primary-600 underline-offset-4 hover:underline hover:text-primary-700",
      },
      size: {
        // Default: medium, modern sizing
        default: "h-10 px-4 py-2",

        // Small: compact for tables/headers
        sm: "h-8 px-3 py-1.5",

        // Large: prominent actions
        lg: "h-10 px-6 py-2.5",

        // Icon: square, compact
        icon: "h-10 w-10",

        // Alias sizes used across the app
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
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
