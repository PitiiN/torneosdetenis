import { BookingStatus } from '@/types/db'

export type PublicBookingStatus = 'PENDIENTE' | 'PAGADA' | 'CANCELADA' | 'HOLD'

/**
 * Maps internal database status to user-facing status.
 * 
 * Rules:
 * - PENDIENTE_PAGO / EN_VERIFICACION -> PENDIENTE
 * - PAGADA -> PAGADA
 * - CANCELADA / EXPIRADA -> CANCELADA
 * - BLOQUEADA -> (Should not be shown to user usually, but mapped to CANCELADA or hidden)
 * - HOLD -> HOLD (Dynamic state, usually from client interaction before DB persistence or PENDIENTE_PAGO without payment)
 */
export function getPublicStatus(internalStatus: BookingStatus | string): PublicBookingStatus {
    const status = internalStatus as BookingStatus

    if (status === 'PENDIENTE_PAGO' || status === 'EN_VERIFICACION') {
        return 'PENDIENTE'
    }

    if (status === 'PAGADA') {
        return 'PAGADA'
    }

    if (status === 'CANCELADA' || status === 'EXPIRADA' || status === 'BLOQUEADA') {
        return 'CANCELADA'
    }

    // Fallback
    return 'CANCELADA'
}

export function getPublicStatusColor(status: PublicBookingStatus): string {
    switch (status) {
        case 'PENDIENTE':
            return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20'
        case 'PAGADA':
            return 'bg-green-500/15 text-green-600 border-green-500/20'
        case 'HOLD': // Reserved for client-side hold
            return 'bg-orange-500/15 text-orange-600 border-orange-500/20'
        case 'CANCELADA':
        default:
            return 'bg-gray-500/15 text-gray-600 border-gray-500/20'
    }
}
