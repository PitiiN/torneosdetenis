import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, Image, Modal, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import AdminBottomBar from '@/components/AdminBottomBar';
import TennisLoading from '@/components/common/TennisLoading';
import { colors, spacing, borderRadius } from '@/theme';

const ROLE_LABELS: Record<string, string> = {
    'student': 'Alumno',
    'coach': 'Profesor',
    'admin': 'Admin'
};

export default function AdminStudentsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [students, setStudents] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
    const [loadingEnrollments, setLoadingEnrollments] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [historyMonth, setHistoryMonth] = useState(new Date());
    const [editJoinedAt, setEditJoinedAt] = useState('');
    const [savingDetails, setSavingDetails] = useState(false);

    const load = useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            // Remove role filter to ensure everyone is searchable in Alumnos screen
            .order('full_name', { ascending: true });

        if (data) setStudents(data);
        setIsLoaded(true);
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return students.filter((s: any) =>
            (s.full_name || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    const filteredEnrollments = useMemo(() => {
        const targetPrefix = `${historyMonth.getFullYear()}-${(historyMonth.getMonth() + 1).toString().padStart(2, '0')}`;

        return studentEnrollments.filter((enr: any) => {
            const dateStr = enr.classes?.start_datetime;
            return dateStr && dateStr.startsWith(targetPrefix);
        });
    }, [studentEnrollments, historyMonth]);

    if (!isLoaded) return <TennisLoading />;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Alumnos</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color={colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar alumno..."
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={filteredStudents}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.studentCard}
                        onPress={async () => {
                            setSelectedStudent(item);
                            setEditJoinedAt(item.joined_at || '');
                            setLoadingEnrollments(true);
                            const { data } = await supabase
                                .from('enrollments')
                                .select('*, classes(*)')
                                .eq('student_id', item.id)
                                .order('created_at', { ascending: false });
                            setStudentEnrollments(data || []);
                            setLoadingEnrollments(false);
                        }}
                    >
                        {item.avatar_url ? (
                            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>
                                    {item.full_name?.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{item.full_name}</Text>
                            <Text style={styles.studentEmail}>{item.email} · <Text style={{ color: colors.primary[400], fontWeight: '600' }}>{ROLE_LABELS[item.role] || item.role}</Text></Text>
                            {item.phone && (
                                <View style={styles.phoneRow}>
                                    <Ionicons name="call" size={12} color={colors.textTertiary} />
                                    <Text style={styles.studentPhone}>{item.phone}</Text>
                                </View>
                            )}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No se encontraron alumnos</Text>
                    </View>
                }
            />

            {/* Student Detail Modal */}
            <Modal visible={!!selectedStudent} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Detalles del Alumno</Text>
                            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                                {selectedStudent && editJoinedAt !== (selectedStudent.joined_at || '') && (
                                    <TouchableOpacity
                                        onPress={async () => {
                                            setSavingDetails(true);
                                            const { error } = await supabase.from('profiles').update({ joined_at: editJoinedAt || null }).eq('id', selectedStudent.id);
                                            setSavingDetails(false);
                                            if (error) {
                                                console.error(error);
                                            } else {
                                                setSelectedStudent({ ...selectedStudent, joined_at: editJoinedAt });
                                                load(); // Refresh list
                                            }
                                        }}
                                        disabled={savingDetails}
                                    >
                                        {savingDetails ? <ActivityIndicator size="small" color={colors.primary[500]} /> : <Ionicons name="save-outline" size={24} color={colors.primary[500]} />}
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {selectedStudent && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detailHeader}>
                                    <View style={styles.detailAvatar}>
                                        <Text style={styles.detailAvatarText}>
                                            {selectedStudent.full_name?.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.detailName}>{selectedStudent.full_name}</Text>
                                        <Text style={styles.detailEmail}>{selectedStudent.email}</Text>
                                    </View>
                                </View>

                                <View style={styles.infoGrid}>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>Teléfono</Text>
                                        <Text style={styles.infoValue}>{selectedStudent.phone || 'No registrado'}</Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>Nivel</Text>
                                        <Text style={styles.infoValue}>{selectedStudent.level || 'No definido'}</Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <Text style={styles.infoLabel}>Incorporación (AAAA-MM-DD)</Text>
                                        <TextInput
                                            style={styles.infoInput}
                                            value={editJoinedAt}
                                            onChangeText={setEditJoinedAt}
                                            placeholder="Ej: 2024-03-10"
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                    </View>
                                </View>

                                <View style={styles.historyHeader}>
                                    <Text style={styles.sectionTitle}>Historial de Clases</Text>
                                    <View style={styles.historyMonthSelector}>
                                        <TouchableOpacity onPress={() => setHistoryMonth(subMonths(historyMonth, 1))}>
                                            <Ionicons name="chevron-back" size={18} color={colors.text} />
                                        </TouchableOpacity>
                                        <Text style={styles.historyMonthText}>
                                            {format(historyMonth, 'MMM yyyy', { locale: es })}
                                        </Text>
                                        <TouchableOpacity onPress={() => setHistoryMonth(addMonths(historyMonth, 1))}>
                                            <Ionicons name="chevron-forward" size={18} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {loadingEnrollments ? (
                                    <ActivityIndicator color={colors.primary[500]} style={{ marginTop: 20 }} />
                                ) : filteredEnrollments.length === 0 ? (
                                    <Text style={styles.noEnrollments}>No hay clases este mes.</Text>
                                ) : (
                                    filteredEnrollments.map((enr) => {
                                        const isCancelled = enr.status !== 'confirmed';
                                        return (
                                            <View key={enr.id} style={styles.enrRow}>
                                                <View style={styles.enrInfo}>
                                                    <Text style={styles.enrTitle}>{enr.classes?.title}</Text>
                                                    <Text style={styles.enrDate}>
                                                        {enr.classes?.start_datetime ? format(new Date(enr.classes.start_datetime), "d MMM yyyy, HH:mm'h'", { locale: es }) : ''}
                                                    </Text>
                                                </View>
                                                <View style={[styles.enrBadge, { backgroundColor: isCancelled ? colors.error + '20' : colors.success + '20' }]}>
                                                    <Text style={[styles.enrBadgeText, { color: isCancelled ? colors.error : colors.success }]}>
                                                        {isCancelled ? 'Cancelada' : 'Confirmada'}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },

    searchBox: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        marginHorizontal: spacing.xl, marginBottom: spacing.lg,
        paddingHorizontal: spacing.md, height: 44,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },

    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

    studentCard: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
    avatarPlaceholder: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.primary[500] + '20',
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '700', color: colors.primary[500] },
    studentInfo: { flex: 1 },
    studentName: { fontSize: 16, fontWeight: '600', color: colors.text },
    studentEmail: { fontSize: 13, color: colors.textSecondary },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    studentPhone: { fontSize: 12, color: colors.textTertiary },

    empty: { alignItems: 'center', paddingVertical: spacing['6xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: spacing.xl, maxHeight: '85%', paddingBottom: spacing['5xl']
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.xl
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
    detailAvatar: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: colors.primary[500] + '20',
        justifyContent: 'center', alignItems: 'center'
    },
    detailAvatarText: { fontSize: 24, fontWeight: '700', color: colors.primary[500] },
    detailName: { fontSize: 20, fontWeight: '700', color: colors.text },
    detailEmail: { fontSize: 14, color: colors.textSecondary },

    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing['2xl'] },
    infoItem: { flex: 1, minWidth: '45%', backgroundColor: colors.background, padding: spacing.md, borderRadius: borderRadius.md },
    infoLabel: { fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 2 },
    infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },

    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        marginTop: spacing.sm,
    },
    historyMonthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
    },
    historyMonthText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
        textTransform: 'capitalize',
        minWidth: 70,
        textAlign: 'center',
    },
    noEnrollments: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl, fontStyle: 'italic' },
    enrRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border
    },
    enrInfo: { flex: 1, gap: 2 },
    enrTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    enrDate: { fontSize: 12, color: colors.textSecondary },
    enrBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    enrBadgeText: { fontSize: 10, fontWeight: '700' },
    infoInput: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        backgroundColor: colors.surfaceLight,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 4,
    },
});
