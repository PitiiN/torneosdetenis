import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert, Image, Modal, TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import AdminBottomBar from '@/components/AdminBottomBar';
import TennisLoading from '@/components/common/TennisLoading';
import { notificationsService } from '@/services/notifications.service';
import { useAlertStore } from '@/store/alert.store';
import { colors, spacing, borderRadius } from '@/theme';

const YEARS = Array.from({ length: 6 }, (_, i) => 2025 + i); // 2025 to 2030
const MONTHS = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function AdminFinanceScreen() {
    const router = useRouter();
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [receipts, setReceipts] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });
    const [isLoaded, setIsLoaded] = useState(false);

    // Filters
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [searchQuery, setSearchQuery] = useState('');
    const [showYearModal, setShowYearModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'history'>('pending');

    // Reject modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Approval modal state
    const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [classCount, setClassCount] = useState('4');
    const [processing, setProcessing] = useState(false);

    // Image preview
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data } = await supabase
            .from('payment_receipts')
            .select('*, profiles!payment_receipts_student_id_fkey (full_name, email)')
            .order('created_at', { ascending: false });

        if (data) setReceipts(data);
        setIsLoaded(true);
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
    const checkIsSameMonth = (d: Date) => d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;

    // Derived filtered data
    const filteredReceipts = useMemo(() => {
        const filtered = receipts.filter(r => {
            if (statusFilter === 'pending') {
                if (r.status !== 'pending') return false;
            } else {
                if (r.status === 'pending') return false;
            }

            const date = new Date(r.created_at);
            if (date.getFullYear() !== selectedYear) return false;
            if (date.getMonth() !== selectedMonth) return false;
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const name = (r.profiles?.full_name || '').toLowerCase();
                const email = (r.profiles?.email || '').toLowerCase();
                if (!name.includes(searchLower) && !email.includes(searchLower)) return false;
            }
            return true;
        });

        // Update stats based on filtered results
        setStats({
            pending: receipts.filter((r: any) => r.status === 'pending').length,
            approved: receipts.filter((r: any) => r.status === 'approved' && checkIsSameMonth(new Date(r.created_at))).length,
            total: 0 // Placeholder or remove usage
        });

        return filtered;
    }, [receipts, selectedYear, selectedMonth, searchQuery, statusFilter]);



    const openApprove = (receipt: any) => {
        setSelectedReceipt(receipt);
        setClassCount('4');
        setShowApproveModal(true);
    };

    const handleApprove = async () => {
        if (!selectedReceipt || !profile) return;
        const count = parseInt(classCount);
        if (!count || count <= 0) {
            useAlertStore.getState().showAlert('Error', 'Ingresa un número válido de clases');
            return;
        }

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('payment_receipts')
                .update({
                    status: 'approved',
                    classes_granted: count,
                    reviewed_by: profile.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', selectedReceipt.id);

            if (error) throw error;

            await notificationsService.createNotification(
                selectedReceipt.student_id,
                'Pago Aprobado ✅',
                `Se han acreditado ${count} clases a tu cuenta. ¡Disfrútalas!`,
                'payment'
            );

            useAlertStore.getState().showAlert('✅ Aprobado', `Se asignaron ${count} clases al alumno.`);
            setShowApproveModal(false);
            setSelectedReceipt(null);
            load();
        } catch (error: any) {
            console.error('Approve error:', error);
            useAlertStore.getState().showAlert('Error', error.message || 'No se pudo aprobar el comprobante');
        } finally {
            setProcessing(false);
        }
    };

    const openReject = (receipt: any) => {
        setSelectedReceipt(receipt);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const handleReject = async () => {
        if (!selectedReceipt || !profile || !rejectionReason.trim()) return;

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('payment_receipts')
                .update({
                    status: 'rejected',
                    admin_notes: rejectionReason.trim(),
                    reviewed_by: profile.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', selectedReceipt.id);

            if (error) throw error;

            await notificationsService.createNotification(
                selectedReceipt.student_id,
                'Pago Rechazado ❌',
                `Tu comprobante fue rechazado. Razón: ${rejectionReason}`,
                'payment_error'
            );

            useAlertStore.getState().showAlert('Rechazado', 'Se ha notificado al alumno.');
            setShowRejectModal(false);
            setSelectedReceipt(null);
            load();
        } catch (error: any) {
            console.error('Reject error:', error);
            useAlertStore.getState().showAlert('Error', error.message || 'No se pudo rechazar el comprobante');
        } finally {
            setProcessing(false);
        }
    };

    const statusColor = (s: string) => {
        if (s === 'pending') return colors.warning;
        if (s === 'approved') return colors.success;
        return colors.error;
    };

    const statusText = (s: string) => {
        if (s === 'pending') return 'Pendiente';
        if (s === 'approved') return 'Aprobado';
        return 'Rechazado';
    };

    if (!isLoaded) return <TennisLoading />;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Finanzas</Text>
                <TouchableOpacity onPress={() => setShowYearModal(true)} style={styles.yearSelectorBtn}>
                    <Text style={styles.yearSelectorText}>{selectedYear}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.primary[500]} />
                </TouchableOpacity>
            </View>

            {/* Month Carousel */}
            <View style={styles.monthCarouselWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthCarousel}>
                    {MONTHS.map((m, i) => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.monthPill, selectedMonth === i && styles.monthPillActive]}
                            onPress={() => setSelectedMonth(i)}
                        >
                            <Text style={[styles.monthPillText, selectedMonth === i && styles.monthPillTextActive]}>
                                {m}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Search Box */}
            <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color={colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar alumno..."
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Status Tabs */}
            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tab, statusFilter === 'pending' && styles.tabActive]}
                    onPress={() => setStatusFilter('pending')}
                >
                    <Text style={[styles.tabText, statusFilter === 'pending' && styles.tabTextActive]}>Bandeja Entrada</Text>
                    {stats.pending > 0 && (
                        <View style={styles.tabBadge}>
                            <Text style={styles.tabBadgeText}>{stats.pending}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, statusFilter === 'history' && styles.tabActive]}
                    onPress={() => setStatusFilter('history')}
                >
                    <Text style={[styles.tabText, statusFilter === 'history' && styles.tabTextActive]}>Historial/Filtros</Text>
                </TouchableOpacity>
            </View>

            {/* Stats (only in history) */}
            {statusFilter === 'history' && (
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
                        <Text style={[styles.statValue, { color: colors.success }]}>{stats.approved}</Text>
                        <Text style={styles.statLabel}>Aprobados Mes</Text>
                    </View>
                </View>
            )}

            {/* Year Dropdown Modal */}
            <Modal visible={showYearModal} transparent animationType="fade">
                <TouchableOpacity style={styles.yearModalOverlay} activeOpacity={1} onPress={() => setShowYearModal(false)}>
                    <View style={styles.yearModalContent}>
                        {YEARS.map(y => (
                            <TouchableOpacity
                                key={y}
                                style={[styles.yearModalItem, selectedYear === y && styles.yearModalItemActive]}
                                onPress={() => { setSelectedYear(y); setShowYearModal(false); }}
                            >
                                <Text style={[styles.yearModalText, selectedYear === y && styles.yearModalTextActive]}>{y}</Text>
                                {selectedYear === y && <Ionicons name="checkmark" size={20} color={colors.primary[500]} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <FlatList
                data={filteredReceipts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => (
                    <View style={[styles.receiptCard, item.status === 'pending' && styles.receiptPending]}>
                        <TouchableOpacity onPress={() => setPreviewUrl(item.image_url)}>
                            <Image source={{ uri: item.image_url }} style={styles.receiptImage} />
                            <View style={styles.imageOverlay}>
                                <Ionicons name="expand" size={16} color={colors.white} />
                            </View>
                        </TouchableOpacity>
                        <View style={styles.receiptBody}>
                            <Text style={styles.receiptName}>{item.profiles?.full_name}</Text>
                            <Text style={styles.receiptEmail}>{item.profiles?.email}</Text>
                            <Text style={styles.receiptDate}>
                                {format(new Date(item.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                                <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
                                    {statusText(item.status)}
                                </Text>
                                {item.status === 'approved' && item.classes_granted > 0 && (
                                    <Text style={[styles.badgeText, { color: colors.success }]}>
                                        {' '}· {item.classes_granted} clases
                                    </Text>
                                )}
                            </View>
                        </View>
                        {item.status === 'pending' && (
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.approveBtn} onPress={() => openApprove(item)}>
                                    <Ionicons name="checkmark" size={20} color={colors.success} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => openReject(item)}>
                                    <Ionicons name="close" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay comprobantes</Text>
                    </View>
                }
            />

            {/* Approve modal with class count */}
            <Modal visible={showApproveModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.approveModal}>
                        <Text style={styles.modalTitle}>Aprobar Comprobante</Text>
                        <Text style={styles.modalSubtitle}>
                            Alumno: {selectedReceipt?.profiles?.full_name}
                        </Text>
                        <Text style={styles.modalLabel}>¿A cuántas clases corresponde este pago?</Text>
                        <TextInput
                            style={styles.classInput}
                            value={classCount}
                            onChangeText={setClassCount}
                            keyboardType="number-pad"
                            autoFocus
                            selectTextOnFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => { setShowApproveModal(false); setSelectedReceipt(null); }}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirm, processing && { opacity: 0.6 }]}
                                onPress={handleApprove}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator color={colors.white} size="small" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Aprobar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Reject modal with reason */}
            <Modal visible={showRejectModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.approveModal}>
                        <Text style={styles.modalTitle}>Rechazar Comprobante</Text>
                        <Text style={styles.modalSubtitle}>
                            De: {selectedReceipt?.profiles?.full_name}
                        </Text>
                        <Text style={styles.modalLabel}>Razón del rechazo (se le enviará al alumno):</Text>
                        <TextInput
                            style={[styles.classInput, { fontSize: 16, textAlign: 'left', minHeight: 80, fontWeight: '400' }]}
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            placeholder="Ej: Monto incorrecto, imagen borrosa..."
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => { setShowRejectModal(false); setSelectedReceipt(null); }}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirm, { backgroundColor: colors.error }, processing && { opacity: 0.6 }]}
                                onPress={handleReject}
                                disabled={processing || !rejectionReason.trim()}
                            >
                                {processing ? (
                                    <ActivityIndicator color={colors.white} size="small" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Rechazar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Image preview modal */}
            <Modal visible={!!previewUrl} transparent animationType="fade">
                <View style={styles.previewOverlay}>
                    <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewUrl(null)}>
                        <Ionicons name="close-circle" size={36} color={colors.white} />
                    </TouchableOpacity>
                    {previewUrl && (
                        <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },

    // Year Selector
    yearSelectorBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primary[500] + '20',
        paddingHorizontal: spacing.sm, paddingVertical: 4,
        borderRadius: borderRadius.md,
    },
    yearSelectorText: { fontSize: 14, fontWeight: '600', color: colors.primary[500] },

    // Month Carousel
    monthCarouselWrap: {
        marginHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    monthCarousel: { gap: spacing.md, paddingRight: spacing.xl },
    monthPill: {
        paddingHorizontal: spacing.md, paddingVertical: 6,
        borderRadius: borderRadius.full, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
    },
    monthPillActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
    monthPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    monthPillTextActive: { color: colors.white },

    // Search Box
    searchBox: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginHorizontal: spacing.xl, marginBottom: spacing.lg,
        paddingHorizontal: spacing.md, height: 44,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },

    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

    // Stats
    statsRow: {
        flexDirection: 'row', gap: spacing.sm,
        paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
    },
    statCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, borderLeftWidth: 3, alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

    // Tabs
    tabsRow: {
        flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
    },
    tab: {
        flex: 1, paddingVertical: 10, borderRadius: borderRadius.md,
        backgroundColor: colors.surface, alignItems: 'center',
        flexDirection: 'row', justifyContent: 'center', gap: 6,
    },
    tabActive: { backgroundColor: colors.primary[500] },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.white },
    tabBadge: {
        backgroundColor: colors.error, borderRadius: 10,
        minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 4,
    },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white },

    // Receipt card
    receiptCard: {
        flexDirection: 'row', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    receiptPending: {
        borderWidth: 1, borderColor: colors.warning + '60',
    },
    receiptImage: {
        width: 64, height: 64, borderRadius: borderRadius.sm,
        backgroundColor: colors.border,
    },
    imageOverlay: {
        position: 'absolute', bottom: 4, right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4,
        padding: 2,
    },
    receiptBody: { flex: 1, gap: 2 },
    receiptName: { fontSize: 14, fontWeight: '600', color: colors.text },
    receiptEmail: { fontSize: 11, color: colors.textSecondary },
    receiptDate: { fontSize: 11, color: colors.textTertiary },
    badge: {
        flexDirection: 'row', alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: borderRadius.full, marginTop: 2,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },

    actions: { justifyContent: 'center', gap: spacing.sm },
    approveBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.success + '20',
        justifyContent: 'center', alignItems: 'center',
    },
    rejectBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.error + '20',
        justifyContent: 'center', alignItems: 'center',
    },

    // Approve modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center', padding: spacing['3xl'],
    },
    approveModal: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing['2xl'], width: '100%',
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xl },
    modalLabel: { fontSize: 14, color: colors.text, marginBottom: spacing.sm },
    classInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
        fontSize: 24, fontWeight: '700', color: colors.text,
        textAlign: 'center', borderWidth: 1, borderColor: colors.primary[500],
        marginBottom: spacing.xl,
    },
    modalActions: { flexDirection: 'row', gap: spacing.md },
    modalCancel: {
        flex: 1, height: 48, borderRadius: borderRadius.lg,
        backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
    },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.text },
    modalConfirm: {
        flex: 1, height: 48, borderRadius: borderRadius.lg,
        backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center',
    },
    modalConfirmText: { fontSize: 15, fontWeight: '700', color: colors.white },

    // Preview
    previewOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center', alignItems: 'center',
    },
    previewClose: { position: 'absolute', top: 60, right: 20, zIndex: 10 },
    previewImage: { width: '90%', height: '70%' },

    // Empty
    empty: {
        alignItems: 'center', paddingVertical: spacing['6xl'], gap: spacing.md,
    },
    emptyText: { fontSize: 15, color: colors.textTertiary },

    // Year dropdown modal
    yearModalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    yearModalContent: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.md, width: 200,
    },
    yearModalItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.md, paddingHorizontal: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    yearModalItemActive: { backgroundColor: colors.primary[500] + '10' },
    yearModalText: { fontSize: 16, color: colors.text },
    yearModalTextActive: { fontSize: 16, fontWeight: '700', color: colors.primary[500] },
});
