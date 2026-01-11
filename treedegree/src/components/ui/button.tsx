import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-body",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-2 border-muted-foreground/30 bg-transparent hover:bg-muted hover:border-muted-foreground/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Fire element button
        fire: "bg-gradient-to-br from-[hsl(145,70%,45%)] to-[hsl(155,75%,48%)] text-white border-2 border-[hsl(155,75%,48%)]/50 shadow-[0_0_30px_hsl(145,70%,45%/0.5)] hover:scale-105 hover:shadow-[0_0_40px_hsl(145,70%,45%/0.7)]",
        // Water element button
        water: "bg-gradient-to-br from-[hsl(195,90%,50%)] to-[hsl(190,100%,65%)] text-white border-2 border-[hsl(190,100%,65%)]/50 shadow-[0_0_30px_hsl(195,90%,50%/0.5)] hover:scale-105 hover:shadow-[0_0_40px_hsl(195,90%,50%/0.7)]",
        // Dual element hero button
        hero: "bg-gradient-to-r from-[hsl(145,70%,45%)] via-[hsl(280,60%,50%)] to-[hsl(195,90%,50%)] text-white border-2 border-white/20 shadow-[0_0_40px_hsl(280,60%,50%/0.5)] hover:scale-105 hover:shadow-[0_0_60px_hsl(280,60%,50%/0.7)] font-display tracking-wider",
        // Stone/cave button
        stone: "bg-gradient-to-br from-[hsl(220,12%,18%)] to-[hsl(220,15%,25%)] text-foreground border-2 border-[hsl(220,12%,25%)] hover:border-muted-foreground/50 hover:bg-muted",
        // Gold achievement button
        gold: "bg-gradient-to-br from-[hsl(45,100%,55%)] to-[hsl(50,100%,70%)] text-background border-2 border-[hsl(50,100%,70%)]/50 shadow-[0_0_30px_hsl(45,100%,55%/0.5)] hover:scale-105 font-display",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
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
