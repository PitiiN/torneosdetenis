import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { canAccessAdminArea, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getCachedValue, setCachedValue } from '@/services/runtimeCache';

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
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    
    // Super Admin States
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [allOrganizations, setAllOrganizations] = useState<any[]>([]);
    const [showOrgModal, setShowOrgModal] = useState(false);
    const [orgSearch, setOrgSearch] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (organizationId) {
            loadTournaments();
        }
    }, [selectedMonth, selectedYear, organizationId]);

    const loadInitialData = async () => {
        const access = await getCurrentUserAccessContext();
        if (access) {
            setIsSuperAdmin(access.isSuperAdmin);
            if (access.isSuperAdmin) {
                await fetchAllOrganizations();
            }
        }
        await loadTournaments();
    };

    const fetchAllOrganizations = async () => {
        const cacheKey = 'finance:allOrganizations';
        const cached = getCachedValue<any[]>(cacheKey);
        if (cached) {
            setAllOrganizations(cached);
            return;
        }

        const { data, error } = await supabase
            .from('organizations_public')
            .select('id, name')
            .order('name');
        if (data && !error) {
            setAllOrganizations(data);
            setCachedValue(cacheKey, data, 5 * 60_000);
        }
    };

    const loadTournaments = async () => {
        setLoading(true);
        setOrganizationName('');
        try {
            const access = await getCurrentUserAccessContext();
            if (!access || !canAccessAdminArea(access)) {
                setTournaments([]);
                setOrganizationId(null);
                setOrganizationName('');
                router.replace('/(tabs)/payments');
                return;
            }

            let storedOrgId = await SecureStore.getItemAsync('selected_org_id');
            let storedOrgName = await SecureStore.getItemAsync('selected_org_name');

            if (!access.isSuperAdmin) {
                storedOrgId = access.profile.org_id || null;
                if (!storedOrgId) {
                    setTournaments([]);
                    setOrganizationId(null);
                    setOrganizationName('');
                    return;
                }
                await SecureStore.setItemAsync('selected_org_id', storedOrgId);

                const { data: ownOrganization } = await supabase
                    .from('organizations_public')
                    .select('name')
                    .eq('id', storedOrgId)
                    .single();
                storedOrgName = ownOrganization?.name || '';
                await SecureStore.setItemAsync('selected_org_name', storedOrgName || '');
            }

            if (!storedOrgId && access.isSuperAdmin) {
                const { data: latestTournament } = await supabase
                    .from('tournaments')
                    .select('organization_id')
                    .not('organization_id', 'is', null)
                    .order('start_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const latestOrgId = latestTournament?.organization_id || null;
                if (latestOrgId) {
                    storedOrgId = latestOrgId;
                    const { data: orgData } = await supabase
                        .from('organizations_public')
                        .select('name')
                        .eq('id', latestOrgId)
                        .single();
                    storedOrgName = orgData?.name || '';
                    await SecureStore.setItemAsync('selected_org_id', latestOrgId);
                    await SecureStore.setItemAsync('selected_org_name', storedOrgName || '');
                }
            }

            if (storedOrgId && !storedOrgName) {
                const { data: orgData } = await supabase
                    .from('organizations_public')
                    .select('name')
                    .eq('id', storedOrgId)
                    .single();

                storedOrgName = orgData?.name || '';
                await SecureStore.setItemAsync('selected_org_name', storedOrgName || '');
            }

            setOrganizationId(storedOrgId);
            setOrganizationName(storedOrgName || '');

            if (!storedOrgId) {
                setTournaments([]);
                setLoading(false);
                return;
            }

            const cacheKey = `finance:tournaments:${storedOrgId}:${selectedYear}:${selectedMonth}`;
            const cachedTournaments = getCachedValue<Tournament[]>(cacheKey);
            if (cachedTournaments) {
                setTournaments(cachedTournaments);
                setLoading(false);
            }

            let query = supabase
                .from('tournaments')
                .select('id, name, start_date')
                .eq('organization_id', storedOrgId)
                .order('start_date', { ascending: false });

            const yearStart = `${selectedYear}-01-01`;
            const yearEnd = `${selectedYear}-12-31`;
            query = query.gte('start_date', yearStart).lte('start_date', yearEnd);

            const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const monthEndDate = new Date(selectedYear, selectedMonth + 1, 0);
            const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;
            query = query.gte('start_date', monthStart).lte('start_date', monthEnd);

            const { data, error } = await query;

            if (error) throw error;
            const nextTournaments = data || [];
            setTournaments(nextTournaments);
            setCachedValue(cacheKey, nextTournaments, 60_000);
        } catch (error) {
            setTournaments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrganization = async (orgId: string, orgName: string) => {
        setOrganizationId(orgId);
        setOrganizationName(orgName);
        await SecureStore.setItemAsync('selected_org_id', orgId);
        await SecureStore.setItemAsync('selected_org_name', orgName);
        setShowOrgModal(false);
    };

    const handleTournamentPress = (tournamentId: string) => {
        router.push(`/(admin)/finance/${tournamentId}`);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerTitleRow}>
                    <View>
                        <Text style={styles.title}>Finanzas</Text>
                        <Text style={styles.subtitle}>{organizationName || 'Sin organización'}</Text>
                    </View>
                    {isSuperAdmin && (
                        <TouchableOpacity 
                            style={styles.changeOrgBtn}
                            onPress={() => setShowOrgModal(true)}
                        >
                            <Ionicons name="swap-horizontal" size={16} color="#fff" />
                            <Text style={styles.changeOrgBtnText}>Cambiar</Text>
                        </TouchableOpacity>
                    )}
                </View>
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
                    <TennisSpinner size={34} style={{ marginTop: spacing.xl }} />
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

            {/* Organization Selector Modal */}
            <Modal visible={showOrgModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Organización</Text>
                            <TouchableOpacity onPress={() => setShowOrgModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder="Buscar organización..."
                            placeholderTextColor={colors.textTertiary}
                            value={orgSearch}
                            onChangeText={setOrgSearch}
                        />

                        <ScrollView style={styles.orgList}>
                            {allOrganizations
                                .filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase()))
                                .map(org => (
                                    <TouchableOpacity 
                                        key={org.id} 
                                        style={[styles.orgItem, organizationId === org.id && styles.orgItemActive]}
                                        onPress={() => handleSelectOrganization(org.id, org.name)}
                                    >
                                        <Text style={[styles.orgItemText, organizationId === org.id && styles.orgItemTextActive]}>
                                            {org.name}
                                        </Text>
                                        {organizationId === org.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />}
                                    </TouchableOpacity>
                                ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    headerTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    changeOrgBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[500],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        gap: 6,
    },
    changeOrgBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius['3xl'],
        borderTopRightRadius: borderRadius['3xl'],
        padding: spacing.xl,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: colors.text,
    },
    modalSearchInput: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    orgList: {
        maxHeight: 300,
    },
    orgItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    orgItemActive: {
        backgroundColor: colors.primary[500] + '10',
    },
    orgItemText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    orgItemTextActive: {
        color: colors.primary[500],
        fontWeight: '800',
    },
});
