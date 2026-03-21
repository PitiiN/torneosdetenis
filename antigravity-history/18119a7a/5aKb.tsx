import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, Modal, FlatList, Platform, Switch,
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
    const [maxStudents, setMaxStudents] = useState('6');
    const [selectedCourt, setSelectedCourt] = useState<any>(null);
    const [selectedCoach, setSelectedCoach] = useState<any>(null);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [description, setDescription] = useState('');
    const [recurringEnabled, setRecurringEnabled] = useState(false);
    const [replicationCount, setReplicationCount] = useState('1');
    const hourScrollRef = useRef<ScrollView>(null);

    // Data
    const [courts, setCourts] = useState<any[]>([]);
    const [coaches, setCoaches] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Modals
    const [showCoachModal, setShowCoachModal] = useState(false);
    const [coachSearch, setCoachSearch] = useState('');

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
        const [courtsRes, coachesRes, categoriesRes] = await Promise.all([
            supabase.from('courts').select('*').order('name'),
            supabase.from('profiles').select('id, full_name, email').in('role', ['coach', 'admin']).order('full_name'),
            supabase.from('class_categories').select('*').order('level'),
        ]);
        if (courtsRes.data) setCourts(courtsRes.data);
        if (coachesRes.data) setCoaches(coachesRes.data);
        if (categoriesRes.data) {
            setCategories(categoriesRes.data);
            if (categoriesRes.data.length > 0) setSelectedCategory(categoriesRes.data[0]);
        }
        if (courtsRes.data && courtsRes.data.length > 0) setSelectedCourt(courtsRes.data[0]);
    };

    const calendarDays = eachDayOfInterval({
        start: startOfMonth(calendarMonth),
        end: endOfMonth(calendarMonth),
    });

    const filteredCoaches = coaches.filter(
        (c) => c.full_name.toLowerCase().includes(coachSearch.toLowerCase())
    );

    const handleSubmit = async () => {
        if (!title.trim()) { useAlertStore.getState().showAlert('Error', 'Ingresa un nombre para la clase'); return; }
        if (selectedHour === null) { useAlertStore.getState().showAlert('Error', 'Selecciona un bloque horario'); return; }
        if (!selectedCourt) { useAlertStore.getState().showAlert('Error', 'Selecciona una cancha'); return; }
        if (!selectedCategory) { useAlertStore.getState().showAlert('Error', 'Selecciona una categoría'); return; }

        setSubmitting(true);
        try {
            const count = recurringEnabled ? (parseInt(replicationCount) || 0) : 0;
            const totalToCreate = 1 + count;

            const classesToInsert = [];
            const datesToCheck = [];

            for (let i = 0; i < totalToCreate; i++) {
                const date = addWeeks(selectedDate, i);
                const startDatetime = new Date(date);
                startDatetime.setHours(selectedHour, 0, 0, 0);

                const endDatetime = new Date(date);
                endDatetime.setHours(selectedHour + 1, 0, 0, 0);

                const startStr = startDatetime.toISOString();
                datesToCheck.push(startStr);

                classesToInsert.push({
                    title: title.trim(),
                    description: description.trim() || null,
                    category_id: selectedCategory.id,
                    court_id: selectedCourt.id,
                    coach_id: selectedCoach?.id || null,
                    start_datetime: startStr,
                    end_datetime: endDatetime.toISOString(),
                    max_students: parseInt(maxStudents) || 6,
                    price: 0,
                    status: 'scheduled',
                });
            }

            // Conflict Check
            const { data: existing } = await supabase
                .from('classes')
                .select('start_datetime')
                .eq('court_id', selectedCourt.id)
                .in('start_datetime', datesToCheck);

            if (existing && existing.length > 0) {
                const conflictDates = existing.map(ex =>
                    format(new Date(ex.start_datetime), "EEEE d 'de' MMMM", { locale: es })
                ).join(', ');

                useAlertStore.getState().showAlert(
                    'Conflicto de Horario ⚠️',
                    `Ya existe una clase en la ${selectedCourt.name} para los siguientes días: ${conflictDates}. Por favor elimina esas clases primero o elige otro horario/cancha.`
                );
                setSubmitting(false);
                return;
            }

            const { error } = await supabase.from('classes').insert(classesToInsert);

            if (error) throw error;

            useAlertStore.getState().showAlert(
                '✅ Éxito',
                totalToCreate > 1
                    ? `${totalToCreate} clases creadas exitosamente.`
                    : `"${title}" fue creada exitosamente.`,
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            useAlertStore.getState().showAlert('Error', error.message);
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
                <Text style={styles.headerTitle}>Crear Clase</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={[styles.form, { paddingBottom: Math.max(spacing['6xl'], insets.bottom + spacing.xl) }]}>
                {/* Title */}
                <Text style={styles.label}>Nombre de la clase</Text>
                <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej: Clase de Iniciación"
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
                    {/* Leading empty days */}
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
                    {HOUR_BLOCKS.map((hour) => (
                        <TouchableOpacity
                            key={hour}
                            style={[styles.hourChip, selectedHour === hour && styles.hourChipSelected]}
                            onPress={() => setSelectedHour(hour)}
                        >
                            <Text style={[styles.hourChipText, selectedHour === hour && styles.hourChipTextSelected]}>
                                {String(hour).padStart(2, '0')}:00
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Court */}
                <Text style={styles.label}>Cancha</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {courts.map((court) => (
                        <TouchableOpacity
                            key={court.id}
                            style={[styles.optionChip, selectedCourt?.id === court.id && styles.optionChipSelected]}
                            onPress={() => setSelectedCourt(court)}
                        >
                            <Text style={[styles.optionChipText, selectedCourt?.id === court.id && styles.optionChipTextSel]}>
                                {court.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Category */}
                <Text style={styles.label}>Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {categories.map((cat) => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[
                                styles.optionChip,
                                selectedCategory?.id === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[
                                styles.optionChipText,
                                selectedCategory?.id === cat.id && { color: colors.white },
                            ]}>
                                {cat.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Coach */}
                <Text style={styles.label}>Profesor</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCoachModal(true)}>
                    <Ionicons name="person" size={18} color={colors.primary[400]} />
                    <Text style={styles.pickerText}>
                        {selectedCoach ? selectedCoach.full_name : 'Seleccionar profesor...'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Max students */}
                <Text style={styles.label}>Cupos máximos</Text>
                <TextInput
                    style={styles.input}
                    value={maxStudents}
                    onChangeText={setMaxStudents}
                    keyboardType="number-pad"
                    placeholder="6"
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

                {/* Recurrence (Admin copy from Home) */}
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

                {/* Buttons Container */}
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

            {/* Coach search modal */}
            <Modal visible={showCoachModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Profesor</Text>
                            <TouchableOpacity onPress={() => setShowCoachModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            value={coachSearch}
                            onChangeText={setCoachSearch}
                            placeholder="Buscar por nombre..."
                            placeholderTextColor={colors.textTertiary}
                            autoFocus
                        />
                        <FlatList
                            data={filteredCoaches}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.coachItem, selectedCoach?.id === item.id && styles.coachItemSel]}
                                    onPress={() => { setSelectedCoach(item); setShowCoachModal(false); setCoachSearch(''); }}
                                >
                                    <View style={styles.coachAvatar}>
                                        <Text style={styles.coachAvatarText}>{item.full_name?.charAt(0)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.coachName}>{item.full_name}</Text>
                                        <Text style={styles.coachEmail}>{item.email}</Text>
                                    </View>
                                    {selectedCoach?.id === item.id && (
                                        <Ionicons name="checkmark-circle" size={22} color={colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.noResults}>No se encontraron profesores</Text>
                            }
                        />
                    </View>
                </View>
            </Modal>
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

    // Month nav
    monthNav: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
    },
    monthText: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },

    // Day grid
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

    // Hour strip
    hourStrip: { maxHeight: 44 },
    hourChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border,
    },
    hourChipSelected: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
    hourChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
    hourChipTextSelected: { color: colors.white },

    // Options
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    optionChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.full,
        borderWidth: 1, borderColor: colors.border,
    },
    optionChipSelected: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
    optionChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    optionChipTextSel: { color: colors.white },

    // Coach picker
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderWidth: 1, borderColor: colors.border,
    },
    pickerText: { flex: 1, fontSize: 15, color: colors.text },

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

    // Recurring block
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

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: spacing['2xl'], maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    searchInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        fontSize: 15, color: colors.text, marginBottom: spacing.lg,
        borderWidth: 1, borderColor: colors.border,
    },
    coachItem: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    coachItemSel: { backgroundColor: colors.primary[500] + '15' },
    coachAvatar: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary[500], justifyContent: 'center', alignItems: 'center',
    },
    coachAvatarText: { fontSize: 16, fontWeight: '700', color: colors.white },
    coachName: { fontSize: 15, fontWeight: '600', color: colors.text },
    coachEmail: { fontSize: 12, color: colors.textSecondary },
    noResults: { textAlign: 'center', color: colors.textTertiary, paddingVertical: spacing.xl },
});
