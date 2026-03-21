import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({ classesToday: 0, activeStudents: 0, pendingPayments: 0, overduePayments: 0 });
    const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadStats = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');

        const [classesRes, studentsRes, pendingRes, overdueRes, upcomingRes] = await Promise.all([
            supabase.from('classes').select('*', { count: 'exact', head: true }).gte('start_datetime', today + 'T00:00:00').lte('start_datetime', today + 'T23:59:59').eq('status', 'scheduled'),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
            supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
            supabase.from('classes_with_availability').select('*').gte('start_datetime', new Date().toISOString()).eq('status', 'scheduled').order('start_datetime').limit(5),
        ]);

        setStats({
            classesToday: classesRes.count || 0,
            activeStudents: studentsRes.count || 0,
            pendingPayments: pendingRes.count || 0,
            overduePayments: overdueRes.count || 0,
        });
        if (upcomingRes.data) setUpcomingClasses(upcomingRes.data);
    };

    useEffect(() => { loadStats(); }, []);

    const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };

    const quickActions = [
        { icon: 'add-circle', label: 'Crear Clase', color: colors.primary[500], route: '/(admin)/classes/create' },
        { icon: 'people', label: 'Alumnos', color: colors.secondary[500], route: '/(admin)/students' },
        { icon: 'card', label: 'Pagos', color: colors.accent[500], route: '/(admin)/payments' },
        { icon: 'list', label: 'Clases', color: colors.info, route: '/(admin)/classes' },
    ];

    return (
        <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Panel Admin</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderLeftColor: colors.primary[500] }]}>
                    <Ionicons name="calendar" size={24} color={colors.primary[500]} />
                    <Text style={styles.statValue}>{stats.classesToday}</Text>
                    <Text style={styles.statLabel}>Clases hoy</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.secondary[500] }]}>
                    <Ionicons name="people" size={24} color={colors.secondary[500]} />
                    <Text style={styles.statValue}>{stats.activeStudents}</Text>
                    <Text style={styles.statLabel}>Alumnos</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
                    <Ionicons name="time" size={24} color={colors.warning} />
                    <Text style={styles.statValue}>{stats.pendingPayments}</Text>
                    <Text style={styles.statLabel}>Pagos pend.</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.error }]}>
                    <Ionicons name="alert-circle" size={24} color={colors.error} />
                    <Text style={styles.statValue}>{stats.overduePayments}</Text>
                    <Text style={styles.statLabel}>Vencidos</Text>
                </View>
            </View>

            {/* Quick actions */}
            <Text style={styles.sectionTitle}>Acciones rápidas</Text>
            <View style={styles.actionsGrid}>
                {quickActions.map((action, index) => (
                    <TouchableOpacity key={index} style={styles.actionCard} onPress={() => router.push(action.route as any)}>
                        <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                            <Ionicons name={action.icon as any} size={24} color={action.color} />
                        </View>
                        <Text style={styles.actionLabel}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Upcoming classes */}
            <Text style={styles.sectionTitle}>Próximas clases</Text>
            {upcomingClasses.map((cls) => (
                <TouchableOpacity key={cls.id} style={styles.upcomingCard} onPress={() => router.push(`/class/${cls.id}` as any)}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.upcomingTitle}>{cls.title}</Text>
                        <Text style={styles.upcomingInfo}>
                            {format(new Date(cls.start_datetime), "EEE d MMM, HH:mm", { locale: es })} · {cls.court_name}
                        </Text>
                    </View>
                    <Text style={styles.upcomingSpots}>{cls.enrolled_count}/{cls.max_students}</Text>
                </TouchableOpacity>
            ))}
            <View style={{ height: spacing['4xl'] }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.lg,
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.xl,
        gap: spacing.sm, marginBottom: spacing.xl,
    },
    statCard: {
        flex: 1, minWidth: '45%', backgroundColor: colors.surface,
        borderRadius: borderRadius.lg, padding: spacing.lg,
        borderLeftWidth: 3, gap: spacing.xs,
    },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    sectionTitle: {
        fontSize: 18, fontWeight: '600', color: colors.text,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    actionsGrid: {
        flexDirection: 'row', paddingHorizontal: spacing.xl,
        gap: spacing.sm, marginBottom: spacing.xl,
    },
    actionCard: {
        flex: 1, alignItems: 'center', backgroundColor: colors.surface,
        borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.sm,
    },
    actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
    upcomingCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.sm,
    },
    upcomingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    upcomingInfo: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
    upcomingSpots: { fontSize: 16, fontWeight: '700', color: colors.primary[400] },
});
