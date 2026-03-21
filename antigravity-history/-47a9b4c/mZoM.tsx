import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Linking, Alert } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { getPublicStatus } from '../../src/lib/bookings/status';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, Clock, CreditCard, MessageSquare, ChevronRight, MapPin } from 'lucide-react-native';
import { es } from 'date-fns/locale';
import type { Booking, Field } from '../../src/types/domain';

const TIME_ZONE = 'America/Santiago';

export default function BookingsScreen() {
    const [bookings, setBookings] = useState<(Booking & { field: Field })[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('bookings')
                .select('*, field:fields(*)')
                .eq('user_id', user.id)
                .order('start_at', { ascending: false });

            if (error) throw error;
            setBookings(data as (Booking & { field: Field })[]);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchBookings();
    };

    const formatDate = (dateString: string, formatStr: string) => {
        try {
            return formatInTimeZone(new Date(dateString), TIME_ZONE, formatStr, { locale: es });
        } catch {
            return dateString;
        }
    };

    const handleWhatsApp = (bookingId: string) => {
        const message = `Hola, envío el comprobante para la reserva #${bookingId.slice(0, 8)}`;
        const url = `whatsapp://send?phone=56912345678&text=${encodeURIComponent(message)}`;
        Linking.openURL(url).catch(() => {
            Alert.alert("Error", "No se pudo abrir WhatsApp. ¿Está instalado?");
        });
    };

    const renderBooking = ({ item }: { item: Booking & { field: Field } }) => {
        const publicStatus = getPublicStatus(item.status);
        const isPast = new Date(item.start_at) < new Date();

        return (
            <Card style={[styles.bookingCard, isPast && styles.pastBooking]}>
                <CardContent style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.fieldName}>{item.field.name}</Text>
                            <Text style={styles.bookingId}>ID: {item.id.slice(0, 8)}</Text>
                        </View>
                        <Badge variant={publicStatus.toLowerCase() as any}>{publicStatus}</Badge>
                    </View>

                    <View style={styles.detailsContainer}>
                        <View style={styles.detailRow}>
                            <Calendar size={18} color="#6b7280" />
                            <Text style={styles.detailText}>{formatDate(item.start_at, "EEEE d 'de' MMMM")}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Clock size={18} color="#6b7280" />
                            <Text style={styles.detailText}>{formatDate(item.start_at, "HH:mm")} - {formatDate(item.end_at, "HH:mm")}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <CreditCard size={18} color="#6b7280" />
                            <Text style={styles.detailText}>
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.price_total_cents / 100)}
                            </Text>
                        </View>
                    </View>

                    {publicStatus === 'PENDIENTE' && !isPast && (
                        <TouchableOpacity
                            style={styles.payButton}
                            onPress={() => handleWhatsApp(item.id)}
                        >
                            <MessageSquare size={18} color="#ffffff" />
                            <Text style={styles.payButtonText}>Enviar Comprobante</Text>
                        </TouchableOpacity>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Mis Reservas</Text>
            </View>
            <FlatList
                data={bookings}
                keyExtractor={item => item.id}
                renderItem={renderBooking}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    !loading ? <Text style={styles.emptyText}>No tienes reservas aún.</Text> : null
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
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    listContent: {
        padding: 20,
        paddingTop: 0,
        gap: 16,
    },
    bookingCard: {
        backgroundColor: '#ffffff',
    },
    pastBooking: {
        opacity: 0.8,
    },
    cardContent: {
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    fieldName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    bookingId: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 2,
    },
    detailsContainer: {
        gap: 10,
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    detailText: {
        fontSize: 14,
        color: '#374151',
        textTransform: 'capitalize',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10b981',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    payButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 100,
        fontSize: 16,
    },
});
