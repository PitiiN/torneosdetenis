import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Alert, Image, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

export default function ProfileScreen() {
    const router = useRouter();
    const { profile, isAdmin } = useAuth();
    const signOut = async () => {
        await supabase.auth.signOut();
    };
    const insets = useSafeAreaInsets();
    const [nextClass, setNextClass] = useState<any>(null);
    const [allowance, setAllowance] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Review modal state
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewText, setReviewText] = useState('');
    const [rating, setRating] = useState(5);
    const [sendingReview, setSendingReview] = useState(false);
    const [reviews, setReviews] = useState<any[]>([]);

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!profile) return;
        setAvatarUri(profile.avatar_url || null);
        setEditName(profile.full_name || '');
        setEditPhone(profile.phone || '');

        const [nextRes, allowanceRes, reviewsRes] = await Promise.all([
            supabase.from('enrollments')
                .select(`classes (title, start_datetime, end_datetime, courts (name), profiles!classes_coach_id_fkey (full_name))`)
                .eq('student_id', profile.id).eq('status', 'confirmed')
                .gte('classes.start_datetime', new Date().toISOString())
                .order('enrolled_at', { ascending: true })
                .limit(1),
            supabase.rpc('get_student_class_allowance', { p_student_id: profile.id }),
            supabase.from('reviews').select('*').eq('student_id', profile.id)
                .order('created_at', { ascending: false }).limit(5),
        ]);

        if (nextRes.data && nextRes.data.length > 0 && nextRes.data[0].classes) {
            setNextClass(nextRes.data[0].classes);
        }
        if (allowanceRes.data && allowanceRes.data.length > 0) setAllowance(allowanceRes.data[0]);
        if (reviewsRes.data) setReviews(reviewsRes.data);
    }, [profile]);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const pickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            allowsEditing: true,
            aspect: [1, 1],
        });
        if (result.canceled || !result.assets?.[0]) return;

        setUploadingAvatar(true);
        try {
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            const fileName = `${profile!.id}/avatar.${ext}`;
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const arrayBuffer = await new Response(blob).arrayBuffer();
            const { error: uploadErr } = await supabase.storage
                .from('avatars').upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            const url = publicUrl + '?t=' + Date.now();
            await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile!.id);
            setAvatarUri(url);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo subir la foto');
        }
        setUploadingAvatar(false);
    };

    const submitReview = async () => {
        if (!reviewText.trim()) {
            Alert.alert('Error', 'Escribe tu opinión');
            return;
        }
        setSendingReview(true);
        const { error } = await supabase.from('reviews').insert({
            student_id: profile!.id,
            message: reviewText.trim(),
            rating,
        });
        setSendingReview(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('✅ Gracias', 'Tu opinión fue enviada.');
            setShowReviewModal(false);
            setReviewText('');
            setRating(5);
            load();
        }
    };

    const saveSettings = async () => {
        if (!editName.trim()) { Alert.alert('Error', 'El nombre no puede estar vacío'); return; }
        setSaving(true);
        const { error } = await supabase.from('profiles').update({
            full_name: editName.trim(),
            phone: editPhone.trim() || null,
        }).eq('id', profile!.id);
        setSaving(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('✅ Guardado', 'Tu perfil fue actualizado.');
            setShowSettings(false);
            load();
        }
    };

    const handleChangePassword = async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(profile!.email, {
            redirectTo: 'escuelatenis://reset-password',
        });
        if (error) Alert.alert('Error', error.message);
        else Alert.alert('✅ Enviado', `Se envió un link para cambiar tu contraseña a ${profile!.email}`);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            >
                {/* Avatar + name */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
                        {uploadingAvatar ? (
                            <ActivityIndicator size="large" color={colors.primary[500]} />
                        ) : avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={40} color={colors.textTertiary} />
                            </View>
                        )}
                        <View style={styles.cameraBadge}>
                            <Ionicons name="camera" size={14} color={colors.white} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.userName}>{profile?.full_name || 'Sin nombre'}</Text>
                    <Text style={styles.userEmail}>{profile?.email}</Text>
                </View>

                {/* Category & Ranking */}
                <View style={styles.rankCard}>
                    <View style={styles.rankItem}>
                        <Ionicons name="ribbon" size={20} color={colors.accent[500]} />
                        <View>
                            <Text style={styles.rankLabel}>Categoría</Text>
                            <Text style={styles.rankValue}>Por asignar</Text>
                        </View>
                    </View>
                    <View style={styles.rankDivider} />
                    <View style={styles.rankItem}>
                        <Ionicons name="trophy" size={20} color={colors.warning} />
                        <View>
                            <Text style={styles.rankLabel}>Ranking</Text>
                            <Text style={styles.rankValue}>—</Text>
                        </View>
                    </View>
                    <Text style={styles.rankHint}>Disponible en Torneos/Ranking</Text>
                </View>

                {/* Active pack */}
                {allowance && allowance.total_paid_classes > 0 && (
                    <View style={styles.packCard}>
                        <View style={styles.packRow}>
                            <Ionicons name="tennisball" size={18} color={colors.success} />
                            <Text style={styles.packTitle}>Pack activo</Text>
                        </View>
                        <Text style={styles.packDetail}>
                            {allowance.remaining_classes} de {allowance.total_paid_classes} clases disponibles
                        </Text>
                    </View>
                )}

                {/* Next class */}
                {nextClass && (
                    <View style={styles.nextCard}>
                        <View style={styles.nextRow}>
                            <Ionicons name="calendar" size={18} color={colors.primary[400]} />
                            <Text style={styles.nextTitle}>Próxima clase</Text>
                        </View>
                        <Text style={styles.nextName}>{nextClass.title}</Text>
                        <Text style={styles.nextDetail}>
                            {format(new Date(nextClass.start_datetime), "EEEE d, HH:mm", { locale: es })} · {nextClass.courts?.name}
                        </Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsCard}>
                    {isAdmin && (
                        <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(admin)/dashboard')}>
                            <View style={[styles.actionIcon, { backgroundColor: colors.primary[500] + '20' }]}>
                                <Ionicons name="shield-checkmark" size={18} color={colors.primary[500]} />
                            </View>
                            <Text style={styles.actionText}>Panel Admin</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionRow} onPress={() => setShowReviewModal(true)}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.accent[500] + '20' }]}>
                            <Ionicons name="chatbubble-ellipses" size={18} color={colors.accent[500]} />
                        </View>
                        <Text style={styles.actionText}>Dejar una opinión</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionRow} onPress={() => setShowSettings(true)}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.info + '20' }]}>
                            <Ionicons name="settings" size={18} color={colors.info} />
                        </View>
                        <Text style={styles.actionText}>Ajustes</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionRow} onPress={handleChangePassword}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                            <Ionicons name="lock-closed" size={18} color={colors.warning} />
                        </View>
                        <Text style={styles.actionText}>Cambiar contraseña</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={signOut}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.error + '20' }]}>
                            <Ionicons name="log-out" size={18} color={colors.error} />
                        </View>
                        <Text style={[styles.actionText, { color: colors.error }]}>Cerrar sesión</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                {/* Recent reviews */}
                {reviews.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Tus opiniones</Text>
                        {reviews.map((r) => (
                            <View key={r.id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <Text style={styles.reviewStars}>{'⭐'.repeat(r.rating)}</Text>
                                    <Text style={styles.reviewDate}>
                                        {format(new Date(r.created_at), 'd MMM', { locale: es })}
                                    </Text>
                                </View>
                                <Text style={styles.reviewText}>{r.message}</Text>
                                {r.admin_reply && (
                                    <View style={styles.replyBox}>
                                        <Text style={styles.replyLabel}>Respuesta:</Text>
                                        <Text style={styles.replyText}>{r.admin_reply}</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>

            {/* Review modal */}
            <Modal visible={showReviewModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Tu opinión</Text>
                            <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalLabel}>¿Cómo calificas la academia?</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                                    <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={32} color={colors.warning} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={styles.reviewInput}
                            placeholder="Escribe tu opinión..."
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            value={reviewText}
                            onChangeText={setReviewText}
                            maxLength={500}
                        />
                        <TouchableOpacity
                            style={[styles.submitBtn, sendingReview && { opacity: 0.6 }]}
                            onPress={submitReview}
                            disabled={sendingReview}
                        >
                            {sendingReview ? <ActivityIndicator color={colors.white} /> : (
                                <Text style={styles.submitText}>Enviar opinión</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Settings modal */}
            <Modal visible={showSettings} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajustes</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.inputLabel}>Nombre completo</Text>
                        <TextInput
                            style={styles.textInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholderTextColor={colors.textTertiary}
                        />
                        <Text style={styles.inputLabel}>Teléfono</Text>
                        <TextInput
                            style={styles.textInput}
                            value={editPhone}
                            onChangeText={setEditPhone}
                            keyboardType="phone-pad"
                            placeholderTextColor={colors.textTertiary}
                            placeholder="+56 9 1234 5678"
                        />
                        <Text style={styles.inputLabel}>Correo electrónico</Text>
                        <TextInput
                            style={[styles.textInput, { color: colors.textTertiary }]}
                            value={profile?.email || ''}
                            editable={false}
                        />
                        <TouchableOpacity
                            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                            onPress={saveSettings}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color={colors.white} /> : (
                                <Text style={styles.submitText}>Guardar cambios</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['6xl'] },

    avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarWrap: { position: 'relative', marginBottom: spacing.md },
    avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.border },
    avatarPlaceholder: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.border,
    },
    cameraBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.primary[500], justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.background,
    },
    userName: { fontSize: 22, fontWeight: '700', color: colors.text },
    userEmail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

    rankCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap',
        alignItems: 'center', gap: spacing.md, marginBottom: spacing.md,
    },
    rankItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    rankDivider: { width: 1, height: 32, backgroundColor: colors.border },
    rankLabel: { fontSize: 11, color: colors.textSecondary },
    rankValue: { fontSize: 15, fontWeight: '600', color: colors.text },
    rankHint: { fontSize: 11, color: colors.textTertiary, width: '100%', textAlign: 'center' },

    packCard: {
        backgroundColor: colors.success + '15', borderRadius: borderRadius.lg,
        padding: spacing.lg, marginBottom: spacing.md,
        borderWidth: 1, borderColor: colors.success + '30',
    },
    packRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    packTitle: { fontSize: 14, fontWeight: '600', color: colors.success },
    packDetail: { fontSize: 13, color: colors.textSecondary },

    nextCard: {
        backgroundColor: colors.primary[900], borderRadius: borderRadius.lg,
        padding: spacing.lg, marginBottom: spacing.md,
        borderWidth: 1, borderColor: colors.primary[700],
    },
    nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    nextTitle: { fontSize: 12, fontWeight: '600', color: colors.primary[400] },
    nextName: { fontSize: 16, fontWeight: '700', color: colors.text },
    nextDetail: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },

    actionsCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.sm, marginBottom: spacing.xl, overflow: 'hidden',
    },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md, paddingHorizontal: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    actionIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    actionText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },

    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    reviewCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.lg, marginBottom: spacing.sm,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    reviewStars: { fontSize: 14 },
    reviewDate: { fontSize: 11, color: colors.textTertiary },
    reviewText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    replyBox: {
        marginTop: spacing.md, paddingTop: spacing.md,
        borderTopWidth: 1, borderTopColor: colors.border,
    },
    replyLabel: { fontSize: 11, color: colors.primary[400], fontWeight: '600', marginBottom: 2 },
    replyText: { fontSize: 13, color: colors.textSecondary },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: spacing['2xl'], paddingBottom: spacing['4xl'],
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.xl,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    modalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
    starsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl, justifyContent: 'center' },
    reviewInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        padding: spacing.lg, fontSize: 15, color: colors.text,
        minHeight: 100, textAlignVertical: 'top', marginBottom: spacing.xl,
    },
    submitBtn: {
        backgroundColor: colors.primary[500], height: 52,
        borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center',
    },
    submitText: { fontSize: 16, fontWeight: '700', color: colors.white },

    inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
    textInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        fontSize: 15, color: colors.text,
    },
});
