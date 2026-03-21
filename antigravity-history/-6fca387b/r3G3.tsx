import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, Modal, FlatList, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { enrollmentsService } from '@/services/enrollments.service';
import { colors, spacing, borderRadius } from '@/theme';
import { notificationsService } from '@/services/notifications.service';
import { useAlertStore } from '@/store/alert.store';

export default function AdminEditClassScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();

    const [cls, setCls] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enrollments, setEnrollments] = useState<any[]>([]);

    // Editable fields
    const [title, setTitle] = useState('');
    const [maxStudents, setMaxStudents] = useState('');
    const [status, setStatus] = useState('scheduled');
    const [selectedCoach, setSelectedCoach] = useState<any>(null);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);

    // Data for selectors
    const [coaches, setCoaches] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [coachSearch, setCoachSearch] = useState('');
    const [showCoachModal, setShowCoachModal] = useState(false);

    // Manual enrollment
    const [showAddModal, setShowAddModal] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [adding, setAdding] = useState(false);
    const [recurringEnabled, setRecurringEnabled] = useState(false);
    const [replicationCount, setReplicationCount] = useState('1');

    const loadClass = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase
            .from('classes')
            .select(`
        *, courts (name), 
        profiles!classes_coach_id_fkey (id, full_name),
        class_categories (id, name, color)
      `)
            .eq('id', id)
            .single();
        if (data) {
            setCls(data);
            setTitle(data.title);
            setMaxStudents(String(data.max_students));
            setStatus(data.status);
            setSelectedCoach(data.profiles);
            setSelectedCategory(data.class_categories);
        }
    }, [id]);

    const loadData = useCallback(async () => {
        const [coachesRes, catsRes] = await Promise.all([
            supabase.from('profiles').select('id, full_name, email').in('role', ['coach', 'admin']).order('full_name'),
            supabase.from('class_categories').select('*').order('level'),
        ]);
        if (coachesRes.data) setCoaches(coachesRes.data);
        if (catsRes.data) setCategories(catsRes.data);
    }, []);

    const loadEnrollments = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase
            .from('enrollments')
            .select('*, profiles!enrollments_student_id_fkey (id, full_name, email)')
            .eq('class_id', id)
            .eq('status', 'confirmed')
            .order('enrolled_at');
        if (data) setEnrollments(data);
    }, [id]);

    useEffect(() => {
        loadClass();
        loadData();
        loadEnrollments();
    }, [loadClass, loadData, loadEnrollments]);

    const handleDeleteClass = () => {
        useAlertStore.getState().showAlert(
            'Eliminar Clase ⚠️',
            '¿Estás seguro de que deseas eliminar esta clase? Se borrará el registro y los alumnos recuperarán sus créditos.',
            [
                { text: 'Volver', style: 'cancel' },
                {
                    text: 'Confirmar Eliminación',
                    style: 'destructive',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            // 1. Recover credits (by cancelling enrollments first)
                            if (enrollments.length > 0) {
                                const { error: enrError } = await supabase
                                    .from('enrollments')
                                    .update({ status: 'cancelled' })
                                    .eq('class_id', id)
                                    .eq('status', 'confirmed');

                                if (enrError) throw enrError;

                                // Notify students
                                const dateStr = format(new Date(cls.start_datetime), "d 'de' MMMM", { locale: es });
                                for (const enr of enrollments) {
                                    await notificationsService.createNotification(
                                        enr.student_id,
                                        'Clase Cancelada ⚠️',
                                        `Tu clase "${title}" para el ${dateStr} ha sido cancelada. El crédito ha sido devuelto.`,
                                        'class_cancelled'
                                    );
                                }
                            }

                            // 2. Delete the class record physically
                            const { error: clsError } = await supabase
                                .from('classes')
                                .delete()
                                .eq('id', id);

                            if (clsError) throw clsError;

                            useAlertStore.getState().showAlert('✅ Eliminada', 'La clase ha sido eliminada correctamente.', [
                                { text: 'OK', onPress: () => router.back() }
                            ]);
                        } catch (err: any) {
                            useAlertStore.getState().showAlert('Error', err.message);
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        const { error } = await supabase
            .from('classes')
            .update({
                title: title.trim(),
                max_students: parseInt(maxStudents) || 6,
                status,
                coach_id: selectedCoach?.id || null,
                category_id: selectedCategory?.id || cls?.category_id,
            })
            .eq('id', id);
        setSaving(false);
        if (error) {
            useAlertStore.getState().showAlert('Error', error.message);
        } else {
            // Notify if cancelled
            if (status === 'cancelled' && cls?.status !== 'cancelled') {
                const dateStr = format(new Date(cls.start_datetime), "d 'de' MMMM", { locale: es });
                for (const enr of enrollments) {
                    await notificationsService.createNotification(
                        enr.student_id,
                        'Clase Cancelada ⚠️',
                        `Tu clase "${title}" para el ${dateStr} ha sido cancelada.`,
                        'class_cancelled'
                    );
                }
            }
            useAlertStore.getState().showAlert('✅ Guardado', 'Los cambios fueron guardados.');
            loadClass();
        }
    };

    const handleRemoveEnrollment = (enrollment: any) => {
        useAlertStore.getState().showAlert(
            'Quitar inscripción',
            `¿Quitar a ${enrollment.profiles?.full_name} de esta clase?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Sí', style: 'destructive',
                    onPress: async () => {
                        await supabase.from('enrollments').update({ status: 'cancelled' }).eq('id', enrollment.id);
                        loadEnrollments();
                    }
                },
            ]
        );
    };

    const openAddStudent = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('role', ['student', 'admin', 'coach']) // Simplified to include everyone
            .eq('is_active', true)
            .order('full_name')
            .limit(1000);
        if (data) {
            // Filter out already enrolled students
            const enrolledIds = enrollments.map((e) => e.student_id);
            setStudents(data.filter((s: any) => !enrolledIds.includes(s.id)));
        }
        setShowAddModal(true);
    };

    const handleAddStudent = async (student: any) => {
        if (!id) return;
        setAdding(true);
        try {
            if (recurringEnabled) {
                const count = parseInt(replicationCount) || 1;
                const { availableClasses, conflicts } = await enrollmentsService.validateRecurringEnrollment(id, student.id, count);

                const performEnrollment = async (classes: any[]) => {
                    setAdding(true);
                    await enrollmentsService.enrollBatch(classes.map(c => c.id), student.id);
                    useAlertStore.getState().showAlert('✅ Éxito', `Alumno inscrito en ${classes.length} clases.`);
                    setShowAddModal(false);
                    setStudentSearch('');
                    setRecurringEnabled(false);
                    setReplicationCount('1');
                    loadEnrollments();
                    setAdding(false);
                };

                if (conflicts.length > 0) {
                    const conflictMsg = conflicts.map(c => `- ${c.date}: ${c.reason}`).join('\n');
                    useAlertStore.getState().showAlert(
                        'Conflictos detectados',
                        `No pudimos incluir todas las clases:\n\n${conflictMsg}\n\n¿Deseas inscribir al alumno solo en las ${availableClasses.length} clases disponibles?`,
                        [
                            { text: 'Cancelar', style: 'cancel', onPress: () => setAdding(false) },
                            { text: 'Inscribir disponibles', onPress: () => performEnrollment(availableClasses) }
                        ]
                    );
                } else {
                    await performEnrollment(availableClasses);
                }
            } else {
                const { error } = await supabase.from('enrollments').insert({
                    class_id: id,
                    student_id: student.id,
                    status: 'confirmed',
                });
                if (error) throw error;
                setShowAddModal(false);
                setStudentSearch('');
                loadEnrollments();
            }
        } catch (error: any) {
            useAlertStore.getState().showAlert('Error', error.message);
        } finally {
            setAdding(false);
        }
    };

    const filteredStudents = students.filter(
        (s) =>
            s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.email?.toLowerCase().includes(studentSearch.toLowerCase())
    );

    const availableSpots = cls ? cls.max_students - enrollments.length : 0;

    if (loading && !cls) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar Clase</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleDeleteClass} disabled={saving} style={styles.cancelHeaderBtn}>
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color={colors.primary[500]} /> : (
                            <Text style={styles.saveBtn}>Guardar</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.form}>
                {/* Info card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar" size={16} color={colors.primary[400]} />
                        <Text style={styles.infoText}>
                            {cls && format(new Date(cls.start_datetime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="location" size={16} color={colors.info} />
                        <Text style={styles.infoText}>{cls?.courts?.name}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={[styles.catDot, { backgroundColor: cls?.class_categories?.color }]} />
                        <Text style={styles.infoText}>{cls?.class_categories?.name}</Text>
                    </View>
                </View>

                {/* Editable fields */}
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} />

                <Text style={styles.label}>Cupos máximos</Text>
                <TextInput style={styles.input} value={maxStudents} onChangeText={setMaxStudents} keyboardType="number-pad" />


                {/* Category Selection */}
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

                {/* Coach Selection */}
                <Text style={styles.label}>Profesor</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCoachModal(true)}>
                    <Ionicons name="person" size={18} color={colors.primary[400]} />
                    <Text style={styles.pickerText}>
                        {selectedCoach ? selectedCoach.full_name : 'Seleccionar profesor...'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Enrollments */}
                <View style={styles.enrollHeader}>
                    <Text style={styles.label}>
                        Inscritos ({enrollments.length}/{maxStudents})
                    </Text>
                    <View style={[styles.spotsBadge, { backgroundColor: availableSpots > 0 ? colors.success + '20' : colors.error + '20' }]}>
                        <Text style={[styles.spotsText, { color: availableSpots > 0 ? colors.success : colors.error }]}>
                            {availableSpots > 0 ? `${availableSpots} cupos` : 'Lleno'}
                        </Text>
                    </View>
                </View>

                {enrollments.map((enrollment) => (
                    <View key={enrollment.id} style={styles.enrolledItem}>
                        <View style={styles.studentAvatar}>
                            <Text style={styles.avatarText}>{enrollment.profiles?.full_name?.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.studentName}>{enrollment.profiles?.full_name}</Text>
                            <Text style={styles.studentEmail}>{enrollment.profiles?.email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveEnrollment(enrollment)}>
                            <Ionicons name="close-circle" size={22} color={colors.error} />
                        </TouchableOpacity>
                    </View>
                ))}

                {availableSpots > 0 && (
                    <TouchableOpacity style={styles.addStudentBtn} onPress={openAddStudent}>
                        <Ionicons name="person-add" size={20} color={colors.primary[500]} />
                        <Text style={styles.addStudentText}>Agregar alumno manualmente</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Coach Selection Modal */}
            <Modal visible={showCoachModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Seleccionar Profesor</Text>
                            <TouchableOpacity onPress={() => setShowCoachModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            value={coachSearch}
                            onChangeText={setCoachSearch}
                            placeholder="Buscar profesor..."
                            placeholderTextColor={colors.textTertiary}
                        />
                        <FlatList
                            data={coaches.filter(c => c.full_name.toLowerCase().includes(coachSearch.toLowerCase()))}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.studentItem, selectedCoach?.id === item.id && styles.coachItemSel]}
                                    onPress={() => { setSelectedCoach(item); setShowCoachModal(false); }}
                                >
                                    <View style={styles.studentAvatar}>
                                        <Text style={styles.avatarText}>{item.full_name?.charAt(0)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.studentName}>{item.full_name}</Text>
                                        <Text style={styles.studentEmail}>{item.email}</Text>
                                    </View>
                                    {selectedCoach?.id === item.id && (
                                        <Ionicons name="checkmark-circle" size={22} color={colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {/* Add student modal */}
            <Modal visible={showAddModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Agregar Alumno</Text>
                            <TouchableOpacity onPress={() => { setShowAddModal(false); setStudentSearch(''); }}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            value={studentSearch}
                            onChangeText={setStudentSearch}
                            placeholder="Buscar alumno..."
                            placeholderTextColor={colors.textTertiary}
                            autoFocus
                            autoCapitalize="none"
                        />

                        {/* Replication Block */}
                        <View style={styles.recurringBlock}>
                            <View style={styles.recurringHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.recurringTitle}>Replicar Inscripción</Text>
                                    <Text style={styles.recurringSubtitle}>Inscribir en las próximas semanas</Text>
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

                        <Text style={[styles.label, { marginTop: spacing.xl }]}>Resultados</Text>
                        <FlatList
                            data={filteredStudents}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.studentItem}
                                    onPress={() => handleAddStudent(item)}
                                    disabled={adding}
                                >
                                    <View style={styles.studentAvatar}>
                                        <Text style={styles.avatarText}>{item.full_name?.charAt(0)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.studentName}>{item.full_name}</Text>
                                        <Text style={styles.studentEmail}>{item.email}</Text>
                                    </View>
                                    <Ionicons name="add-circle" size={22} color={colors.primary[500]} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.noResults}>No se encontraron alumnos</Text>
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
    center: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1, marginLeft: spacing.lg },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    cancelHeaderBtn: { padding: spacing.xs },
    saveBtn: { fontSize: 16, fontWeight: '600', color: colors.primary[500] },
    form: { paddingHorizontal: spacing.xl, paddingBottom: spacing['6xl'] },

    infoCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        padding: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    infoText: { fontSize: 14, color: colors.textSecondary, textTransform: 'capitalize' },
    catDot: { width: 10, height: 10, borderRadius: 5 },

    label: {
        fontSize: 14, fontWeight: '600', color: colors.textSecondary,
        marginTop: spacing.lg, marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    chipRow: { flexDirection: 'row', gap: spacing.sm },
    statusChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        borderRadius: borderRadius.full, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
    },
    statusChipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
    statusText: { fontSize: 13, fontWeight: '600', color: colors.text },
    statusTextActive: { color: colors.white },

    optionChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.full,
        borderWidth: 1, borderColor: colors.border,
    },
    optionChipText: { fontSize: 13, fontWeight: '600', color: colors.text },

    pickerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs,
    },
    pickerText: { flex: 1, fontSize: 15, color: colors.text },
    coachItemSel: { backgroundColor: colors.primary[500] + '15' },

    enrollHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: spacing.lg,
    },
    spotsBadge: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    spotsText: { fontSize: 12, fontWeight: '600' },

    enrolledItem: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginTop: spacing.sm,
    },
    studentAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.primary[500], justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '700', color: colors.white },
    studentName: { fontSize: 14, fontWeight: '600', color: colors.text },
    studentEmail: { fontSize: 11, color: colors.textSecondary },

    addStudentBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, borderWidth: 1, borderColor: colors.primary[500],
        borderStyle: 'dashed', borderRadius: borderRadius.md,
        paddingVertical: spacing.md, marginTop: spacing.md,
    },
    addStudentText: { fontSize: 14, fontWeight: '600', color: colors.primary[500] },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: spacing['2xl'], maxHeight: '70%',
    },
    modalHeaderRow: {
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
    studentItem: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    noResults: { textAlign: 'center', color: colors.textTertiary, paddingVertical: spacing.xl },

    // Recurring block
    recurringBlock: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    recurringHeader: { flexDirection: 'row', alignItems: 'center' },
    recurringTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    recurringSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    replicationInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    replicationLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
    replicationInput: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        width: 50,
        textAlign: 'center',
        color: colors.text,
        fontWeight: '700',
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.primary[500],
    },
});
