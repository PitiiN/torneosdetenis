import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { COURT_SCHEDULES } from '../../src/lib/courtSchedules';
import { format, addDays, isToday, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, X, FileText, Ban } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AdminAgendaScreen() {
    const { user } = useAuth();
    const [fields, setFields] = useState<any[]>([]);
    const [selectedField, setSelectedField] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Generar próximos 14 días para el selector
    const days = useMemo(() => {
        return Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
    }, []);

    useEffect(() => {
        const fetchFields = async () => {
            const { data } = await supabase.from('fields').select('*').eq('is_active', true);
            if (data) {
                setFields(data);
                if (data.length > 0) setSelectedField(data[0]);
            }
        };
        fetchFields();
    }, []);

    useEffect(() => {
        if (selectedField && selectedDate) {
            fetchBookings();
        }
    }, [selectedField, selectedDate]);

    const fetchBookings = async () => {
        setLoading(true);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
            .from('bookings')
            .select('*, user:profiles(full_name, phone)')
            .eq('field_id', selectedField.id)
            .gte('start_at', startOfDay.toISOString())
            .lte('start_at', endOfDay.toISOString())
            .neq('status', 'CANCELADA');

        if (error) {
            console.error('Error fetching bookings:', error);
        } else {
            setBookings(data || []);
        }
        setLoading(false);
    };

    const timeSlots = useMemo(() => {
        if (!selectedField) return [];
        const schedule = COURT_SCHEDULES[selectedField.name];
        if (!schedule) return [];

        const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
        const daySchedule = isWeekend && schedule.weekend ? schedule.weekend : schedule.weekday;

        if (!daySchedule) return [];

        const slots = [];
        const [startHour, startMin] = daySchedule.start.split(':').map(Number);
        const [endHour, endMin] = daySchedule.end.split(':').map(Number);

        let currentHour = startHour;
        let currentMin = startMin;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
            const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
            slots.push(timeStr);

            currentHour += 1;
        }
        return slots;
    }, [selectedField, selectedDate]);

    const getBookingForSlot = (time: string) => {
        return bookings.find(b => {
            const bTime = format(new Date(b.start_at), 'HH:mm');
            return bTime === time;
        });
    };

    const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-manage-booking', {
                body: {
                    bookingId,
                    action: 'update',
                    updateData: { status: newStatus }
                }
            });

            if (error) throw error;

            Alert.alert("Éxito", "Reserva actualizada correctamente");
            fetchBookings();
        } catch (error: any) {
            console.error('Error updating status via Edge Function:', error);
            Alert.alert("Error", "No se pudo actualizar la reserva: " + (error.message || "Error desconocido"));
        } finally {
            setLoading(false);
        }
    };

    const handleBlockSlot = async (time: string) => {
        if (!selectedField || !selectedDate) return;

        try {
            setLoading(true);
            const [hour, minute] = time.split(':').map(Number);
            const startAt = new Date(selectedDate);
            startAt.setHours(hour, minute, 0, 0);

            const endAt = new Date(startAt);
            endAt.setHours(hour + 1, minute, 0, 0);

            const { error } = await supabase
                .from('bookings')
                .insert({
                    field_id: selectedField.id,
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString(),
                    user_id: user?.id,
                    status: 'BLOQUEADA',
                    payment_status: 'COMPLETED',
                    price_total_cents: 0,
                    verification_note: 'Bloqueo Manual'
                });

            if (error) throw error;
            Alert.alert("Éxito", "Horario bloqueado correctamente.");
            fetchBookings();
        } catch (error: any) {
            Alert.alert("Error", error.message || "No se pudo bloquear el horario.");
        } finally {
            setLoading(false);
        }
    };

    const showBookingActions = (booking: any) => {
        const actions: any[] = [];

        if (booking.status === 'BLOQUEADA') {
            actions.push({
                text: "Desbloquear Horario",
                onPress: () => handleUpdateStatus(booking.id, 'CANCELADA'),
                style: 'destructive',
            });
        } else {
            actions.push({
                text: "Confirmar Pago",
                onPress: () => handleUpdateStatus(booking.id, 'PAGADA'),
                style: 'default',
            });

            if (booking.payment_proof_path) {
                actions.push({
                    text: "Ver Comprobante",
                    onPress: () => {
                        const { data } = supabase.storage.from('payments').getPublicUrl(booking.payment_proof_path);
                        if (data?.publicUrl) Linking.openURL(data.publicUrl);
                    },
                    style: 'default'
                });
            }

            actions.push({
                text: "Cancelar Reserva",
                onPress: () => {
                    Alert.alert(
                        "¿Confirmar cancelación?",
                        "Esta acción no se puede deshacer.",
                        [
                            { text: "No", style: "cancel" },
                            { text: "Sí, Cancelar", onPress: () => handleUpdateStatus(booking.id, 'CANCELADA'), style: 'destructive' }
                        ]
                    );
                },
                style: 'destructive',
            });
        }

        actions.push({ text: "Cerrar", style: "cancel" });

        Alert.alert(
            "Gestionar Reserva",
            booking.status === 'BLOQUEADA' ? "Este horario está bloqueado administrativamente." : `Cliente: ${booking.user?.full_name || 'N/A'}\nEstado: ${booking.status}`,
            actions
        );
    };

    const showAvailableActions = (time: string) => {
        Alert.alert(
            "Espacio Disponible",
            `¿Qué deseas hacer con el horario de las ${time}?`,
            [
                { text: "Bloquear Horario", onPress: () => handleBlockSlot(time), style: 'destructive' },
                { text: "Cancelar", style: "cancel" }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Selector de Cancha */}
            <View style={styles.fieldSelector}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fieldScroll}>
                    {fields.map((field) => (
                        <TouchableOpacity
                            key={field.id}
                            style={[styles.fieldBadge, selectedField?.id === field.id && styles.fieldBadgeSelected]}
                            onPress={() => setSelectedField(field)}
                        >
                            <Text style={[styles.fieldBadgeText, selectedField?.id === field.id && styles.fieldBadgeTextSelected]}>
                                {field.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Selector de Fecha */}
            <View style={styles.dateSelector}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
                    {days.map((day) => {
                        const isSel = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                        return (
                            <TouchableOpacity
                                key={day.toISOString()}
                                style={[styles.dateItem, isSel && styles.dateItemSelected]}
                                onPress={() => setSelectedDate(day)}
                            >
                                <Text style={[styles.dateDayName, isSel && styles.dateDayNameSelected]}>
                                    {format(day, 'EEE', { locale: es })}
                                </Text>
                                <Text style={[styles.dateDayNum, isSel && styles.dateDayNumSelected]}>
                                    {format(day, 'd')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Grid de Disponibilidad */}
            <ScrollView style={styles.gridContainer} contentContainerStyle={styles.gridContent}>
                {loading ? (
                    <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 40 }} />
                ) : timeSlots.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <X size={48} color="#d1d5db" />
                        <Text style={styles.emptyText}>La cancha está cerrada este día.</Text>
                    </View>
                ) : (
                    timeSlots.map((time) => {
                        const booking = getBookingForSlot(time);
                        return (
                            <View key={time} style={styles.slotRow}>
                                <View style={styles.timeContainer}>
                                    <Text style={styles.timeText}>{time}</Text>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.slotCard,
                                        booking ? (
                                            booking.status === 'PAGADA' ? styles.slotOccupied :
                                                booking.status === 'BLOQUEADA' ? styles.slotBlocked :
                                                    styles.slotPending
                                        ) : styles.slotAvailable
                                    ]}
                                    onPress={() => {
                                        if (booking) {
                                            showBookingActions(booking);
                                        } else {
                                            showAvailableActions(time);
                                        }
                                    }}
                                >
                                    {booking ? (
                                        <View style={styles.bookingInfo}>
                                            <View style={styles.bookingHeader}>
                                                <Text style={[
                                                    styles.bookingName,
                                                    (booking.status === 'PAGADA' || booking.status === 'BLOQUEADA') ? styles.whiteText : styles.amberText
                                                ]}>
                                                    {booking.status === 'BLOQUEADA' ? 'HORARIO BLOQUEADO' : (booking.user?.full_name || 'Admin/Invitado')}
                                                </Text>
                                                <Badge variant={booking.status === 'PAGADA' ? 'pagada' : 'pendiente'}>
                                                    {booking.status === 'PAGADA' ? 'OK' : booking.status === 'BLOQUEADA' ? 'BLOQ' : 'PRIO'}
                                                </Badge>
                                            </View>
                                            <Text style={[
                                                styles.bookingDetails,
                                                (booking.status === 'PAGADA' || booking.status === 'BLOQUEADA') ? styles.whiteText : styles.amberText
                                            ]}>
                                                {booking.status === 'BLOQUEADA' ? (booking.verification_note || 'Manual') : (booking.user?.phone || 'Sin teléfono')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.availableText}>Disponible</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    fieldSelector: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    fieldScroll: {
        paddingHorizontal: 16,
        gap: 10,
    },
    fieldBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    fieldBadgeSelected: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    fieldBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6b7280',
    },
    fieldBadgeTextSelected: {
        color: '#fff',
    },
    dateSelector: {
        paddingVertical: 12,
        backgroundColor: '#f9fafb',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    dateScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    dateItem: {
        width: 50,
        height: 65,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    dateItemSelected: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    dateDayName: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9ca3af',
        textTransform: 'uppercase',
    },
    dateDayNameSelected: {
        color: 'rgba(255,255,255,0.8)',
    },
    dateDayNum: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginTop: 2,
    },
    dateDayNumSelected: {
        color: '#fff',
    },
    gridContainer: {
        flex: 1,
    },
    gridContent: {
        padding: 16,
    },
    slotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    timeContainer: {
        width: 60,
    },
    timeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
    },
    slotCard: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        minHeight: 70,
        justifyContent: 'center',
        borderWidth: 1,
    },
    slotAvailable: {
        backgroundColor: '#f0fdf4',
        borderColor: '#dcfce7',
        borderStyle: 'dashed',
    },
    slotOccupied: {
        backgroundColor: '#10b981',
        borderColor: '#059669',
    },
    slotBlocked: {
        backgroundColor: '#4b5563',
        borderColor: '#374151',
    },
    slotPending: {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
    },
    availableText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    bookingInfo: {
        gap: 4,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bookingName: {
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
    },
    bookingDetails: {
        fontSize: 13,
        opacity: 0.9,
    },
    whiteText: {
        color: '#fff',
    },
    amberText: {
        color: '#92400e',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});
