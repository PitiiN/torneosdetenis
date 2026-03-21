import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import {
    TrendingUp,
    Users,
    Calendar,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    DollarSign,
    Clock,
    ShieldCheck
} from 'lucide-react-native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';

export default function AdminScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        confirmed: 0,
        pending: 0,
        revenue: 0,
        today: 0
    });
    const [recentBookings, setRecentBookings] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const now = new Date();
            const firstDay = startOfMonth(now).toISOString();
            const lastDay = endOfMonth(now).toISOString();
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch current month bookings
            const { data: monthData, error: monthError } = await supabase
                .from('bookings')
                .select('status, price_total_cents, start_at')
                .gte('start_at', firstDay)
                .lte('start_at', lastDay);

            if (monthData) {
                const total = monthData.length;
                const confirmed = monthData.filter(b => b.status === 'PAGADA').length;
                const pending = monthData.filter(b => b.status === 'EN_VERIFICACION' || b.status === 'PENDIENTE_PAGO').length;
                const revenue = monthData
                    .filter(b => b.status === 'PAGADA')
                    .reduce((sum, b) => sum + (b.price_total_cents || 0), 0);
                const todayCount = monthData.filter(b => b.start_at.startsWith(today)).length;

                setStats({ total, confirmed, pending, revenue, today: todayCount });
            }

            // 2. Fetch recent bookings that need verification
            const { data: pendingData } = await supabase
                .from('bookings')
                .select('*, field:fields(name)')
                .eq('status', 'EN_VERIFICACION')
                .order('created_at', { ascending: false })
                .limit(5);

            setRecentBookings(pendingData || []);

        } catch (error) {
            console.error('Error fetching admin stats:', error);
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

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
        }).format(cents / 1); // Assuming our values aren't actually divided into cents but raw CLP as per earlier logic
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Cargando panel...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />
            }
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Panel Administrador</Text>
                    <Text style={styles.subtitle}>{format(new Date(), 'MMMM yyyy', { locale: es })}</Text>
                </View>
                <TouchableOpacity style={styles.notificationBtn}>
                    <TrendingUp size={24} color="#10b981" />
                </TouchableOpacity>
            </View>

            {/* Primary Stats Row */}
            <View style={styles.statsGrid}>
                <TouchableOpacity onPress={() => router.push('/admin/financials')}>
                    <Card style={styles.mainStatCard}>
                        <CardContent style={styles.statContent}>
                            <View style={styles.statIconContainer}>
                                <DollarSign size={24} color="#10b981" />
                            </View>
                            <Text style={styles.statValue}>{formatCurrency(stats.revenue)}</Text>
                            <Text style={styles.statLabel}>Ingresos del Mes</Text>
                        </CardContent>
                    </Card>
                </TouchableOpacity>
            </View>

            {/* Secondary Stats Grid */}
            <View style={styles.secondaryStatsGrid}>
                <Card style={styles.secondaryStatCard}>
                    <CardContent>
                        <Text style={styles.secondaryStatValue}>{stats.total}</Text>
                        <Text style={styles.secondaryStatLabel}>Reservas</Text>
                    </CardContent>
                </Card>
                <Card style={styles.secondaryStatCard}>
                    <CardContent>
                        <Text style={styles.secondaryStatValue}>{stats.confirmed}</Text>
                        <Text style={[styles.secondaryStatLabel, { color: '#10b981' }]}>Pagadas</Text>
                    </CardContent>
                </Card>
                <Card style={styles.secondaryStatCard}>
                    <CardContent>
                        <Text style={styles.secondaryStatValue}>{stats.pending}</Text>
                        <Text style={[styles.secondaryStatLabel, { color: '#f59e0b' }]}>Pendientes</Text>
                    </CardContent>
                </Card>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Gestión Rápidas</Text>
                <View style={styles.actionGrid}>
                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={() => router.push('/admin/agenda')}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
                            <Calendar size={24} color="#10b981" />
                        </View>
                        <Text style={styles.actionLabel}>Agenda</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem}>
                        <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                            <Clock size={24} color="#3b82f6" />
                        </View>
                        <Text style={styles.actionLabel}>Bloqueos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={() => router.push('/admin/permissions')}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#f5f3ff' }]}>
                            <ShieldCheck size={24} color="#8b5cf6" />
                        </View>
                        <Text style={styles.actionLabel}>Permisos</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Pending Verifications */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Por Verificar</Text>
                    <TouchableOpacity>
                        <Text style={styles.viewMore}>Ver todo</Text>
                    </TouchableOpacity>
                </View>

                {recentBookings.length === 0 ? (
                    <Card>
                        <CardContent style={styles.emptyContainer}>
                            <CheckCircle size={32} color="#10b981" />
                            <Text style={styles.emptyText}>¡Todo al día! No hay verificaciones pendientes.</Text>
                        </CardContent>
                    </Card>
                ) : (
                    recentBookings.map((booking) => (
                        <TouchableOpacity key={booking.id} style={styles.bookingRow}>
                            <Card>
                                <CardContent style={styles.bookingCardContent}>
                                    <View style={styles.bookingMainInfo}>
                                        <Text style={styles.bookingField}>{booking.field?.name}</Text>
                                        <Text style={styles.bookingDate}>
                                            {format(new Date(booking.start_at), "dd 'de' MMM, HH:mm", { locale: es })}
                                        </Text>
                                    </View>
                                    <Badge variant="pendiente">Por Revisar</Badge>
                                    <ChevronRight size={20} color="#d1d5db" />
                                </CardContent>
                            </Card>
                        </TouchableOpacity>
                    ))
                )}
            </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 14,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    notificationBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    statsGrid: {
        marginBottom: 16,
    },
    mainStatCard: {
        backgroundColor: '#fff',
        borderLeftWidth: 4,
        borderLeftColor: '#10b981',
    },
    statContent: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
    },
    statLabel: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    secondaryStatsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    secondaryStatCard: {
        flex: 1,
        alignItems: 'center',
    },
    secondaryStatValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        textAlign: 'center',
    },
    secondaryStatLabel: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 2,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    viewMore: {
        fontSize: 14,
        color: '#10b981',
        fontWeight: '600',
        marginBottom: 12,
    },
    actionGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionItem: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    actionIcon: {
        width: 60,
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    bookingRow: {
        marginBottom: 10,
    },
    bookingCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
    },
    bookingMainInfo: {
        flex: 1,
    },
    bookingField: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    bookingDate: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
    },
});
