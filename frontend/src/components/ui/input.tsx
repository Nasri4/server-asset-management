import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-gray-400 selection:bg-primary selection:text-primary-foreground " +
        "h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm " +
        "transition-all duration-150 outline-none " +
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium " +
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100",
        "focus:border-primary focus:ring-2 focus:ring-primary/20",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
