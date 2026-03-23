import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { TOURNAMENT_CATEGORIES } from '@/constants/tournamentOptions';
import { getTournamentPlacements } from '@/services/ranking';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from 'expo-router';
import { TennisSpinner } from '@/components/TennisSpinner';

type RankingRow = {
    playerId: string;
    name: string;
    points: number;
    rank: number;
    previousRank: number | null;
};

const NO_ORGANIZATION_MESSAGE = 'Por favor, selecciona una organización en la pestaña de Inicio para ver el ranking.';

const decodeEscapedUnicode = (value: unknown) =>
    String(value ?? '').replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );

export default function PlayersScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [activeCategory, setActiveCategory] = useState(TOURNAMENT_CATEGORIES[0]);
    const [loading, setLoading] = useState(true);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState('');
    const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
    const [modality, setModality] = useState<'singles' | 'dobles'>('singles');
    const [page, setPage] = useState(0);

    useEffect(() => {
        loadRanking(activeCategory);
    }, [activeCategory, modality]);

    useFocusEffect(
        React.useCallback(() => {
            loadRanking(activeCategory);
        }, [activeCategory, modality])
    );

    const resolveFallbackOrganizationId = async (currentUserId: string) => {
        const { data: recentRegistration } = await supabase
            .from('registrations')
            .select('tournaments:tournaments!inner(organization_id)')
            .eq('player_id', currentUserId)
            .order('registered_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const tournamentRef = (recentRegistration as any)?.tournaments;
        if (Array.isArray(tournamentRef)) {
            return tournamentRef[0]?.organization_id || null;
        }
        return tournamentRef?.organization_id || null;
    };

    const loadRanking = async (category: string) => {
        setLoading(true);
        setRankingRows([]);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) {
                setRankingRows([]);
                return;
            }

            const storedOrgId = await SecureStore.getItemAsync('selected_org_id');
            const storedOrgName = decodeEscapedUnicode((await SecureStore.getItemAsync('selected_org_name')) || '');
            if (storedOrgName) {
                setOrganizationName(storedOrgName);
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', session.user.id)
                .single();

            const fallbackOrgId = await resolveFallbackOrganizationId(session.user.id);
            const orgId = storedOrgId || profile?.org_id || fallbackOrgId || null;
            setOrganizationId(orgId);
            if (!orgId) {
                setOrganizationName(storedOrgName || '');
                setRankingRows([]);
                return;
            }

            const { data: organization } = await supabase
                .from('organizations_public')
                .select('name')
                .eq('id', orgId)
                .single();
            const organizationNameValue = decodeEscapedUnicode(organization?.name || '');
            setOrganizationName(organizationNameValue || storedOrgName || '');
            await SecureStore.setItemAsync('selected_org_id', orgId);
            await SecureStore.setItemAsync('selected_org_name', organizationNameValue);

            if (organizationNameValue === 'Chile Open' && category === 'Escalafón') {
                const { count } = await supabase
                    .from('tournaments')
                    .select('id', { count: 'exact', head: true })
                    .eq('organization_id', orgId)
                    .eq('level', category)
                    .in('status', ['completed', 'finalized', 'finished']);

                if (!count || count === 0) {
                    setRankingRows([]);
                    setPage(0);
                    return;
                }
            }

            const { data: tournaments, error: tournamentsError } = await supabase
                .from('tournaments')
                .select('id, name, description, format, status, level, end_date, start_date, modality')
                .eq('organization_id', orgId)
                .eq('level', category)
                .in('status', ['completed', 'finalized', 'finished'])
                .order('end_date', { ascending: false });

            if (tournamentsError) throw tournamentsError;

            const completedTournaments = (tournaments || []).filter((tournament: any) => {
                if (modality === 'dobles') return tournament.modality === 'dobles';
                return !tournament.modality || tournament.modality === 'singles';
            });
            if (completedTournaments.length === 0) {
                setRankingRows([]);
                return;
            }

            const tournamentIds = completedTournaments.map(tournament => tournament.id);
            const { data: matches, error: matchesError } = await supabase
                .from('matches')
                .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, score, status')
                .in('tournament_id', tournamentIds);

            if (matchesError) throw matchesError;

            const { data: registrations, error: registrationsError } = await supabase
                .from('registrations')
                .select('player_id')
                .in('tournament_id', tournamentIds);

            if (registrationsError) throw registrationsError;

            const matchesByTournament = (matches || []).reduce((acc, match: any) => {
                acc[match.tournament_id] = [...(acc[match.tournament_id] || []), match];
                return acc;
            }, {} as Record<string, any[]>);

            const buildRankingMap = (sourceTournaments: any[]) => {
                const totals: Record<string, number> = {};

                sourceTournaments.forEach((tournament: any) => {
                    const placements = getTournamentPlacements(tournament, matchesByTournament[tournament.id] || []);
                    placements.forEach((placement) => {
                        if (placement.playerId) {
                            totals[placement.playerId] = (totals[placement.playerId] || 0) + placement.points;
                        }
                        if (placement.playerId2) {
                            totals[placement.playerId2] = (totals[placement.playerId2] || 0) + placement.points;
                        }
                    });
                });

                return totals;
            };

            const currentTotals = buildRankingMap(completedTournaments);
            const previousTotals = buildRankingMap(completedTournaments.slice(1));
            const playerIds = [...new Set([
                ...Object.keys(currentTotals),
                ...Object.keys(previousTotals),
                ...((registrations || []).map((registration: any) => registration.player_id).filter(Boolean))
            ])];

            if (playerIds.length === 0) {
                setRankingRows([]);
                return;
            }

            const { data: profiles, error: profilesError } = await supabase
                .from('public_profiles')
                .select('id, name')
                .in('id', playerIds);

            if (profilesError) throw profilesError;

            const profileMap = (profiles || []).reduce((acc, currentProfile: any) => {
                acc[currentProfile.id] = currentProfile.name;
                return acc;
            }, {} as Record<string, string>);

            const currentSorted = Object.entries(currentTotals)
                .sort((a, b) => b[1] - a[1] || (profileMap[a[0]] || '').localeCompare(profileMap[b[0]] || ''))
                .map(([playerId, points], index) => ({
                    playerId,
                    name: profileMap[playerId] || 'Jugador',
                    points,
                    rank: index + 1,
                }));

            playerIds.forEach((playerId) => {
                if (currentSorted.find((row) => row.playerId === playerId)) return;
                currentSorted.push({
                    playerId,
                    name: profileMap[playerId] || 'Jugador',
                    points: 0,
                    rank: 0,
                });
            });

            currentSorted.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
            currentSorted.forEach((row, index) => {
                row.rank = index + 1;
            });

            const previousRankMap = Object.entries(previousTotals)
                .sort((a, b) => b[1] - a[1] || (profileMap[a[0]] || '').localeCompare(profileMap[b[0]] || ''))
                .reduce((acc, [playerId], index) => {
                    acc[playerId] = index + 1;
                    return acc;
                }, {} as Record<string, number>);

            let nextRows = currentSorted.map((row) => ({
                    ...row,
                    previousRank: previousRankMap[row.playerId] || null,
                }));

            setRankingRows(nextRows);
            setPage(0);
        } catch (error) {
            setRankingRows([]);
        } finally {
            setLoading(false);
        }
    };

    const pages = useMemo(() => {
        if (rankingRows.length <= 10) return [{ label: 'Top 10', start: 0, size: 10 }];

        const extraPages = [];
        let start = 10;
        while (start < rankingRows.length) {
            const end = Math.min(start + 20, rankingRows.length);
            extraPages.push({ label: `${start + 1}-${end}`, start, size: 20 });
            start += 20;
        }
        return [{ label: 'Top 10', start: 0, size: 10 }, ...extraPages];
    }, [rankingRows]);

    const visibleRows = useMemo(() => {
        const currentPage = pages[page] || pages[0];
        if (!currentPage) return [];
        return rankingRows.slice(currentPage.start, currentPage.start + currentPage.size);
    }, [page, pages, rankingRows]);

    const topThree = page === 0 ? visibleRows.slice(0, 3) : [];
    const listRows = page === 0 ? visibleRows.slice(3) : visibleRows;

    const renderMovement = (row: RankingRow) => {
        if (!row.previousRank || row.previousRank === row.rank) {
            return <Text style={styles.movementNeutral}>-</Text>;
        }

        if (row.rank < row.previousRank) {
            return (
                <View style={styles.movementRow}>
                    <Ionicons name="arrow-up" size={12} color={colors.success} />
                    <Text style={[styles.movementText, { color: colors.success }]}>{row.previousRank - row.rank}</Text>
                </View>
            );
        }

        return (
            <View style={styles.movementRow}>
                <Ionicons name="arrow-down" size={12} color={colors.error} />
                <Text style={[styles.movementText, { color: colors.error }]}>{row.rank - row.previousRank}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <Text style={styles.title}>Ranking</Text>
                <Text style={styles.subtitle}>
                    {organizationId
                        ? `${organizationName ? `${organizationName} · ` : ''}${activeCategory} · ${modality === 'dobles' ? 'Dobles' : 'Singles'}`
                        : NO_ORGANIZATION_MESSAGE}
                </Text>
            </View>

            <View style={styles.modalitySelectorContainer}>
                <View style={styles.modalitySelector}>
                    <TouchableOpacity 
                        style={[styles.modalityBtn, modality === 'singles' && styles.modalityBtnActive]}
                        onPress={() => setModality('singles')}
                    >
                        <Text style={[styles.modalityBtnText, modality === 'singles' && styles.modalityBtnTextActive]}>Singles</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modalityBtn, modality === 'dobles' && styles.modalityBtnActive]}
                        onPress={() => setModality('dobles')}
                    >
                        <Text style={[styles.modalityBtnText, modality === 'dobles' && styles.modalityBtnTextActive]}>Dobles</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
                    {TOURNAMENT_CATEGORIES.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[styles.filterButton, activeCategory === category && styles.filterButtonActive]}
                            onPress={() => setActiveCategory(category)}
                        >
                            <Text style={[styles.filterButtonText, activeCategory === category && styles.filterButtonTextActive]}>
                                {category}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {loading ? (
                    <TennisSpinner size={34} style={{ marginTop: spacing.xl }} />
                ) : !organizationId ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="business-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyTitle}>Organización no seleccionada</Text>
                        <Text style={styles.emptyText}>{NO_ORGANIZATION_MESSAGE}</Text>
                    </View>
                ) : rankingRows.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="podium-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyTitle}>Sin ranking disponible</Text>
                        <Text style={styles.emptyText}>Todavía no hay torneos finalizados en esta categoría.</Text>
                    </View>
                ) : (
                    <>
                        {page === 0 && (
                            <View style={styles.topThreeContainer}>
                                <View style={styles.podiumLayout}>
                                    {topThree[0] && (
                                        <View
                                            key={topThree[0].playerId}
                                            style={[styles.podiumCard, styles.podiumCardFirst, styles.podiumCardFeatured]}
                                        >
                                            <Text style={[styles.podiumPlace, styles.podiumPlaceFeatured]}>#1</Text>
                                            <Text style={[styles.podiumName, styles.podiumNameFeatured]}>{topThree[0].name}</Text>
                                            <Text style={[styles.podiumPoints, styles.podiumPointsFeatured]}>{topThree[0].points} pts</Text>
                                            {renderMovement(topThree[0])}
                                        </View>
                                    )}

                                    <View style={styles.podiumSideColumn}>
                                        {topThree.slice(1, 3).map((row, index) => (
                                            <View
                                                key={row.playerId}
                                                style={[
                                                    styles.podiumCard,
                                                    styles.podiumCardCompact,
                                                    index === 0 ? styles.podiumCardSecond : styles.podiumCardThird,
                                                ]}
                                            >
                                                <Text style={styles.podiumPlace}>#{row.rank}</Text>
                                                <Text style={[styles.podiumName, styles.podiumNameCompact]}>{row.name}</Text>
                                                <Text style={[styles.podiumPoints, styles.podiumPointsCompact]}>{row.points} pts</Text>
                                                {renderMovement(row)}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={styles.listCard}>
                            {listRows.map((row) => (
                                <View key={row.playerId} style={styles.listRow}>
                                    <View style={styles.listLeft}>
                                        <Text style={styles.listRank}>#{row.rank}</Text>
                                        <View>
                                            <Text style={styles.listName}>{row.name}</Text>
                                            <Text style={styles.listPoints}>{row.points} puntos</Text>
                                        </View>
                                    </View>
                                    {renderMovement(row)}
                                </View>
                            ))}
                        </View>

                        <View style={styles.paginationRow}>
                            {pages.map((pageItem, index) => (
                                <TouchableOpacity
                                    key={pageItem.label}
                                    style={[styles.pageButton, page === index && styles.pageButtonActive]}
                                    onPress={() => setPage(index)}
                                >
                                    <Text style={[styles.pageButtonText, page === index && styles.pageButtonTextActive]}>
                                        {pageItem.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
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
        color: colors.text,
        fontSize: 36,
        fontWeight: '900',
    },
    subtitle: {
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 120,
    },
    filterContainer: {
        gap: spacing.sm,
        paddingBottom: spacing.xl,
    },
    filterButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    filterButtonActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    filterButtonText: {
        color: colors.textSecondary,
        fontWeight: '700',
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    topThreeContainer: {
        marginBottom: spacing.xl,
    },
    podiumLayout: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'stretch',
    },
    podiumSideColumn: {
        flex: 1,
        gap: spacing.md,
    },
    podiumCard: {
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    podiumCardFeatured: {
        flex: 1.15,
        minHeight: 132,
        justifyContent: 'space-between',
    },
    podiumCardCompact: {
        minHeight: 62,
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    podiumCardFirst: {
        backgroundColor: '#F05A18',
        borderColor: '#FFB089',
    },
    podiumCardSecond: {
        backgroundColor: colors.isDark ? '#EFF3F8' : colors.surfaceSecondary,
        borderColor: colors.border,
    },
    podiumCardThird: {
        backgroundColor: colors.isDark ? '#F3F6EC' : colors.surfaceSecondary,
        borderColor: colors.border,
    },
    podiumPlace: {
        color: colors.primary[500],
        fontSize: 11,
        fontWeight: '800',
        marginBottom: spacing.xs,
    },
    podiumPlaceFeatured: {
        color: '#FFF3E8',
    },
    podiumName: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '900',
        marginBottom: spacing.xs,
    },
    podiumNameFeatured: {
        color: '#fff',
        fontSize: 20,
        lineHeight: 22,
    },
    podiumNameCompact: {
        fontSize: 14,
        lineHeight: 16,
        color: colors.text,
        marginBottom: 2,
    },
    podiumPoints: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    podiumPointsFeatured: {
        color: '#FFF3E8',
    },
    podiumPointsCompact: {
        color: colors.textSecondary,
        fontSize: 12,
        marginBottom: 2,
    },
    listCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    listRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    listLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    listRank: {
        color: colors.primary[500],
        fontWeight: '800',
        width: 36,
    },
    listName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    listPoints: {
        color: colors.textSecondary,
        fontSize: 13,
        marginTop: 2,
    },
    movementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    movementText: {
        fontSize: 12,
        fontWeight: '800',
    },
    movementNeutral: {
        color: colors.textTertiary,
        fontWeight: '700',
    },
    paginationRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.xl,
    },
    pageButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    pageButtonActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    pageButtonText: {
        color: colors.textSecondary,
        fontWeight: '700',
    },
    pageButtonTextActive: {
        color: '#fff',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        marginTop: spacing.md,
    },
    emptyText: {
        color: colors.textSecondary,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    modalitySelectorContainer: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
    },
    modalitySelector: { 
        flexDirection: 'row', 
        backgroundColor: colors.surfaceSecondary, 
        borderRadius: borderRadius.lg, 
        padding: 4,
    },
    modalityBtn: { 
        flex: 1, 
        paddingVertical: 8, 
        alignItems: 'center', 
        borderRadius: borderRadius.md 
    },
    modalityBtnActive: { 
        backgroundColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2 
    },
    modalityBtnText: { 
        fontSize: 13, 
        fontWeight: '600', 
        color: colors.textSecondary 
    },
    modalityBtnTextActive: { 
        color: colors.primary[500], 
        fontWeight: '700' 
    },
});




