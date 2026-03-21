'use client'

import { Button } from '@/components/ui/button'
import { CalendarRange } from 'lucide-react'
import { AdminCalendarView } from '@/components/admin/AdminCalendarView'

export default function AdminAvailabilityPage() {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Disponibilidad (Admin)</h1>
                    <p className="text-muted-foreground">
                        Gestiona reservas y crea reservas periódicas
                    </p>
                </div>
            </div>

            {/* Calendar View */}
            <AdminCalendarView />
        </div>
    )
}
