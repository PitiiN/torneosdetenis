export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type BookingStatus =
    | 'PENDIENTE_PAGO'
    | 'EN_VERIFICACION'
    | 'PAGADA'
    | 'CANCELADA'
    | 'BLOQUEADA'
    | 'EXPIRADA'

export type UserRole = 'USER' | 'ADMIN'

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    phone: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    phone?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    phone?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            user_roles: {
                Row: {
                    user_id: string
                    role: UserRole
                    created_at: string
                }
                Insert: {
                    user_id: string
                    role?: UserRole
                    created_at?: string
                }
                Update: {
                    user_id?: string
                    role?: UserRole
                    created_at?: string
                }
            }
            fields: {
                Row: {
                    id: string
                    name: string
                    location_text: string | null
                    timezone: string
                    slot_duration_minutes: number
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    location_text?: string | null
                    timezone?: string
                    slot_duration_minutes?: number
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    location_text?: string | null
                    timezone?: string
                    slot_duration_minutes?: number
                    is_active?: boolean
                    created_at?: string
                }
            }
            field_schedules: {
                Row: {
                    id: string
                    field_id: string
                    day_of_week: number
                    start_time: string
                    end_time: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    field_id: string
                    day_of_week: number
                    start_time: string
                    end_time: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    field_id?: string
                    day_of_week?: number
                    start_time?: string
                    end_time?: string
                    is_active?: boolean
                    created_at?: string
                }
            }
            bookings: {
                Row: {
                    id: string
                    user_id: string | null
                    field_id: string
                    status: BookingStatus
                    start_at: string
                    end_at: string
                    duration_minutes: number
                    price_total_cents: number
                    currency: string
                    payment_proof_path: string | null
                    payment_reference: string | null
                    verification_note: string | null
                    created_at: string
                    updated_at: string
                    created_source: string
                    status_updated_by: string | null
                    status_updated_at: string | null
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    field_id: string
                    status?: BookingStatus
                    start_at: string
                    end_at: string
                    duration_minutes: number
                    price_total_cents?: number
                    currency?: string
                    payment_proof_path?: string | null
                    payment_reference?: string | null
                    verification_note?: string | null
                    created_at?: string
                    updated_at?: string
                    created_source?: string
                    status_updated_by?: string | null
                    status_updated_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    field_id?: string
                    status?: BookingStatus
                    start_at?: string
                    end_at?: string
                    duration_minutes?: number
                    price_total_cents?: number
                    currency?: string
                    payment_proof_path?: string | null
                    payment_reference?: string | null
                    verification_note?: string | null
                    created_at?: string
                    updated_at?: string
                    created_source?: string
                    status_updated_by?: string | null
                    status_updated_at?: string | null
                }
            }
            field_blocks: {
                Row: {
                    id: string
                    field_id: string
                    start_at: string
                    end_at: string
                    reason: string | null
                    created_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    field_id: string
                    start_at: string
                    end_at: string
                    reason?: string | null
                    created_by?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    field_id?: string
                    start_at?: string
                    end_at?: string
                    reason?: string | null
                    created_by?: string | null
                    created_at?: string
                }
            }
        }
        Functions: {
            is_admin: {
                Args: { uid: string }
                Returns: boolean
            }
        }
        Enums: {
            booking_status: BookingStatus
            user_role: UserRole
        }
    }
}
