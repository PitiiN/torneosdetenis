import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground',
                destructive:
                    'border-transparent bg-destructive/90 text-destructive-foreground shadow-sm shadow-destructive/20',
                outline:
                    'text-foreground border-border/60',
                success:
                    'border-transparent bg-success/90 text-success-foreground shadow-sm shadow-success/20',
                warning:
                    'border-transparent bg-warning/90 text-warning-foreground shadow-sm shadow-warning/20',
                // Booking status variants with glow effects
                pendiente:
                    'border-yellow-500/30 bg-yellow-500/15 text-yellow-400 shadow-[0_0_10px_rgb(245_158_11/0.2)]',
                verificacion:
                    'border-blue-400/30 bg-blue-500/15 text-blue-400 shadow-[0_0_10px_rgb(59_130_246/0.2)]',
                pagada:
                    'border-green-500/30 bg-green-500/15 text-green-400 shadow-[0_0_10px_rgb(34_197_94/0.2)]',
                rechazada:
                    'border-red-500/30 bg-red-500/15 text-red-400 shadow-[0_0_10px_rgb(239_68_68/0.2)]',
                cancelada:
                    'border-gray-400/30 bg-gray-500/15 text-gray-400',
                bloqueada:
                    'border-purple-500/30 bg-purple-500/15 text-purple-400 shadow-[0_0_10px_rgb(168_85_247/0.2)]',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
