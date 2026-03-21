import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { classesService } from '@/services/classes.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { useAuth } from '@/hooks/useAuth';
import { useAlertStore } from '@/store/alert.store';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

export default function ClassDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { profile } = useAuth();
    const [cls, setCls] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);

    const loadClass = async () => {
        if (!id) return;
        const { data } = await classesService.getClassById(id);
        if (data) setCls(data);
        setLoading(false);
    };

    useEffect(() => { loadClass(); }, [id]);

    // Check if student category is allowed in this class
    const canEnroll = () => {
        if (!profile || !cls) return false;
        const userCat = profile.student_category;
        // If no category assigned to user, allow enrollment (admin can fix later)
        if (!userCat) return true;
        // Intermedio and Avanzado can enroll in ANY class
        if (userCat === 'Intermedio' || userCat === 'Avanzado') return true;
        // Inicial can only enroll if at least one court category is 'Inicial'
        const cat1 = cls.category_name;
        const cat2 = cls.court2_category_name;
        if (cat1 === 'Inicial' || cat2 === 'Inicial') return true;
        return false;
    };

    const handleEnroll = async () => {
        if (!profile || !id) return;
        useAlertStore.getState().showAlert(
            'Inscribirse',
            `¿Confirmas tu inscripción en "${cls.title}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setEnrolling(true);
                        try {
                            await enrollmentsService.enroll(id, profile.id);
                            useAlertStore.getState().showAlert('¡Inscrito!', 'Te has inscrito exitosamente en la clase.');
                            loadClass();
                        } catch (err: any) {
                            useAlertStore.getState().showAlert('Error', err.message || 'No se pudo completar la inscripción');
                        }
                        setEnrolling(false);
                    },
                },
            ]
        );
    };

    const handleSolicitud = async () => {
        if (!profile || !id || !cls) return;
        useAlertStore.getState().showAlert(
            'Solicitar Inscripción',
            'Esta clase fue cancelada automáticamente por no tener alumnos suficientes. ¿Deseas enviar una solicitud al admin para que te inscriba manualmente?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Enviar Solicitud',
                    onPress: async () => {
                        setEnrolling(true);
                        try {
                            const dateStr = format(new Date(cls.start_datetime), "EEEE d 'de' MMMM HH:mm", { locale: es });
                            const { error } = await supabase.from('student_requests').insert({
                                student_id: profile.id,
                                category: 'Petición',
                                message: `Solicito inscripción en la clase "${cls.title}" del ${dateStr}. (Nota: esta clase fue cancelada por mínimo de alumnos.)`,
                                status: 'pending',
                            });
                            if (error) throw error;
                            useAlertStore.getState().showAlert('✅ Enviada', 'Tu solicitud fue enviada al administrador. Te notificaremos cuando sea procesada.');
                        } catch (err: any) {
                            useAlertStore.getState().showAlert('Error', err.message);
                        }
                        setEnrolling(false);
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    if (!cls) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>Clase no encontrada</Text>
            </View>
        );
    }

    const spotsColor = cls.available_spots > 2 ? colors.success : cls.available_spots > 0 ? colors.warning : colors.error;
    const isAutoCancelled = cls.auto_cancelled === true;
    const allowed = canEnroll();

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Category badges */}
                <View style={styles.catBadgesRow}>
                    {cls.category_name && (
                        <View style={[styles.categoryBadge, { backgroundColor: (cls.category_color || colors.primary[500]) + '20' }]}>
                            <View style={[styles.categoryDot, { backgroundColor: cls.category_color || colors.primary[500] }]} />
                            <Text style={[styles.categoryText, { color: cls.category_color || colors.primary[500] }]}>
                                Cancha 1: {cls.category_name}
                            </Text>
                        </View>
                    )}
                    {cls.court2_category_name && (
                        <View style={[styles.categoryBadge, { backgroundColor: (cls.court2_category_color || colors.primary[500]) + '20' }]}>
                            <View style={[styles.categoryDot, { backgroundColor: cls.court2_category_color || colors.primary[500] }]} />
                            <Text style={[styles.categoryText, { color: cls.court2_category_color || colors.primary[500] }]}>
                                Cancha 2: {cls.court2_category_name}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Auto-cancel warning */}
                {isAutoCancelled && (
                    <View style={styles.autoCancelBanner}>
                        <Ionicons name="alert-circle" size={18} color={colors.warning} />
                        <Text style={styles.autoCancelText}>
                            Esta clase fue cancelada por mínimo de alumnos. Puedes solicitar inscripción manual.
                        </Text>
                    </View>
                )}

                <Text style={styles.title}>{cls.title}</Text>
                {cls.description && <Text style={styles.description}>{cls.description}</Text>}

                {/* Info cards */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoCard}>
                        <Ionicons name="calendar" size={20} color={colors.primary[400]} />
                        <Text style={styles.infoLabel}>Fecha</Text>
                        <Text style={styles.infoValue}>
                            {format(new Date(cls.start_datetime), "EEEE d MMM", { locale: es })}
                        </Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Ionicons name="time" size={20} color={colors.primary[400]} />
                        <Text style={styles.infoLabel}>Horario</Text>
                        <Text style={styles.infoValue}>
                            {format(new Date(cls.start_datetime), 'HH:mm')} - {format(new Date(cls.end_datetime), 'HH:mm')}
                        </Text>
                    </View>
                </View>

                {/* Spots */}
                {!isAutoCancelled && (
                    <View style={styles.spotsSection}>
                        <Text style={styles.sectionTitle}>Disponibilidad</Text>
                        <View style={styles.spotsBar}>
                            <View style={[styles.spotsFill, { width: `${((cls.enrolled_count || 0) / cls.max_students) * 100}%`, backgroundColor: spotsColor }]} />
                        </View>
                        <View style={styles.spotsInfo}>
                            <Text style={[styles.spotsCount, { color: spotsColor }]}>
                                {cls.available_spots} cupos disponibles
                            </Text>
                            <Text style={styles.spotsTotal}>{cls.enrolled_count || 0}/{cls.max_students} inscritos</Text>
                        </View>
                    </View>
                )}

                {/* Category restriction message */}
                {!allowed && !isAutoCancelled && (
                    <View style={styles.restrictionBanner}>
                        <Ionicons name="lock-closed" size={18} color={colors.error} />
                        <Text style={styles.restrictionText}>
                            Tu categoría ({profile?.student_category}) no permite inscripción en esta clase. Pregunta al administrador si deseas participar.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* CTA button */}
            {cls.status === 'scheduled' && !isAutoCancelled && allowed && cls.available_spots > 0 && (
                <View style={styles.ctaContainer}>
                    <TouchableOpacity
                        style={[styles.ctaButton, enrolling && styles.ctaDisabled]}
                        onPress={handleEnroll}
                        disabled={enrolling}
                    >
                        {enrolling ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <>
                                <Ionicons name="tennisball" size={20} color={colors.white} />
                                <Text style={styles.ctaText}>Inscribirme</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Solicitud button for auto-cancelled classes */}
            {isAutoCancelled && (
                <View style={styles.ctaContainer}>
                    <TouchableOpacity
                        style={[styles.ctaButtonSolicitud, enrolling && styles.ctaDisabled]}
                        onPress={handleSolicitud}
                        disabled={enrolling}
                    >
                        {enrolling ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <>
                                <Ionicons name="mail" size={20} color={colors.white} />
                                <Text style={styles.ctaText}>Solicitar Inscripción</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    errorText: { fontSize: 16, color: colors.textSecondary },
    scrollContent: { padding: spacing.xl, paddingTop: 50, paddingBottom: 120 },
    header: { marginBottom: spacing.xl },
    backBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    },
    catBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    categoryBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full, gap: spacing.xs,
    },
    categoryDot: { width: 8, height: 8, borderRadius: 4 },
    categoryText: { fontSize: 13, fontWeight: '600' },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    description: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
    infoGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl,
    },
    infoCard: {
        flex: 1, minWidth: '45%', backgroundColor: colors.surface,
        borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.xs,
    },
    infoLabel: { fontSize: 11, color: colors.textTertiary },
    infoValue: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
    spotsSection: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    spotsBar: {
        height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.sm,
    },
    spotsFill: { height: '100%', borderRadius: 4 },
    spotsInfo: { flexDirection: 'row', justifyContent: 'space-between' },
    spotsCount: { fontSize: 14, fontWeight: '600' },
    spotsTotal: { fontSize: 13, color: colors.textSecondary },
    ctaContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: spacing.xl, paddingBottom: spacing['3xl'],
        backgroundColor: colors.background + 'F0',
    },
    ctaButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary[500], height: 56,
        borderRadius: borderRadius.lg, gap: spacing.sm,
    },
    ctaButtonSolicitud: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.warning, height: 56,
        borderRadius: borderRadius.lg, gap: spacing.sm,
    },
    ctaDisabled: { opacity: 0.6 },
    ctaText: { fontSize: 16, fontWeight: '700', color: colors.white },
    autoCancelBanner: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.warning + '15', borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.md,
        borderWidth: 1, borderColor: colors.warning + '30',
    },
    autoCancelText: { flex: 1, fontSize: 13, color: colors.warning, fontWeight: '500' },
    restrictionBanner: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.error + '15', borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.md,
        borderWidth: 1, borderColor: colors.error + '30',
    },
    restrictionText: { flex: 1, fontSize: 13, color: colors.error, fontWeight: '500' },
});
