import React, { useCallback, useMemo, useState } from 'react';
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
    rejection_reason?: string | null;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function PaymentsScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

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

            // 1. Obtener registros confirmados (registrations)
            const { data: registrationRows, error: registrationError } = await supabase
                .from('registrations')
                .select('id, tournament_id, fee_amount, is_paid, status, registered_at')
                .eq('player_id', session.user.id)
                .order('id', { ascending: false });

            if (registrationError) throw registrationError;

            // 2. Obtener solicitudes de inscripción (pendientes y rechazadas)
            const { data: requestRows, error: requestsError } = await supabase
                .from('tournament_registration_requests')
                .select('id, tournament_id, status, rejection_reason, created_at')
                .eq('player_id', session.user.id)
                .order('created_at', { ascending: false });

            if (requestsError) throw requestsError;

            // 3. Unificar IDs de torneos
            const tournamentIds = [...new Set([
                ...(registrationRows || []).map((row: any) => row?.tournament_id),
                ...(requestRows || []).map((row: any) => row?.tournament_id)
            ].filter(Boolean))] as string[];

            // 4. Obtener información de los torneos (incluyendo su cuota)
            const tournamentsById: Record<string, { name: string; end_date: string | null; start_date: string | null; registration_fee: number }> = {};
            if (tournamentIds.length > 0) {
                const { data: tournamentRows, error: tournamentsError } = await supabase
                    .from('tournaments')
                    .select('id, name, end_date, start_date, registration_fee')
                    .in('id', tournamentIds);

                if (tournamentsError) throw tournamentsError;

                (tournamentRows || []).forEach((tournament: any) => {
                    tournamentsById[tournament.id] = {
                        name: tournament.name || 'Torneo',
                        end_date: tournament.end_date || null,
                        start_date: tournament.start_date || null,
                        registration_fee: Number(tournament.registration_fee || 0),
                    };
                });
            }

            // 5. Formatear las inscripciones confirmadas
            const formattedRegistrations = (registrationRows || []).map((registration: any) => {
                const tournament = tournamentsById[registration.tournament_id];
                return {
                    id: registration.id,
                    tournament_id: registration.tournament_id,
                    tournament_name: tournament?.name || 'Torneo',
                    fee_amount: Number(registration.fee_amount || tournament?.registration_fee || 0),
                    is_paid: Boolean(registration.is_paid),
                    created_at: tournament?.end_date || tournament?.start_date || registration.registered_at || new Date().toISOString(),
                    status: registration.status,
                } as PaymentRecord;
            });

            // 6. Formatear las solicitudes pendientes y rechazadas
            const formattedRequests = (requestRows || [])
                .filter((req: any) => req.status === 'pending' || req.status === 'rejected')
                .map((req: any) => {
                    const tournament = tournamentsById[req.tournament_id];
                    return {
                        id: req.id,
                        tournament_id: req.tournament_id,
                        tournament_name: tournament?.name || 'Torneo',
                        fee_amount: Number(tournament?.registration_fee || 0),
                        is_paid: false,
                        created_at: req.created_at || new Date().toISOString(),
                        status: req.status === 'pending' ? 'pending_approval' : 'rejected',
                        rejection_reason: req.rejection_reason || null,
                    } as PaymentRecord;
                });

            // 7. Combinar y ordenar por fecha (más reciente primero)
            const combined = [...formattedRegistrations, ...formattedRequests].sort((a, b) => {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return dateB - dateA;
            });

            setPayments(combined);
            setCachedValue(cacheKey, combined, 60_000);
        } catch (error) {
            setPayments([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = new Set<number>([currentYear]);

        payments.forEach((payment) => {
            const paymentDate = new Date(payment.created_at);
            if (!Number.isNaN(paymentDate.getTime())) {
                years.add(paymentDate.getFullYear());
            }
        });

        return [...years].sort((a, b) => b - a);
    }, [payments]);

    const filteredPayments = useMemo(() => (
        payments.filter((payment) => {
            const paymentDate = new Date(payment.created_at);
            if (Number.isNaN(paymentDate.getTime())) return false;
            return paymentDate.getFullYear() === selectedYear && paymentDate.getMonth() === selectedMonth;
        })
    ), [payments, selectedYear, selectedMonth]);

    const totalUnpaid = filteredPayments
        .filter(payment => !payment.is_paid)
        .reduce((acc, payment) => acc + payment.fee_amount, 0);

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

                <View style={styles.filterSection}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.carouselScroll}
                    >
                        {availableYears.map((year) => (
                            <TouchableOpacity
                                key={year}
                                style={[styles.carouselItem, selectedYear === year && styles.carouselItemActive]}
                                onPress={() => setSelectedYear(year)}
                            >
                                <Text style={[styles.carouselText, selectedYear === year && styles.carouselTextActive]}>{year}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.carouselScroll}
                        style={{ marginTop: spacing.xs }}
                    >
                        {MONTHS.map((month, index) => (
                            <TouchableOpacity
                                key={month}
                                style={[styles.carouselItem, selectedMonth === index && styles.carouselItemActive]}
                                onPress={() => setSelectedMonth(index)}
                            >
                                <Text style={[styles.carouselText, selectedMonth === index && styles.carouselTextActive]}>{month}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loadingState}>
                        <TennisSpinner size={34} />
                    </View>
                ) : filteredPayments.length > 0 ? (
                    <View style={styles.list}>
                        {filteredPayments.map((p) => {
                            const isPaid = p.is_paid || p.status === 'confirmed';
                            
                            const getBadgeStyle = () => {
                                if (isPaid) return styles.statusPaid;
                                if (p.status === 'pending_approval') return styles.statusPendingApproval;
                                return styles.statusUnpaid;
                            };

                            const getBadgeTextStyle = () => {
                                if (isPaid) return styles.statusTextPaid;
                                if (p.status === 'pending_approval') return styles.statusTextPendingApproval;
                                return styles.statusTextUnpaid;
                            };

                            const getBadgeText = () => {
                                if (isPaid) return 'PAGADO';
                                if (p.status === 'pending_approval') return 'EN REVISIÓN';
                                if (p.status === 'rejected') return 'RECHAZADO';
                                return 'PENDIENTE';
                            };

                            return (
                                <View key={p.id} style={styles.paymentCard}>
                                    <View style={styles.paymentInfo}>
                                        <Text style={styles.tournamentName} numberOfLines={1}>{p.tournament_name}</Text>
                                        <View style={styles.dateRow}>
                                            <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                                            <Text style={styles.dateText}>{new Date(p.created_at).toLocaleDateString()}</Text>
                                        </View>
                                        {p.status === 'rejected' && p.rejection_reason ? (
                                            <Text style={styles.rejectionReason} numberOfLines={2}>
                                                Motivo: {p.rejection_reason}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.paymentStatus}>
                                        <Text style={styles.amountText}>${p.fee_amount.toLocaleString()}</Text>
                                        <View style={[styles.statusBadge, getBadgeStyle()]}>
                                            <Text style={[styles.statusText, getBadgeTextStyle()]}>
                                                {getBadgeText()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay pagos para el mes y año seleccionados.</Text>
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
    filterSection: {
        marginBottom: spacing.xl,
    },
    carouselScroll: {
        gap: spacing.xs,
        paddingRight: spacing.xl,
    },
    carouselItem: {
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 70,
        alignItems: 'center',
    },
    carouselItemActive: {
        backgroundColor: colors.primary[500] + '20',
        borderColor: colors.primary[500],
    },
    carouselText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    carouselTextActive: {
        color: colors.primary[500],
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
    statusPendingApproval: {
        backgroundColor: colors.warning + '1A',
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
    statusTextPendingApproval: {
        color: colors.warning,
    },
    rejectionReason: {
        fontSize: 12,
        color: colors.error,
        marginTop: 6,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingState: {
        minHeight: 260,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        marginTop: spacing.md,
    }
});
