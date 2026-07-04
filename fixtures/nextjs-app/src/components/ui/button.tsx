import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "ghost";
}

/** Styled button with variants. */
export function Button({ variant = "default", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium",
        variant === "default" && "bg-slate-900 text-white",
        variant === "destructive" && "bg-red-600 text-white",
        variant === "ghost" && "bg-transparent hover:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}
