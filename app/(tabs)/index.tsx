import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import * as SecureStore from 'expo-secure-store';
import { DateField } from '@/components/DateField';
import { CHILEAN_COMUNAS } from '@/constants/tournamentOptions';
import { Modal } from 'react-native';
import { resolveStorageAssetUrl } from '@/services/storage';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getCachedValue, setCachedValue } from '@/services/runtimeCache';

const { width } = Dimensions.get('window');

interface Organization {
    id: string;
    name: string;
    slug: string | null;
    created_at: string;
    logo_url: string | null;
    logo_signed_url?: string | null;
}

type OpenTournamentRef = {
    organization_id: string;
    comuna?: string | null;
    start_date?: string | null;
};

type HomeCachePayload = {
    savedAt: number;
    organizations: Organization[];
    openTournaments: OpenTournamentRef[];
};

const HOME_RUNTIME_CACHE_KEY = 'home:organizations:v1';
const HOME_CACHE_TTL_MS = 5 * 60_000;
const ORGANIZATIONS_UPDATED_AT_KEY = 'organizations_last_updated_at';

export default function InicioScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [sourceOrganizations, setSourceOrganizations] = useState<Organization[]>([]);
    const [openTournaments, setOpenTournaments] = useState<OpenTournamentRef[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedComuna, setSelectedComuna] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showComunaModal, setShowComunaModal] = useState(false);
    const lastSeenOrganizationsUpdatedAtRef = useRef<string | null>(null);

    useEffect(() => {
        loadOrganizationsSource();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            (async () => {
                const updatedAt = await SecureStore.getItemAsync(ORGANIZATIONS_UPDATED_AT_KEY);
                if (!active) return;

                if (updatedAt && updatedAt !== lastSeenOrganizationsUpdatedAtRef.current) {
                    lastSeenOrganizationsUpdatedAtRef.current = updatedAt;
                    await loadOrganizationsSource(true);
                }
            })();

            return () => {
                active = false;
            };
        }, [])
    );

    useEffect(() => {
        applyFilters();
    }, [sourceOrganizations, openTournaments, selectedComuna, selectedDate]);

    const applyFilters = () => {
        const tournamentsByOrg = openTournaments.reduce((acc, tournament) => {
            const key = tournament.organization_id;
            if (!key) return acc;
            acc[key] = [...(acc[key] || []), tournament];
            return acc;
        }, {} as Record<string, OpenTournamentRef[]>);

        let filtered = sourceOrganizations;
        if (selectedComuna || selectedDate) {
            filtered = sourceOrganizations.filter((org) => {
                const orgTournaments = tournamentsByOrg[org.id] || [];
                if (orgTournaments.length === 0) return false;
                return orgTournaments.some((tournament) => {
                    const matchComuna = !selectedComuna || tournament.comuna === selectedComuna;
                    const matchDate = !selectedDate || String(tournament.start_date || '') >= selectedDate;
                    return matchComuna && matchDate;
                });
            });
        }

        setOrganizations(filtered);
    };

    async function loadOrganizationsSource(forceRefresh = false) {
        setLoading(true);
        let hydratedFromCache = false;
        try {
            let cachedPayload = getCachedValue<HomeCachePayload>(HOME_RUNTIME_CACHE_KEY);

            if (cachedPayload) {
                setSourceOrganizations(cachedPayload.organizations);
                setOpenTournaments(cachedPayload.openTournaments);
                hydratedFromCache = true;
                const isCacheFresh = Date.now() - cachedPayload.savedAt < HOME_CACHE_TTL_MS;
                if (isCacheFresh && !forceRefresh) {
                    return;
                }
            }

            const { data: orgData, error: orgError } = await supabase
                .from('organizations_public')
                .select('id, name, slug, created_at, logo_url');
            if (orgError) throw orgError;

            const { data: tournamentData, error: tournamentsError } = await supabase
                .from('tournaments')
                .select('organization_id, comuna, start_date, status')
                .eq('status', 'open');

            const enrichedOrganizations = await Promise.all(
                ((orgData || []) as Organization[]).map(async (organization) => {
                    const signedLogo = await resolveStorageAssetUrl(organization.logo_url, 900);
                    const rawLogoUrl = String(organization.logo_url || '').trim();
                    const storageUrlFallback = /^https?:\/\//i.test(rawLogoUrl) && rawLogoUrl.includes('/storage/v1/object/')
                        ? rawLogoUrl
                        : null;

                    return {
                        ...organization,
                        logo_signed_url: signedLogo || storageUrlFallback,
                    };
                })
            );

            await Promise.allSettled(
                enrichedOrganizations
                    .map((organization) => organization.logo_signed_url)
                    .filter((url): url is string => Boolean(url))
                    .map((url) => Image.prefetch(url))
            );

            const nextPayload: HomeCachePayload = {
                savedAt: Date.now(),
                organizations: enrichedOrganizations,
                openTournaments: tournamentsError ? [] : ((tournamentData || []) as OpenTournamentRef[]),
            };

            setSourceOrganizations(nextPayload.organizations);
            setOpenTournaments(nextPayload.openTournaments);
            setCachedValue(HOME_RUNTIME_CACHE_KEY, nextPayload, HOME_CACHE_TTL_MS);
        } catch (error) {
            if (!hydratedFromCache) {
                setOrganizations([]);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            {/* Top Bar */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerLeft}>
                    <Ionicons name="tennisball" size={24} color={colors.primary[500]} />
                    <Text style={styles.logoText}>SweetSpot</Text>
                </View>
                <View style={{ width: 40, height: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Welcome Section */}
                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Explora Organizaciones</Text>
                    <Text style={styles.welcomeSubtitle}>Encuentra tu próximo club y únete a sus torneos</Text>
                </View>

                {/* Filter Section */}
                <View style={styles.filterSection}>
                    <View style={styles.filterRow}>
                        <TouchableOpacity 
                            style={[styles.filterChip, selectedComuna && styles.activeFilterChip]} 
                            onPress={() => setShowComunaModal(true)}
                        >
                            <Ionicons name="location-outline" size={16} color={selectedComuna ? '#fff' : colors.textTertiary} />
                            <Text style={[styles.filterChipText, selectedComuna && styles.activeFilterChipText]}>
                                {selectedComuna || 'Comuna'}
                            </Text>
                            {selectedComuna && (
                                <TouchableOpacity onPress={() => setSelectedComuna(null)}>
                                    <Ionicons name="close-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.filterChip, selectedDate && styles.activeFilterChip]}
                            onPress={() => {}} // DateField handles its own modal
                        >
                            <Ionicons name="calendar-outline" size={16} color={selectedDate ? '#fff' : colors.textTertiary} />
                            <DateField 
                                value={selectedDate || ''} 
                                onChange={(date) => setSelectedDate(date || null)}
                                label="" 
                                hideLabel
                                isCompact
                            />
                            {selectedDate && (
                                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                                    <Ionicons name="close-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Organizations Vitrine */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Clubes y Organizadores</Text>
                </View>

                {loading ? (
                    <TennisSpinner size={34} style={{ marginTop: 40 }} />
                ) : (
                    <View style={styles.orgGrid}>
                        {organizations.map((org) => (
                            <TouchableOpacity 
                                key={org.id} 
                                style={styles.orgCard}
                                onPress={async () => {
                                    await SecureStore.setItemAsync('selected_org_id', org.id);
                                    await SecureStore.setItemAsync('selected_org_name', org.name);
                                    router.push({
                                        pathname: '/(tabs)/tournaments',
                                        params: { orgId: org.id }
                                    });
                                }}
                            >
                                <View style={styles.orgIconContainer}>
                                    {org.logo_signed_url ? (
                                        <Image 
                                            source={{ uri: org.logo_signed_url, cache: 'force-cache' }} 
                                            style={styles.orgLogo}
                                            fadeDuration={0}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Ionicons name="business" size={40} color={colors.primary[500]} />
                                    )}
                                </View>
                                <Text style={styles.orgName}>{org.name}</Text>
                                <View style={styles.orgMeta}>
                                    <Ionicons name="trophy-outline" size={12} color={colors.textTertiary} />
                                    <Text style={styles.orgMetaText}>Ver torneos</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                        
                        {organizations.length === 0 && (
                            <View style={styles.emptyState}>
                                <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                                <Text style={styles.emptyText}>No se encontraron organizaciones disponibles.</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Selection Modal for Comuna */}
            <Modal visible={showComunaModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Seleccionar Comuna</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {CHILEAN_COMUNAS.map((comuna) => (
                                <TouchableOpacity 
                                    key={comuna} 
                                    style={styles.modalOption} 
                                    onPress={() => {
                                        setSelectedComuna(comuna);
                                        setShowComunaModal(false);
                                    }}
                                >
                                    <Text style={styles.modalOptionText}>{comuna}</Text>
                                    {selectedComuna === comuna && (
                                        <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setShowComunaModal(false)}>
                            <Text style={styles.modalCloseText}>Cancelar</Text>
                        </TouchableOpacity>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    logoText: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.primary[500],
        fontStyle: 'italic',
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: spacing.xl,
    },
    welcomeSection: {
        marginBottom: spacing['2xl'],
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: -0.5,
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    filterSection: {
        marginBottom: spacing.xl,
    },
    filterRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
    },
    activeFilterChip: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    filterChipText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeFilterChipText: {
        color: '#fff',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
    },
    orgGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    orgCard: {
        width: (width - spacing.xl * 2 - spacing.md) / 2,
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        gap: spacing.sm,
    },
    orgIconContainer: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
        overflow: 'hidden',
    },
    orgLogo: {
        width: '100%',
        height: '100%',
    },
    orgName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    orgMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    orgMetaText: {
        fontSize: 12,
        color: colors.textTertiary,
        fontWeight: '500',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        width: '100%',
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: spacing.md,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        width: '100%',
        padding: spacing.xl,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
        marginBottom: spacing.xl,
    },
    modalOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalOptionText: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '600',
    },
    modalClose: {
        marginTop: spacing.xl,
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    modalCloseText: {
        fontSize: 16,
        color: colors.primary[500],
        fontWeight: '700',
    },
});
