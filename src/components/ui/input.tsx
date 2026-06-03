import * as React from "react";
import { cn } from "@/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-white/14 bg-white/[0.075] px-3 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] outline-none backdrop-blur-xl transition-colors duration-200 file:border-0 file:bg-transparent file:text-sm file:font-semibold placeholder:text-[#94A3B8] focus-visible:border-[#22D3EE]/55 focus-visible:bg-white/[0.11] focus-visible:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
