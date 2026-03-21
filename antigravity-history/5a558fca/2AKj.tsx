import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminClassesListScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [classes, setClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const { data } = await supabase
            .from('classes')
            .select('*, courts (name), class_categories (name, color), profiles!classes_coach_id_fkey (full_name)')
            .order('start_datetime', { ascending: false })
            .limit(50);
        if (data) setClasses(data);
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Clases</Text>
                <TouchableOpacity onPress={() => router.push('/(admin)/classes/create')}>
                    <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={classes}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => {
                    const isPast = new Date(item.start_datetime) < new Date();
                    return (
                        <TouchableOpacity
                            style={[styles.card, isPast && styles.cardPast]}
                            onPress={() => router.push(`/(admin)/classes/${item.id}`)}
                        >
                            <View style={[styles.colorBar, { backgroundColor: item.class_categories?.color || colors.primary[500] }]} />
                            <View style={styles.cardContent}>
                                <View style={styles.cardRow}>
                                    <Text style={styles.className}>{item.title}</Text>
                                    <View style={[styles.statusBadge, {
                                        backgroundColor: item.status === 'scheduled' ? colors.success + '20' :
                                            item.status === 'cancelled' ? colors.error + '20' : colors.textTertiary + '20',
                                    }]}>
                                        <Text style={[styles.statusText, {
                                            color: item.status === 'scheduled' ? colors.success :
                                                item.status === 'cancelled' ? colors.error : colors.textTertiary,
                                        }]}>
                                            {item.status === 'scheduled' ? 'Programada' :
                                                item.status === 'cancelled' ? 'Cancelada' : 'Completada'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.classDetail}>
                                    {format(new Date(item.start_datetime), "EEE d MMM, HH:mm", { locale: es })} · {item.courts?.name}
                                </Text>
                                <Text style={styles.classCoach}>
                                    {item.profiles?.full_name || 'Sin profesor'} · {item.class_categories?.name} · Cupos: {item.max_students}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay clases creadas</Text>
                        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(admin)/classes/create')}>
                            <Text style={styles.createBtnText}>Crear primera clase</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
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
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

    card: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    cardPast: { opacity: 0.6 },
    colorBar: { width: 4, height: 44, borderRadius: 2 },
    cardContent: { flex: 1, gap: 2 },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    className: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
    statusText: { fontSize: 10, fontWeight: '600' },
    classDetail: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
    classCoach: { fontSize: 11, color: colors.textTertiary },

    empty: { alignItems: 'center', paddingVertical: spacing['6xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },
    createBtn: {
        backgroundColor: colors.primary[500], paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md, borderRadius: borderRadius.lg,
    },
    createBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
});
