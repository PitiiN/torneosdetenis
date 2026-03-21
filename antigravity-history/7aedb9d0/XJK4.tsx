import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { getPublicStatus } from '../../src/lib/bookings/status';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
    Calendar,
    Clock,
    CreditCard,
    ChevronRight,
    HelpCircle,
    Phone,
    Mail,
    User,
    CheckCircle,
    CalendarDays
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { Booking, Field } from '../../src/types/domain';

const TIME_ZONE = 'America/Santiago';

interface DashboardStats {
    totalBookings: number;
    pendingPayment: number;
    confirmed: number;
}

export default function DashboardScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = useState('');
    const [nextBooking, setNextBooking] = useState<(Booking & { field?: Field }) | null>(null);
    const [stats, setStats] = useState<DashboardStats>({
        totalBookings: 0,
        pendingPayment: 0,
        confirmed: 0,
    });

    const fetchData = async () => {
        try {
            // 1. Get Profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();

                if (profile?.full_name) {
                    setUserName(profile.full_name.split(' ')[0]);
                }
            }

            // 2. Fetch Next Booking
            const now = new Date().toISOString();
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('*, field:fields(*)')
                .gte('start_at', now)
                .neq('status', 'CANCELADA')
                .order('start_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            setNextBooking(bookingData as (Booking & { field?: Field }) | null);

            // 3. Stats (Current Month)
            const startDate = startOfMonth(new Date());
            const endDate = endOfMonth(new Date());

            const { data: monthData } = await supabase
                .from('bookings')
                .select('status')
                .gte('start_at', startDate.toISOString())
                .lte('start_at', endDate.toISOString());

            if (monthData) {
                const publicStats = monthData.map(b => getPublicStatus(b.status));
                setStats({
                    totalBookings: publicStats.length,
                    pendingPayment: publicStats.filter(s => s === 'PENDIENTE').length,
                    confirmed: publicStats.filter(s => s === 'PAGADA').length,
                });
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const formatDate = (dateString: string, formatStr: string) => {
        try {
            return formatInTimeZone(new Date(dateString), TIME_ZONE, formatStr, { locale: es });
        } catch {
            return dateString;
        }
    };

    const formatCurrency = (amountCents: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
        }).format(amountCents / 100);
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.greeting}>Hola, {userName || 'Jugador'} 👋</Text>
                <Text style={styles.subtitle}>Resumen de tu actividad deportiva</Text>
            </View>

            {/* Next Booking Hero */}
            <Card style={styles.heroCard}>
                <CardHeader style={styles.heroHeader}>
                    <View style={styles.badgeRow}>
                        <Badge variant="outline">Próxima Reserva</Badge>
                        {nextBooking && (
                            <Badge variant={getPublicStatus(nextBooking.status).toLowerCase() as any}>
                                {getPublicStatus(nextBooking.status)}
                            </Badge>
                        )}
                    </View>
                    <Text style={styles.heroTitle}>
                        {nextBooking ? nextBooking.field?.name : 'Sin reservas próximas'}
                    </Text>
                </CardHeader>
                <CardContent>
                    {nextBooking ? (
                        <View style={styles.bookingDetails}>
                            <View style={styles.detailItem}>
                                <Calendar color="#10b981" size={20} />
                                <View>
                                    <Text style={styles.detailLabel}>Fecha</Text>
                                    <Text style={styles.detailValue}>
                                        {formatDate(nextBooking.start_at, "EEEE d 'de' MMMM")}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.detailItem}>
                                <Clock color="#10b981" size={20} />
                                <View>
                                    <Text style={styles.detailLabel}>Horario</Text>
                                    <Text style={styles.detailValue}>
                                        {formatDate(nextBooking.start_at, 'HH:mm')} - {formatDate(nextBooking.end_at, 'HH:mm')}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.detailItem}>
                                <CreditCard color="#10b981" size={20} />
                                <View>
                                    <Text style={styles.detailLabel}>Valor</Text>
                                    <Text style={styles.detailValue}>
                                        {formatCurrency(nextBooking.price_total_cents || 3500000)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No tienes reservas activas. ¡Agenda la próxima!</Text>
                            <Button
                                title="Reservar ahora"
                                onPress={() => router.push('/(tabs)/search')}
                                style={styles.reserveButton}
                            />
                        </View>
                    )}
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                    <View style={styles.statIconContainer}>
                        <CalendarDays color="#6b7280" size={16} />
                    </View>
                    <Text style={styles.statValue}>{stats.totalBookings}</Text>
                    <Text style={styles.statLabel}>Total Mes</Text>
                </Card>
                <Card style={styles.statCard}>
                    <View style={styles.statIconContainer}>
                        <Clock color="#f59e0b" size={16} />
                    </View>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.pendingPayment}</Text>
                    <Text style={styles.statLabel}>Pendientes</Text>
                </Card>
                <Card style={styles.statCard}>
                    <View style={styles.statIconContainer}>
                        <CheckCircle color="#10b981" size={16} />
                    </View>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.confirmed}</Text>
                    <Text style={styles.statLabel}>Pagadas</Text>
                </Card>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
            <View style={styles.quickActions}>
                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/(tabs)/search')}>
                    <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
                        <Calendar color="#10b981" size={24} />
                    </View>
                    <Text style={styles.actionText}>Nueva Reserva</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/(tabs)/bookings')}>
                    <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                        <CreditCard color="#3b82f6" size={24} />
                    </View>
                    <Text style={styles.actionText}>Mis Reservas</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/(tabs)/profile')}>
                    <View style={[styles.actionIcon, { backgroundColor: '#f5f3ff' }]}>
                        <User color="#8b5cf6" size={24} />
                    </View>
                    <Text style={styles.actionText}>Perfil</Text>
                </TouchableOpacity>
            </View>

            {/* Support */}
            <Card style={styles.supportCard}>
                <CardHeader>
                    <View style={styles.row}>
                        <HelpCircle color="#10b981" size={20} />
                        <Text style={styles.supportTitle}>¿Necesitas ayuda?</Text>
                    </View>
                </CardHeader>
                <CardContent style={styles.supportContent}>
                    <TouchableOpacity style={styles.supportLink}>
                        <Phone color="#059669" size={20} />
                        <Text style={styles.supportLinkText}>Contactar Soporte</Text>
                        <ChevronRight color="#9ca3af" size={20} />
                    </TouchableOpacity>
                </CardContent>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 24,
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 4,
    },
    heroCard: {
        marginBottom: 24,
        borderWidth: 0,
        elevation: 4,
        shadowOpacity: 0.1,
    },
    heroHeader: {
        paddingBottom: 8,
    },
    badgeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    bookingDetails: {
        marginTop: 12,
        gap: 16,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6b7280',
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        textTransform: 'capitalize',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        textAlign: 'center',
        color: '#6b7280',
        marginBottom: 20,
        fontSize: 15,
    },
    reserveButton: {
        width: '100%',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    statCard: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
    },
    statIconContainer: {
        marginBottom: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 2,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    actionItem: {
        alignItems: 'center',
        width: '30%',
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
        textAlign: 'center',
    },
    supportCard: {
        backgroundColor: '#ffffff',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    supportTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    supportContent: {
        paddingTop: 0,
    },
    supportLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
    },
    supportLinkText: {
        flex: 1,
        fontSize: 15,
        color: '#374151',
    },
});
