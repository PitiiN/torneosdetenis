import { cn } from "@/lib/utils"

export type BookingStatus =
    | 'PENDIENTE_PAGO'
    | 'EN_VERIFICACION'
    | 'PAGADA'
    | 'RECHAZADA' // Deprecated but exists in DB
    | 'CANCELADA'
    | 'BLOQUEADA'
    | 'EXPIRADA'

export type UserVisibleStatus =
    | 'PENDIENTE'
    | 'PAGADA'
    | 'CANCELADA'

// Mapping Logic
export function toUserVisibleStatus(status: BookingStatus): UserVisibleStatus {
    switch (status) {
        case 'PENDIENTE_PAGO':
        case 'EN_VERIFICACION':
            return 'PENDIENTE'
        case 'PAGADA':
            return 'PAGADA'
        case 'CANCELADA':
        case 'EXPIRADA':
        case 'BLOQUEADA':
        case 'RECHAZADA':
            return 'CANCELADA'
        default:
            return 'CANCELADA' // Fallback
    }
}

export function getStatusLabel(status: UserVisibleStatus | BookingStatus, isAdmin: boolean = false): string {
    if (!isAdmin) {
        // User View Labels
        const userStatus = isAdmin ? (status as BookingStatus) : toUserVisibleStatus(status as BookingStatus)
        switch (userStatus) {
            case 'PENDIENTE': return 'Pendiente'
            case 'PAGADA': return 'Pagada'
            case 'CANCELADA': return 'Cancelada'
            default: return userStatus as string
        }
    } else {
        // Admin View Labels
        switch (status) {
            case 'PENDIENTE_PAGO': return 'Pendiente de Pago'
            case 'EN_VERIFICACION': return 'En Verificación'
            case 'PAGADA': return 'Pagada'
            case 'CANCELADA': return 'Cancelada'
            case 'EXPIRADA': return 'Expirada'
            case 'BLOQUEADA': return 'Bloqueada'
            case 'RECHAZADA': return 'Cancelada (Rechazada)' // Admin hint
            default: return status
        }
    }
}

export function getStatusBadgeVariant(status: UserVisibleStatus | BookingStatus, isAdmin: boolean = false): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
    // We can define custom variants in Badge component or map to standard
    const mapping = isAdmin ? status : toUserVisibleStatus(status as BookingStatus)

    switch (mapping) {
        case 'PAGADA': return 'success'
        case 'PENDIENTE': return 'warning'
        case 'PENDIENTE_PAGO': return 'warning'
        case 'EN_VERIFICACION': return 'secondary'
        case 'CANCELADA': return 'destructive'
        case 'EXPIRADA': return 'outline'
        case 'BLOQUEADA': return 'destructive'
        case 'RECHAZADA': return 'destructive'
        default: return 'default'
    }
}
