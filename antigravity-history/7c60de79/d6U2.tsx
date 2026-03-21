import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { enrollmentsService } from '@/services/enrollments.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function MyClassesScreen() {
    const { profile } = useAuth();
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

    const loadEnrollments = async () => {
        if (!profile) return;
        const { data } = await enrollmentsService.getStudentEnrollments(profile.id);
        if (data) setEnrollments(data);
    };

    useEffect(() => { loadEnrollments(); }, [profile]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadEnrollments();
        setRefreshing(false);
    };

    const now = new Date();
    const filtered = enrollments.filter((e) => {
        const classDate = new Date(e.classes?.start_datetime);
        return filter === 'upcoming' ? classDate >= now : classDate < now;
    });

    const handleCancel = (enrollmentId: string) => {
        Alert.alert(
            'Cancelar inscripción',
            '¿Estás seguro de que quieres cancelar esta inscripción?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Sí, cancelar',
                    style: 'destructive',
                    onPress: async () => {
                        await enrollmentsService.cancelEnrollment(enrollmentId);
                        loadEnrollments();
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Mis Clases</Text>
            </View>

            <View style={styles.filterRow}>
                {(['upcoming', 'past'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                            {f === 'upcoming' ? 'Próximas' : 'Pasadas'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => {
                    const cls = item.classes;
                    if (!cls) return null;
                    const isPast = new Date(cls.start_datetime) < now;
                    return (
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{cls.title}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: cls.status === 'cancelled' ? colors.error + '20' : colors.success + '20' }]}>
                                    <Text style={[styles.statusText, { color: cls.status === 'cancelled' ? colors.error : colors.success }]}>
                                        {cls.status === 'cancelled' ? 'Cancelada' : 'Programada'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.cardInfo}>
                                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                                <Text style={styles.infoText}>
                                    {format(new Date(cls.start_datetime), "EEEE d MMM, HH:mm", { locale: es })}
                                </Text>
                            </View>
                            <View style={styles.cardInfo}>
                                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                <Text style={styles.infoText}>{cls.courts?.name}</Text>
                            </View>
                            <View style={styles.cardInfo}>
                                <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                                <Text style={styles.infoText}>{cls.profiles?.full_name}</Text>
                            </View>
                            {!isPast && cls.status !== 'cancelled' && (
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
                                    <Text style={styles.cancelText}>Cancelar inscripción</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="tennisball-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>
                            {filter === 'upcoming' ? 'No tienes clases próximas' : 'No tienes clases pasadas'}
                        </Text>
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
    filterRow: {
        flexDirection: 'row', paddingHorizontal: spacing.xl,
        gap: spacing.sm, marginBottom: spacing.lg,
    },
    filterBtn: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        borderRadius: borderRadius.full, backgroundColor: colors.surface,
    },
    filterBtnActive: { backgroundColor: colors.primary[500] },
    filterText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    filterTextActive: { color: colors.white },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    card: {
        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        padding: spacing.lg, marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.sm,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
    statusText: { fontSize: 11, fontWeight: '600' },
    cardInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
    infoText: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
    cancelBtn: {
        marginTop: spacing.md, paddingVertical: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border,
        alignItems: 'center',
    },
    cancelText: { fontSize: 14, fontWeight: '600', color: colors.error },
    emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },
});
