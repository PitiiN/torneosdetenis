import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, startOfMonth, endOfMonth, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { enrollmentsService } from '@/services/enrollments.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function MyClassesScreen() {
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [allowance, setAllowance] = useState<any>(null);

    const load = useCallback(async () => {
        if (!profile) return;
        const now = new Date();
        const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

        const [enrollRes, allowanceRes] = await Promise.all([
            supabase.from('enrollments')
                .select(`
          *,
          classes (
            id, title, start_datetime, end_datetime, status,
            courts (name),
            profiles!classes_coach_id_fkey (full_name),
            class_categories (name, color)
          )
        `)
                .eq('student_id', profile.id)
                .eq('status', 'confirmed')
                .gte('classes.start_datetime', monthStart + 'T00:00:00')
                .lte('classes.start_datetime', monthEnd + 'T23:59:59')
                .order('enrolled_at', { ascending: false }),
            supabase.rpc('get_student_class_allowance', { p_student_id: profile.id }),
        ]);

        if (enrollRes.data) {
            // Filter out enrollments where classes is null (outside month range)
            const valid = enrollRes.data.filter((e: any) => e.classes !== null);
            // Sort by class start date
            valid.sort((a: any, b: any) =>
                new Date(a.classes.start_datetime).getTime() - new Date(b.classes.start_datetime).getTime()
            );
            setEnrollments(valid);
        }
        if (allowanceRes.data && allowanceRes.data.length > 0) setAllowance(allowanceRes.data[0]);
    }, [profile]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleCancel = (enrollment: any) => {
        const cls = enrollment.classes;
        const hoursUntil = differenceInHours(new Date(cls.start_datetime), new Date());

        if (hoursUntil < 8) {
            Alert.alert('No se puede cancelar', 'Solo puedes cancelar hasta 8 horas antes del inicio de la clase.');
            return;
        }

        Alert.alert('Cancelar inscripción', '¿Confirmas cancelar tu inscripción?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, cancelar', style: 'destructive',
                onPress: async () => {
                    await enrollmentsService.cancelEnrollment(enrollment.id);
                    load();
                }
            },
        ]);
    };

    const now = new Date();
    const upcomingEnrollments = enrollments.filter(
        (e) => new Date(e.classes.start_datetime) > now
    );
    const nextClass = upcomingEnrollments.length > 0 ? upcomingEnrollments[0] : null;
    const restClasses = upcomingEnrollments.slice(1);
    const pastClasses = enrollments.filter(
        (e) => new Date(e.classes.start_datetime) <= now
    );

    const renderHeader = () => (
        <View>
            {/* Allowance summary */}
            {allowance && (
                <View style={styles.allowanceCard}>
                    <View style={styles.allowanceHeader}>
                        <Ionicons name="tennisball" size={18} color={colors.primary[400]} />
                        <Text style={styles.allowanceTitle}>Tu Plan</Text>
                    </View>
                    <View style={styles.allowanceStats}>
                        <View style={styles.allowanceStat}>
                            <Text style={styles.statValue}>{allowance.total_paid_classes}</Text>
                            <Text style={styles.statLabel}>Pagadas</Text>
                        </View>
                        <View style={[styles.allowanceStat, styles.statDivider]}>
                            <Text style={styles.statValue}>{allowance.used_classes}</Text>
                            <Text style={styles.statLabel}>Usadas</Text>
                        </View>
                        <View style={styles.allowanceStat}>
                            <Text style={[styles.statValue, {
                                color: allowance.remaining_classes > 0 ? colors.success : colors.error
                            }]}>
                                {allowance.remaining_classes}
                            </Text>
                            <Text style={styles.statLabel}>Disponibles</Text>
                        </View>
                    </View>
                    {/* Progress bar */}
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, {
                            width: allowance.total_paid_classes > 0
                                ? `${(allowance.used_classes / allowance.total_paid_classes) * 100}%`
                                : '0%',
                            backgroundColor: allowance.remaining_classes > 0 ? colors.primary[500] : colors.error,
                        }]} />
                    </View>
                </View>
            )}

            {/* Next class hero */}
            {nextClass && (
                <View style={styles.heroCard}>
                    <View style={styles.heroBadge}>
                        <Ionicons name="time" size={14} color={colors.primary[400]} />
                        <Text style={styles.heroBadgeText}>Próxima clase</Text>
                    </View>
                    <Text style={styles.heroTitle}>{nextClass.classes.title}</Text>
                    <View style={styles.heroDetails}>
                        <View style={styles.heroRow}>
                            <Ionicons name="calendar" size={16} color={colors.textSecondary} />
                            <Text style={styles.heroText}>
                                {format(new Date(nextClass.classes.start_datetime), "EEEE d 'de' MMMM", { locale: es })}
                            </Text>
                        </View>
                        <View style={styles.heroRow}>
                            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.heroText}>
                                {format(new Date(nextClass.classes.start_datetime), 'HH:mm')} - {format(new Date(nextClass.classes.end_datetime), 'HH:mm')}
                            </Text>
                        </View>
                        <View style={styles.heroRow}>
                            <Ionicons name="location" size={16} color={colors.textSecondary} />
                            <Text style={styles.heroText}>{nextClass.classes.courts?.name}</Text>
                        </View>
                        <View style={styles.heroRow}>
                            <Ionicons name="person" size={16} color={colors.textSecondary} />
                            <Text style={styles.heroText}>{nextClass.classes.profiles?.full_name}</Text>
                        </View>
                    </View>
                    {differenceInHours(new Date(nextClass.classes.start_datetime), now) >= 8 && (
                        <TouchableOpacity style={styles.heroCancelBtn} onPress={() => handleCancel(nextClass)}>
                            <Text style={styles.heroCancelText}>Cancelar inscripción</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Month label */}
            <Text style={styles.monthLabel}>
                Clases de {format(now, 'MMMM', { locale: es })}
            </Text>
        </View>
    );

    const allClasses = [...restClasses, ...pastClasses];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Mis Clases</Text>
            </View>

            <FlatList
                data={allClasses}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => {
                    const cls = item.classes;
                    const isPast = new Date(cls.start_datetime) <= now;
                    const canCancel = !isPast && differenceInHours(new Date(cls.start_datetime), now) >= 8;

                    return (
                        <View style={[styles.classCard, isPast && styles.classCardPast]}>
                            <View style={[styles.categoryDot, {
                                backgroundColor: cls.class_categories?.color || colors.primary[500]
                            }]} />
                            <View style={styles.classInfo}>
                                <Text style={[styles.className, isPast && styles.textPast]}>{cls.title}</Text>
                                <Text style={styles.classDetail}>
                                    {format(new Date(cls.start_datetime), "EEE d, HH:mm", { locale: es })} · {cls.courts?.name}
                                </Text>
                            </View>
                            {canCancel && (
                                <TouchableOpacity onPress={() => handleCancel(item)} style={styles.cancelSmall}>
                                    <Ionicons name="close-circle" size={22} color={colors.error} />
                                </TouchableOpacity>
                            )}
                            {isPast && (
                                <Ionicons name="checkmark-circle" size={22} color={colors.textTertiary} />
                            )}
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="tennisball-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No tienes clases este mes</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

    // Allowance
    allowanceCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.lg, marginBottom: spacing.lg,
    },
    allowanceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    allowanceTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    allowanceStats: { flexDirection: 'row', marginBottom: spacing.md },
    allowanceStat: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    progressBar: {
        height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3 },

    // Hero next class
    heroCard: {
        backgroundColor: colors.primary[900], borderRadius: borderRadius.xl,
        padding: spacing.xl, marginBottom: spacing.lg,
        borderWidth: 1, borderColor: colors.primary[700],
    },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        alignSelf: 'flex-start', backgroundColor: colors.primary[500] + '25',
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full, marginBottom: spacing.md,
    },
    heroBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary[400] },
    heroTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    heroDetails: { gap: spacing.sm },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    heroText: { fontSize: 14, color: colors.textSecondary, textTransform: 'capitalize' },
    heroCancelBtn: {
        marginTop: spacing.lg, paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.primary[700], alignItems: 'center',
    },
    heroCancelText: { fontSize: 14, fontWeight: '600', color: colors.error },

    // Month label
    monthLabel: {
        fontSize: 16, fontWeight: '600', color: colors.text,
        textTransform: 'capitalize', marginBottom: spacing.md,
    },

    // Class card
    classCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.lg, marginBottom: spacing.sm, gap: spacing.md,
    },
    classCardPast: { opacity: 0.6 },
    categoryDot: { width: 8, height: 8, borderRadius: 4 },
    classInfo: { flex: 1 },
    className: { fontSize: 15, fontWeight: '600', color: colors.text },
    classDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
    textPast: { color: colors.textSecondary },
    cancelSmall: { padding: 4 },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },
});
