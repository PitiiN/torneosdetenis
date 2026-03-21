import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, startOfDay, endOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [stats, setStats] = useState({ classes: 0, students: 0, enrolled: 0, revenue: 0 });
    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const now = new Date();
        const [classesRes, studentsRes, enrollRes, revenueRes, todayRes] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
            supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
            supabase.from('payments').select('final_amount').eq('status', 'paid'),
            supabase.from('classes')
                .select('*, courts (name), class_categories (name, color), profiles!classes_coach_id_fkey (full_name)')
                .gte('start_datetime', format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"))
                .lte('start_datetime', format(endOfDay(addDays(now, 1)), "yyyy-MM-dd'T'HH:mm:ss"))
                .eq('status', 'scheduled')
                .order('start_datetime')
                .limit(8),
        ]);

        setStats({
            classes: classesRes.count || 0,
            students: studentsRes.count || 0,
            enrolled: enrollRes.count || 0,
            revenue: revenueRes.data?.reduce((s: number, p: any) => s + parseFloat(p.final_amount || 0), 0) || 0,
        });
        if (todayRes.data) setTodayClasses(todayRes.data);
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const STAT_CARDS = [
        { icon: 'calendar', label: 'Clases', value: stats.classes, color: colors.primary[500] },
        { icon: 'people', label: 'Alumnos', value: stats.students, color: colors.secondary[500] },
        { icon: 'checkmark-circle', label: 'Inscritos', value: stats.enrolled, color: colors.info },
        { icon: 'card', label: 'Ingresos', value: `$${(stats.revenue / 1000).toFixed(0)}k`, color: colors.accent[500] },
    ];

    const QUICK_ACTIONS = [
        { icon: 'add-circle', label: 'Crear', color: colors.primary[500], route: '/(admin)/classes/create' },
        { icon: 'calendar', label: 'Agenda', color: colors.secondary[500], route: '/(admin)/schedule' },
        { icon: 'list', label: 'Lista', color: colors.info, route: '/(admin)/classes' },
        { icon: 'card', label: 'Finanzas', color: colors.accent[500], route: '/(admin)/payments' },
        { icon: 'chatbubbles', label: 'Opiniones', color: colors.warning, route: '/(admin)/reviews' },
    ];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Panel Admin</Text>
                        <Text style={styles.subtitle}>Gestión de la escuela</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
                        <Ionicons name="home" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Stats grid */}
                <View style={styles.statsGrid}>
                    {STAT_CARDS.map((stat) => (
                        <View key={stat.label} style={styles.statCard}>
                            <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                            <Text style={styles.statValue}>{stat.value}</Text>
                            <Text style={styles.statLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Today's classes */}
                <Text style={styles.sectionTitle}>Próximas clases</Text>
                {todayClasses.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No hay clases programadas</Text>
                    </View>
                ) : (
                    todayClasses.map((cls) => (
                        <TouchableOpacity
                            key={cls.id}
                            style={styles.classCard}
                            onPress={() => router.push(`/(admin)/classes/${cls.id}`)}
                        >
                            <View style={[styles.classColorBar, { backgroundColor: cls.class_categories?.color || colors.primary[500] }]} />
                            <View style={styles.classInfo}>
                                <Text style={styles.className}>{cls.title}</Text>
                                <Text style={styles.classDetail}>
                                    {format(new Date(cls.start_datetime), 'HH:mm')} · {cls.courts?.name} · {cls.profiles?.full_name || 'Sin coach'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Bottom quick actions */}
            <View style={[styles.quickActions, { paddingBottom: insets.bottom + spacing.sm }]}>
                {QUICK_ACTIONS.map((action) => (
                    <TouchableOpacity
                        key={action.label}
                        style={styles.quickAction}
                        onPress={() => router.push(action.route as any)}
                    >
                        <View style={[styles.quickIconCircle, { backgroundColor: action.color + '20' }]}>
                            <Ionicons name={action.icon as any} size={22} color={action.color} />
                        </View>
                        <Text style={styles.quickLabel}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 120 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    },
    greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
        paddingHorizontal: spacing.xl, marginBottom: spacing.xl,
    },
    statCard: {
        width: '47%', backgroundColor: colors.surface,
        borderRadius: borderRadius.lg, padding: spacing.lg,
        alignItems: 'flex-start', gap: spacing.xs,
    },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },

    sectionTitle: {
        fontSize: 16, fontWeight: '600', color: colors.text,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    classCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        marginBottom: spacing.sm, borderRadius: borderRadius.md,
        padding: spacing.md, gap: spacing.md,
    },
    classColorBar: { width: 4, height: 36, borderRadius: 2 },
    classInfo: { flex: 1 },
    className: { fontSize: 14, fontWeight: '600', color: colors.text },
    classDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    emptyCard: {
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        borderRadius: borderRadius.md, padding: spacing.xl, alignItems: 'center',
    },
    emptyText: { fontSize: 14, color: colors.textTertiary },

    // Bottom quick actions
    quickActions: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-around',
        backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
        paddingTop: spacing.md,
    },
    quickAction: { alignItems: 'center', gap: spacing.xs },
    quickIconCircle: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center',
    },
    quickLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
});
