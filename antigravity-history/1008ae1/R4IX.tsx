import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Alert, ActivityIndicator, Image, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

// Class packs offered by the academy
const CLASS_PACKS = [
    { name: '4 clases', price: 56000, classes: 4, popular: false },
    { name: '8 clases', price: 96000, classes: 8, popular: true },
    { name: '12 clases', price: 132000, classes: 12, popular: false },
    { name: '16 clases', price: 160000, classes: 16, popular: false },
];

const BANK_INFO_TEXT =
    `Banco Estado
Cuenta Corriente
12345678
12.345.678-9
Escuela de Tenis SpA
pagos@escuelatenis.cl`;

const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

export default function PaymentsScreen() {
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [allowance, setAllowance] = useState<any>(null);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

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

    const copyToClipboard = () => {
        Clipboard.setString(BANK_INFO_TEXT);
        Alert.alert('Copiado', `Datos bancarios copiados al portapapeles`);
    };

    const pickAndUpload = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para subir el comprobante.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]) return;

        setUploading(true);
        try {
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            const fileName = `${profile!.id}/${Date.now()}.${ext}`;
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('receipts').upload(fileName, arrayBuffer, { contentType: `image/${ext}` });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
            await supabase.from('payment_receipts').insert({
                student_id: profile!.id, image_url: publicUrl, status: 'pending',
            });
            Alert.alert('✅ Comprobante enviado', 'Será revisado por el administrador.');
            load();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo subir');
        }
        setUploading(false);
    };

    const statusLabel = (s: string) => {
        if (s === 'pending') return { text: 'Pendiente', color: colors.warning };
        if (s === 'approved') return { text: 'Aprobado', color: colors.success };
        return { text: 'Rechazado', color: colors.error };
    };

    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const filteredReceipts = receipts.filter(r => isSameMonth(new Date(r.created_at), currentMonth));

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Pagos</Text>
            </View>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            >
                {/* Allowance */}
                {allowance && (
                    <View style={styles.allowanceCard}>
                        <Text style={styles.cardTitle}>Tu Plan Mensual</Text>
                        <View style={styles.allowanceStats}>
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, { color: colors.primary[500] }]}>{allowance.total_paid_classes}</Text>
                                <Text style={styles.statLabel}>Pagadas</Text>
                            </View>
                            <View style={[styles.stat, styles.statBorder]}>
                                <Text style={styles.statValue}>{allowance.used_classes}</Text>
                                <Text style={styles.statLabel}>Usadas</Text>
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
                                    ? `${(allowance.used_classes / allowance.total_paid_classes) * 100}%` : '0%',
                            }]} />
                        </View>
                    </View>
                )}

                {/* Class Packs */}
                <Text style={styles.sectionTitle}>Packs de Clases</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.packsStrip}
                    contentContainerStyle={styles.packsStripContent}
                >
                    {CLASS_PACKS.map((pack) => (
                        <View key={pack.name} style={[styles.packCard, pack.popular && styles.packPopular]}>
                            {pack.popular && (
                                <View style={styles.popularBadge}>
                                    <Text style={styles.popularText}>⭐ Popular</Text>
                                </View>
                            )}
                            <Text style={styles.packClasses}>{pack.classes}</Text>
                            <Text style={styles.packLabel}>clases/mes</Text>
                            <Text style={styles.packPrice}>{formatCLP(pack.price)}</Text>
                            <Text style={styles.packUnit}>{formatCLP(Math.round(pack.price / pack.classes))}/clase</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Bank transfer data */}
                <Text style={styles.sectionTitle}>Datos para transferencia</Text>
                <TouchableOpacity style={styles.bankCard} onPress={copyToClipboard} activeOpacity={0.7}>
                    <Text style={styles.bankValue}>{BANK_INFO_TEXT}</Text>
                    <View style={styles.copyOverlay}>
                        <Ionicons name="copy" size={20} color={colors.primary[400]} />
                        <Text style={styles.copyText}>Copiar Datos</Text>
                    </View>
                </TouchableOpacity>

                {/* Upload */}
                <TouchableOpacity
                    style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
                    onPress={pickAndUpload}
                    disabled={uploading}
                >
                    {uploading ? <ActivityIndicator color={colors.white} /> : (
                        <>
                            <Ionicons name="cloud-upload" size={22} color={colors.white} />
                            <Text style={styles.uploadText}>Subir Comprobante de Pago</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* History */}
                <Text style={styles.sectionTitle}>Historial de Pagos</Text>

                {/* Month Selector for History */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
                        <Ionicons name="chevron-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </Text>
                    <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
                        <Ionicons name="chevron-forward" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {filteredReceipts.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="receipt-outline" size={36} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>Sin comprobantes este mes</Text>
                    </View>
                ) : filteredReceipts.map((r) => {
                    const st = statusLabel(r.status);
                    return (
                        <View key={r.id} style={styles.receiptCard}>
                            <Image source={{ uri: r.image_url }} style={styles.thumb} />
                            <View style={styles.receiptInfo}>
                                <Text style={styles.receiptDate}>
                                    {format(new Date(r.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                </Text>
                                <View style={[styles.badge, { backgroundColor: st.color + '20' }]}>
                                    <View style={[styles.dot, { backgroundColor: st.color }]} />
                                    <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
                                </View>
                                {r.status === 'approved' && r.classes_granted > 0 && (
                                    <Text style={styles.grantedText}>{r.classes_granted} clases asignadas</Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['6xl'] },

    allowanceCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.xl, marginBottom: spacing.xl,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    allowanceStats: { flexDirection: 'row', marginBottom: spacing.md },
    stat: { flex: 1, alignItems: 'center' },
    statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary[500] },

    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },

    // Packs
    packsStrip: { marginBottom: spacing.xl, marginHorizontal: -spacing.xl },
    packsStripContent: { paddingHorizontal: spacing.xl, paddingTop: 12 },
    packCard: {
        width: 140, backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.lg, marginRight: spacing.md, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
        position: 'relative', minHeight: 140, justifyContent: 'center',
    },
    packPopular: { borderColor: colors.primary[500], borderWidth: 2 },
    popularBadge: {
        position: 'absolute', top: -12, alignSelf: 'center',
        backgroundColor: colors.primary[900], borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm, paddingVertical: 4,
        borderWidth: 1, borderColor: colors.primary[500],
    },
    popularText: { fontSize: 10, fontWeight: '700', color: colors.primary[400] },
    packClasses: { fontSize: 32, fontWeight: '700', color: colors.text },
    packLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
    packPrice: { fontSize: 18, fontWeight: '700', color: colors.primary[400] },
    packUnit: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

    // Bank
    bankCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        padding: spacing.lg, marginBottom: spacing.xl,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    bankValue: { fontSize: 15, fontWeight: '500', color: colors.text, lineHeight: 24 },
    copyOverlay: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: spacing.sm },
    copyText: { fontSize: 10, color: colors.primary[400], fontWeight: '600' },

    // Upload
    uploadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary[500], height: 52,
        borderRadius: borderRadius.lg, gap: spacing.sm, marginBottom: spacing.xl,
    },
    uploadText: { fontSize: 16, fontWeight: '700', color: colors.white },

    // Month Selector
    monthSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        marginBottom: spacing.md,
    },
    monthArrow: { padding: 4 },
    monthText: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },

    // Receipts
    receiptCard: {
        flexDirection: 'row', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    thumb: { width: 48, height: 48, borderRadius: borderRadius.sm, backgroundColor: colors.border },
    receiptInfo: { flex: 1, justifyContent: 'center', gap: 3 },
    receiptDate: { fontSize: 13, color: colors.textSecondary },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        alignSelf: 'flex-start', paddingHorizontal: spacing.sm,
        paddingVertical: 2, borderRadius: borderRadius.full,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    grantedText: { fontSize: 11, color: colors.success, fontWeight: '600' },

    emptyCard: {
        alignItems: 'center', paddingVertical: spacing['3xl'],
        backgroundColor: colors.surface, borderRadius: borderRadius.md, gap: spacing.sm,
    },
    emptyText: { fontSize: 14, color: colors.textTertiary },
});
