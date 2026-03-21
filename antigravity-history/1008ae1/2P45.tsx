import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { paymentsService } from '@/services/payments.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function PaymentsScreen() {
    const { profile } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        if (!profile) return;
        const [paymentsRes, summaryRes] = await Promise.all([
            paymentsService.getStudentPayments(profile.id),
            paymentsService.getStudentSummary(profile.id),
        ]);
        if (paymentsRes.data) setPayments(paymentsRes.data);
        if (summaryRes.data) setSummary(summaryRes.data);
    };

    useEffect(() => { load(); }, [profile]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
        paid: { color: colors.payment.paid, label: 'Pagado', icon: 'checkmark-circle' },
        pending: { color: colors.payment.pending, label: 'Pendiente', icon: 'time' },
        overdue: { color: colors.payment.overdue, label: 'Vencido', icon: 'alert-circle' },
        refunded: { color: colors.payment.refunded, label: 'Reembolsado', icon: 'arrow-undo' },
        cancelled: { color: colors.payment.cancelled, label: 'Cancelado', icon: 'close-circle' },
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Pagos</Text>
            </View>

            {/* Summary cards */}
            {summary && (
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { borderLeftColor: colors.success }]}>
                        <Text style={styles.summaryLabel}>Pagado</Text>
                        <Text style={styles.summaryValue}>${Number(summary.total_paid).toLocaleString('es-CL')}</Text>
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: colors.warning }]}>
                        <Text style={styles.summaryLabel}>Pendiente</Text>
                        <Text style={styles.summaryValue}>${Number(summary.total_pending).toLocaleString('es-CL')}</Text>
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: colors.error }]}>
                        <Text style={styles.summaryLabel}>Vencido</Text>
                        <Text style={styles.summaryValue}>${Number(summary.total_overdue).toLocaleString('es-CL')}</Text>
                    </View>
                </View>
            )}

            <FlatList
                data={payments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => {
                    const config = statusConfig[item.status] || statusConfig.pending;
                    return (
                        <View style={styles.paymentCard}>
                            <View style={styles.paymentHeader}>
                                <View style={styles.paymentLeft}>
                                    <Ionicons name={config.icon as any} size={20} color={config.color} />
                                    <View>
                                        <Text style={styles.paymentTitle}>{item.description || item.classes?.title || 'Pago'}</Text>
                                        <Text style={styles.paymentDate}>
                                            Vence: {format(new Date(item.due_date), 'd MMM yyyy', { locale: es })}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.paymentRight}>
                                    <Text style={styles.paymentAmount}>
                                        ${Number(item.final_amount).toLocaleString('es-CL')}
                                    </Text>
                                    <View style={[styles.paymentBadge, { backgroundColor: config.color + '20' }]}>
                                        <Text style={[styles.paymentBadgeText, { color: config.color }]}>{config.label}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="wallet-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay pagos registrados</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    summaryRow: {
        flexDirection: 'row', paddingHorizontal: spacing.xl,
        gap: spacing.sm, marginBottom: spacing.lg,
    },
    summaryCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, borderLeftWidth: 3,
    },
    summaryLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
    summaryValue: { fontSize: 16, fontWeight: '700', color: colors.text },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    paymentCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        padding: spacing.lg, marginBottom: spacing.sm,
    },
    paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    paymentLeft: { flexDirection: 'row', gap: spacing.md, flex: 1, alignItems: 'center' },
    paymentTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    paymentDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    paymentRight: { alignItems: 'flex-end' },
    paymentAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
    paymentBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: borderRadius.sm, marginTop: 4 },
    paymentBadgeText: { fontSize: 10, fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },
});
