import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { classesService } from '@/services/classes.service';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '@/theme';

export default function ScheduleScreen() {
    const { profile } = useAuth();
    const router = useRouter();
    const [classes, setClasses] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const currentWeekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

    const loadClasses = async () => {
        const start = format(currentWeekStart, 'yyyy-MM-dd');
        const end = format(currentWeekEnd, 'yyyy-MM-dd');
        const { data } = await classesService.getClassesInRange(start, end, profile?.id);
        if (data) setClasses(data);
    };

    useEffect(() => { loadClasses(); }, [weekOffset]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadClasses();
        setRefreshing(false);
    };

    // Group classes by day
    const groupedByDay = classes.reduce((acc: Record<string, any[]>, cls) => {
        const day = format(new Date(cls.start_datetime), 'yyyy-MM-dd');
        if (!acc[day]) acc[day] = [];
        acc[day].push(cls);
        return acc;
    }, {});

    const days = Object.entries(groupedByDay).sort(([a], [b]) => a.localeCompare(b));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Horarios</Text>
            </View>

            {/* Week navigation */}
            <View style={styles.weekNav}>
                <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.weekLabel}>
                    {format(currentWeekStart, 'd MMM', { locale: es })} — {format(currentWeekEnd, 'd MMM yyyy', { locale: es })}
                </Text>
                <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)}>
                    <Ionicons name="chevron-forward" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={days}
                keyExtractor={([day]) => day}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item: [day, dayClasses] }) => (
                    <View style={styles.daySection}>
                        <Text style={styles.dayHeader}>
                            {format(new Date(day), 'EEEE d', { locale: es })}
                        </Text>
                        {dayClasses.map((cls: any) => (
                            <TouchableOpacity
                                key={cls.class_id}
                                style={styles.scheduleItem}
                                onPress={() => router.push(`/class/${cls.class_id}` as any)}
                            >
                                <View style={[styles.timeBlock, { borderLeftColor: cls.category_color || colors.primary[500] }]}>
                                    <Text style={styles.timeText}>{format(new Date(cls.start_datetime), 'HH:mm')}</Text>
                                    <Text style={styles.timeEndText}>{format(new Date(cls.end_datetime), 'HH:mm')}</Text>
                                </View>
                                <View style={styles.scheduleContent}>
                                    <Text style={styles.scheduleTitle}>{cls.title}</Text>
                                    <Text style={styles.scheduleInfo}>{cls.court_name} · {cls.coach_name}</Text>
                                    <Text style={[styles.spotsText, { color: cls.available_spots > 0 ? colors.success : colors.error }]}>
                                        {cls.available_spots > 0 ? `${cls.available_spots} cupos` : 'Lleno'}
                                    </Text>
                                </View>
                                {cls.is_enrolled && (
                                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>Sin clases esta semana</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    weekNav: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        borderRadius: borderRadius.lg, marginBottom: spacing.lg,
    },
    weekLabel: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    daySection: { marginBottom: spacing.xl },
    dayHeader: {
        fontSize: 16, fontWeight: '600', color: colors.primary[400],
        marginBottom: spacing.sm, textTransform: 'capitalize',
    },
    scheduleItem: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
        gap: spacing.md,
    },
    timeBlock: {
        borderLeftWidth: 3, paddingLeft: spacing.sm,
    },
    timeText: { fontSize: 15, fontWeight: '700', color: colors.text },
    timeEndText: { fontSize: 12, color: colors.textSecondary },
    scheduleContent: { flex: 1 },
    scheduleTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    scheduleInfo: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    spotsText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },
});
