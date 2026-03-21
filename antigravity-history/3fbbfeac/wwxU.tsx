import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { classesService } from '@/services/classes.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { useAuth } from '@/hooks/useAuth';
import { useAlertStore } from '@/store/alertStore';
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

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Category badge */}
                {cls.category_name && (
                    <View style={[styles.categoryBadge, { backgroundColor: (cls.category_color || colors.primary[500]) + '20' }]}>
                        <View style={[styles.categoryDot, { backgroundColor: cls.category_color || colors.primary[500] }]} />
                        <Text style={[styles.categoryText, { color: cls.category_color || colors.primary[500] }]}>
                            {cls.category_name}
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
                    <View style={styles.infoCard}>
                        <Ionicons name="location" size={20} color={colors.secondary[500]} />
                        <Text style={styles.infoLabel}>Cancha</Text>
                        <Text style={styles.infoValue}>{cls.court_name}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Ionicons name="person" size={20} color={colors.accent[500]} />
                        <Text style={styles.infoLabel}>Coach</Text>
                        <Text style={styles.infoValue}>{cls.coach_name}</Text>
                    </View>
                </View>

                {/* Spots */}
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

                {/* Price */}
                {cls.price > 0 && (
                    <View style={styles.priceSection}>
                        <Text style={styles.sectionTitle}>Valor</Text>
                        <Text style={styles.priceValue}>${Number(cls.price).toLocaleString('es-CL')} CLP</Text>
                    </View>
                )}
            </ScrollView>

            {/* CTA button */}
            {cls.status === 'scheduled' && cls.available_spots > 0 && (
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
    categoryBadge: {
        flexDirection: 'row', alignItems: 'center',
        alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full, marginBottom: spacing.md, gap: spacing.xs,
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
    priceSection: { marginBottom: spacing.xl },
    priceValue: { fontSize: 24, fontWeight: '700', color: colors.primary[400] },
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
    ctaDisabled: { opacity: 0.6 },
    ctaText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
