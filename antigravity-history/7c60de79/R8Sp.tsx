import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { enrollmentsService } from '@/services/enrollments.service';
import { useAlertStore } from '@/store/alert.store';
import { colors, spacing, borderRadius } from '@/theme';

export default function MyClassesScreen() {
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'futuras' | 'pasadas'>('futuras');

    const load = useCallback(async () => {
        if (!profile) return;
        const { data } = await supabase.from('enrollments')
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
            .order('enrolled_at', { ascending: false });

        if (data) {
            const valid = data.filter((e: any) => e.classes !== null);
            valid.sort((a: any, b: any) =>
                new Date(a.classes.start_datetime).getTime() - new Date(b.classes.start_datetime).getTime()
            );
            setEnrollments(valid);
        }
    }, [profile]);

    useFocusEffect(
        useCallback(() => {
            if (profile) load();
        }, [profile, load])
    );

    useEffect(() => {
        if (!profile) return;

        // Initial load is handled by useFocusEffect, but we also want realtime
        const channel = supabase
            .channel(`my-enrollments-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'enrollments',
                    filter: `student_id=eq.${profile.id}`,
                },
                () => {
                    load();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile, load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleCancel = (enrollment: any) => {
        const cls = enrollment.classes;
        const hoursUntil = differenceInHours(new Date(cls.start_datetime), new Date());
        if (hoursUntil < 8) {
            useAlertStore.getState().showAlert('No se puede cancelar', 'Solo puedes cancelar hasta 8 horas antes del inicio.');
            return;
        }
        useAlertStore.getState().showAlert('Cancelar inscripción', '¿Confirmas cancelar?', [
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

    // Correctly find the next closest confirmed class
    const upcoming = enrollments
        .filter((e) => new Date(e.classes.start_datetime) > now && e.classes.status !== 'cancelled')
        .sort((a, b) => new Date(a.classes.start_datetime).getTime() - new Date(b.classes.start_datetime).getTime());

    const past = enrollments.filter((e) => new Date(e.classes.start_datetime) <= now);
    const nextClass = upcoming.length > 0 ? upcoming[0] : null;

    const renderHeader = () => (
        <View>
            {/* Next class hero */}
            {nextClass ? (
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
                            <Text style={styles.heroText}>{nextClass.classes.profiles?.full_name || 'Sin profesor'}</Text>
                        </View>
                    </View>
                    <View style={styles.heroActions}>
                        {differenceInHours(new Date(nextClass.classes.start_datetime), now) >= 8 && (
                            <TouchableOpacity onPress={() => handleCancel(nextClass)}>
                                <Text style={styles.heroCancelText}>Cancelar Inscripción</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : (
                <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.heroBadge}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.heroBadgeText, { color: colors.textTertiary }]}>Horario</Text>
                    </View>
                    <Text style={styles.heroTitle}>No hay clases registradas</Text>
                    <Text style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
                        Inscríbete en una clase desde el inicio para verla aquí.
                    </Text>
                </View>
            )}

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
                <TouchableOpacity
                    style={[styles.filterTab, activeTab === 'futuras' && styles.filterTabActive]}
                    onPress={() => setActiveTab('futuras')}
                >
                    <Text style={[styles.filterText, activeTab === 'futuras' && styles.filterTextActive]}>
                        Futuras
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, activeTab === 'pasadas' && styles.filterTabActive]}
                    onPress={() => setActiveTab('pasadas')}
                >
                    <Text style={[styles.filterText, activeTab === 'pasadas' && styles.filterTextActive]}>
                        Pasadas
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // If viewing future classes, show all upcoming (including the one in the hero card)
    const listData = activeTab === 'futuras' ? upcoming : past;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}><Text style={styles.title}>Mis Clases</Text></View>
            <FlatList
                data={listData}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => {
                    const cls = item.classes;
                    const isPast = activeTab === 'pasadas';
                    const canCancel = !isPast && differenceInHours(new Date(cls.start_datetime), now) >= 8;
                    return (
                        <View style={[styles.classCard, isPast && styles.cardPast]}>
                            <View style={[styles.catDot, { backgroundColor: cls.class_categories?.color || colors.primary[500] }]} />
                            <View style={styles.classInfo}>
                                <Text style={[styles.className, isPast && styles.textPast]}>{cls.title}</Text>
                                <Text style={styles.classDetail}>
                                    {format(new Date(cls.start_datetime), "EEE d, HH:mm", { locale: es })} · {cls.courts?.name}
                                </Text>
                            </View>
                            {canCancel && (
                                <TouchableOpacity onPress={() => handleCancel(item)} style={styles.iconBtn}>
                                    <Ionicons name="close-circle" size={20} color={colors.error} />
                                </TouchableOpacity>
                            )}
                            keyExtractor={(item) => item.id}
                            ListHeaderComponent={renderHeader}
                            contentContainerStyle={styles.listContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                            renderItem={({ item }) => {
                                const cls = item.classes;
                                const isPast = activeTab === 'pasadas';
                                const canCancel = !isPast && differenceInHours(new Date(cls.start_datetime), now) >= 8;
                                return (
                                    <View style={[styles.classCard, isPast && styles.cardPast]}>
                                        <View style={[styles.catDot, { backgroundColor: cls.class_categories?.color || colors.primary[500] }]} />
                                        <View style={styles.classInfo}>
                                            <Text style={[styles.className, isPast && styles.textPast]}>{cls.title}</Text>
                                            <Text style={styles.classDetail}>
                                                {format(new Date(cls.start_datetime), "EEE d, HH:mm", { locale: es })} · {cls.courts?.name}
                                            </Text>
                                        </View>
                                        {canCancel && (
                                            <TouchableOpacity onPress={() => handleCancel(item)} style={styles.iconBtn}>
                                                <Ionicons name="close-circle" size={20} color={colors.error} />
                                            </TouchableOpacity>
                                        )}
                                        {isPast && <Ionicons name="checkmark-circle" size={20} color={colors.textTertiary} />}
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Ionicons name="tennisball-outline" size={48} color={colors.textTertiary} />
                                    <Text style={styles.emptyText}>
                                        {activeTab === 'futuras' ? 'No tienes más clases programadas' : 'No tienes clases pasadas'}
                                    </Text>
                                </View>
                            }
                />
                        </View>
                    );
                }

const styles= StyleSheet.create({
                container: {flex: 1, backgroundColor: colors.background },
            header: {paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
            title: {fontSize: 24, fontWeight: '700', color: colors.text },
            listContent: {paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

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
            heroBadgeText: {fontSize: 12, fontWeight: '600', color: colors.primary[400] },
            heroTitle: {fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
            heroDetails: {gap: spacing.sm },
            heroRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
            heroText: {fontSize: 14, color: colors.textSecondary, textTransform: 'capitalize' },
            heroActions: {
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            marginTop: spacing.lg, paddingTop: spacing.md,
            borderTopWidth: 1, borderTopColor: colors.primary[700],
        },
            calendarBtn: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
            calendarBtnText: {fontSize: 13, fontWeight: '600', color: colors.primary[400] },
            heroCancelText: {fontSize: 13, fontWeight: '600', color: colors.error },

            // Filter Tabs
            filterTabs: {
                flexDirection: 'row', backgroundColor: colors.surface,
            borderRadius: borderRadius.lg, padding: 4, marginBottom: spacing.md,
        },
            filterTab: {
                flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
            borderRadius: borderRadius.md,
        },
            filterTabActive: {backgroundColor: colors.background },
            filterText: {fontSize: 14, fontWeight: '600', color: colors.textTertiary },
            filterTextActive: {color: colors.text },

            classCard: {
                flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.surface, borderRadius: borderRadius.md,
            padding: spacing.lg, marginBottom: spacing.sm, gap: spacing.md,
        },
            cardPast: {opacity: 0.6 },
            catDot: {width: 8, height: 8, borderRadius: 4 },
            classInfo: {flex: 1 },
            className: {fontSize: 15, fontWeight: '600', color: colors.text },
            classDetail: {fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
            textPast: {color: colors.textSecondary },
            iconBtn: {padding: 4 },

            emptyState: {alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
            emptyText: {fontSize: 15, color: colors.textTertiary },
    });
