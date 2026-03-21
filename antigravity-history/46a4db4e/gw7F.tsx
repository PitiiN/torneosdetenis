import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AdminBottomBar from '@/components/AdminBottomBar';
import { colors, spacing, borderRadius } from '@/theme';
import { useEffect, useState } from 'react';
import { supabase } from '@/supabase/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Tournament {
    id: string;
    name: string;
    modality: string;
    category: string;
    format: string;
    status: string;
    start_date: string;
}

export default function AdminTournamentsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTournaments();
    }, []);

    const loadTournaments = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('tournaments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTournaments(data || []);
        } catch (error) {
            console.error('Error loading tournaments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'draft': return 'Borrador';
            case 'in_progress': return 'En Curso';
            case 'completed': return 'Finalizado';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return colors.textTertiary;
            case 'in_progress': return colors.success;
            case 'completed': return colors.primary[500];
            default: return colors.textSecondary;
        }
    };

    const getFormatText = (format: string) => {
        switch (format) {
            case 'eliminacion': return 'Eliminación Directa';
            case 'round-robin': return 'Round Robin';
            case 'consolacion': return 'Consolación';
            default: return format;
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Torneos</Text>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    {tournaments.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="trophy-outline" size={64} color={colors.border} />
                            <Text style={styles.emptyText}>No hay torneos creados aún.</Text>
                            <Text style={styles.emptySubText}>Toca el botón "+" para crear uno nuevo.</Text>
                        </View>
                    ) : (
                        tournaments.map((t) => (
                            <TouchableOpacity
                                key={t.id}
                                style={styles.card}
                                onPress={() => router.push(`/tournaments/${t.id}` as any)}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleContainer}>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(t.status) + '20' }]}>
                                            <Text style={[styles.statusText, { color: getStatusColor(t.status) }]}>
                                                {getStatusText(t.status)}
                                            </Text>
                                        </View>
                                        <Text style={styles.cardTitle}>{t.name}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                                </View>
                                <View style={styles.cardDetails}>
                                    <View style={styles.detailRow}>
                                        <Ionicons name="tennisball-outline" size={16} color={colors.textSecondary} />
                                        <Text style={styles.detailText}>{getFormatText(t.format)} - {t.category.toUpperCase()}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                                        <Text style={styles.detailText}>
                                            {t.start_date ? format(new Date(t.start_date), "d 'de' MMMM, yyyy", { locale: es }) : 'Fecha por definir'}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Floating Action Button */}
            <TouchableOpacity
                style={[styles.fab, { bottom: 100 }]} // Offset for bottom bar
                onPress={() => router.push('/tournaments/create' as any)}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: spacing.xl, paddingBottom: 150 }, // Extra padding for FAB
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
    emptySubText: { fontSize: 14, color: colors.textTertiary, marginTop: spacing.sm },

    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    cardTitleContainer: { flex: 1, paddingRight: spacing.md },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: spacing.sm },
    statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    cardDetails: { gap: spacing.sm },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    detailText: { fontSize: 14, color: colors.textSecondary },

    fab: {
        position: 'absolute',
        right: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 10,
    }
});
