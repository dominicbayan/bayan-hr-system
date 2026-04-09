import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-teal-600 px-4 py-2 text-white hover:bg-teal-700",
        outline: "border border-slate-300 bg-transparent px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
        ghost: "px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800",
        destructive: "bg-red-600 px-4 py-2 text-white hover:bg-red-700",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  ),
);

Button.displayName = "Button";
