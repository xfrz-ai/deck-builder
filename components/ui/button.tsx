import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold tracking-[-0.01em] transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[#E5E5E5] to-[#E2E2E2] text-primary shadow-[0_3px_4px_-1px_rgba(0,0,0,0.15),0px_1px_0px_0px_rgba(255,255,255,0.33)_inset,0px_0px_0px_1px_#D4D4D4] hover:from-[#ECECEC] hover:to-[#E8E8E8]",
        outline:
          "border border-stroke-02 bg-surface-01 text-primary hover:bg-surface-03",
        ghost:
          "border border-transparent font-medium text-primary hover:bg-surface-03 aria-pressed:border-stroke-02 aria-pressed:bg-surface-03 aria-pressed:shadow-pressed data-[state=open]:border-stroke-02 data-[state=open]:bg-surface-03 data-[state=open]:shadow-pressed",
        subtle: "bg-surface-03 text-primary hover:bg-[#ebebeb]",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-3 text-xs",
        icon: "size-10 p-0",
        "icon-sm": "size-8 rounded-lg p-0",
        // Icon with a small caption underneath, used by the main toolbar.
        tool: "h-14 min-w-14 flex-col gap-1 px-1.5 text-[10px] leading-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
