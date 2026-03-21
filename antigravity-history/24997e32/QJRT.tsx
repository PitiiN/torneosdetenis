import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Calendar, TrendingUp, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';

export default function AdminFinancialsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [stats, setStats] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        totalPaid: 0,
        totalPending: 0,
        paidCount: 0,
        pendingCount: 0,
    });

    const monthLabel = useMemo(() => {
        return format(selectedDate, 'MMMM yyyy', { locale: es });
    }, [selectedDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const start = startOfMonth(selectedDate).toISOString();
            const end = endOfMonth(selectedDate).toISOString();

            // 1. Fetch all bookings for the month
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('*, field:fields(name)')
                .gte('start_at', start)
                .lte('start_at', end)
                .neq('status', 'CANCELADA');

            if (error) throw error;

            // 2. Aggregate Data
            const fieldStatsMap: Record<string, any> = {};
            let totalPaid = 0;
            let totalPending = 0;
            let paidCount = 0;
            let pendingCount = 0;

            bookings?.forEach(b => {
                const fieldName = b.field?.name || 'Otro';
                if (!fieldStatsMap[fieldName]) {
                    fieldStatsMap[fieldName] = {
                        name: fieldName,
                        paid: 0,
                        pending: 0,
                        count: 0
                    };
                }

                const price = b.price_total_cents || 0;
                fieldStatsMap[fieldName].count++;

                if (b.status === 'PAGADA') {
                    fieldStatsMap[fieldName].paid += price;
                    totalPaid += price;
                    paidCount++;
                } else {
                    fieldStatsMap[fieldName].pending += price;
                    totalPending += price;
                    pendingCount++;
                }
            });

            setStats(Object.values(fieldStatsMap));
            setSummary({ totalPaid, totalPending, paidCount, pendingCount });

        } catch (error) {
            console.error('Error fetching financials:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const changeMonth = (increment: number) => {
        setSelectedDate(prev => increment > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />}
        >
            {/* Month Selector */}
            <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
                    <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthLabel}</Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
                    <ChevronRight size={24} color="#374151" />
                </TouchableOpacity>
            </View>

            {/* Summary Section */}
            <View style={styles.summaryGrid}>
                <Card style={[styles.summaryCard, { backgroundColor: '#ecfdf5', borderColor: '#10b981' }]}>
                    <CardContent>
                        <Text style={styles.summaryLabel}>Confirmado</Text>
                        <Text style={[styles.summaryValue, { color: '#065f46' }]}>{formatCurrency(summary.totalPaid)}</Text>
                        <View style={styles.summarySubRow}>
                            <CheckCircle size={14} color="#059669" />
                            <Text style={styles.summarySubText}>{summary.paidCount} reservas</Text>
                        </View>
                    </CardContent>
                </Card>

                <Card style={[styles.summaryCard, { backgroundColor: '#fffbeb', borderColor: '#f59e0b' }]}>
                    <CardContent>
                        <Text style={styles.summaryLabel}>Por Cobrar</Text>
                        <Text style={[styles.summaryValue, { color: '#92400e' }]}>{formatCurrency(summary.totalPending)}</Text>
                        <View style={styles.summarySubRow}>
                            <Clock size={14} color="#d97706" />
                            <Text style={styles.summarySubText}>{summary.pendingCount} pendientes</Text>
                        </View>
                    </CardContent>
                </Card>
            </View>

            {/* Stats by Field */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Desglose por Cancha</Text>
                {stats.map((item) => {
                    const total = item.paid + item.pending;
                    const progress = total > 0 ? (item.paid / total) * 100 : 0;

                    return (
                        <Card key={item.name} style={styles.fieldCard}>
                            <CardContent>
                                <View style={styles.fieldHeader}>
                                    <Text style={styles.fieldName}>{item.name}</Text>
                                    <Text style={styles.fieldTotal}>{formatCurrency(total)}</Text>
                                </View>

                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                                </View>

                                <View style={styles.fieldDetails}>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Pagado</Text>
                                        <Text style={styles.detailValueGreen}>{formatCurrency(item.paid)}</Text>
                                    </View>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Pendiente</Text>
                                        <Text style={styles.detailValueAmber}>{formatCurrency(item.pending)}</Text>
                                    </View>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Reservas</Text>
                                        <Text style={styles.detailValueGray}>{item.count}</Text>
                                    </View>
                                </View>
                            </CardContent>
                        </Card>
                    );
                })}
            </View>

            <View style={styles.infoBanner}>
                <Text style={styles.infoText}>
                    Este panel muestra estadísticas basadas en las reservas activas (no canceladas) del periodo seleccionado.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        textTransform: 'capitalize',
    },
    navBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
    },
    summaryGrid: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        borderWidth: 1,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    summarySubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    summarySubText: {
        fontSize: 11,
        color: '#6b7280',
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
    },
    fieldCard: {
        marginBottom: 12,
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    fieldName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    fieldTotal: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: '#e5e7eb',
        borderRadius: 4,
        marginBottom: 12,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10b981',
    },
    fieldDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 11,
        color: '#9ca3af',
        marginBottom: 2,
    },
    detailValueGreen: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#059669',
    },
    detailValueAmber: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#d97706',
    },
    detailValueGray: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#4b5563',
    },
    infoBanner: {
        margin: 16,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
    },
    infoText: {
        fontSize: 12,
        color: '#6b7280',
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
