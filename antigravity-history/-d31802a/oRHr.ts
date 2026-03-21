import type { Database, BookingStatus, UserRole } from './db'

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Field = Database['public']['Tables']['fields']['Row']
export type FieldInsert = Database['public']['Tables']['fields']['Insert']
export type FieldUpdate = Database['public']['Tables']['fields']['Update']

export type FieldSchedule = Database['public']['Tables']['field_schedules']['Row']
export type FieldScheduleInsert = Database['public']['Tables']['field_schedules']['Insert']
export type FieldScheduleUpdate = Database['public']['Tables']['field_schedules']['Update']

export type Booking = Database['public']['Tables']['bookings']['Row']
export type BookingInsert = Database['public']['Tables']['bookings']['Insert']
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']

export type FieldBlock = Database['public']['Tables']['field_blocks']['Row']
export type FieldBlockInsert = Database['public']['Tables']['field_blocks']['Insert']
export type FieldBlockUpdate = Database['public']['Tables']['field_blocks']['Update']

export type { BookingStatus, UserRole }

// Availability slot type
export interface TimeSlot {
    startTime: string // HH:mm format
    endTime: string   // HH:mm format
    startAt: Date
    endAt: Date
    available: boolean
    bookingId?: string
    blockId?: string
}

// Booking with related data
export interface BookingWithDetails extends Booking {
    field?: Field
    profile?: Profile
}

// User with profile and role
export interface UserWithRole {
    id: string
    email: string
    profile?: Profile
    role: UserRole
}
