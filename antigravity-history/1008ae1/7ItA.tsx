import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

const BANK_INFO = {
    banco: 'Banco Estado',
    tipo: 'Cuenta Corriente',
    numero: '12345678',
    rut: '12.345.678-9',
    nombre: 'Escuela de Tenis SpA',
    email: 'pagos@escuelatenis.cl',
};

export default function PaymentsScreen() {
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [allowance, setAllowance] = useState<any>(null);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!profile) return;
        const [allowanceRes, receiptsRes] = await Promise.all([
            supabase.rpc('get_student_class_allowance', { p_student_id: profile.id }),
            supabase.from('payment_receipts')
                .select('*')
                .eq('student_id', profile.id)
                .order('created_at', { ascending: false }),
        ]);
        if (allowanceRes.data && allowanceRes.data.length > 0) setAllowance(allowanceRes.data[0]);
        if (receiptsRes.data) setReceipts(receiptsRes.data);
    }, [profile]);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const pickAndUpload = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para subir el comprobante.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: false,
        });

        if (result.canceled || !result.assets?.[0]) return;

        setUploading(true);
        try {
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            const fileName = `${profile!.id}/${Date.now()}.${ext}`;

            // Upload to Supabase Storage
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);

            // Create receipt record
            const { error: insertError } = await supabase.from('payment_receipts').insert({
                student_id: profile!.id,
                image_url: publicUrl,
                status: 'pending',
            });

            if (insertError) throw insertError;

            Alert.alert('✅ Comprobante enviado', 'Tu comprobante será revisado por el administrador.');
            load();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo subir el comprobante');
        }
        setUploading(false);
    };

    const statusLabel = (s: string) => {
        if (s === 'pending') return { text: 'Pendiente', color: colors.warning };
        if (s === 'approved') return { text: 'Aprobado', color: colors.success };
        return { text: 'Rechazado', color: colors.error };
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Pagos</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            >
                {/* Allowance card */}
                {allowance && (
                    <View style={styles.allowanceCard}>
                        <Text style={styles.cardTitle}>Tu Plan Mensual</Text>
                        <View style={styles.allowanceStats}>
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, { color: colors.primary[500] }]}>{allowance.total_paid_classes}</Text>
                                <Text style={styles.statLabel}>Clases pagadas</Text>
                            </View>
                            <View style={[styles.stat, styles.statBorder]}>
                                <Text style={styles.statValue}>{allowance.used_classes}</Text>
                                <Text style={styles.statLabel}>Utilizadas</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, {
                                    color: allowance.remaining_classes > 0 ? colors.success : colors.error
                                }]}>{allowance.remaining_classes}</Text>
                                <Text style={styles.statLabel}>Disponibles</Text>
                            </View>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                                width: allowance.total_paid_classes > 0
                                    ? `${(allowance.used_classes / allowance.total_paid_classes) * 100}%`
                                    : '0%',
                            }]} />
                        </View>
                    </View>
                )}

                {/* Bank transfer info */}
                <View style={styles.bankCard}>
                    <View style={styles.bankHeader}>
                        <Ionicons name="business" size={20} color={colors.primary[400]} />
                        <Text style={styles.cardTitle}>Datos para Transferencia</Text>
                    </View>
                    <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>Banco</Text>
                        <Text style={styles.bankValue}>{BANK_INFO.banco}</Text>
                    </View>
                    <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>Tipo Cuenta</Text>
                        <Text style={styles.bankValue}>{BANK_INFO.tipo}</Text>
                    </View>
                    <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>N° Cuenta</Text>
                        <Text style={styles.bankValue}>{BANK_INFO.numero}</Text>
                    </View>
                    <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>RUT</Text>
                        <Text style={styles.bankValue}>{BANK_INFO.rut}</Text>
                    </View>
                    <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>Nombre</Text>
                        <Text style={styles.bankValue}>{BANK_INFO.nombre}</Text>
                    </View>
                    <View style={[styles.bankRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.bankLabel}>Email</Text>
                        <Text style={styles.bankValue}>{BANK_INFO.email}</Text>
                    </View>
                </View>

                {/* Upload receipt button */}
                <TouchableOpacity
                    style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
                    onPress={pickAndUpload}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <>
                            <Ionicons name="cloud-upload" size={22} color={colors.white} />
                            <Text style={styles.uploadBtnText}>Subir Comprobante de Pago</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Receipts history */}
                <Text style={styles.sectionTitle}>Historial de Comprobantes</Text>
                {receipts.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="receipt-outline" size={40} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay comprobantes enviados</Text>
                    </View>
                ) : (
                    receipts.map((r) => {
                        const st = statusLabel(r.status);
                        return (
                            <View key={r.id} style={styles.receiptCard}>
                                <Image source={{ uri: r.image_url }} style={styles.receiptThumb} />
                                <View style={styles.receiptInfo}>
                                    <Text style={styles.receiptDate}>
                                        {format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                    </Text>
                                    <View style={[styles.receiptBadge, { backgroundColor: st.color + '20' }]}>
                                        <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                                        <Text style={[styles.receiptStatus, { color: st.color }]}>{st.text}</Text>
                                    </View>
                                    {r.status === 'approved' && r.classes_granted > 0 && (
                                        <Text style={styles.classesGranted}>
                                            {r.classes_granted} clases asignadas
                                        </Text>
                                    )}
                                    {r.status === 'rejected' && r.admin_notes && (
                                        <Text style={styles.rejectedNote}>Motivo: {r.admin_notes}</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['6xl'] },

    // Allowance
    allowanceCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.xl, marginBottom: spacing.lg,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    allowanceStats: { flexDirection: 'row', marginBottom: spacing.md },
    stat: { flex: 1, alignItems: 'center' },
    statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    progressBar: {
        height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden',
    },
    progressFill: {
        height: '100%', borderRadius: 3, backgroundColor: colors.primary[500],
    },

    // Bank info
    bankCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
        marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.primary[700],
    },
    bankHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    bankRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    bankLabel: { fontSize: 13, color: colors.textSecondary },
    bankValue: { fontSize: 14, fontWeight: '600', color: colors.text },

    // Upload
    uploadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary[500], height: 52,
        borderRadius: borderRadius.lg, gap: spacing.sm, marginBottom: spacing.xl,
    },
    uploadBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

    // Section
    sectionTitle: {
        fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md,
    },

    // Receipt
    receiptCard: {
        flexDirection: 'row', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    receiptThumb: {
        width: 56, height: 56, borderRadius: borderRadius.sm,
        backgroundColor: colors.border,
    },
    receiptInfo: { flex: 1, justifyContent: 'center', gap: 4 },
    receiptDate: { fontSize: 13, color: colors.textSecondary },
    receiptBadge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        alignSelf: 'flex-start', paddingHorizontal: spacing.sm,
        paddingVertical: 2, borderRadius: borderRadius.full,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    receiptStatus: { fontSize: 12, fontWeight: '600' },
    classesGranted: { fontSize: 12, color: colors.success, fontWeight: '600' },
    rejectedNote: { fontSize: 11, color: colors.error, fontStyle: 'italic' },

    // Empty
    emptyCard: {
        alignItems: 'center', paddingVertical: spacing['3xl'],
        backgroundColor: colors.surface, borderRadius: borderRadius.md, gap: spacing.sm,
    },
    emptyText: { fontSize: 14, color: colors.textTertiary },
});
