import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';
import { useAlertStore } from '@/store/alert.store';
import { useRef } from 'react';

const HOUR_BLOCKS = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 to 22:00

export default function AdminCreateClassScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { hour, date } = useLocalSearchParams<{ hour: string; date: string }>();

    // Form state
    const [title, setTitle] = useState('');
    const initialDate = date
        ? (date.includes('T') ? new Date(date) : new Date(date + 'T00:00:00'))
        : new Date();

    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [calendarMonth, setCalendarMonth] = useState(initialDate);
    const [selectedHour, setSelectedHour] = useState<number | null>(hour ? parseInt(hour) : null);
    const [maxStudents, setMaxStudents] = useState('12');
    const [description, setDescription] = useState('');
    const [recurringEnabled, setRecurringEnabled] = useState(false);
    const [replicationCount, setReplicationCount] = useState('1');
    const hourScrollRef = useRef<ScrollView>(null);

    // Category per court
    const [categories, setCategories] = useState<any[]>([]);
    const [courts, setCourts] = useState<any[]>([]);
    const [court1Category, setCourt1Category] = useState<any>(null);
    const [court2Category, setCourt2Category] = useState<any>(null);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedHour !== null && hourScrollRef.current) {
            const index = HOUR_BLOCKS.indexOf(selectedHour);
            if (index !== -1) {
                setTimeout(() => {
                    hourScrollRef.current?.scrollTo({
                        x: Math.max(0, index * 88 - 100),
                        animated: true
                    });
                }, 300);
            }
        }
    }, [selectedHour]);

    const loadData = async () => {
        const [courtsRes, categoriesRes] = await Promise.all([
            supabase.from('courts').select('*').order('name'),
            supabase.from('class_categories').select('*').order('level'),
        ]);
        if (courtsRes.data) setCourts(courtsRes.data);
        if (categoriesRes.data) {
            setCategories(categoriesRes.data);
            if (categoriesRes.data.length > 0) {
                setCourt1Category(categoriesRes.data[0]);
                setCourt2Category(categoriesRes.data[0]);
            }
        }
    };

    const calendarDays = eachDayOfInterval({
        start: startOfMonth(calendarMonth),
        end: endOfMonth(calendarMonth),
    });

    const handleSubmit = async () => {
        if (!title.trim()) { useAlertStore.getState().showAlert('Error', 'Ingresa un nombre para la clase'); return; }
        if (selectedHour === null) { useAlertStore.getState().showAlert('Error', 'Selecciona un bloque horario'); return; }
        if (!court1Category || !court2Category) { useAlertStore.getState().showAlert('Error', 'Asigna una categoría a cada cancha'); return; }

        setSubmitting(true);
        try {
            const count = recurringEnabled ? (parseInt(replicationCount) || 0) : 0;
            const totalToCreate = 1 + count;

            // We need the first court for the DB record
            const mainCourt = courts[0];
            if (!mainCourt) {
                useAlertStore.getState().showAlert('Error', 'No se encontraron canchas configuradas');
                setSubmitting(false);
                return;
            }

            const classesToInsert = [];

            for (let i = 0; i < totalToCreate; i++) {
                const d = addWeeks(selectedDate, i);
                const startDatetime = new Date(d);
                startDatetime.setHours(selectedHour, 0, 0, 0);

                const endDatetime = new Date(d);
                endDatetime.setHours(selectedHour + 1, 0, 0, 0);

                classesToInsert.push({
                    title: title.trim(),
                    description: description.trim() || null,
                    category_id: court1Category.id,
                    court2_category_id: court2Category.id,
                    court_id: mainCourt.id,
                    coach_id: null,
                    start_datetime: startDatetime.toISOString(),
                    end_datetime: endDatetime.toISOString(),
                    max_students: parseInt(maxStudents) || 12,
                    price: 0,
                    status: 'scheduled',
                });
            }

            // Check for overlapping classes on the same court
            const { data: existing } = await supabase
                .from('classes')
                .select('start_datetime, end_datetime')
                .eq('court_id', mainCourt.id)
                .gte('start_datetime', classesToInsert[0].start_datetime.split('T')[0] + 'T00:00:00Z')
                .lte('end_datetime', classesToInsert[classesToInsert.length - 1].end_datetime.split('T')[0] + 'T23:59:59Z');

            const conflictingDates: string[] = [];
            if (existing) {
                for (const proposed of classesToInsert) {
                    const pStart = new Date(proposed.start_datetime).getTime();
                    const pEnd = new Date(proposed.end_datetime).getTime();

                    const hasOverlap = existing.some(ex => {
                        const eStart = new Date(ex.start_datetime).getTime();
                        const eEnd = new Date(ex.end_datetime).getTime();
                        return (pStart < eEnd && pEnd > eStart);
                    });

                    if (hasOverlap) {
                        conflictingDates.push(proposed.start_datetime);
                    }
                }
            }

            const finalClassesToInsert = classesToInsert.filter(c => !conflictingDates.includes(c.start_datetime));

            if (conflictingDates.length > 0) {
                const conflictDetails = conflictingDates.map(dStr =>
                    format(new Date(dStr), "EEEE d 'de' MMMM", { locale: es })
                ).join(', ');

                if (finalClassesToInsert.length === 0) {
                    useAlertStore.getState().showAlert(
                        'Todo en Conflicto ⚠️',
                        `Ya existen clases para todos los días seleccionados: ${conflictDetails}.`
                    );
                    setSubmitting(false);
                    return;
                }

                useAlertStore.getState().showAlert(
                    'Conflicto de Horario ⚠️',
                    `Ya existen clases para los siguientes días: ${conflictDetails}.\n\n¿Deseas crear solo las clases en los días disponibles?`,
                    [
                        { text: 'Cancelar', onPress: () => setSubmitting(false), style: 'cancel' },
                        {
                            text: 'Crear Disponibles',
                            onPress: () => performInsert(finalClassesToInsert)
                        }
                    ]
                );
                return;
            }

            await performInsert(finalClassesToInsert);
        } catch (error: any) {
            useAlertStore.getState().showAlert('Error', error.message);
            setSubmitting(false);
        }
    };

    const performInsert = async (classes: any[]) => {
        setSubmitting(true);
        try {
            const { error } = await supabase.from('classes').insert(classes);
            if (error) throw error;

            useAlertStore.getState().showAlert(
                '✅ Éxito',
                classes.length > 1
                    ? `${classes.length} clases creadas exitosamente.`
                    : `"${title}" fue creada exitosamente.`,
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            useAlertStore.getState().showAlert('Error', error.message);
            setSubmitting(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Clase Adultos</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={[styles.form, { paddingBottom: Math.max(spacing['6xl'], insets.bottom + spacing.xl) }]}>
                {/* Title */}
                <Text style={styles.label}>Nombre de la clase</Text>
                <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej: Clase de la mañana"
                    placeholderTextColor={colors.textTertiary}
                />

                {/* Calendar month selector */}
                <Text style={styles.label}>Fecha</Text>
                <View style={styles.monthNav}>
                    <TouchableOpacity onPress={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                        <Ionicons name="chevron-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{format(calendarMonth, 'MMMM yyyy', { locale: es })}</Text>
                    <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                        <Ionicons name="chevron-forward" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Day grid */}
                <View style={styles.dayGrid}>
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                        <Text key={d} style={styles.dayHeader}>{d}</Text>
                    ))}
                    {Array.from({ length: (startOfMonth(calendarMonth).getDay() + 6) % 7 }, (_, i) => (
                        <View key={`empty-${i}`} style={styles.dayCell} />
                    ))}
                    {calendarDays.map((day) => {
                        const selected = isSameDay(day, selectedDate);
                        return (
                            <TouchableOpacity
                                key={day.toISOString()}
                                style={[styles.dayCell, selected && styles.dayCellSelected]}
                                onPress={() => setSelectedDate(day)}
                            >
                                <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>
                                    {format(day, 'd')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.selectedDateText}>
                    {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </Text>

                {/* Hour blocks */}
                <Text style={styles.label}>Bloque horario</Text>
                <ScrollView
                    ref={hourScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.hourStrip}
                >
                    {HOUR_BLOCKS.map((h) => (
                        <TouchableOpacity
                            key={h}
                            style={[styles.hourChip, selectedHour === h && styles.hourChipSelected]}
                            onPress={() => setSelectedHour(h)}
                        >
                            <Text style={[styles.hourChipText, selectedHour === h && styles.hourChipTextSelected]}>
                                {String(h).padStart(2, '0')}:00
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Category per court */}
                <Text style={styles.label}>Categoría por Cancha</Text>
                <View style={styles.courtCatBlock}>
                    {courts.slice(0, 2).map((court, idx) => {
                        const selected = idx === 0 ? court1Category : court2Category;
                        const setter = idx === 0 ? setCourt1Category : setCourt2Category;
                        return (
                            <View key={court.id} style={styles.courtCatRow}>
                                <Text style={styles.courtCatLabel}>{court.name}</Text>
                                <View style={styles.catChips}>
                                    {categories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[
                                                styles.catChip,
                                                selected?.id === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                                            ]}
                                            onPress={() => setter(cat)}
                                        >
                                            <Text style={[
                                                styles.catChipText,
                                                selected?.id === cat.id && { color: colors.white },
                                            ]}>
                                                {cat.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Max students */}
                <Text style={styles.label}>Cupos máximos (ambas canchas)</Text>
                <TextInput
                    style={styles.input}
                    value={maxStudents}
                    onChangeText={setMaxStudents}
                    keyboardType="number-pad"
                    placeholder="12"
                    placeholderTextColor={colors.textTertiary}
                />

                {/* Description */}
                <Text style={styles.label}>Descripción (opcional)</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Notas adicionales..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                />

                {/* Recurrence */}
                <View style={styles.recurringBlock}>
                    <View style={styles.recurringHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.recurringTitle}>Replicar Clase</Text>
                            <Text style={styles.recurringSubtitle}>Crear esta clase las próximas semanas</Text>
                        </View>
                        <Switch
                            value={recurringEnabled}
                            onValueChange={setRecurringEnabled}
                            trackColor={{ false: colors.border, true: colors.primary[500] }}
                            thumbColor={colors.white}
                        />
                    </View>

                    {recurringEnabled && (
                        <View style={styles.replicationInputContainer}>
                            <Text style={styles.replicationLabel}>Semanas adicionales:</Text>
                            <TextInput
                                style={styles.replicationInput}
                                value={replicationCount}
                                onChangeText={setReplicationCount}
                                keyboardType="number-pad"
                                maxLength={2}
                            />
                        </View>
                    )}
                </View>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.cancelBtn, submitting && { opacity: 0.6 }]}
                        onPress={() => router.back()}
                        disabled={submitting}
                    >
                        <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <>
                                <Ionicons name="add-circle" size={22} color={colors.white} />
                                <Text style={styles.submitText}>Crear Clase</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    form: { paddingHorizontal: spacing.xl },

    label: {
        fontSize: 14, fontWeight: '600', color: colors.textSecondary,
        marginTop: spacing.lg, marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },

    monthNav: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
    },
    monthText: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },

    dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayHeader: {
        width: `${100 / 7}%`, textAlign: 'center',
        fontSize: 11, fontWeight: '600', color: colors.textTertiary,
        paddingVertical: spacing.xs,
    },
    dayCell: {
        width: `${100 / 7}%`, aspectRatio: 1,
        justifyContent: 'center', alignItems: 'center',
    },
    dayCellSelected: {
        backgroundColor: colors.primary[500], borderRadius: borderRadius.full,
    },
    dayCellText: { fontSize: 14, color: colors.text },
    dayCellTextSelected: { color: colors.white, fontWeight: '700' },
    selectedDateText: {
        fontSize: 13, color: colors.primary[400], textAlign: 'center',
        marginTop: spacing.xs, textTransform: 'capitalize',
    },

    hourStrip: { maxHeight: 44 },
    hourChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border,
    },
    hourChipSelected: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
    hourChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
    hourChipTextSelected: { color: colors.white },

    // Court category assignment
    courtCatBlock: {
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        padding: spacing.lg, gap: spacing.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    courtCatRow: { gap: spacing.sm },
    courtCatLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    catChips: { flexDirection: 'row', gap: spacing.sm },
    catChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        backgroundColor: colors.background, borderRadius: borderRadius.full,
        borderWidth: 1, borderColor: colors.border,
    },
    catChipText: { fontSize: 13, fontWeight: '600', color: colors.text },

    // Submit
    submitBtn: {
        flex: 2,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary[500], height: 52,
        borderRadius: borderRadius.lg, gap: spacing.sm,
    },
    submitText: { fontSize: 16, fontWeight: '700', color: colors.white },

    cancelBtn: {
        flex: 1,
        height: 52,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },

    buttonContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing['2xl'],
        marginBottom: spacing['6xl'],
    },

    recurringBlock: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginTop: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    recurringHeader: { flexDirection: 'row', alignItems: 'center' },
    recurringTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    recurringSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    replicationInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    replicationLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
    replicationInput: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        width: 60,
        textAlign: 'center',
        color: colors.text,
        fontWeight: '700',
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.primary[500],
    },
});
