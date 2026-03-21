import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomBar from '@/components/AdminBottomBar';
import {
    format, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameDay, isToday, addMonths, subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

// Time block definitions
const TIME_BLOCKS = [
    { label: 'Mañana', start: 8, end: 13 },
    { label: 'Tarde', start: 13, end: 19 },
    { label: 'Noche', start: 19, end: 23 },
];

export default function AdminDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [stats, setStats] = useState({ classes: 0, students: 0, activeStudents: 0, revenue: 0 });
    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const now = new Date();
        const monthStart = format(startOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss");
        const monthEnd = format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss");

        const [classesRes, studentsRes, revenueRes, todayRes, receiptsRes, enrollRes] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
            supabase.from('payments')
                .select('final_amount')
                .eq('status', 'paid')
                .gte('created_at', monthStart)
                .lte('created_at', monthEnd),
            supabase.from('classes')
                .select('*, courts (name), class_categories (name, color), profiles!classes_coach_id_fkey (full_name)')
                .gte('start_datetime', format(startOfDay(now), "yyyy-MM-dd'T'HH:mm:ss"))
                .lte('start_datetime', format(endOfDay(addDays(now, 1)), "yyyy-MM-dd'T'HH:mm:ss"))
                .eq('status', 'scheduled')
                .order('start_datetime')
                .limit(8),
            supabase.from('payment_receipts').select('student_id, classes_granted').eq('status', 'approved'),
            supabase.from('enrollments').select('student_id').eq('status', 'confirmed'),
        ]);

        const studentMap: Record<string, number> = {};
        receiptsRes.data?.forEach(r => studentMap[r.student_id] = (studentMap[r.student_id] || 0) + (r.classes_granted || 0));
        enrollRes.data?.forEach(e => studentMap[e.student_id] = (studentMap[e.student_id] || 0) - 1);
        const activeStudentsCount = Object.values(studentMap).filter(v => v > 0).length;

        setStats({
            classes: classesRes.count || 0,
            students: studentsRes.count || 0,
            activeStudents: activeStudentsCount,
            revenue: revenueRes.data?.reduce((s: number, p: any) => s + parseFloat(p.final_amount || 0), 0) || 0,
        });
        if (todayRes.data) setTodayClasses(todayRes.data);
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const STAT_CARDS = [
        { icon: 'calendar', label: 'Clases activas', value: stats.classes, color: colors.primary[500] },
        { icon: 'people', label: 'Alumnos activos', value: stats.activeStudents, color: colors.secondary[500] },
        { icon: 'card', label: 'Ingresos mes', value: `$${(stats.revenue / 1000).toFixed(0)}k`, color: colors.accent[500] },
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

            <AdminBottomBar />
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

    // Daily View
    dailyViewHeader: {
        marginBottom: spacing.md,
    },
    monthSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: spacing.sm, gap: spacing.lg,
    },
    monthText: {
        fontSize: 16, fontWeight: '700', color: colors.text,
        textTransform: 'capitalize', minWidth: 140, textAlign: 'center',
    },
    monthArrow: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    },
    dayStrip: { maxHeight: 76, marginBottom: spacing.sm },
    dayStripContent: { paddingHorizontal: spacing.xl, gap: 6 },
    dayItem: {
        width: 44, height: 60, alignItems: 'center', justifyContent: 'center',
        borderRadius: borderRadius.lg, backgroundColor: colors.surface,
    },
    dayItemSelected: { backgroundColor: colors.primary[500] },
    dayName: { fontSize: 9, fontWeight: '600', color: colors.textTertiary },
    dayNum: { fontSize: 16, fontWeight: '700', color: colors.text },
    dayTextSelected: { color: colors.white },
    todayDot: {
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: colors.primary[500], marginTop: 2,
    },
    todayDotSelected: { backgroundColor: colors.white },

    blockSection: { marginBottom: spacing.md, paddingHorizontal: spacing.xl },
    blockHeader: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    blockLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    hoursGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    },
    hourBlock: {
        width: '31.5%', paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
        minHeight: 64,
    },
    hourBlockEmpty: { backgroundColor: colors.surface, opacity: 0.4 },
    hourBlockAvailable: { backgroundColor: colors.secondary[800], borderWidth: 1, borderColor: colors.secondary[600] },
    hourBlockFull: { backgroundColor: '#3B1010', borderWidth: 1, borderColor: colors.error },
    hourBlockCancelled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: 0.6 },
    hourText: { fontSize: 13, fontWeight: '600', color: colors.textTertiary },
    hourTextActive: { color: colors.white },
    hourCategory: { fontSize: 8, fontWeight: '600', color: colors.textSecondary, marginTop: 1, textTransform: 'uppercase' },
    spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
    hourStatus: { fontSize: 10, fontWeight: '700', color: colors.white },
});
