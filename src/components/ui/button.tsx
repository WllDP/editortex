import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-center text-sm font-semibold leading-none text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/70 disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]",
          variant === "default" && "border-[#60A5FA]/35 bg-[#2563EB]/88 hover:bg-[#3B82F6]",
          variant === "outline" &&
            "border-white/16 bg-white/[0.075] text-[#E5E7EB] hover:border-[#22D3EE]/45 hover:bg-white/[0.12] hover:text-white",
          variant === "ghost" &&
            "border-transparent bg-transparent shadow-none hover:border-white/14 hover:bg-white/[0.08] hover:text-white",
          variant === "destructive" && "border-[#FB7185]/35 bg-[#F43F5E]/90 hover:bg-[#FF4D9D]",
          size === "sm" && "h-9 px-3.5 py-0",
          size === "md" && "h-10 px-[18px] py-0",
          size === "icon" && "h-10 w-10 rounded-2xl p-0",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
