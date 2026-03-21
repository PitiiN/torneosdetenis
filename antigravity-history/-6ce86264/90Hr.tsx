import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30',
                destructive:
                    'bg-destructive text-destructive-foreground shadow-md shadow-destructive/20 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30',
                outline:
                    'border border-border/60 bg-transparent hover:bg-secondary/80 hover:text-secondary-foreground hover:border-border',
                secondary:
                    'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost:
                    'hover:bg-secondary/50 hover:text-secondary-foreground',
                link:
                    'text-primary underline-offset-4 hover:underline',
                success:
                    'bg-success text-success-foreground shadow-md shadow-success/20 hover:bg-success/90 hover:shadow-lg hover:shadow-success/30',
                warning:
                    'bg-warning text-warning-foreground shadow-md shadow-warning/20 hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/30',
                glow:
                    'bg-primary text-primary-foreground shadow-[0_0_20px_rgb(var(--primary)/0.4)] hover:shadow-[0_0_30px_rgb(var(--primary)/0.6)]',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 rounded-md px-3 text-xs',
                lg: 'h-11 rounded-lg px-8 text-base',
                xl: 'h-12 rounded-lg px-10 text-base font-semibold',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
