import { BookingStatus } from '@/types/db'

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

export function getPublicStatusColor(status: PublicBookingStatus): string {
    switch (status) {
        case 'PENDIENTE':
            return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20'
        case 'PAGADA':
            return 'bg-green-500/15 text-green-600 border-green-500/20'
        case 'CANCELADA':
        default:
            return 'bg-gray-500/15 text-gray-600 border-gray-500/20'
    }
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

export function getStatusBadgeVariant(status: PublicBookingStatus | BookingStatus, isAdmin: boolean = false): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
    // Admin view maps internal statuses
    if (isAdmin) {
        const s = status as BookingStatus
        switch (s) {
            case 'PAGADA': return 'success'
            case 'PENDIENTE_PAGO': return 'warning'
            case 'EN_VERIFICACION': return 'secondary'
            case 'CANCELADA': return 'destructive'
            case 'EXPIRADA': return 'outline'
            case 'BLOQUEADA': return 'destructive'
            case 'RECHAZADA': return 'destructive'
            default: return 'default'
        }
    }

    // User view maps public status
    const publicStatus = getPublicStatus(status as BookingStatus)
    switch (publicStatus) {
        case 'PAGADA': return 'success'
        case 'PENDIENTE': return 'warning'
        case 'CANCELADA': return 'destructive'
        default: return 'default'
    }
}
