import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
      green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      yellow: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
      red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
      gray: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
