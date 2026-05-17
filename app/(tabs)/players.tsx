import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { TOURNAMENT_CATEGORIES } from '@/constants/tournamentOptions';
import { buildRankingRows, RankingRow } from '@/services/ranking';
import * as SecureStore from '@/utils/SecureStore';
import { useFocusEffect } from 'expo-router';
import { TennisSpinner } from '@/components/TennisSpinner';
import { PlayerProfileModal } from '@/components/players/PlayerProfileModal';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { notifyRankingChangesForManualAdjustment } from '@/services/pushNotifications';

type RankingScreenRow = RankingRow & {
    previousRank: number | null;
    isNewEntry: boolean;
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
    const [rankingRows, setRankingRows] = useState<RankingScreenRow[]>([]);
    const [modality, setModality] = useState<'singles' | 'dobles'>('singles');
    const [page, setPage] = useState(0);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [showPlayerProfile, setShowPlayerProfile] = useState(false);
    const [canEditRanking, setCanEditRanking] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<RankingScreenRow | null>(null);
    const [editingPoints, setEditingPoints] = useState('');
    const [savingManualPoints, setSavingManualPoints] = useState(false);

    const handlePlayerLongPress = (playerId: string) => {
        setSelectedPlayerId(playerId);
        setShowPlayerProfile(true);
    };

    const closeRankingEditor = (force = false) => {
        if (savingManualPoints && !force) return;
        setEditingPlayer(null);
        setEditingPoints('');
    };

    const openRankingEditor = (row: RankingScreenRow) => {
        if (!canEditRanking) {
            handlePlayerLongPress(row.playerId);
            return;
        }
        setEditingPlayer(row);
        setEditingPoints(String(row.manualPoints || 0));
    };

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

    const fetchManualPointsMap = async (orgId: string, category: string, currentModality: 'singles' | 'dobles') => {
        const { data, error } = await supabase
            .from('ranking_manual_adjustments')
            .select('player_id, points')
            .eq('organization_id', orgId)
            .eq('level', category)
            .eq('modality', currentModality);

        if (error) throw error;

        return (data || []).reduce((acc, row: any) => {
            const playerId = String(row?.player_id || '').trim();
            if (!playerId) return acc;
            acc[playerId] = Number(row?.points) || 0;
            return acc;
        }, {} as Record<string, number>);
    };

    const buildRankingSnapshot = async (orgId: string, category: string, currentModality: 'singles' | 'dobles') => {
        const { data: tournaments, error: tournamentsError } = await supabase
            .from('tournaments')
            .select('id, name, description, format, status, level, end_date, start_date, modality, created_at')
            .eq('organization_id', orgId)
            .eq('level', category)
            .in('status', ['completed', 'finalized', 'finished'])
            .order('end_date', { ascending: false });

        if (tournamentsError) throw tournamentsError;

        const completedTournaments = (tournaments || [])
            .filter((tournament: any) => {
                if (currentModality === 'dobles') return tournament.modality === 'dobles';
                return !tournament.modality || tournament.modality === 'singles';
            })
            .sort((leftTournament: any, rightTournament: any) => {
                const leftDate = new Date(leftTournament.end_date || leftTournament.start_date || 0).getTime();
                const rightDate = new Date(rightTournament.end_date || rightTournament.start_date || 0).getTime();
                if (rightDate !== leftDate) return rightDate - leftDate;
                const leftCreated = new Date(leftTournament.created_at || 0).getTime();
                const rightCreated = new Date(rightTournament.created_at || 0).getTime();
                return rightCreated - leftCreated;
            });

        const tournamentIds = completedTournaments.map((tournament: any) => tournament.id);
        const [matchesResult, registrationsResult, manualPointsByPlayer] = await Promise.all([
            tournamentIds.length
                ? supabase
                    .from('matches')
                    .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status')
                    .in('tournament_id', tournamentIds)
                : Promise.resolve({ data: [], error: null } as any),
            tournamentIds.length
                ? supabase
                    .from('registrations')
                    .select('player_id, tournament_id')
                    .in('tournament_id', tournamentIds)
                : Promise.resolve({ data: [], error: null } as any),
            fetchManualPointsMap(orgId, category, currentModality),
        ]);

        if (matchesResult.error) throw matchesResult.error;
        if (registrationsResult.error) throw registrationsResult.error;

        const matches = matchesResult.data || [];
        const registrations = registrationsResult.data || [];

        const matchesByTournament = matches.reduce((acc: Record<string, any[]>, match: any) => {
            acc[match.tournament_id] = [...(acc[match.tournament_id] || []), match];
            return acc;
        }, {} as Record<string, any[]>);

        const registrationsByTournament = registrations.reduce((acc: Record<string, any[]>, registration: any) => {
            acc[registration.tournament_id] = [...(acc[registration.tournament_id] || []), registration];
            return acc;
        }, {} as Record<string, any[]>);

        const playerIds = [...new Set([
            ...Object.keys(manualPointsByPlayer),
            ...registrations.map((registration: any) => registration.player_id),
            ...matches.flatMap((match: any) => [match.player_a_id, match.player_a2_id, match.player_b_id, match.player_b2_id]),
        ].filter(Boolean))];

        const profilesResult = playerIds.length
            ? await supabase
                .from('public_profiles')
                .select('id, name')
                .in('id', playerIds)
            : { data: [], error: null };

        if (profilesResult.error) throw profilesResult.error;

        const profileMap = (profilesResult.data || []).reduce((acc, currentProfile: any) => {
            acc[currentProfile.id] = currentProfile.name;
            return acc;
        }, {} as Record<string, string>);

        const currentRows = buildRankingRows(
            completedTournaments,
            matchesByTournament,
            registrationsByTournament,
            profileMap,
            manualPointsByPlayer
        );

        const previousRowsBase = buildRankingRows(
            completedTournaments.slice(1),
            matchesByTournament,
            registrationsByTournament,
            profileMap,
            manualPointsByPlayer
        );

        const previousRankMap: Record<string, number> = {};
        previousRowsBase.forEach((row) => {
            previousRankMap[row.playerId] = row.rank;
        });

        const hasHistory = completedTournaments.length > 1;
        const rows = currentRows.map((row) => {
            const previousRank = hasHistory && Object.prototype.hasOwnProperty.call(previousRankMap, row.playerId)
                ? previousRankMap[row.playerId]
                : null;
            return {
                ...row,
                previousRank,
                isNewEntry: hasHistory && previousRank === null && row.points > 0,
            } as RankingScreenRow;
        });

        return {
            rows,
            baseRows: currentRows,
            manualPointsByPlayer,
            completedTournaments,
        };
    };

    const loadRanking = async (category: string) => {
        setLoading(true);
        setRankingRows([]);
        try {
            const accessContext = await getCurrentUserAccessContext();
            const session = accessContext?.session;
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
                setCanEditRanking(false);
                setOrganizationName(storedOrgName || '');
                setRankingRows([]);
                return;
            }

            setCanEditRanking(canManageOrganization(accessContext, orgId));

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
            const snapshot = await buildRankingSnapshot(orgId, category, modality);
            setRankingRows(snapshot.rows);
            setPage(0);
        } catch (error) {
            setRankingRows([]);
        } finally {
            setLoading(false);
        }
    };

    const saveManualRankingPoints = async () => {
        if (!editingPlayer || !organizationId || !canEditRanking || savingManualPoints) return;

        const parsedPoints = Number(editingPoints.trim());
        if (!Number.isFinite(parsedPoints)) {
            Alert.alert('Puntaje inválido', 'Ingresa un número válido para el ajuste manual.');
            return;
        }

        setSavingManualPoints(true);
        try {
            const accessContext = await getCurrentUserAccessContext();
            const userId = accessContext?.session?.user?.id;
            if (!userId) throw new Error('No session');

            const previousSnapshot = await buildRankingSnapshot(organizationId, activeCategory, modality);

            const payload = {
                organization_id: organizationId,
                level: activeCategory,
                modality,
                player_id: editingPlayer.playerId,
                points: parsedPoints,
                created_by: userId,
                updated_by: userId,
            };

            const { data: existingAdjustment, error: existingError } = await supabase
                .from('ranking_manual_adjustments')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('level', activeCategory)
                .eq('modality', modality)
                .eq('player_id', editingPlayer.playerId)
                .maybeSingle();

            if (existingError) throw existingError;

            if (existingAdjustment?.id) {
                const { error: updateError } = await supabase
                    .from('ranking_manual_adjustments')
                    .update({ points: parsedPoints, updated_by: userId })
                    .eq('id', existingAdjustment.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('ranking_manual_adjustments')
                    .insert(payload);
                if (insertError) throw insertError;
            }

            const currentSnapshot = await buildRankingSnapshot(organizationId, activeCategory, modality);
            setRankingRows(currentSnapshot.rows);
            setPage(0);
            closeRankingEditor(true);

            await notifyRankingChangesForManualAdjustment({
                organizationId,
                level: activeCategory,
                modality,
                previousRows: previousSnapshot.baseRows,
                currentRows: currentSnapshot.baseRows,
                affectedPlayerId: editingPlayer.playerId,
            });
        } catch (error) {
            console.error('Error saving manual ranking points:', error);
            Alert.alert('Error', 'No se pudo guardar el cambio manual del ranking.');
        } finally {
            setSavingManualPoints(false);
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

    const renderMovement = (row: RankingScreenRow) => {
        if (row.previousRank === null) {
            if (row.isNewEntry) {
                return (
                    <View style={styles.movementRow}>
                        <Ionicons name="arrow-up" size={12} color={colors.success} />
                        <Text style={[styles.movementText, { color: colors.success }]}>N</Text>
                    </View>
                );
            }
            return <Text style={styles.movementNeutral}>-</Text>;
        }

        if (row.previousRank === row.rank) {
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
                {organizationId && canEditRanking ? (
                    <Text style={styles.adminHint}>Toque simple: editar puntaje manual. Mantener 2 segundos: perfil y enfrentamientos.</Text>
                ) : null}
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
                    <View style={styles.loadingState}>
                        <TennisSpinner size={34} />
                    </View>
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
                                        <Pressable
                                            key={topThree[0].playerId}
                                            style={[styles.podiumCard, styles.podiumCardFirst, styles.podiumCardFeatured]}
                                            onPress={() => openRankingEditor(topThree[0])}
                                            onLongPress={() => handlePlayerLongPress(topThree[0].playerId)}
                                            delayLongPress={2000}
                                        >
                                            <Text style={[styles.podiumPlace, styles.podiumPlaceFeatured]}>#1</Text>
                                            <Text style={[styles.podiumName, styles.podiumNameFeatured]}>{topThree[0].name}</Text>
                                            <Text style={[styles.podiumPoints, styles.podiumPointsFeatured]}>{topThree[0].points} pts</Text>
                                            {renderMovement(topThree[0])}
                                        </Pressable>
                                    )}

                                    <View style={styles.podiumSideColumn}>
                                        {topThree.slice(1, 3).map((row, index) => (
                                            <Pressable
                                                key={row.playerId}
                                                style={[
                                                    styles.podiumCard,
                                                    styles.podiumCardCompact,
                                                    index === 0 ? styles.podiumCardSecond : styles.podiumCardThird,
                                                ]}
                                                onPress={() => openRankingEditor(row)}
                                                onLongPress={() => handlePlayerLongPress(row.playerId)}
                                                delayLongPress={2000}
                                            >
                                                <Text style={styles.podiumPlace}>#{row.rank}</Text>
                                                <Text style={[styles.podiumName, styles.podiumNameCompact]}>{row.name}</Text>
                                                <Text style={[styles.podiumPoints, styles.podiumPointsCompact]}>{row.points} pts</Text>
                                                {renderMovement(row)}
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={styles.listCard}>
                            {listRows.map((row) => (
                                <Pressable
                                    key={row.playerId}
                                    style={styles.listRow}
                                    onPress={() => openRankingEditor(row)}
                                    onLongPress={() => handlePlayerLongPress(row.playerId)}
                                    delayLongPress={2000}
                                >
                                    <View style={styles.listLeft}>
                                        <Text style={styles.listRank}>#{row.rank}</Text>
                                        <View>
                                            <Text style={styles.listName}>{row.name}</Text>
                                            <Text style={styles.listPoints}>
                                                {row.points} puntos{canEditRanking ? ` · ajuste ${row.manualPoints >= 0 ? '+' : ''}${row.manualPoints}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    {renderMovement(row)}
                                </Pressable>
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

            <PlayerProfileModal
                visible={showPlayerProfile}
                playerId={selectedPlayerId}
                tournamentOrgId={organizationId}
                tournamentLevel={activeCategory}
                onClose={() => setShowPlayerProfile(false)}
            />

            <Modal
                visible={!!editingPlayer}
                transparent
                animationType="fade"
                onRequestClose={() => closeRankingEditor()}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Editar puntaje manual</Text>
                        <Text style={styles.modalSubtitle}>
                            {editingPlayer?.name || 'Jugador'} · {activeCategory} · {modality === 'dobles' ? 'Dobles' : 'Singles'}
                        </Text>
                        <TextInput
                            value={editingPoints}
                            onChangeText={setEditingPoints}
                            keyboardType="numeric"
                            style={styles.modalInput}
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            editable={!savingManualPoints}
                        />
                        <Text style={styles.modalHelper}>Ingresa cuantos puntos deseas agregar o restar al jugador.</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => closeRankingEditor()} disabled={savingManualPoints}>
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveManualRankingPoints} disabled={savingManualPoints}>
                                <Text style={styles.modalSaveText}>{savingManualPoints ? 'Guardando...' : 'Guardar'}</Text>
                            </TouchableOpacity>
                        </View>
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
    title: {
        color: colors.text,
        fontSize: 36,
        fontWeight: '900',
    },
    subtitle: {
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    adminHint: {
        color: colors.textTertiary,
        marginTop: spacing.sm,
        fontSize: 12,
        lineHeight: 18,
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
        textAlign: 'center',
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
        textAlign: 'center',
    },
    pageButtonTextActive: {
        color: '#fff',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    modalCard: {
        width: '100%',
        backgroundColor: colors.background,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '900',
    },
    modalSubtitle: {
        color: colors.textSecondary,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    modalInput: {
        height: 52,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: spacing.md,
        fontSize: 18,
        fontWeight: '700',
    },
    modalHelper: {
        color: colors.textTertiary,
        marginTop: spacing.sm,
        fontSize: 12,
        lineHeight: 18,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    modalCancelBtn: {
        flex: 1,
        height: 48,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    modalCancelText: {
        color: colors.textSecondary,
        fontWeight: '700',
    },
    modalSaveBtn: {
        flex: 1,
        height: 48,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary[500],
    },
    modalSaveText: {
        color: '#fff',
        fontWeight: '800',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 80,
    },
    loadingState: {
        minHeight: 260,
        alignItems: 'center',
        justifyContent: 'center',
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
        color: colors.textSecondary,
        textAlign: 'center'
    },
    modalityBtnTextActive: {
        color: colors.primary[500],
        fontWeight: '700'
    },
});





