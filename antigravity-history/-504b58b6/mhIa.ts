import { BookingStatus } from '../../types/db'

export type PublicBookingStatus = 'PENDIENTE' | 'PAGADA' | 'CANCELADA'

/**
 * Maps internal database status to user-facing status.
 * RECHAZADA is mapped to CANCELADA to hide it from user view as requested.
 */
export function getPublicStatus(internalStatus: BookingStatus | string): PublicBookingStatus {
    const status = internalStatus as BookingStatus

    if (status === 'PENDIENTE_PAGO' || status === 'EN_VERIFICACION') {
        return 'PENDIENTE'
    }

    if (status === 'PAGADA') {
        return 'PAGADA'
    }

    if (status === 'CANCELADA' || status === 'EXPIRADA' || status === 'BLOQUEADA' || status === 'RECHAZADA') {
        return 'CANCELADA'
    }

    return 'CANCELADA'
}

export function getStatusLabel(status: PublicBookingStatus | BookingStatus, isAdmin: boolean = false): string {
    if (!isAdmin) {
        const publicStatus = getPublicStatus(status as BookingStatus)
        switch (publicStatus) {
            case 'PENDIENTE': return 'Pendiente'
            case 'PAGADA': return 'Pagada'
            case 'CANCELADA': return 'Cancelada'
        }
    } else {
        const s = status as BookingStatus
        switch (s) {
            case 'PENDIENTE_PAGO': return 'Pendiente de Pago'
            case 'EN_VERIFICACION': return 'En Verificación'
            case 'PAGADA': return 'Pagada'
            case 'CANCELADA': return 'Cancelada'
            case 'EXPIRADA': return 'Expirada'
            case 'BLOQUEADA': return 'Bloqueada'
            case 'RECHAZADA': return 'Cancelada (Rechazada)'
            default: return s
        }
    }
    return status
}
