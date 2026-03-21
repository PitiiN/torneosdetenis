// ... imports
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    Clock,
    Plus,
    Edit2,
    CalendarPlus,
    CalendarRange, // Imported for new button
    Check,
    X,
    ListChecks, // Imported for rename
} from 'lucide-react'
import { PatternBookingModal } from '@/components/admin/PatternBookingModal'

// ... inside component

// Pattern modal
const [showPatternModal, setShowPatternModal] = useState(false)

    // ... inside return (Header)

    < div className = "flex gap-2" >
                    <Button
                        variant={isMultiSelectMode ? "secondary" : "outline"}
                        onClick={() => {
                            setIsMultiSelectMode(!isMultiSelectMode)
                            setSelectedSlots([])
                        }}
                    >
                        <ListChecks className="w-4 h-4 mr-2" />
                        {isMultiSelectMode ? 'Cancelar Selección' : 'Selección Múltiple'}
                    </Button>
                    <Button onClick={() => setShowPatternModal(true)}>
                        <CalendarRange className="w-4 h-4 mr-2" />
                        Reserva Periódica
                    </Button>
                </div >

    // ... inside return (Modals)

    {/* Recurring Modal (Manual Selection) */ }
{
    showRecurringModal && (
        <RecurringBookingModal
            selectedSlots={selectedSlots}
            field={selectedField}
            fields={fields}
            onClose={handleRecurringClose}
            onSave={handleRecurringSaved}
        />
    )
}

{/* Pattern Modal (Rule Based) */ }
{
    showPatternModal && (
        <PatternBookingModal
            field={selectedField}
            fields={fields}
            onClose={() => setShowPatternModal(false)}
            onSave={() => {
                setShowPatternModal(false)
                fetchWeekBookings()
            }}
        />
    )
}
        </div >
    )
}
