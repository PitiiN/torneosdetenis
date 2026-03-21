import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomBar from '@/components/AdminBottomBar';
import {
    format, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameDay, isToday, addMonths, subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import TennisLoading from '@/components/common/TennisLoading';
import { useAlertStore } from '@/store/alert.store';
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
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [classes, setClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const dayStripRef = useRef<ScrollView>(null);

    // Days for the current month carousel
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const load = useCallback(async () => {
        const startM = format(startOfMonth(currentMonth), "yyyy-MM-dd'T'00:00:00");
        const endM = format(endOfMonth(currentMonth), "yyyy-MM-dd'T'23:59:59");

        const [classesCountRes] = await Promise.all([
            supabase.from('classes').select('id', { count: 'exact', head: true })
                .eq('status', 'scheduled')
                .gte('start_datetime', startM)
                .lte('start_datetime', endM),
        ]);

        // Alumnos distintos que tomaron a lo menos 1 clase en el mes elegido
        const { data: enrollData } = await supabase
            .from('enrollments')
            .select('student_id, classes!inner(start_datetime)')
            .gte('classes.start_datetime', startM)
            .lte('classes.start_datetime', endM)
            .eq('status', 'confirmed');

        const uniqueStudents = new Set(enrollData?.map(e => e.student_id));

        setStats(prev => ({
            ...prev,
            classes: classesCountRes.count || 0,
            activeStudents: uniqueStudents.size,
        }));

        // Fetch Classes for daily view
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const { data: classesData } = await supabase
            .from('classes_with_availability')
            .select('*')
            .gte('start_datetime', dateStr + 'T00:00:00')
            .lte('start_datetime', dateStr + 'T23:59:59')
            .order('start_datetime');

        if (classesData) setClasses(classesData);
        setIsLoaded(true);
    }, [selectedDate, currentMonth]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    useEffect(() => {
        // Real-time subscription to enrollments and classes to update availability
        const channel = supabase
            .channel('admin-schedule-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
                load();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => {
                load();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [load]);

    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    // Get class for a specific hour
    const getClassAtHour = (hour: number) => {
        return classes.find((c) => {
            const h = new Date(c.start_datetime).getHours();
            return h === hour;
        });
    };

    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const scrollToSelectedDate = useCallback((animated = true) => {
        if (dayStripRef.current && daysInMonth.length > 0) {
            const index = daysInMonth.findIndex(d => isSameDay(d, selectedDate));
            if (index !== -1) {
                // Width 40 + 10 gap = 50. Padding 16.
                const padding = 16;
                const offset = Math.max(0, padding + (index * 50) - 150);
                [100, 300, 600, 1000].forEach(delay => {
                    setTimeout(() => {
                        dayStripRef.current?.scrollTo({ x: offset, animated });
                    }, delay);
                });
            }
        }
    }, [selectedDate, daysInMonth]);

    useEffect(() => {
        scrollToSelectedDate();
    }, [selectedDate, currentMonth]);

    useFocusEffect(
        useCallback(() => {
            scrollToSelectedDate();
        }, [scrollToSelectedDate])
    );

    const handleWeatherCancellation = async () => {
        const dateStr = format(selectedDate, 'd MMMM', { locale: es });

        useAlertStore.getState().showAlert(
            'Confirmar suspensión',
            `¿Estás SEGURO de suspender TODAS las clases del día ${dateStr} por clima?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Siguiente...',
                    style: 'destructive',
                    onPress: () => {
                        useAlertStore.getState().showAlert(
                            '¡ULTIMA CONFIRMACIÓN!',
                            'Esta acción cancelará todas las inscripciones desde la hora actual en adelante para este día. Los alumnos recuperarán sus créditos. Esta acción NO se puede deshacer.',
                            [
                                { text: 'Abortar', style: 'cancel' },
                                {
                                    text: 'SUSPENDER TODO',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            const { data, error } = await supabase.rpc('cancel_classes_for_day', {
                                                p_date: format(selectedDate, 'yyyy-MM-dd'),
                                                p_start_time: new Date().toISOString()
                                            });

                                            if (error) throw error;

                                            const affected = (data as any)?.[0]?.affected_enrollments || 0;
                                            useAlertStore.getState().showAlert('Éxito', `Día suspendido. Se cancelaron ${affected} inscripciones.`);
                                            load();
                                        } catch (err: any) {
                                            useAlertStore.getState().showAlert('Error', err.message);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const handleEmptyBlockClick = (hour: number) => {
        useAlertStore.getState().showAlert(
            'Bloque Disponible',
            `¿Qué deseas hacer con el bloque de las ${String(hour).padStart(2, '0')}:00?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Bloquear',
                    style: 'destructive',
                    onPress: () => blockHour(hour)
                },
                {
                    text: 'Crear Clase',
                    onPress: () => router.push({
                        pathname: '/(admin)/classes/create',
                        params: { hour: String(hour), date: format(selectedDate, 'yyyy-MM-dd') }
                    } as any)
                }
            ]
        );
    };

    const blockHour = async (hour: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: court } = await supabase.from('courts').select('id').limit(1).single();
        const { data: cat } = await supabase.from('class_categories').select('id').limit(1).single();

        if (!court || !cat) {
            useAlertStore.getState().showAlert('Error', 'Faltan configuraciones de cancha o categoría.');
            return;
        }

        const startDatetime = new Date(selectedDate);
        startDatetime.setHours(hour, 0, 0, 0);
        const endDatetime = new Date(selectedDate);
        endDatetime.setHours(hour + 1, 0, 0, 0);

        const { error } = await supabase.from('classes').insert({
            title: 'Bloqueado',
            description: 'Bloqueado temporalmente',
            status: 'cancelled',
            category_id: cat.id,
            court_id: court.id,
            coach_id: user.id,
            start_datetime: startDatetime.toISOString(),
            end_datetime: endDatetime.toISOString(),
            max_students: 0,
            price: 0,
        });

        if (error) {
            useAlertStore.getState().showAlert('Error', error.message);
        } else {
            load();
        }
    };

    const STAT_CARDS = [
        { icon: 'calendar', label: 'Clases activas', value: stats.classes, color: colors.primary[500] },
        { icon: 'people', label: 'Alumnos activos', value: stats.activeStudents, color: colors.secondary[500] },
    ];

    if (!isLoaded) return <TennisLoading />;

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
                    <TouchableOpacity onPress={handleWeatherCancellation} style={styles.weatherBtn}>
                        <View style={styles.weatherIconStack}>
                            <Ionicons name="cloud-outline" size={24} color={colors.primary[500]} />
                            <Ionicons name="rainy-outline" size={12} color={colors.primary[500]} style={styles.rainIcon} />
                        </View>
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

                {/* Daily View Controls */}
                <View style={styles.dailyViewHeader}>
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

                    <ScrollView
                        ref={dayStripRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.dayStrip}
                        contentContainerStyle={styles.dayStripContent}
                        onContentSizeChange={() => scrollToSelectedDate()}
                    >
                        {daysInMonth.map((day) => {
                            const selected = isSameDay(day, selectedDate);
                            const today = isToday(day);
                            return (
                                <TouchableOpacity
                                    key={day.toISOString()}
                                    style={[styles.dayItem, selected && styles.dayItemSelected]}
                                    onPress={() => setSelectedDate(day)}
                                >
                                    <Text style={[styles.dayName, selected && styles.dayTextSelected]}>
                                        {format(day, 'EEE', { locale: es }).slice(0, 2).toUpperCase()}
                                    </Text>
                                    <Text style={[styles.dayNum, selected && styles.dayTextSelected]}>
                                        {format(day, 'd')}
                                    </Text>
                                    {today && <View style={[styles.todayDot, selected && styles.todayDotSelected]} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Daily Blocks View */}
                <Text style={styles.sectionTitle}>
                    Gestión del {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </Text>

                {TIME_BLOCKS.map((block) => (
                    <View key={block.label} style={styles.blockSection}>
                        <View style={styles.blockHeader}>
                            <Ionicons
                                name={block.start < 13 ? 'sunny' : block.start < 19 ? 'partly-sunny' : 'moon'}
                                size={14}
                                color={colors.primary[400]}
                            />
                            <Text style={styles.blockLabel}>{block.label}</Text>
                        </View>
                        <View style={styles.hoursGrid}>
                            {Array.from({ length: block.end - block.start }, (_, i) => {
                                const hour = block.start + i;
                                const cls = getClassAtHour(hour);
                                const hasClass = !!cls;
                                const isCancelled = hasClass && cls.status === 'cancelled';
                                const isFull = hasClass && !isCancelled && (cls.available_spots <= 0);

                                return (
                                    <TouchableOpacity
                                        key={hour}
                                        style={[
                                            styles.hourBlock,
                                            hasClass && !isCancelled && (isFull ? styles.hourBlockFull : styles.hourBlockAvailable),
                                            isCancelled && styles.hourBlockCancelled,
                                            !hasClass && styles.hourBlockEmpty,
                                        ]}
                                        disabled={false}
                                        onPress={() => {
                                            if (hasClass) {
                                                router.push(`/(admin)/classes/${cls.id}` as any);
                                            } else {
                                                handleEmptyBlockClick(hour);
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.hourText}>
                                            {String(hour).padStart(2, '0')}:00
                                        </Text>
                                        {hasClass && (
                                            <View style={styles.classInfo}>
                                                <Text style={[styles.hourCategory, isCancelled && { textDecorationLine: 'none' }]} numberOfLines={1}>
                                                    {isCancelled ? 'BLOQUEADA' : (cls.category_name || 'General')}
                                                </Text>
                                                {!isCancelled && (
                                                    <View style={styles.spotsRow}>
                                                        <Ionicons name="people" size={10} color={colors.white} />
                                                        <Text style={styles.hourStatus}>
                                                            {`${cls.max_students - cls.available_spots}/${cls.max_students}`}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
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
    weatherBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.primary[500] + '15',
        justifyContent: 'center', alignItems: 'center',
    },
    weatherIconStack: { alignItems: 'center', justifyContent: 'center' },
    rainIcon: { marginTop: -6 },

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
    hourBlockCancelled: { backgroundColor: colors.error + '20', borderWidth: 1, borderColor: colors.error, opacity: 0.9 },
    hourText: { fontSize: 13, fontWeight: '600', color: colors.white },
    hourCategory: { fontSize: 8, fontWeight: '600', color: colors.textSecondary, marginTop: 1, textTransform: 'uppercase' },
    spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
    hourStatus: { fontSize: 10, fontWeight: '700', color: colors.white },
});
