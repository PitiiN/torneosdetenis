import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { useFocusEffect } from 'expo-router';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getCachedValue, setCachedValue } from '@/services/runtimeCache';

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
    const { colors } = useTheme();
    const styles = getStyles(colors);
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

            const cacheKey = `payments:${session.user.id}`;
            const cached = getCachedValue<PaymentRecord[]>(cacheKey);
            if (cached) {
                setPayments(cached);
            }

            const { data: registrationRows, error } = await supabase
                .from('registrations')
                .select('id, tournament_id, fee_amount, is_paid, status, registered_at')
                .eq('player_id', session.user.id)
                .order('id', { ascending: false });

            if (error) throw error;

            const tournamentIds = [...new Set(
                (registrationRows || [])
                    .map((row: any) => row?.tournament_id)
                    .filter(Boolean)
            )] as string[];

            const tournamentsById: Record<string, { name: string; end_date: string | null; start_date: string | null }> = {};
            if (tournamentIds.length > 0) {
                const { data: tournamentRows, error: tournamentsError } = await supabase
                    .from('tournaments')
                    .select('id, name, end_date, start_date')
                    .in('id', tournamentIds);

                if (tournamentsError) throw tournamentsError;

                (tournamentRows || []).forEach((tournament: any) => {
                    tournamentsById[tournament.id] = {
                        name: tournament.name || 'Torneo',
                        end_date: tournament.end_date || null,
                        start_date: tournament.start_date || null,
                    };
                });
            }

            const formatted = (registrationRows || []).map((registration: any) => {
                const tournament = tournamentsById[registration.tournament_id];
                return {
                    id: registration.id,
                    tournament_id: registration.tournament_id,
                    tournament_name: tournament?.name || 'Torneo',
                    fee_amount: Number(registration.fee_amount || 0),
                    is_paid: Boolean(registration.is_paid),
                    created_at: tournament?.end_date || tournament?.start_date || registration.registered_at || new Date().toISOString(),
                    status: registration.status,
                } as PaymentRecord;
            });

            setPayments(formatted);
            setCachedValue(cacheKey, formatted, 60_000);
        } catch (error) {
            setPayments([]);
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
                    <TennisSpinner size={34} style={{ marginTop: 40 }} />
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

const getStyles = (colors: any) => StyleSheet.create({
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
        color: colors.text,
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
        color: colors.text,
    },
    summaryIcon: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionHeader: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
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
        color: colors.text,
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
        color: colors.text,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
    },
    statusPaid: {
        backgroundColor: colors.success + '1A',
    },
    statusUnpaid: {
        backgroundColor: colors.error + '1A',
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
