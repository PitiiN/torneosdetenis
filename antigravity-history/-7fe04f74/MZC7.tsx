import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval,
    isSameDay, isToday, startOfDay, endOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import AdminBottomBar from '@/components/AdminBottomBar';
import { colors, spacing, borderRadius } from '@/theme';

// Time block definitions
const TIME_BLOCKS = [
    { label: 'Mañana', start: 8, end: 13 },
    { label: 'Tarde', start: 13, end: 19 },
    { label: 'Noche', start: 19, end: 23 },
];

export default function AdminScheduleScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [classes, setClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const dayStripRef = useRef<ScrollView>(null);

    // Days for the current month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

    const loadClasses = useCallback(async () => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        // Usar classes_with_availability para traer también los cupos disponibles
        const { data } = await supabase
            .from('classes_with_availability')
            .select('*')
            .gte('start_datetime', startOfDay(selectedDate).toISOString())
            .lte('start_datetime', endOfDay(selectedDate).toISOString())
            .order('start_datetime');
        if (data) setClasses(data);
    }, [selectedDate]);

    useEffect(() => { loadClasses(); }, [loadClasses]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadClasses();
        setRefreshing(false);
    };

    // Al pinchar un bloque de clase, vamos a la vista de edición de la clase
    // donde el admin puede ver los alumnos inscritos, borrar o añadir.
    const openClassDetail = (cls: any) => {
        router.push(`/(admin)/classes/${cls.id}` as any);
    };

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
                const padding = 16;
                const offset = Math.max(0, padding + (index * 54) - 150);
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
    }, [selectedDate, currentMonth, scrollToSelectedDate]);

    useFocusEffect(
        useCallback(() => {
            scrollToSelectedDate();
        }, [scrollToSelectedDate])
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Agenda Diaria</Text>
                <TouchableOpacity onPress={() => router.push('/(admin)/classes/create')}>
                    <Ionicons name="add-circle" size={24} color={colors.primary[500]} />
                </TouchableOpacity>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Month selector */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
                        <Ionicons name="chevron-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </Text>
                    <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
                        <Ionicons name="chevron-forward" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Day carousel */}
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

                {/* Title */}
                <Text style={styles.sectionTitle}>
                    Clases del {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </Text>

                {/* Time block grids */}
                {TIME_BLOCKS.map((block) => (
                    <View key={block.label} style={styles.blockSection}>
                        <View style={styles.blockHeader}>
                            <Ionicons
                                name={block.start < 13 ? 'sunny' : block.start < 19 ? 'partly-sunny' : 'moon'}
                                size={16}
                                color={colors.primary[400]}
                            />
                            <Text style={styles.blockLabel}>{block.label}</Text>
                            <Text style={styles.blockRange}>
                                {String(block.start).padStart(2, '0')}:00 — {String(block.end).padStart(2, '0')}:00
                            </Text>
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
                                        disabled={!hasClass}
                                        onPress={() => hasClass && openClassDetail(cls)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.hourText, hasClass && !isCancelled && styles.hourTextActive]}>
                                            {String(hour).padStart(2, '0')}:00
                                        </Text>
                                        {hasClass && (
                                            <>
                                                <Text style={[styles.hourCategory, isCancelled && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
                                                    {cls.category_name || 'General'}
                                                </Text>
                                                <Text style={[
                                                    styles.hourStatus,
                                                    isCancelled ? styles.hourStatusCancelled : isFull ? styles.hourStatusFull : styles.hourStatusAvailable
                                                ]}>
                                                    {isCancelled ? 'Cancelada' : isFull ? 'Lleno' : `${cls.max_students - cls.available_spots}/${cls.max_students} alum.`}
                                                </Text>
                                            </>
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
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    scrollContent: { paddingBottom: spacing['4xl'] },

    // Month selector
    monthSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
        gap: spacing.lg,
    },
    monthArrow: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    },
    monthText: {
        fontSize: 18, fontWeight: '700', color: colors.text,
        textTransform: 'capitalize', minWidth: 180, textAlign: 'center',
    },

    // Day strip
    dayStrip: { maxHeight: 76, marginBottom: spacing.md },
    dayStripContent: { paddingHorizontal: spacing.lg, gap: 6 },
    dayItem: {
        width: 48, height: 68, alignItems: 'center', justifyContent: 'center',
        borderRadius: borderRadius.lg, backgroundColor: colors.surface,
    },
    dayItemSelected: { backgroundColor: colors.primary[500] },
    dayName: { fontSize: 10, fontWeight: '600', color: colors.textTertiary, marginBottom: 2 },
    dayNum: { fontSize: 18, fontWeight: '700', color: colors.text },
    dayTextSelected: { color: colors.white },
    todayDot: {
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: colors.primary[500], marginTop: 2,
    },
    todayDotSelected: { backgroundColor: colors.white },

    // Section
    sectionTitle: {
        fontSize: 15, fontWeight: '600', color: colors.text,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
        textTransform: 'capitalize',
    },

    // Time blocks
    blockSection: { marginBottom: spacing.lg, paddingHorizontal: spacing.xl },
    blockHeader: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    blockLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    blockRange: { fontSize: 12, color: colors.textTertiary, marginLeft: 'auto' },
    hoursGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    },
    hourBlock: {
        width: '31%', paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
        minHeight: 68,
    },
    hourBlockEmpty: { backgroundColor: colors.surface, opacity: 0.5 },
    hourBlockAvailable: { backgroundColor: colors.secondary[700], borderWidth: 1, borderColor: colors.secondary[500] },
    hourBlockFull: { backgroundColor: '#3B1010', borderWidth: 1, borderColor: colors.error },
    hourBlockCancelled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: 0.7 },

    hourText: { fontSize: 14, fontWeight: '600', color: colors.textTertiary },
    hourTextActive: { color: colors.white },
    hourCategory: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
    hourStatus: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    hourStatusAvailable: { color: colors.secondary[300] },
    hourStatusFull: { color: colors.error },
    hourStatusCancelled: { color: colors.textTertiary, textDecorationLine: 'line-through' },
});
