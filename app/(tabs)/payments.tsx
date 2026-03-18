import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

interface PaymentRecord {
    id: string;
    tournament_id: string;
    tournament_name: string;
    fee_amount: number;
    is_paid: boolean;
    created_at: string;
    status: string;
}

export default function PaymentsScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);

    useFocusEffect(
        useCallback(() => {
            fetchPayments();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPayments();
    }, []);

    async function fetchPayments() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('registrations')
                .select(`
                    id,
                    tournament_id,
                    fee_amount,
                    is_paid,
                    created_at,
                    status,
                    tournaments:tournaments!inner(name)
                `)
                .eq('player_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map((r: any) => ({
                id: r.id,
                tournament_id: r.tournament_id,
                tournament_name: r.tournaments.name,
                fee_amount: r.fee_amount,
                is_paid: r.is_paid,
                created_at: r.created_at,
                status: r.status
            }));

            setPayments(formatted);
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const totalUnpaid = payments.filter(p => !p.is_paid).reduce((acc, p) => acc + p.fee_amount, 0);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerContent}>
                    <Ionicons name="card" size={24} color={colors.primary[500]} />
                    <Text style={styles.headerTitle}>Mis Pagos</Text>
                    <View style={{ width: 24 }} />
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            >
                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View>
                        <Text style={styles.summaryLabel}>PENDIENTE POR PAGAR</Text>
                        <Text style={styles.summaryValue}>${totalUnpaid.toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryIcon}>
                        <Ionicons name="wallet-outline" size={32} color={colors.primary[500]} />
                    </View>
                </View>

                {/* Payments List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Historial de Torneos</Text>
                </View>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
                ) : payments.length > 0 ? (
                    <View style={styles.list}>
                        {payments.map((p) => (
                            <View key={p.id} style={styles.paymentCard}>
                                <View style={styles.paymentInfo}>
                                    <Text style={styles.tournamentName} numberOfLines={1}>{p.tournament_name}</Text>
                                    <View style={styles.dateRow}>
                                        <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                                        <Text style={styles.dateText}>{new Date(p.created_at).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                                <View style={styles.paymentStatus}>
                                    <Text style={styles.amountText}>${p.fee_amount.toLocaleString()}</Text>
                                    <View style={[styles.statusBadge, p.is_paid ? styles.statusPaid : styles.statusUnpaid]}>
                                        <Text style={[styles.statusText, p.is_paid ? styles.statusTextPaid : styles.statusTextUnpaid]}>
                                            {p.is_paid ? 'PAGADO' : 'PENDIENTE'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No tienes registros de pagos aún.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        height: 60,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 40,
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.textTertiary,
        letterSpacing: 1,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
    },
    summaryIcon: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.xl,
        backgroundColor: 'rgba(255,255,255,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionHeader: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
    },
    list: {
        gap: spacing.md,
    },
    paymentCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    tournamentName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: 12,
        color: colors.textTertiary,
    },
    paymentStatus: {
        alignItems: 'flex-end',
        gap: 6,
    },
    amountText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
    },
    statusPaid: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    statusUnpaid: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
    },
    statusTextPaid: {
        color: colors.success,
    },
    statusTextUnpaid: {
        color: colors.error,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        marginTop: spacing.md,
    }
});
