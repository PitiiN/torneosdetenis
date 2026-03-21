import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import AdminBottomBar from '@/components/AdminBottomBar';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminStudentsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [students, setStudents] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const load = useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .order('full_name', { ascending: true });

        if (data) setStudents(data);
    }, []);

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(s =>
            (s.full_name || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

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
                    <View style={styles.studentCard}>
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
                            <Text style={styles.studentEmail}>{item.email}</Text>
                            {item.phone && (
                                <View style={styles.phoneRow}>
                                    <Ionicons name="call" size={12} color={colors.textTertiary} />
                                    <Text style={styles.studentPhone}>{item.phone}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No se encontraron alumnos</Text>
                    </View>
                }
            />
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
});
