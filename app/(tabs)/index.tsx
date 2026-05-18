import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import * as SecureStore from '@/utils/SecureStore';
import { DateField } from '@/components/DateField';
import { CHILEAN_COMUNAS } from '@/constants/tournamentOptions';
import { Modal } from 'react-native';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getCachedValue, setCachedValue } from '@/services/runtimeCache';

interface Organization {
    id: string;
    name: string;
    slug: string | null;
    created_at: string;
    logo_url: string | null;
    logo_signed_url?: string | null;
    logo_ready?: boolean;
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

const normalizeOrganizations = (organizations: Organization[]): Organization[] =>
    organizations.map((organization) => {
        const rawLogoUrl = String(organization.logo_url || '').trim();
        const signedLogoUrl = String(organization.logo_signed_url || '').trim();
        return {
            ...organization,
            logo_signed_url: signedLogoUrl || null,
            logo_ready: typeof organization.logo_ready === 'boolean'
                ? organization.logo_ready
                : Boolean(!rawLogoUrl || signedLogoUrl),
        };
    });

export default function InicioScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { width: screenWidth } = useWindowDimensions();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [sourceOrganizations, setSourceOrganizations] = useState<Organization[]>([]);
    const [openTournaments, setOpenTournaments] = useState<OpenTournamentRef[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedComuna, setSelectedComuna] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showComunaModal, setShowComunaModal] = useState(false);
    const lastSeenOrganizationsUpdatedAtRef = useRef<string | null>(null);
    const logoRetryInFlightRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        loadOrganizationsSource();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadOrganizationsSource(true);
        }, [])
    );

    useEffect(() => {
        applyFilters();
    }, [sourceOrganizations, openTournaments, selectedComuna, selectedDate]);

    const orgCardWidth = useMemo(() => {
        const horizontalPadding = spacing.xl * 2;
        const interCardGap = spacing.md;
        const availableWidth = screenWidth - horizontalPadding - interCardGap;
        const computed = Math.floor(availableWidth / 2);
        return Math.max(148, computed);
    }, [screenWidth]);

    const organizationsReadyToRender = useMemo(() => {
        if (loading) return false;
        return sourceOrganizations.every((org) => Boolean(org.logo_ready));
    }, [loading, sourceOrganizations]);

    const prepareOrganizationsForRender = useCallback(async (organizationsInput: Organization[]) => {
        const normalizedOrganizations = normalizeOrganizations(organizationsInput);

        const resolvedOrganizations = await Promise.all(
            normalizedOrganizations.map(async (organization) => {
                const rawLogoUrl = String(organization.logo_url || '').trim();
                const currentLogoUrl = String(organization.logo_signed_url || '').trim();

                if (!rawLogoUrl) {
                    return {
                        ...organization,
                        logo_signed_url: null,
                        logo_ready: true,
                    };
                }

                let finalLogoUrl = currentLogoUrl || null;
                if (!finalLogoUrl) {
                    const signedLogo = await resolveStorageAssetUrlWithRetry(rawLogoUrl, {
                        expiresInSeconds: 900,
                        attempts: 3,
                        baseDelayMs: 350,
                    });
                    const fallbackLogo = /^https?:\/\//i.test(rawLogoUrl) ? rawLogoUrl : null;
                    finalLogoUrl = signedLogo || fallbackLogo;
                }

                return {
                    ...organization,
                    logo_signed_url: finalLogoUrl,
                    logo_ready: true,
                };
            })
        );

        const logoUrlsToPrefetch = resolvedOrganizations
            .map((organization) => String(organization.logo_signed_url || '').trim())
            .filter(Boolean);

        if (logoUrlsToPrefetch.length > 0) {
            await Promise.allSettled(
                logoUrlsToPrefetch.map((logoUrl) => Image.prefetch(logoUrl))
            );
        }

        return resolvedOrganizations;
    }, []);

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

    const retryOrganizationLogo = useCallback(async (organization: Organization) => {
        const organizationId = String(organization?.id || '').trim();
        const rawLogoUrl = String(organization?.logo_url || '').trim();
        if (!organizationId || !rawLogoUrl) return;
        if (logoRetryInFlightRef.current.has(organizationId)) return;

        logoRetryInFlightRef.current.add(organizationId);
        try {
            const signedLogo = await resolveStorageAssetUrlWithRetry(rawLogoUrl, {
                expiresInSeconds: 900,
                attempts: 4,
                baseDelayMs: 350,
            });
            const fallbackLogo = /^https?:\/\//i.test(rawLogoUrl) ? rawLogoUrl : null;
            const nextLogoUrl = signedLogo || fallbackLogo;
            if (!nextLogoUrl) return;

            setSourceOrganizations((previousOrganizations) => {
                const nextOrganizations = previousOrganizations.map((currentOrganization) => {
                    if (currentOrganization.id !== organizationId) return currentOrganization;
                    if (currentOrganization.logo_signed_url === nextLogoUrl) return currentOrganization;
                    return {
                        ...currentOrganization,
                        logo_signed_url: nextLogoUrl,
                        logo_ready: true,
                    };
                });

                setCachedValue<HomeCachePayload>(
                    HOME_RUNTIME_CACHE_KEY,
                    {
                        savedAt: Date.now(),
                        organizations: nextOrganizations,
                        openTournaments,
                    },
                    HOME_CACHE_TTL_MS
                );

                return nextOrganizations;
            });
        } finally {
            logoRetryInFlightRef.current.delete(organizationId);
        }
    }, [openTournaments]);

    async function loadOrganizationsSource(forceRefresh = false) {
        const shouldShowSpinner = !sourceOrganizations.length && !openTournaments.length;
        if (shouldShowSpinner) {
            setLoading(true);
        }
        let hydratedFromCache = false;
        try {
            let cachedPayload = getCachedValue<HomeCachePayload>(HOME_RUNTIME_CACHE_KEY);

            if (cachedPayload && !forceRefresh) {
                const preparedCachedOrganizations = await prepareOrganizationsForRender(cachedPayload.organizations);
                setSourceOrganizations(preparedCachedOrganizations);
                setOpenTournaments(cachedPayload.openTournaments);
                hydratedFromCache = true;
                setLoading(false);
                const isCacheFresh = Date.now() - cachedPayload.savedAt < HOME_CACHE_TTL_MS;
                if (isCacheFresh) {
                    return;
                }
            }

            // Retrieve current user and followed organizations
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id || null;

            let followedOrgIds = new Set<string>();
            if (currentUserId) {
                const { data: followData } = await supabase
                    .from('organization_followers')
                    .select('organization_id')
                    .eq('user_id', currentUserId);

                if (followData) {
                    followedOrgIds = new Set(followData.map(f => f.organization_id));
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

            const baseOrganizations = ((orgData || []) as Organization[]).map((organization) => {
                const rawLogoUrl = String(organization.logo_url || '').trim();
                const externalLogoUrl = /^https?:\/\//i.test(rawLogoUrl)
                    ? rawLogoUrl
                    : null;

                return {
                    ...organization,
                    logo_signed_url: externalLogoUrl,
                    logo_ready: Boolean(externalLogoUrl || !rawLogoUrl),
                };
            });

            // Sort logic: 
            // 1st criterion: followed by user (alphabetically by name if multiple)
            // 2nd criterion: not followed (by creation date ascending - oldest first)
            baseOrganizations.sort((a, b) => {
                const aFollowed = followedOrgIds.has(a.id);
                const bFollowed = followedOrgIds.has(b.id);

                if (aFollowed && !bFollowed) return -1;
                if (!aFollowed && bFollowed) return 1;

                if (aFollowed && bFollowed) {
                    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
                }

                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateA - dateB;
            });

            const preparedOrganizations = await prepareOrganizationsForRender(baseOrganizations);

            const nextPayload: HomeCachePayload = {
                savedAt: Date.now(),
                organizations: preparedOrganizations,
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
            <View style={{ backgroundColor: '#fff', paddingTop: insets.top }}>
                <View style={styles.header}>
                    <View style={styles.headerCentered}>
                        <Image
                            source={require('../../assets/Logos/LogoLetrasHorizontal.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                    </View>
                </View>
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

                {loading || !organizationsReadyToRender ? (
                    <View style={styles.loadingState}>
                        <TennisSpinner size={34} />
                    </View>
                ) : (
                    <View style={styles.orgGrid}>
                        {organizations.map((org) => (
                            <TouchableOpacity 
                                key={org.id} 
                                style={[styles.orgCard, { width: orgCardWidth }]}
                                onPress={async () => {
                                    await SecureStore.setItemAsync('selected_org_id', org.id);
                                    await SecureStore.setItemAsync('selected_org_name', org.name);
                                    router.push({
                                        pathname: '/(tabs)/tournaments',
                                        params: { orgId: org.id }
                                    });
                                }}
                            >
                                <View style={styles.orgHeader}>
                                    <Text style={styles.orgName} numberOfLines={2}>{org.name}</Text>
                                </View>
                                <View style={styles.orgImageSection}>
                                    {org.logo_signed_url ? (
                                        <Image 
                                            source={{ uri: org.logo_signed_url, cache: 'force-cache' }} 
                                            style={styles.orgLogo}
                                            fadeDuration={0}
                                            resizeMode="cover"
                                            onError={() => {
                                                retryOrganizationLogo(org);
                                            }}
                                        />
                                    ) : (
                                        <View style={styles.orgFallback} />
                                    )}
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
        paddingTop: 0,
        paddingBottom: 0,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        height: 72,
        overflow: 'hidden',
    },
    headerCentered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerLogo: {
        width: 360,
        height: 88,
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
        alignItems: 'center',
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
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
        textAlign: 'center',
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
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        minHeight: 260,
    },
    orgHeader: {
        minHeight: 78,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        maxHeight: '25%',
    },
    orgImageSection: {
        flex: 3,
        minHeight: 195,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    orgLogo: {
        width: '100%',
        height: '100%',
    },
    orgFallback: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surfaceSecondary,
    },
    orgName: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 22,
        width: '100%',
        flexShrink: 1,
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
    loadingState: {
        minHeight: 260,
        alignItems: 'center',
        justifyContent: 'center',
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
        textAlign: 'center',
    },
});
