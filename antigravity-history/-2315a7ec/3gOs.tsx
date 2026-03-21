import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, differenceInHours, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { enrollmentsService } from '@/services/enrollments.service';
import TennisLoading from '@/components/common/TennisLoading';
import { useAlertStore } from '@/store/alert.store';
import { colors, spacing, borderRadius } from '@/theme';

// Time block definitions
const TIME_BLOCKS = [
    { label: 'Mañana', start: 8, end: 13 },
    { label: 'Tarde', start: 13, end: 19 },
    { label: 'Noche', start: 19, end: 23 },
];

export default function HomeScreen() {
    const { profile, isAdmin } = useAuth();
    const insets = useSafeAreaInsets();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [classes, setClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [allowance, setAllowance] = useState<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const dayStripRef = useRef<ScrollView>(null);

    // Days for the current month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const loadClasses = useCallback(async () => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const { data } = await supabase
            .from('classes_with_availability')
            .select('*')
            .gte('start_datetime', dateStr + 'T00:00:00')
            .lte('start_datetime', dateStr + 'T23:59:59')
            .order('start_datetime');
        if (data) setClasses(data);
    }, [selectedDate]);

    const loadAllowance = useCallback(async () => {
        if (!profile) return;
        const { data } = await supabase.rpc('get_student_class_allowance', {
            p_student_id: profile.id,
        });
        if (data && data.length > 0) setAllowance(data[0]);
    }, [profile]);

    useFocusEffect(
        useCallback(() => {
            const init = async () => {
                await Promise.all([loadClasses(), loadAllowance()]);
                setIsLoaded(true);
            };
            init();
        }, [loadClasses, loadAllowance])
    );

    useEffect(() => {
        // Real-time subscription to enrollments and classes to update availability
        const channel = supabase
            .channel('schedule-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
                loadClasses();
                loadAllowance();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => {
                loadClasses();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadClasses, loadAllowance]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadClasses(), loadAllowance()]);
        setRefreshing(false);
    };

    const handleEnroll = async (cls: any) => {
        if (!profile) return;

        // Check 
        if (allowance && allowance.remaining_classes <= 0 && !isAdmin) {
            useAlertStore.getState().showAlert('Sin cupos', 'Has alcanzado el límite de clases de tu plan. Revisa tus pagos para ampliar.');
            return;
        }

        setEnrolling(true);
        try {
            await enrollmentsService.enroll(cls.id, profile.id);
            useAlertStore.getState().showAlert('✅ Inscrito', `Te inscribiste en "${cls.title}"`);
            setModalVisible(false);
            loadClasses();
            loadAllowance();
        } catch (err: any) {
            useAlertStore.getState().showAlert('Error', err.message || 'No se pudo inscribir');
        }
        setEnrolling(false);
    };

    const handleCancelEnrollment = async (cls: any) => {
        if (!profile) return;

        const hoursUntilClass = differenceInHours(new Date(cls.start_datetime), new Date());

        if (hoursUntilClass < 24) {
            useAlertStore.getState().showAlert('No se puede cancelar', 'Solo puedes cancelar hasta 24 horas antes del inicio de la clase.');
            return;
        }

        useAlertStore.getState().showAlert('Cancelar inscripción', '¿Confirmas cancelar tu inscripción?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
                    // Find enrollment
                    const { data: enrollment } = await supabase
                        .from('enrollments')
                        .select('id')
                        .eq('class_id', cls.id)
                        .eq('student_id', profile.id)
                        .eq('status', 'confirmed')
                        .single();
                    if (enrollment) {
                        await enrollmentsService.cancelEnrollment(enrollment.id);
                        useAlertStore.getState().showAlert('Cancelado', 'Tu inscripción fue cancelada.');
                        setModalVisible(false);
                        loadClasses();
                        loadAllowance();
                    }
                }
            },
        ]);
    };

    // Check if student is enrolled in a class
    const checkEnrolled = async (classId: string): Promise<boolean> => {
        if (!profile) return false;
        const { data } = await supabase
            .from('enrollments')
            .select('id')
            .eq('class_id', classId)
            .eq('student_id', profile.id)
            .eq('status', 'confirmed')
            .maybeSingle();
        return !!data;
    };

    const openClassModal = async (cls: any) => {
        const enrolled = await checkEnrolled(cls.id);
        setSelectedClass({ ...cls, isEnrolled: enrolled });
        setModalVisible(true);
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
                // width (48) + gap (6) = 54. 
                // We add spacing.lg (16) which is the contentContainer padding
                const padding = 16;
                const offset = Math.max(0, padding + (index * 54) - 150);

                // Multiple retries to catch layout stabilization
                [100, 300, 600, 1000].forEach(delay => {
                    setTimeout(() => {
                        dayStripRef.current?.scrollTo({ x: offset, animated });
                    }, delay);
                });
            }
        }
    }, [selectedDate, daysInMonth]);

    // Scroll when date or month changes
    useEffect(() => {
        scrollToSelectedDate();
    }, [selectedDate, currentMonth]);

    // Scroll when screen gains focus
    useFocusEffect(
        useCallback(() => {
            scrollToSelectedDate();
        }, [scrollToSelectedDate])
    );

    if (!isLoaded) return <TennisLoading />;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
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

                {/* Allowance bar (for students) */}
                {!isAdmin && allowance && (
                    <View style={styles.allowanceBar}>
                        <Ionicons name="tennisball" size={16} color={colors.primary[400]} />
                        <Text style={styles.allowanceText}>
                            {allowance.remaining_classes > 0
                                ? `${allowance.remaining_classes} clases disponibles de ${allowance.total_paid_classes}`
                                : 'Sin clases disponibles — revisa tus pagos'}
                        </Text>
                    </View>
                )}

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
                                const isAvailable = hasClass && !isCancelled && cls.available_spots > 0;

                                return (
                                    <TouchableOpacity
                                        key={hour}
                                        style={[
                                            styles.hourBlock,
                                            hasClass && (isCancelled ? styles.hourBlockCancelled : (isFull ? styles.hourBlockFull : styles.hourBlockAvailable)),
                                            !hasClass && styles.hourBlockEmpty,
                                        ]}
                                        disabled={!hasClass || isCancelled}
                                        onPress={() => hasClass && !isCancelled && openClassModal(cls)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.hourText}>
                                            {String(hour).padStart(2, '0')}:00
                                        </Text>
                                        {hasClass && (
                                            <View style={styles.classInfo}>
                                                <Text style={[styles.hourCategory, isCancelled && { color: colors.textTertiary }]} numberOfLines={1}>
                                                    {isCancelled ? 'BLOQUEADA' : (cls.category_name || 'General')}
                                                </Text>
                                                {!isCancelled && (
                                                    <Text style={[
                                                        styles.hourStatus,
                                                        isFull ? styles.hourStatusFull : styles.hourStatusAvailable
                                                    ]}>
                                                        {isFull ? 'Lleno' : `${cls.available_spots} cupos`}
                                                    </Text>
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

            {/* Class detail modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedClass && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{selectedClass.title}</Text>
                                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                                        <Ionicons name="close" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalInfo}>
                                    <View style={styles.modalRow}>
                                        <Ionicons name="time" size={18} color={colors.primary[400]} />
                                        <Text style={styles.modalLabel}>Horario</Text>
                                        <Text style={styles.modalValue}>
                                            {format(new Date(selectedClass.start_datetime), 'HH:mm')} - {format(new Date(selectedClass.end_datetime), 'HH:mm')}
                                        </Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Ionicons name="person" size={18} color={colors.secondary[500]} />
                                        <Text style={styles.modalLabel}>Profesor</Text>
                                        <Text style={styles.modalValue}>{selectedClass.coach_name || 'Por asignar'}</Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Ionicons name="pricetag" size={18} color={colors.accent[500]} />
                                        <Text style={styles.modalLabel}>Categoría</Text>
                                        <Text style={styles.modalValue}>{selectedClass.category_name || 'General'}</Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Ionicons name="location" size={18} color={colors.info} />
                                        <Text style={styles.modalLabel}>Cancha</Text>
                                        <Text style={styles.modalValue}>{selectedClass.court_name}</Text>
                                    </View>
                                    <View style={styles.modalRow}>
                                        <Ionicons name="people" size={18} color={
                                            selectedClass.available_spots > 0 ? colors.success : colors.error
                                        } />
                                        <Text style={styles.modalLabel}>Cupos</Text>
                                        <Text style={[styles.modalValue, {
                                            color: selectedClass.available_spots > 0 ? colors.success : colors.error
                                        }]}>
                                            {selectedClass.available_spots} / {selectedClass.max_students}
                                        </Text>
                                    </View>
                                </View>

                                {/* Actions */}
                                {selectedClass.isEnrolled ? (
                                    differenceInHours(new Date(selectedClass.start_datetime), new Date()) >= 24 && (
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={() => handleCancelEnrollment(selectedClass)}
                                        >
                                            <Ionicons name="close-circle" size={20} color={colors.error} />
                                            <Text style={styles.cancelButtonText}>Cancelar clase</Text>
                                        </TouchableOpacity>
                                    )
                                ) : selectedClass.available_spots > 0 ? (
                                    <TouchableOpacity
                                        style={[styles.enrollButton, enrolling && { opacity: 0.6 }]}
                                        onPress={() => handleEnroll(selectedClass)}
                                        disabled={enrolling}
                                    >
                                        {enrolling ? (
                                            <ActivityIndicator color={colors.white} />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                                                <Text style={styles.enrollButtonText}>Confirmar Inscripción</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.fullBanner}>
                                        <Text style={styles.fullBannerText}>Clase completa</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 20 },

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

    // Allowance
    allowanceBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, marginBottom: spacing.md,
        borderLeftWidth: 3, borderLeftColor: colors.primary[500],
    },
    allowanceText: { fontSize: 13, color: colors.textSecondary, flex: 1 },

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
    classInfo: { flex: 1 },
    hourBlock: {
        width: '31%', paddingVertical: spacing.sm,
        borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
        minHeight: 68,
    },
    hourBlockEmpty: { backgroundColor: colors.surface, opacity: 0.5 },
    hourBlockAvailable: { backgroundColor: colors.secondary[700], borderWidth: 1, borderColor: colors.secondary[500] },
    hourBlockFull: { backgroundColor: '#3B1010', borderWidth: 1, borderColor: colors.error },
    hourBlockCancelled: { backgroundColor: colors.error + '20', borderWidth: 1, borderColor: colors.error, opacity: 0.9 },
    hourText: { fontSize: 14, fontWeight: '600', color: colors.white },
    hourCategory: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
    hourStatus: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    hourStatusAvailable: { color: colors.secondary[300] },
    hourStatusFull: { color: colors.error },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: spacing['2xl'], paddingBottom: spacing['4xl'],
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.xl,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
    modalInfo: { gap: spacing.md, marginBottom: spacing.xl },
    modalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    modalLabel: { fontSize: 14, color: colors.textSecondary, width: 80 },
    modalValue: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },

    enrollButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.secondary[600], height: 52,
        borderRadius: borderRadius.lg, gap: spacing.sm,
    },
    enrollButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
    cancelButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.error + '15', height: 52,
        borderRadius: borderRadius.lg, gap: spacing.sm,
        borderWidth: 1, borderColor: colors.error,
    },
    cancelButtonText: { fontSize: 16, fontWeight: '600', color: colors.error },
    fullBanner: {
        height: 52, borderRadius: borderRadius.lg,
        backgroundColor: colors.error + '15', alignItems: 'center', justifyContent: 'center',
    },
    fullBannerText: { fontSize: 16, fontWeight: '600', color: colors.error },
});
