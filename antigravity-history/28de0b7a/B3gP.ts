import { z } from 'zod'

export const adminBookingFilterSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'canceled', 'paid', 'payment_pending', 'verifying']).optional(),
    fieldId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    from: z.string().datetime().optional(), // Expects ISO string
    to: z.string().datetime().optional(),
    summary: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
})

export type AdminBookingFilter = z.infer<typeof adminBookingFilterSchema>
