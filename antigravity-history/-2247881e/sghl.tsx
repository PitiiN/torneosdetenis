import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import {
    format,
    addDays,
    startOfWeek,
    isSameDay,
    isBefore,
    startOfToday,
    parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { MapPin, Clock, Calendar as CalendarIcon, CheckCircle, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { Field, Booking } from '../../src/types/domain';

const TIME_ZONE = 'America/Santiago';

// Fixed operating hours for now to match web logic
const COURT_SCHEDULES: Record<string, any> = {
    'Huelén 7': { start: '09:30', end: '23:30', interval: 60 },
    'Huelén 5': { start: '09:30', end: '23:30', interval: 60 },
    'Tabancura 6': { start: '19:00', end: '22:00', interval: 60 },
};

export default function SearchScreen() {
    const router = useRouter();
    const [fields, setFields] = useState<Field[]>([]);
    const [selectedField, setSelectedField] = useState<Field | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [loading, setLoading] = useState(true);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);
    const [bookingLoading, setBookingLoading] = useState(false);

    // 1. Fetch Fields
    useEffect(() => {
        const fetchFields = async () => {
            const { data } = await supabase.from('fields').select('*').eq('is_active', true);
            if (data) {
                setFields(data);
                if (data.length > 0) setSelectedField(data[0]);
            }
            setLoading(false);
        };
        fetchFields();
    }, []);

    // 2. Calculate Availability when field or date changes
    useEffect(() => {
        if (!selectedField) return;

        const fetchAvailability = async () => {
            setSlotsLoading(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');

                // Fetch bookings for this field and date
                const { data: bookings } = await supabase
                    .from('bookings')
                    .select('start_at, end_at, status, created_at, created_source')
                    .eq('field_id', selectedField.id)
                    .gte('start_at', `${dateStr}T00:00:00`)
                    .lte('start_at', `${dateStr}T23:59:59`)
                    .not('status', 'in', '("CANCELADA","EXPIRADA")');

                // Fetch blocks
                const { data: blocks } = await supabase
                    .from('field_blocks')
                    .select('start_at, end_at')
                    .eq('field_id', selectedField.id)
                    .gte('start_at', `${dateStr}T00:00:00`)
                    .lte('start_at', `${dateStr}T23:59:59`);

                // Generate slots based on schedule
                const sched = COURT_SCHEDULES[selectedField.name] || { start: '09:00', end: '23:00', interval: 60 };
                const [startH, startM] = sched.start.split(':').map(Number);
                const [endH, endM] = sched.end.split(':').map(Number);

                const slots = [];
                let current = new Date(selectedDate);
                current.setHours(startH, startM, 0, 0);

                const endDay = new Date(selectedDate);
                endDay.setHours(endH, endM, 0, 0);

                while (current < endDay) {
                    const slotStartTime = formatInTimeZone(current, TIME_ZONE, 'HH:mm');
                    const slotEndTime = formatInTimeZone(new Date(current.getTime() + 60 * 60000), TIME_ZONE, 'HH:mm');

                    // Check if occupied
                    const isOccupied = bookings?.some(b => {
                        const bStart = formatInTimeZone(new Date(b.start_at), TIME_ZONE, 'HH:mm');
                        return bStart === slotStartTime;
                    }) || blocks?.some(bl => {
                        const blStart = formatInTimeZone(new Date(bl.start_at), TIME_ZONE, 'HH:mm');
                        return blStart === slotStartTime;
                    });

                    // Check if past
                    const isPast = isBefore(current, new Date());

                    slots.push({
                        time: slotStartTime,
                        endTime: slotEndTime,
                        startAt: current.toISOString(),
                        endAt: new Date(current.getTime() + 60 * 60000).toISOString(),
                        status: isOccupied ? 'occupied' : (isPast ? 'past' : 'available')
                    });

                    current = new Date(current.getTime() + sched.interval * 60000);
                }

                setAvailableSlots(slots);
            } catch (err) {
                console.error(err);
            } finally {
                setSlotsLoading(false);
            }
        };

        fetchAvailability();
    }, [selectedField, selectedDate]);

    const handleBooking = async (slot: any) => {
        Alert.alert(
            "Confirmar Reserva",
            `¿Deseas reservar ${selectedField?.name} para hoy a las ${slot.time}?`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Confirmar", onPress: () => processBooking(slot) }
            ]
        );
    };

    const processBooking = async (slot: any) => {
        setBookingLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-booking', {
                body: {
                    fieldId: selectedField?.id,
                    startAt: slot.startAt,
                    durationMinutes: 60,
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            Alert.alert("¡Éxito!", "Tu reserva ha sido creada. Tienes 10 minutos para pagar.");
            router.push('/(tabs)/bookings');
        } catch (err: any) {
            console.error('Error creating booking via Edge Function:', err);
            Alert.alert("Error", err.message || "No se pudo crear la reserva");
        } finally {
            setBookingLoading(false);
        }
    };

    // Date range for picker (next 14 days)
    const dates = useMemo(() => {
        return Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));
    }, []);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Reservar Cancha</Text>
            </View>

            {/* Field Selector */}
            <View style={styles.fieldListContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fieldList}>
                    {fields.map(field => (
                        <TouchableOpacity
                            key={field.id}
                            onPress={() => setSelectedField(field)}
                            style={[styles.fieldBadge, selectedField?.id === field.id && styles.fieldBadgeSelected]}
                        >
                            <Text style={[styles.fieldBadgeText, selectedField?.id === field.id && styles.fieldBadgeTextSelected]}>
                                {field.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Date Picker */}
            <View style={styles.datePickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
                    {dates.map(date => {
                        const isActive = isSameDay(date, selectedDate);
                        return (
                            <TouchableOpacity
                                key={date.toISOString()}
                                onPress={() => setSelectedDate(date)}
                                style={[styles.dateItem, isActive && styles.dateItemActive]}
                            >
                                <Text style={[styles.dateDay, isActive && styles.dateTextActive]}>
                                    {format(date, 'eee', { locale: es })}
                                </Text>
                                <Text style={[styles.dateNumber, isActive && styles.dateTextActive]}>
                                    {format(date, 'd')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Slots List */}
            <FlatList
                data={availableSlots}
                keyExtractor={item => item.time}
                contentContainerStyle={styles.slotList}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.slotCard,
                            item.status !== 'available' && styles.slotCardDisabled
                        ]}
                        onPress={() => item.status === 'available' && handleBooking(item)}
                        disabled={item.status !== 'available' || bookingLoading}
                    >
                        <View style={styles.slotInfo}>
                            <Clock size={20} color={item.status === 'available' ? '#10b981' : '#9ca3af'} />
                            <Text style={[styles.slotTime, item.status !== 'available' && styles.slotTextDisabled]}>
                                {item.time} - {item.endTime}
                            </Text>
                        </View>
                        <View style={styles.slotAction}>
                            {item.status === 'available' ? (
                                <View style={styles.actionBadgePrimary}>
                                    <Text style={styles.actionTextPrimary}>Disponible</Text>
                                    <ChevronRight size={16} color="#ffffff" />
                                </View>
                            ) : (
                                <Badge variant="outline">{item.status === 'occupied' ? 'Ocupado' : 'Pasado'}</Badge>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    slotsLoading ? <ActivityIndicator style={styles.mt20} color="#10b981" /> : (
                        <Text style={styles.emptyText}>No hay horarios disponibles para este día.</Text>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
        paddingTop: 60,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    fieldListContainer: {
        marginBottom: 20,
    },
    fieldList: {
        paddingHorizontal: 20,
        gap: 10,
    },
    fieldBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    fieldBadgeSelected: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    fieldBadgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    fieldBadgeTextSelected: {
        color: '#ffffff',
    },
    datePickerContainer: {
        marginBottom: 20,
        backgroundColor: '#ffffff',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f3f4f6',
    },
    dateList: {
        paddingHorizontal: 20,
        gap: 15,
    },
    dateItem: {
        width: 50,
        height: 65,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    dateItemActive: {
        backgroundColor: '#10b981',
    },
    dateDay: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    dateNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginTop: 2,
    },
    dateTextActive: {
        color: '#ffffff',
    },
    slotList: {
        padding: 20,
        paddingTop: 0,
        gap: 12,
    },
    slotCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    slotCardDisabled: {
        backgroundColor: '#f3f4f6',
        borderColor: '#f3f4f6',
    },
    slotInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    slotTime: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    slotTextDisabled: {
        color: '#9ca3af',
    },
    slotAction: {},
    actionBadgePrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    actionTextPrimary: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 40,
        fontSize: 15,
    },
    mt20: {
        marginTop: 20,
    },
});
