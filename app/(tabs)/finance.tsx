import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

type Tournament = {
    id: string;
    name: string;
    start_date: string | null;
};

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEARS = [2026, 2027, 2028, 2029, 2030];

export default function FinanceScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [loading, setLoading] = useState(true);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(2026); // Default to 2026 as per request
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);

    const GLOBAL_ADMIN_EMAIL = 'javier.aravena25@gmail.com';

    useEffect(() => {
        loadTournaments();
    }, [selectedMonth, selectedYear]);

    const loadTournaments = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const isGlobal = session.user.email === GLOBAL_ADMIN_EMAIL;
            
            // Get profile to check role and org_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, org_id')
                .eq('id', session.user.id)
                .single();
            
            setUserProfile(profile);

            let storedOrgId = await SecureStore.getItemAsync('selected_org_id');
            let storedOrgName = await SecureStore.getItemAsync('selected_org_name');

            // Business Rule: Regular admins can ONLY see their assigned organization
            if (profile?.role === 'admin' && !isGlobal) {
                if (profile.org_id) {
                    storedOrgId = profile.org_id;
                    // Fetch real org name if restricted
                    const { data: orgData } = await supabase
                        .from('organizations')
                        .select('name')
                        .eq('id', profile.org_id)
                        .single();
                    storedOrgName = orgData?.name || '';
                } else {
                    // Admin without org cannot see anything
                    setTournaments([]);
                    setLoading(false);
                    return;
                }
            }

            setOrganizationId(storedOrgId);
            setOrganizationName(storedOrgName || '');

            if (!storedOrgId) {
                setTournaments([]);
                setLoading(false);
                return;
            }

            const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const monthEndDate = new Date(selectedYear, selectedMonth + 1, 0);
            const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

            const { data, error } = await supabase
                .from('tournaments')
                .select('id, name, start_date')
                .eq('organization_id', storedOrgId)
                .gte('start_date', monthStart)
                .lte('start_date', monthEnd)
                .order('start_date', { ascending: true });

            if (error) throw error;
            setTournaments(data || []);
        } catch (error) {
            console.error('Error loading tournaments for finance:', error);
            setTournaments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleTournamentPress = (tournamentId: string) => {
        router.push(`/(admin)/finance/${tournamentId}`);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <Text style={styles.title}>Finanzas</Text>
                <Text style={styles.subtitle}>{organizationName || 'Selecciona una organización en Inicio'}</Text>
            </View>

            <View style={styles.filtersSection}>
                {/* Year Selector - Now on top and carousel */}
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Año</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                        {YEARS.map((year) => (
                            <TouchableOpacity
                                key={year}
                                style={[styles.filterChip, selectedYear === year && styles.filterChipActive]}
                                onPress={() => setSelectedYear(year)}
                            >
                                <Text style={[styles.filterChipText, selectedYear === year && styles.filterChipTextActive]}>{year}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Month Selector */}
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Mes</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
                        {MONTHS.map((month, index) => (
                            <TouchableOpacity
                                key={month}
                                style={[styles.filterChip, selectedMonth === index && styles.filterChipActive]}
                                onPress={() => setSelectedMonth(index)}
                            >
                                <Text style={[styles.filterChipText, selectedMonth === index && styles.filterChipTextActive]}>{month}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: spacing.xl }} />
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Torneos del período ({tournaments.length})</Text>
                        {tournaments.length > 0 ? tournaments.map((tournament) => (
                            <TouchableOpacity
                                key={tournament.id}
                                style={styles.tournamentCard}
                                onPress={() => handleTournamentPress(tournament.id)}
                            >
                                <View style={styles.tournamentInfo}>
                                    <View style={styles.tournamentIcon}>
                                        <Ionicons name="trophy" size={20} color={colors.primary[500]} />
                                    </View>
                                    <View>
                                        <Text style={styles.tournamentName}>{tournament.name}</Text>
                                        <Text style={styles.tournamentDate}>
                                            {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString() : 'Sin fecha'}
                                        </Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                                <Text style={styles.emptyText}>No hay torneos para el período seleccionado.</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
    },
    subtitle: {
        color: colors.textSecondary,
        marginTop: spacing.xs,
        fontSize: 14,
    },
    filtersSection: {
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterGroup: {
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    filterLabel: {
        paddingHorizontal: spacing.xl,
        fontSize: 10,
        fontWeight: '900',
        color: colors.primary[500],
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    carouselContent: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    content: {
        padding: spacing.xl,
        paddingBottom: 40,
    },
    filterChip: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        minWidth: 60,
        alignItems: 'center',
    },
    filterChipActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    filterChipText: {
        color: colors.textSecondary,
        fontWeight: '700',
        fontSize: 14,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    section: {
        gap: spacing.md,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        marginBottom: spacing.xs,
    },
    tournamentCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tournamentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    tournamentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary[500] + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tournamentName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    tournamentDate: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: spacing.md,
    },
    emptyText: {
        color: colors.textTertiary,
        textAlign: 'center',
        fontSize: 14,
    },
});
