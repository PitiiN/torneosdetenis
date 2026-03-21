import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert, Image, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminFinanceScreen() {
    const router = useRouter();
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [receipts, setReceipts] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });

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

        if (data) {
            setReceipts(data);
            setStats({
                pending: data.filter((r: any) => r.status === 'pending').length,
                approved: data.filter((r: any) => r.status === 'approved').length,
                total: data.reduce((s: number, r: any) => s + (r.classes_granted || 0), 0),
            });
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const openApprove = (receipt: any) => {
        setSelectedReceipt(receipt);
        setClassCount('4');
        setShowApproveModal(true);
    };

    const handleApprove = async () => {
        if (!selectedReceipt || !profile) return;
        const count = parseInt(classCount);
        if (!count || count <= 0) {
            Alert.alert('Error', 'Ingresa un número válido de clases');
            return;
        }

        setProcessing(true);
        const { error } = await supabase
            .from('payment_receipts')
            .update({
                status: 'approved',
                classes_granted: count,
                reviewed_by: profile.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', selectedReceipt.id);

        setProcessing(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('✅ Aprobado', `Se asignaron ${count} clases al alumno.`);
            setShowApproveModal(false);
            setSelectedReceipt(null);
            load();
        }
    };

    const handleReject = (receipt: any) => {
        Alert.prompt
        Alert.alert('Rechazar comprobante', '¿Confirmas rechazar este comprobante?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Rechazar', style: 'destructive',
                onPress: async () => {
                    await supabase
                        .from('payment_receipts')
                        .update({
                            status: 'rejected',
                            admin_notes: 'Comprobante rechazado por admin',
                            reviewed_by: profile?.id,
                            reviewed_at: new Date().toISOString(),
                        })
                        .eq('id', receipt.id);
                    load();
                }
            },
        ]);
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Finanzas</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
                    <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
                    <Text style={styles.statLabel}>Pendientes</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
                    <Text style={[styles.statValue, { color: colors.success }]}>{stats.approved}</Text>
                    <Text style={styles.statLabel}>Aprobados</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.primary[500] }]}>
                    <Text style={[styles.statValue, { color: colors.primary[500] }]}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Clases asig.</Text>
                </View>
            </View>

            <FlatList
                data={receipts}
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
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
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
});
