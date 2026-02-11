import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-border/60 bg-muted/40 text-foreground/80 [a&]:hover:bg-muted/55",
        secondary:
          "border-border/60 bg-muted/30 text-foreground/80 [a&]:hover:bg-muted/45",
        destructive:
          "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400 [a&]:hover:bg-rose-500/15",
        success:
          "border-sam-success/20 bg-sam-success-soft text-sam-success dark:border-sam-success/30 dark:text-sam-success",
        warning:
          "border-sam-warning/20 bg-sam-warning-soft text-sam-warning dark:border-sam-warning/30 dark:text-sam-warning",
        info:
          "border-sam-info/20 bg-sam-info-soft text-sam-info dark:border-sam-info/30 dark:text-sam-info",
        "soft-success":
          "border-sam-success/20 bg-sam-success-soft text-sam-success dark:border-sam-success/30 dark:text-sam-success",
        "soft-warning":
          "border-sam-warning/20 bg-sam-warning-soft text-sam-warning dark:border-sam-warning/30 dark:text-sam-warning",
        "soft-danger":
          "border-sam-error/20 bg-sam-error-soft text-sam-error dark:border-sam-error/30 dark:text-sam-error",
        "soft-info":
          "border-sam-info/20 bg-sam-info-soft text-sam-info dark:border-sam-info/30 dark:text-sam-info",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
