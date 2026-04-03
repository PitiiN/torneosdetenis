import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { useTheme, spacing, borderRadius } from '@/theme';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { createInitialMatches, getRoundRobinGroupNames, getRoundRobinSlots, getSetsToShow, hasConsolationBracket, isRoundRobinFormat } from '@/services/tournamentStructure';
import { DateField } from '@/components/DateField';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { resolveStorageAssetUrl } from '@/services/storage';
import { AdminQuickActionsBar } from '@/components/navigation/AdminQuickActionsBar';
import { getTournamentPlacements } from '@/services/ranking';
import { formatDateDDMMYYYY, formatTime24, parseTimeRelaxed } from '@/utils/datetime';
import {
    buildDescriptionWithChampion,
    extractChampionFromDescription,
    resolveChampionFromMatches,
    syncTournamentChampion
} from '@/services/tournamentChampion';
import { notifyTournamentUsers } from '@/services/pushNotifications';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURT_OPTIONS = Array.from({ length: 20 }, (_current, index) => `Cancha ${index + 1}`);
type MatchSlot = 1 | 2 | 3 | 4;
type GroupMember = 1 | 2;
type ManualParticipantRow = { id: string; name: string };
type ManualDoublesTeam = { p1Name: string; p2Name: string; p1Id?: string | null; p2Id?: string | null };
type ManualDoublesTeamRow = {
    id: string;
    p1Name: string;
    p2Name: string;
    p1Id: string | null;
    p2Id: string | null;
    label: string;
};
type AssignmentTarget =
    | { type: 'match'; label: string; matchId: string; slot: MatchSlot }
    | { type: 'group'; label: string; groupName: string; slotIndex: number; member: GroupMember };

export default function AdminTournamentDetailScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors); // Assuming getStyles is defined elsewhere or needs to be added.

    const [tournament, setTournament] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [playerAvatarById, setPlayerAvatarById] = useState<Record<string, string | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('main');

    // Score Edit Modal
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [setScores, setSetScores] = useState<{ s1: string, s2: string }[]>([
        { s1: '', s2: '' },
        { s1: '', s2: '' },
        { s1: '', s2: '' }
    ]);
    const scoreInputRefs = useRef<Array<TextInput | null>>([]);
    const [savingMatch, setSavingMatch] = useState(false);

    const IS_DOUBLES = tournament?.modality === 'dobles';
    const MATCH_HEIGHT = IS_DOUBLES ? 180 : 130;
    const ROUND_GAP = 24;

    // Player Selection Modal
    const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ matchId: string, slot: MatchSlot } | null>(null);
    const [selectedGroupSlot, setSelectedGroupSlot] = useState<{ groupName: string, slotIndex: number, member: GroupMember } | null>(null);
    const [assignmentTargets, setAssignmentTargets] = useState<AssignmentTarget[]>([]);
    const [activeAssignmentIndex, setActiveAssignmentIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [manualPlayerName, setManualPlayerName] = useState('');
    const [manualPlayerName2, setManualPlayerName2] = useState('');
    const [isManualPlayerModalVisible, setIsManualPlayerModalVisible] = useState(false);
    const [manualCreationMode, setManualCreationMode] = useState<'assignment' | 'participants'>('assignment');
    const [savingPlayer, setSavingPlayer] = useState(false);
    const [pendingDoublesTeamIds, setPendingDoublesTeamIds] = useState<string[]>([]);
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSeedCountModalVisible, setIsSeedCountModalVisible] = useState(false);
    const [seedCountInput, setSeedCountInput] = useState('');
    const [seedCountLimit, setSeedCountLimit] = useState(0);
    const [isFinalsCountModalVisible, setIsFinalsCountModalVisible] = useState(false);
    const [finalsCountInput, setFinalsCountInput] = useState('4');
    const tournamentDescriptionRef = useRef<string | null | undefined>(null);
    const playerSearchBottomPadding = insets.bottom + spacing['3xl'];

    // Scheduling Modal
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        date: '',
        time: '',
        court: ''
    });
    const [isCourtPickerVisible, setIsCourtPickerVisible] = useState(false);
    const [savingSchedule, setSavingSchedule] = useState(false);

    useEffect(() => {
        tournamentDescriptionRef.current = tournament?.description;
    }, [tournament?.description]);

    const goBackToParentOrTournaments = useCallback(() => {
        if (tournament?.parent_tournament_id) {
            router.replace(`/(admin)/tournaments/master/${tournament.parent_tournament_id}` as any);
            return;
        }

        router.push({ pathname: '/(tabs)/tournaments', params: { orgId: tournament?.organization_id } } as any);
    }, [router, tournament?.organization_id, tournament?.parent_tournament_id]);

    const padTwo = (value: number) => String(value).padStart(2, '0');
    const formatScheduleDate = (scheduledAt?: string | null) => {
        if (!scheduledAt) return null;
        return formatDateDDMMYYYY(scheduledAt);
    };
    const formatScheduleTime = (scheduledAt?: string | null) => {
        if (!scheduledAt) return null;
        return formatTime24(scheduledAt);
    };
    const getNotifiablePlayerIdsFromMatch = (match: any) => {
        const candidateIds = [match?.player_a_id, match?.player_a2_id, match?.player_b_id, match?.player_b2_id]
            .map((value) => String(value || '').trim())
            .filter((value) => UUID_PATTERN.test(value));
        return [...new Set(candidateIds)];
    };
    const isMatchFullyDefinedForNotification = (match: any) => {
        if (!match) return false;
        if (IS_DOUBLES) {
            return [match?.player_a_id, match?.player_a2_id, match?.player_b_id, match?.player_b2_id]
                .every((value) => UUID_PATTERN.test(String(value || '').trim()));
        }
        return [match?.player_a_id, match?.player_b_id]
            .every((value) => UUID_PATTERN.test(String(value || '').trim()));
    };
    const buildMatchPairingLabel = (match: any) => {
        const teamA = IS_DOUBLES
            ? `${getDisplayName(match, 1)} / ${getDisplayName(match, 2)}`
            : getDisplayName(match, 1);
        const teamB = IS_DOUBLES
            ? `${getDisplayName(match, 3)} / ${getDisplayName(match, 4)}`
            : getDisplayName(match, 3);
        return `${teamA} vs ${teamB}`;
    };
    const notifyDefinedKnockoutMatch = async (match: any) => {
        const tournamentId = String(id || '').trim();
        if (!UUID_PATTERN.test(tournamentId)) return;

        const recipientIds = getNotifiablePlayerIdsFromMatch(match);
        if (!recipientIds.length) return;

        await notifyTournamentUsers({
            tournamentId,
            userIds: recipientIds,
            type: 'next_match_defined',
            title: 'Nuevo enfrentamiento definido',
            body: `Tu proximo partido ya esta definido: ${buildMatchPairingLabel(match)}.`,
            matchId: String(match?.id || '').trim() || null,
            data: {
                type: 'next_match_defined',
                tournamentId,
                matchId: String(match?.id || '').trim() || null,
            },
        });
    };
    const notifyScheduledMatchUpdate = async (match: any, nextScheduledAt: string | null, nextCourt: string) => {
        const tournamentId = String(id || '').trim();
        if (!UUID_PATTERN.test(tournamentId)) return;

        const recipientIds = getNotifiablePlayerIdsFromMatch(match);
        if (!recipientIds.length) return;

        const dateLabel = nextScheduledAt ? (formatScheduleDate(nextScheduledAt) || 'Sin fecha') : 'Sin fecha';
        const timeLabel = nextScheduledAt ? (formatScheduleTime(nextScheduledAt) || '') : '';
        const courtLabel = nextCourt || 'Cancha por definir';
        const scheduleLabel = `${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}`.trim();

        await notifyTournamentUsers({
            tournamentId,
            userIds: recipientIds,
            type: 'match_schedule_updated',
            title: 'Partido reprogramado',
            body: `Se actualizo el partido ${buildMatchPairingLabel(match)}. Nueva programacion: ${scheduleLabel} - ${courtLabel}.`,
            matchId: String(match?.id || '').trim() || null,
            data: {
                type: 'match_schedule_updated',
                tournamentId,
                matchId: String(match?.id || '').trim() || null,
            },
        });
    };

    const collectPlayerIds = (registrations: any[], tournamentMatches: any[]) => {
        const ids = new Set<string>();

        (registrations || []).forEach((registration: any) => {
            const playerId = String(registration?.player_id || '');
            if (UUID_PATTERN.test(playerId)) {
                ids.add(playerId);
            }
        });

        (tournamentMatches || []).forEach((match: any) => {
            [match?.player_a_id, match?.player_a2_id, match?.player_b_id, match?.player_b2_id].forEach((playerId) => {
                if (typeof playerId === 'string' && UUID_PATTERN.test(playerId)) {
                    ids.add(playerId);
                }
            });
        });

        return [...ids];
    };

    const fetchPublicProfileMap = async (playerIds: string[]) => {
        if (playerIds.length === 0) {
            return {} as Record<string, { name: string; avatarUrl: string | null }>;
        }

        const { data: publicProfiles, error: publicProfilesError } = await supabase
            .from('public_profiles')
            .select('id, name, avatar_url')
            .in('id', playerIds);

        if (publicProfilesError) throw publicProfilesError;

        const avatarPathById = (publicProfiles || []).reduce((acc: Record<string, string>, profile: any) => {
            const avatarPath = String(profile?.avatar_url || '').trim();
            if (avatarPath) acc[profile.id] = avatarPath;
            return acc;
        }, {});

        const signedAvatarByPath = new Map<string, string | null>();
        await Promise.all(
            Object.values(avatarPathById).map(async (path) => {
                if (signedAvatarByPath.has(path)) return;
                const signedAvatar = await resolveStorageAssetUrl(path);
                signedAvatarByPath.set(path, signedAvatar || null);
            })
        );

        return (publicProfiles || []).reduce((acc: Record<string, { name: string; avatarUrl: string | null }>, profile: any) => {
            const avatarPath = String(profile?.avatar_url || '').trim();
            acc[profile.id] = {
                name: profile.name || 'Jugador',
                avatarUrl: avatarPath ? (signedAvatarByPath.get(avatarPath) || null) : null,
            };
            return acc;
        }, {});
    };

    const resolveHydratedProfile = (
        playerId: string | null | undefined,
        profileMapById: Record<string, { name: string; avatarUrl: string | null }>
    ) => {
        if (!playerId) return null;
        if (playerId === 'BYE') return { id: playerId, name: 'BYE' };
        const profile = profileMapById[playerId];
        return {
            id: playerId,
            name: profile?.name || 'Desconocido',
            avatar_url: profile?.avatarUrl || null,
        };
    };

    const hydrateRegistrations = (
        registrations: any[],
        profileMapById: Record<string, { name: string; avatarUrl: string | null }>
    ) =>
        (registrations || []).map((registration: any) => ({
            ...registration,
            profiles: registration.player_id
                ? {
                    id: registration.player_id,
                    name: profileMapById[registration.player_id]?.name || 'Desconocido',
                    avatar_url: profileMapById[registration.player_id]?.avatarUrl || null,
                }
                : null,
        }));

    const hydrateMatches = (
        tournamentMatches: any[],
        profileMapById: Record<string, { name: string; avatarUrl: string | null }>
    ) =>
        (tournamentMatches || []).map((match: any) => ({
            ...match,
            player_a: resolveHydratedProfile(match.player_a_id, profileMapById),
            player_b: resolveHydratedProfile(match.player_b_id, profileMapById),
            player_a2: resolveHydratedProfile(match.player_a2_id, profileMapById),
            player_b2: resolveHydratedProfile(match.player_b2_id, profileMapById),
        }));

    const normalizeManualNameKey = (value?: string | null) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();

    const normalizeTeamMemberKey = (name?: string | null, id?: string | null) => {
        const normalizedId = String(id || '').trim();
        if (UUID_PATTERN.test(normalizedId)) return normalizedId.toUpperCase();
        return normalizeManualNameKey(name);
    };

    const buildManualDoublesTeamKey = (team: ManualDoublesTeam) => {
        const memberA = normalizeTeamMemberKey(team.p1Name, team.p1Id);
        const memberB = normalizeTeamMemberKey(team.p2Name, team.p2Id);
        if (!memberA || !memberB) return '';
        return [memberA, memberB].sort().join('::');
    };

    const parseManualAssignments = (description?: string | null) => {
        const match = (description || '').match(/\[MANUAL_ASSIGNMENTS:([^\]]+)\]/);
        if (!match?.[1]) {
            return {
                rrSlots: {},
                matchSlots: {}
            } as {
                rrSlots: Record<string, Record<string, { name: string }>>;
                matchSlots: Record<string, Record<string, { name: string }>>;
            };
        }

        try {
            return JSON.parse(decodeURIComponent(match[1]));
        } catch {
            return { rrSlots: {}, matchSlots: {} };
        }
    };

    const parseManualParticipants = (description?: string | null) => {
        const match = (description || '').match(/\[MANUAL_PARTICIPANTS:([^\]]+)\]/);
        if (!match?.[1]) {
            return {
                singles: [],
                doubles: []
            } as {
                singles: string[];
                doubles: ManualDoublesTeam[];
            };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(match[1]));
            const parsedSinglesRaw = Array.isArray(parsed)
                ? parsed
                : (Array.isArray(parsed?.singles) ? parsed.singles : []);
            const parsedDoublesRaw = Array.isArray(parsed?.doubles) ? parsed.doubles : [];

            const seenSingles = new Set<string>();
            const singles = parsedSinglesRaw
                .map((entry: any) => String(entry || '').trim())
                .filter(Boolean)
                .filter((name: string) => {
                    const key = normalizeManualNameKey(name);
                    if (!key || seenSingles.has(key)) return false;
                    seenSingles.add(key);
                    return true;
                });

            const seenTeams = new Set<string>();
            const doubles = parsedDoublesRaw
                .map((entry: any) => ({
                    p1Name: String(entry?.p1Name || '').trim(),
                    p2Name: String(entry?.p2Name || '').trim(),
                    p1Id: UUID_PATTERN.test(String(entry?.p1Id || '').trim()) ? String(entry?.p1Id || '').trim() : null,
                    p2Id: UUID_PATTERN.test(String(entry?.p2Id || '').trim()) ? String(entry?.p2Id || '').trim() : null
                }))
                .filter((entry: { p1Name: string; p2Name: string }) => entry.p1Name && entry.p2Name)
                .filter((entry: ManualDoublesTeam) => {
                    const teamKey = buildManualDoublesTeamKey(entry);
                    if (!teamKey || seenTeams.has(teamKey)) return false;
                    seenTeams.add(teamKey);
                    return true;
                });

            return { singles, doubles };
        } catch {
            return { singles: [], doubles: [] };
        }
    };

    const buildTournamentDescriptionWithMetadata = (
        description: string | null | undefined,
        assignments: {
            rrSlots?: Record<string, Record<string, { name: string }>>;
            matchSlots?: Record<string, Record<string, { name: string }>>;
        },
        manualParticipants: {
            singles?: string[];
            doubles?: ManualDoublesTeam[];
        }
    ) => {
        const baseDescription = (description || '')
            .replace(/\s*\[MANUAL_ASSIGNMENTS:[^\]]+\]/g, '')
            .replace(/\s*\[MANUAL_PARTICIPANTS:[^\]]+\]/g, '')
            .trim();
        const hasAssignments =
            Object.keys(assignments.rrSlots || {}).length > 0 ||
            Object.keys(assignments.matchSlots || {}).length > 0;
        const hasManualParticipants =
            (manualParticipants?.singles?.length || 0) > 0 ||
            (manualParticipants?.doubles?.length || 0) > 0;

        if (!hasAssignments && !hasManualParticipants) return baseDescription || null;

        const segments: string[] = [];
        if (baseDescription) segments.push(baseDescription);
        if (hasAssignments) {
            const encodedAssignments = encodeURIComponent(JSON.stringify(assignments));
            segments.push(`[MANUAL_ASSIGNMENTS:${encodedAssignments}]`);
        }
        if (hasManualParticipants) {
            const encodedManualParticipants = encodeURIComponent(
                JSON.stringify({
                    singles: manualParticipants?.singles || [],
                    doubles: manualParticipants?.doubles || []
                })
            );
            segments.push(`[MANUAL_PARTICIPANTS:${encodedManualParticipants}]`);
        }
        return segments.join(' ').trim();
    };

    const updateTournamentDescription = async (
        updater: (current: {
            rrSlots: Record<string, Record<string, { name: string }>>;
            matchSlots: Record<string, Record<string, { name: string }>>;
        }) => {
            rrSlots: Record<string, Record<string, { name: string }>>;
            matchSlots: Record<string, Record<string, { name: string }>>;
        }
    ) => {
        const currentDescription = tournamentDescriptionRef.current;
        const currentAssignments = parseManualAssignments(currentDescription);
        const currentManualParticipants = parseManualParticipants(currentDescription);
        const nextAssignments = updater(currentAssignments);
        const nextDescription = buildTournamentDescriptionWithMetadata(
            currentDescription,
            nextAssignments,
            currentManualParticipants
        );

        const { error } = await supabase
            .from('tournaments')
            .update({ description: nextDescription })
            .eq('id', id);

        if (error) throw error;

        tournamentDescriptionRef.current = nextDescription;
        setTournament((prev: any) => prev ? { ...prev, description: nextDescription } : prev);
        return nextAssignments;
    };

    const updateTournamentManualParticipants = async (
        updater: (current: {
            singles: string[];
            doubles: ManualDoublesTeam[];
        }) => {
            singles: string[];
            doubles: ManualDoublesTeam[];
        }
    ) => {
        const currentDescription = tournamentDescriptionRef.current;
        const currentAssignments = parseManualAssignments(currentDescription);
        const currentManualParticipants = parseManualParticipants(currentDescription);
        const nextManualParticipants = updater(currentManualParticipants);
        const nextDescription = buildTournamentDescriptionWithMetadata(
            currentDescription,
            currentAssignments,
            nextManualParticipants
        );

        const { error } = await supabase
            .from('tournaments')
            .update({ description: nextDescription })
            .eq('id', id);

        if (error) throw error;

        tournamentDescriptionRef.current = nextDescription;
        setTournament((prev: any) => prev ? { ...prev, description: nextDescription } : prev);
        return nextManualParticipants;
    };

    useEffect(() => {
        if (!id || id === 'undefined') return;
        loadTournamentData();
    }, [id]);

    const loadTournamentData = async (withLoader = true) => {
        if (withLoader) setIsLoading(true);
        try {
            const access = await getCurrentUserAccessContext();
            if (!access) {
                router.replace('/(auth)/login');
                return;
            }

            // Load Tournament
            const { data: tourData, error: tourErr } = await supabase
                .from('tournaments')
                .select('id, organization_id, parent_tournament_id, name, level, format, status, description, set_type, surface, start_date, end_date, registration_fee, max_players, modality')
                .eq('id', id)
                .single();
            if (tourErr) throw tourErr;
            if (!canManageOrganization(access, tourData.organization_id)) {
                router.replace('/(tabs)/tournaments');
                return;
            }
            setTournament(tourData);

            if (isRoundRobinFormat(tourData.format)) {
                const availableGroups = getRoundRobinGroupNames(tourData.format, tourData.description);
                setActiveTab(currentTab => {
                    if (currentTab === 'finales') return currentTab;
                    if (currentTab === 'participantes') return currentTab;
                    if (currentTab.startsWith('group:')) {
                        const currentGroup = currentTab.replace('group:', '');
                        if (availableGroups.includes(currentGroup)) return currentTab;
                    }
                    return `group:${availableGroups[0] || 'A'}`;
                });
            }

            // Load Players
            const { data: playersDataRaw, error: plyErr } = await supabase
                .from('registrations')
                .select('id, tournament_id, player_id, status, fee_amount, is_paid')
                .eq('tournament_id', id);
            if (plyErr) throw plyErr;
            const playersData = (playersDataRaw || []) as any[];

            // Load Matches
            const { data: matchDataRaw, error: matchErr } = await supabase
                .from('matches')
                .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, status, score, winner_id, winner_2_id, scheduled_at, court')
                .eq('tournament_id', id)
                .order('match_order', { ascending: true });

            if (matchErr) throw matchErr;

            let loadedMatches = (matchDataRaw || []) as any[];
            if (loadedMatches.length === 0) {
                const scaffoldMatches = createInitialMatches({
                    tournamentId: String(id),
                    format: tourData.format,
                    description: tourData.description,
                    maxPlayers: tourData.max_players || 2,
                    participants: [],
                    modality: tourData.modality
                });

                if (scaffoldMatches.length > 0) {
                    const { error: scaffoldError } = await supabase.from('matches').insert(scaffoldMatches);
                    if (scaffoldError) throw scaffoldError;

                    const { data: regeneratedMatchesRaw, error: regeneratedError } = await supabase
                        .from('matches')
                        .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, status, score, winner_id, winner_2_id, scheduled_at, court')
                        .eq('tournament_id', id)
                        .order('match_order', { ascending: true });

                    if (regeneratedError) throw regeneratedError;
                    loadedMatches = (regeneratedMatchesRaw || []) as any[];
                }
            }

            const playerIds = collectPlayerIds(playersData, loadedMatches);
            const profileMapById = await fetchPublicProfileMap(playerIds);
            const hydratedPlayers = hydrateRegistrations(playersData, profileMapById);
            const hydratedMatches = hydrateMatches(loadedMatches, profileMapById);
            const nextAvatarMap = Object.entries(profileMapById).reduce((acc: Record<string, string | null>, [playerId, profile]) => {
                acc[playerId] = profile.avatarUrl || null;
            return acc;
            }, {});

            setPlayers(hydratedPlayers);
            setMatches(hydratedMatches);
            setPlayerAvatarById(nextAvatarMap);

            // Sync champion if missing from description
            if (!extractChampionFromDescription(tourData.description)) {
                syncTournamentChampion(id, supabase).then(newChampName => {
                    if (newChampName) {
                        setTournament((prev: any) => prev ? { 
                            ...prev, 
                            description: buildDescriptionWithChampion(prev.description, newChampName)
                        } : prev);
                    }
                });
            }

            // Check and move byes
            const byeResolved = await checkAndProcessByes(hydratedMatches, tourData.description, tourData.format);

            // Repair historical progression for already-finished matches (winner -> next round, loser -> consolation)
            const progressionRepaired = await repairFinishedMatchesProgression(hydratedMatches, tourData.format);

            if (byeResolved || progressionRepaired) {
                const { data: refreshedMatchesRaw, error: refreshedMatchesError } = await supabase
                    .from('matches')
                    .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, status, score, winner_id, winner_2_id, scheduled_at, court')
                    .eq('tournament_id', id)
                    .order('match_order', { ascending: true });

                if (refreshedMatchesError) throw refreshedMatchesError;
                setMatches(hydrateMatches((refreshedMatchesRaw || []) as any[], profileMapById));
            }

        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la información del torneo.');
        } finally {
            if (withLoader) setIsLoading(false);
        }
    };

    const getScoreText = (scoreValue: any): string => {
        if (scoreValue === null || scoreValue === undefined) return '';
        if (typeof scoreValue === 'string') return scoreValue.trim();

        if (typeof scoreValue === 'object') {
            if (scoreValue?.wo) return 'W.O.';
            if (typeof scoreValue?.text === 'string') return scoreValue.text.trim();
            if (typeof scoreValue?.score === 'string') return scoreValue.score.trim();
            if (Array.isArray(scoreValue?.sets)) {
                const setsAsText = scoreValue.sets
                    .map((setScore: any) => String(setScore || '').trim())
                    .filter(Boolean)
                    .join(', ');
                if (setsAsText) return setsAsText;
            }
            return '';
        }

        const fallback = String(scoreValue || '').trim();
        return fallback === '[object Object]' ? '' : fallback;
    };

    const getScoreSetStrings = (scoreValue: any): string[] => {
        const scoreText = getScoreText(scoreValue);
        if (!scoreText) return [];
        if (/^W\.?O\.?$/i.test(scoreText)) return [scoreText];
        return scoreText.split(/\s*,\s*/).filter(Boolean);
    };

    const handleMatchPress = (match: any) => {
        setSelectedMatch(match);

        // Parse existing score "6-4 6-2" into setScores array
        const setsToShow = getSetsToShow(tournament?.set_type);
        const newSetScores = Array.from({ length: setsToShow }, () => ({ s1: '', s2: '' }));

        const scoreText = getScoreText(match.score);
        if (scoreText && !/^W\.?O\.?$/i.test(scoreText)) {
            const setStrings = scoreText.split(/\s*,\s*/);
            setStrings.forEach((setStr: string, idx: number) => {
                if (idx < setsToShow) {
                    const [s1, s2] = setStr.split(/[-]/);
                    newSetScores[idx] = { s1: s1 || '', s2: s2 || '' };
                }
            });
        }

        setSetScores(newSetScores);
        setIsEditModalVisible(true);
    };

    const handleSchedulePress = (match: any) => {
        setSelectedMatch(match);
        let initialDate = '';
        let initialTime = '';
        if (match.scheduled_at) {
            const d = new Date(match.scheduled_at);
            if (!Number.isNaN(d.getTime())) {
                initialDate = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
                initialTime = `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
            }
        }
        const normalizedCourt = COURT_OPTIONS.includes(String(match.court || ''))
            ? String(match.court || '')
            : '';
        setScheduleData({
            date: initialDate,
            time: initialTime,
            court: normalizedCourt
        });
        setIsScheduleModalVisible(true);
    };

    const saveMatchSchedule = async () => {
        if (!selectedMatch) return;
        setSavingSchedule(true);

        try {
            const previousScheduledAt = selectedMatch.scheduled_at || null;
            const previousCourt = String(selectedMatch.court || '');
            const normalizedDate = String(scheduleData.date || '').trim();
            const normalizedTime = String(scheduleData.time || '').trim();
            const normalizedCourt = COURT_OPTIONS.includes(String(scheduleData.court || '').trim())
                ? String(scheduleData.court || '').trim()
                : '';
            let scheduledAt: string | null = null;

            if (!normalizedDate && normalizedTime) {
                Alert.alert('Error', 'Para guardar la hora primero debes seleccionar una fecha.');
                return;
            }

            if (normalizedDate) {
                const validTime = parseTimeRelaxed(normalizedTime);
                if (!validTime) {
                    Alert.alert('Error', 'Ingresa una hora válida (ej: 18:30 o 1830).');
                    return;
                }

                const localDateTime = new Date(`${normalizedDate}T${validTime}:00`);
                if (Number.isNaN(localDateTime.getTime())) {
                    Alert.alert('Error', 'La fecha u hora ingresada no es válida.');
                    return;
                }
                scheduledAt = localDateTime.toISOString();
            }
            
            const { error } = await supabase
                .from('matches')
                .update({
                    scheduled_at: scheduledAt,
                    court: normalizedCourt
                })
                .eq('id', selectedMatch.id);

            if (error) throw error;
            
            applyMatchPatchLocally(selectedMatch.id, { 
                scheduled_at: scheduledAt, 
                court: normalizedCourt 
            });
            const hasSchedulingChanges =
                previousScheduledAt !== scheduledAt || previousCourt !== normalizedCourt;
            if (hasSchedulingChanges) {
                await notifyScheduledMatchUpdate(
                    { ...selectedMatch, scheduled_at: scheduledAt, court: normalizedCourt },
                    scheduledAt,
                    normalizedCourt
                );
            }
            setIsScheduleModalVisible(false);
            Alert.alert('Éxito', 'Horario y cancha guardados.');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar la programación.');
        } finally {
            setSavingSchedule(false);
        }
    };

    const resolveWinnerIds = (match: any, scoreValue: any) => {
        const scoreText = getScoreText(scoreValue);
        if (!scoreText || /^W\.?O\.?$/i.test(scoreText)) {
            return { w1: null, w2: null, side: null };
        }

        const sets = scoreText.split(/\s*,\s*/).filter(Boolean);
        let playerAWins = 0;
        let playerBWins = 0;

        sets.forEach(setScore => {
            const [aRaw, bRaw] = setScore.split('-');
            const a = Number(aRaw);
            const b = Number(bRaw);
            if (Number.isNaN(a) || Number.isNaN(b)) return;
            if (a > b) playerAWins += 1;
            if (b > a) playerBWins += 1;
        });

        if (playerAWins === playerBWins) return { w1: null, w2: null, side: null };
        return playerAWins > playerBWins 
            ? { w1: match.player_a_id, w2: match.player_a2_id, side: 'A' }
            : { w1: match.player_b_id, w2: match.player_b2_id, side: 'B' };
    };

    const getNextMatchLink = (match: any, sourceMatches: any[]) => {
        if (String(match.round || '').startsWith('Grupo ')) return null;
        const isRoundRobinFinal = String(match.round || '').includes('RR');
        const isConsolation = /^Consolaci/i.test(String(match.round || ''));
        const bracketMatches = sourceMatches
            .filter(candidate => {
                if (isRoundRobinFinal) return String(candidate.round || '').includes('RR');
                if (isConsolation) return /^Consolaci/i.test(String(candidate.round || ''));
                return !/^Consolaci/i.test(String(candidate.round || '')) && !String(candidate.round || '').includes('RR');
            })
            .sort((a, b) => {
                if ((a.round_number || 0) !== (b.round_number || 0)) return (a.round_number || 0) - (b.round_number || 0);
                return (a.match_order || 0) - (b.match_order || 0);
            });

        const currentRoundMatches = bracketMatches.filter(candidate => candidate.round_number === match.round_number);
        // Ensure we only look for the next round in the same bracket (exclude placement matches)
        const nextRoundMatches = bracketMatches.filter(candidate => 
            candidate.round_number === (match.round_number || 0) + 1 &&
            !/3er|4to|5to|6to|puesto/i.test(String(candidate.round || ''))
        );
        if (nextRoundMatches.length === 0) return null;

        const currentIndex = currentRoundMatches.findIndex(candidate => candidate.id === match.id);
        if (currentIndex === -1) return null;

        const nextMatch = nextRoundMatches[Math.floor(currentIndex / 2)];
        if (!nextMatch) return null;

        const nextSlotField = currentIndex % 2 === 0 ? 'player_a_id' : 'player_b_id';
        const nextSlotField2 = currentIndex % 2 === 0 ? 'player_a2_id' : 'player_b2_id';
        return { nextMatch, nextSlotField, nextSlotField2 };
    };

    const getConsolationLinkForLoser = (match: any, sourceMatches: any[], formatOverride?: string | null) => {
        if (!hasConsolationBracket(formatOverride ?? tournament?.format)) return null;
        if (String(match.round || '').startsWith('Grupo ')) return null;
        if (/^Consolaci/i.test(String(match.round || ''))) return null;
        if (String(match.round || '').includes('RR')) return null;
        if (/3er|4to|5to|6to|puesto/i.test(String(match.round || ''))) return null;
        if (Number(match.round_number || 0) !== 1) return null;

        const firstMainRoundMatches = sourceMatches
            .filter((candidate) =>
                !String(candidate.round || '').startsWith('Grupo ') &&
                !/^Consolaci/i.test(String(candidate.round || '')) &&
                !String(candidate.round || '').includes('RR') &&
                !/3er|4to|5to|6to|puesto/i.test(String(candidate.round || '')) &&
                Number(candidate.round_number || 0) === 1
            )
            .sort((a, b) => (a.match_order || 0) - (b.match_order || 0));

        const consolationFirstRoundMatches = sourceMatches
            .filter((candidate) =>
                /^Consolaci/i.test(String(candidate.round || '')) &&
                !/3er|4to|5to|6to|puesto/i.test(String(candidate.round || '')) &&
                Number(candidate.round_number || 0) === 1
            )
            .sort((a, b) => (a.match_order || 0) - (b.match_order || 0));

        if (!consolationFirstRoundMatches.length) return null;

        const currentIndex = firstMainRoundMatches.findIndex((candidate) => candidate.id === match.id);
        if (currentIndex === -1) return null;

        const targetMatch = consolationFirstRoundMatches[Math.floor(currentIndex / 2)];
        if (!targetMatch) return null;

        const nextSlotField = currentIndex % 2 === 0 ? 'player_a_id' : 'player_b_id';
        const nextSlotField2 = currentIndex % 2 === 0 ? 'player_a2_id' : 'player_b2_id';
        return { nextMatch: targetMatch, nextSlotField, nextSlotField2 };
    };

    async function propagateWinnerToNextMatch(
        match: any,
        winnerId: string | null,
        winner2Id: string | null = null,
        sourceMatches: any[] = matches,
        winnerSide?: 'A' | 'B',
        notifyOnDefinedMatch = false
    ) {
        if (!winnerId && !winnerSide) return false;
        if (String(match.round || '').startsWith('Grupo ')) return false;

        const nextLink = getNextMatchLink(match, sourceMatches);
        if (!nextLink) return false;
        const { nextMatch, nextSlotField, nextSlotField2 } = nextLink;
        const wasFullyDefinedBefore = isMatchFullyDefinedForNotification(nextMatch);
        let projectedNextMatch = { ...nextMatch };

        const currentWinnerId = nextMatch?.[nextSlotField] || null;
        const currentWinner2Id = nextMatch?.[nextSlotField2] || null;
        if (winnerId && currentWinnerId && currentWinnerId !== winnerId) return false;
        if (IS_DOUBLES && winner2Id && currentWinner2Id && currentWinner2Id !== (winner2Id || null)) return false;

        let advancedAny = false;
        const updateData: any = {};
        if (winnerId && currentWinnerId !== winnerId) {
            updateData[nextSlotField] = winnerId;
            projectedNextMatch = { ...projectedNextMatch, [nextSlotField]: winnerId };
        }
        if (IS_DOUBLES && currentWinner2Id !== (winner2Id || null)) {
            updateData[nextSlotField2] = winner2Id || null;
            projectedNextMatch = { ...projectedNextMatch, [nextSlotField2]: winner2Id || null };
        }

        if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
                .from('matches')
                .update(updateData)
                .eq('id', nextMatch.id);

            if (error) throw error;
            applyMatchPatchLocally(nextMatch.id, updateData);
            advancedAny = true;
        }

        // ADVANCE MANUAL PLAYERS
        const targetSide = nextSlotField.startsWith('player_a') ? 'A' : 'B';
        const parsedAssignments = tournament?.description ? parseManualAssignments(tournament.description) : { rrSlots: {}, matchSlots: {} };
        const manualSlots = parsedAssignments.matchSlots?.[match.id] || {};
        
        // Correctly resolve manual participant names using the string keys
        const p1Key = getMatchManualKey(winnerSide === 'A' ? 1 : 3);
        const p2Key = getMatchManualKey(winnerSide === 'A' ? 2 : 4);
        
        const winnerP1 = manualSlots[p1Key];
        const winnerP2 = manualSlots[p2Key];

        if (winnerP1 || winnerP2) {
            const targetOffsetStart = targetSide === 'A' ? 1 : 3;
            const nextMatchSlots = parsedAssignments.matchSlots?.[nextMatch.id] || {};
            const targetP1 = nextMatchSlots[getMatchManualKey(targetOffsetStart)];
            const targetP2 = nextMatchSlots[getMatchManualKey(targetOffsetStart + 1 as MatchSlot)];
            const needsManualUpdate =
                (winnerP1 && normalizeManualNameKey(targetP1?.name) !== normalizeManualNameKey(winnerP1?.name)) ||
                (winnerP2 && normalizeManualNameKey(targetP2?.name) !== normalizeManualNameKey(winnerP2?.name));

            if (needsManualUpdate) {
                await updateTournamentDescription(current => {
                    const nextMatchSlots = { ...(current.matchSlots?.[nextMatch.id] || {}) };
                    
                    if (winnerP1) nextMatchSlots[getMatchManualKey(targetOffsetStart)] = winnerP1;
                    if (winnerP2) nextMatchSlots[getMatchManualKey(targetOffsetStart + 1 as MatchSlot)] = winnerP2;

                    return {
                        ...current,
                        matchSlots: {
                            ...(current.matchSlots || {}),
                            [nextMatch.id]: nextMatchSlots
                        }
                    };
                });
                advancedAny = true;
            }
        }

        if (
            notifyOnDefinedMatch &&
            !wasFullyDefinedBefore &&
            isMatchFullyDefinedForNotification(projectedNextMatch)
        ) {
            await notifyDefinedKnockoutMatch(projectedNextMatch);
        }
        return advancedAny;
    }

    async function propagateLoserToConsolation(
        match: any,
        loserId: string | null,
        loser2Id: string | null = null,
        sourceMatches: any[] = matches,
        loserSide?: 'A' | 'B',
        formatOverride?: string | null,
        notifyOnDefinedMatch = false
    ) {
        if (!hasConsolationBracket(formatOverride ?? tournament?.format)) return false;
        if (!loserId && !loserSide) return false;
        if (String(match.round || '').startsWith('Grupo ')) return false;

        const nextLink = getConsolationLinkForLoser(match, sourceMatches, formatOverride);
        if (!nextLink) return false;
        const { nextMatch, nextSlotField, nextSlotField2 } = nextLink;
        const wasFullyDefinedBefore = isMatchFullyDefinedForNotification(nextMatch);
        let projectedNextMatch = { ...nextMatch };

        const loserDisplayName = loserSide ? getDisplayName(match, loserSide === 'A' ? 1 : 3) : '';
        const loserDisplayName2 = IS_DOUBLES && loserSide ? getDisplayName(match, loserSide === 'A' ? 2 : 4) : '';
        if (loserId === 'BYE' || isByeName(loserDisplayName) || (IS_DOUBLES && isByeName(loserDisplayName2))) {
            return false;
        }

        const currentLoserId = nextMatch?.[nextSlotField] || null;
        const currentLoser2Id = nextMatch?.[nextSlotField2] || null;
        if (loserId && currentLoserId && currentLoserId !== loserId) return false;
        if (IS_DOUBLES && loser2Id && currentLoser2Id && currentLoser2Id !== (loser2Id || null)) return false;

        let advancedAny = false;
        const updateData: any = {};
        if (loserId && currentLoserId !== loserId) {
            updateData[nextSlotField] = loserId;
            projectedNextMatch = { ...projectedNextMatch, [nextSlotField]: loserId };
        }
        if (IS_DOUBLES && currentLoser2Id !== (loser2Id || null)) {
            updateData[nextSlotField2] = loser2Id || null;
            projectedNextMatch = { ...projectedNextMatch, [nextSlotField2]: loser2Id || null };
        }

        if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
                .from('matches')
                .update(updateData)
                .eq('id', nextMatch.id);

            if (error) throw error;
            applyMatchPatchLocally(nextMatch.id, updateData);
            advancedAny = true;
        }

        const targetSide = nextSlotField.startsWith('player_a') ? 'A' : 'B';
        const parsedAssignments = tournament?.description ? parseManualAssignments(tournament.description) : { rrSlots: {}, matchSlots: {} };
        const manualSlots = parsedAssignments.matchSlots?.[match.id] || {};
        const p1Key = getMatchManualKey(loserSide === 'A' ? 1 : 3);
        const p2Key = getMatchManualKey(loserSide === 'A' ? 2 : 4);
        const loserP1 = manualSlots[p1Key];
        const loserP2 = manualSlots[p2Key];

        if (loserP1 || loserP2) {
            const targetOffsetStart = targetSide === 'A' ? 1 : 3;
            const nextMatchSlots = parsedAssignments.matchSlots?.[nextMatch.id] || {};
            const targetP1 = nextMatchSlots[getMatchManualKey(targetOffsetStart)];
            const targetP2 = nextMatchSlots[getMatchManualKey(targetOffsetStart + 1 as MatchSlot)];
            const needsManualUpdate =
                (loserP1 && normalizeManualNameKey(targetP1?.name) !== normalizeManualNameKey(loserP1?.name)) ||
                (loserP2 && normalizeManualNameKey(targetP2?.name) !== normalizeManualNameKey(loserP2?.name));

            if (needsManualUpdate) {
                await updateTournamentDescription(current => {
                    const nextMatchSlots = { ...(current.matchSlots?.[nextMatch.id] || {}) };

                    if (loserP1) nextMatchSlots[getMatchManualKey(targetOffsetStart)] = loserP1;
                    if (loserP2) nextMatchSlots[getMatchManualKey(targetOffsetStart + 1 as MatchSlot)] = loserP2;

                    return {
                        ...current,
                        matchSlots: {
                            ...(current.matchSlots || {}),
                            [nextMatch.id]: nextMatchSlots
                        }
                    };
                });
                advancedAny = true;
            }
        }

        if (
            notifyOnDefinedMatch &&
            !wasFullyDefinedBefore &&
            isMatchFullyDefinedForNotification(projectedNextMatch)
        ) {
            await notifyDefinedKnockoutMatch(projectedNextMatch);
        }
        return advancedAny;
    }

    async function repairFinishedMatchesProgression(allMatches: any[], formatOverride?: string | null) {
        if (isRoundRobinFormat(formatOverride ?? tournament?.format)) return false;
        if (!allMatches.length) return false;

        const finishedMatches = [...allMatches]
            .filter((match) =>
                !String(match.round || '').startsWith('Grupo ') &&
                !/3er|4to|5to|6to|puesto/i.test(String(match.round || '')) &&
                (
                    ['finished', 'completed', 'finalized'].includes(String(match.status || '').toLowerCase()) ||
                    Boolean(getScoreText(match.score))
                )
            )
            .sort((a, b) => {
                if ((a.round_number || 0) !== (b.round_number || 0)) {
                    return (a.round_number || 0) - (b.round_number || 0);
                }
                return (a.match_order || 0) - (b.match_order || 0);
            });

        if (!finishedMatches.length) return false;

        let repairedAny = false;
        for (const match of finishedMatches) {
            let winnerId: string | null = match.winner_id || null;
            let winner2Id: string | null = match.winner_2_id || null;
            let winnerSide: 'A' | 'B' | null = null;

            if (winnerId && winnerId === match.player_a_id) winnerSide = 'A';
            if (winnerId && winnerId === match.player_b_id) winnerSide = 'B';

            if (!winnerSide) {
                const resolved = resolveWinnerIds(match, match.score);
                if (resolved.side) {
                    winnerSide = resolved.side as 'A' | 'B';
                    winnerId = winnerId || resolved.w1 || null;
                    winner2Id = winner2Id || resolved.w2 || null;
                }
            }

            if (!winnerSide) continue;

            const advancedWinner = await propagateWinnerToNextMatch(
                match,
                winnerId,
                winner2Id,
                allMatches,
                winnerSide
            );
            if (advancedWinner) repairedAny = true;

            const loserSide = winnerSide === 'A' ? 'B' : 'A';
            const loserId = loserSide === 'A' ? match.player_a_id : match.player_b_id;
            const loser2Id = loserSide === 'A' ? match.player_a2_id : match.player_b2_id;
            const advancedLoser = await propagateLoserToConsolation(
                match,
                loserId || null,
                loser2Id || null,
                allMatches,
                loserSide,
                formatOverride
            );
            if (advancedLoser) repairedAny = true;
        }

        return repairedAny;
    }

    async function checkAndProcessByes(
        allMatches: any[],
        descriptionOverride?: string | null,
        formatOverride?: string | null
    ) {
        if (isRoundRobinFormat(formatOverride ?? tournament?.format)) return false;

        const isByeValue = (value: unknown) => {
            const normalized = String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toUpperCase();
            return normalized === 'BYE';
        };

        const manualAssignmentsForBye = parseManualAssignments(descriptionOverride ?? tournament?.description);
        const resolveNameForByeCheck = (match: any, slot: MatchSlot) => {
            const playerId = getPlayerIdBySlot(match, slot);
            if (playerId) return getPlayerName(playerId);

            const manualName =
                manualAssignmentsForBye.matchSlots?.[match.id]?.[getMatchManualKey(slot)]?.name ||
                manualAssignmentsForBye.matchSlots?.[match.id]?.[getMatchManualFallbackKey(slot)]?.name ||
                null;
            if (manualName) return manualName;

            return getDisplayName(match, slot);
        };

        let workingMatches = [...allMatches];
        const pendingMatches = workingMatches.filter(m => String(m?.status || 'pending') !== 'finished');
        let resolvedAnyBye = false;
        
        for (const m of pendingMatches) {
            const nameA = resolveNameForByeCheck(m, 1);
            const nameA2 = IS_DOUBLES ? resolveNameForByeCheck(m, 2) : '';
            const nameB = resolveNameForByeCheck(m, 3);
            const nameB2 = IS_DOUBLES ? resolveNameForByeCheck(m, 4) : '';

            const isABye = [nameA, nameA2].some(isByeValue);
            const isBBye = [nameB, nameB2].some(isByeValue);

            if (isABye === isBBye) continue;

            let winnerId: string | null = null;
            let winner2Id: string | null = null;
            const winnerSide: 'A' | 'B' = isABye ? 'B' : 'A';
            if (isABye) {
                winnerId = m.player_b_id && m.player_b_id !== 'BYE' ? m.player_b_id : null;
                winner2Id = m.player_b2_id && m.player_b2_id !== 'BYE' ? m.player_b2_id : null;
            } else {
                winnerId = m.player_a_id && m.player_a_id !== 'BYE' ? m.player_a_id : null;
                winner2Id = m.player_a2_id && m.player_a2_id !== 'BYE' ? m.player_a2_id : null;
            }

            const updatePayload: any = {
                score: 'W.O.',
                status: 'finished',
            };
            if (winnerId) {
                updatePayload.winner_id = winnerId;
            } else {
                updatePayload.winner_id = null;
            }
            if (IS_DOUBLES) {
                updatePayload.winner_2_id = winner2Id;
            }

            const { error } = await supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', m.id);
            
            if (!error) {
                const updatedCurrentMatch = { ...m, ...updatePayload };
                workingMatches = workingMatches.map((candidateMatch) =>
                    candidateMatch.id === m.id ? updatedCurrentMatch : candidateMatch
                );
                resolvedAnyBye = true;
                await propagateWinnerToNextMatch(updatedCurrentMatch, winnerId, winner2Id, workingMatches, winnerSide);
            }
        }
        return resolvedAnyBye;
    }

    async function finalizeTournament() {
        Alert.alert(
            'Finalizar Torneo',
            '¿Estás seguro de que quieres dar por finalizado este torneo? Esto permitirá que los resultados se reflejen en los perfiles y rankings de los jugadores.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Finalizar',
                    onPress: async () => {
                        const championName = resolveChampionFromMatches(
                            matches,
                            players,
                            tournament?.description
                        );

                        const { error } = await supabase
                            .from('tournaments')
                            .update({ 
                                status: 'finished',
                                description: buildDescriptionWithChampion(tournament?.description, championName)
                            })
                            .eq('id', id);

                        if (error) {
                            Alert.alert('Error', 'No se pudo finalizar el torneo.');
                        } else {
                            const tournamentId = String(id || '').trim();
                            const participantIds = [...new Set(
                                players
                                    .map((player) => String(player?.player_id || '').trim())
                                    .filter((playerId) => UUID_PATTERN.test(playerId))
                            )];
                            if (UUID_PATTERN.test(tournamentId) && participantIds.length > 0) {
                                await notifyTournamentUsers({
                                    tournamentId,
                                    userIds: participantIds,
                                    type: 'tournament_finished',
                                    title: 'Torneo finalizado',
                                    body: championName
                                        ? `Felicitamos a ${championName} por coronarse campeon de ${tournament?.name || 'este torneo'}.`
                                        : `${tournament?.name || 'Este torneo'} finalizo.`,
                                    data: {
                                        type: 'tournament_finished',
                                        tournamentId,
                                    },
                                });
                            }
                            await loadTournamentData();
                            Alert.alert('Éxito', 'Torneo finalizado.');
                        }
                    }
                }
            ]
        );
    }

    const saveMatchScore = async () => {
        if (!selectedMatch) return;
        setSavingMatch(true);

        // Construct score string "6-4 6-2"
        const finalScore = setScores
            .filter(set => set.s1 !== '' || set.s2 !== '')
            .map(set => `${set.s1}-${set.s2}`)
            .join(', ');

        try {
            const { w1, w2, side } = resolveWinnerIds(selectedMatch, finalScore);
            const { error } = await supabase
                .from('matches')
                .update({ 
                    score: finalScore, 
                    winner_id: w1, 
                    winner_2_id: w2,
                    status: 'finished' 
                })
                .eq('id', selectedMatch.id);

            if (error) throw error;
                if (side) {
                    await propagateWinnerToNextMatch(selectedMatch, w1, w2 || null, matches, side as 'A' | 'B', true);
                    const loserSide = side === 'A' ? 'B' : 'A';
                    const loserId = loserSide === 'A' ? selectedMatch.player_a_id : selectedMatch.player_b_id;
                    const loser2Id = loserSide === 'A' ? selectedMatch.player_a2_id : selectedMatch.player_b2_id;
                    await propagateLoserToConsolation(selectedMatch, loserId || null, loser2Id || null, matches, loserSide, undefined, true);
                    
                    // Use the robust resolution logic to get the champion name (handles manual participants)
                    // We simulate the updated matches state by patching the matches array locally for the call
                    const patchedMatches = matches.map(m => 
                        m.id === selectedMatch.id 
                            ? { ...m, score: finalScore, winner_id: w1, winner_2_id: w2, status: 'finished' } 
                            : m
                    );
                    
                    const championName = resolveChampionFromMatches(
                        patchedMatches,
                        players,
                        tournament?.description
                    );
                    
                    if (championName) {
                        const newDescription = buildDescriptionWithChampion(tournament?.description, championName);
                        
                        await supabase
                            .from('tournaments')
                            .update({ description: newDescription })
                            .eq('id', id);
                    }
                }

            applyMatchPatchLocally(selectedMatch.id, {
                score: finalScore,
                winner_id: w1,
                winner_2_id: w2,
                status: 'finished'
            });
            setIsEditModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el resultado.');
        } finally {
            setSavingMatch(false);
        }
    };

    const generateMatches = async () => {
        // Dummy logic to generate initial structure based on format and players
        Alert.alert('Información', 'La lógica de scaffold está en desarrollo.');
    };

    const getPlayerName = (pId: string) => {
        if (!pId) return 'Por definir';
        if (pId === 'BYE') return 'BYE';
        const player = players.find(p => p.player_id === pId);
        return player ? (player.profiles?.name || 'Desconocido') : 'Por definir';
    };

    const getPlayerAvatar = (playerId: string | null | undefined) => {
        if (!playerId || playerId === 'BYE') return null;
        return playerAvatarById[playerId] || null;
    };

    const removeParticipant = async (pId: string) => {
        Alert.alert(
            'Eliminar Participante',
            '¿Estás seguro de que quieres eliminar a este participante de este torneo?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('registrations')
                            .delete()
                            .eq('tournament_id', id)
                            .eq('player_id', pId);

                        if (error) {
                            Alert.alert('Error', 'No se pudo eliminar el participante.');
                        } else {
                            await supabase
                                .from('tournament_registration_requests')
                                .delete()
                                .eq('tournament_id', id)
                                .eq('player_id', pId);
                            await loadTournamentData();
                        }
                    }
                }
            ]
        );
    };

    const registerParticipant = async (
        pId: string,
        options: { keepModalOpen?: boolean } = {}
    ) => {
        const keepModalOpen = options.keepModalOpen ?? false;
        setSavingPlayer(true);
        try {
            const { error } = await supabase
                .from('registrations')
                .insert({
                    tournament_id: id,
                    player_id: pId,
                    status: 'confirmed',
                    fee_amount: tournament?.registration_fee || 0,
                    is_paid: false
                });

            if (error) throw error;
            const profileName =
                players.find((player) => player.player_id === pId)?.profiles?.name ||
                searchResults.find((user) => user.id === pId)?.name ||
                'Jugador';

            setPlayers((currentPlayers) => {
                if (currentPlayers.some((player) => player.player_id === pId)) {
                    return currentPlayers;
                }

                return [
                    ...currentPlayers,
                    {
                        id: createUuid(),
                        tournament_id: id,
                        player_id: pId,
                        status: 'confirmed',
                        fee_amount: tournament?.registration_fee || 0,
                        is_paid: false,
                        profiles: {
                            id: pId,
                            name: profileName,
                            avatar_url: null
                        }
                    }
                ];
            });

            resetPlayerSelectionSearch();
            if (!keepModalOpen) {
                closePlayerSelectionModal();
            }
        } catch (error: any) {
            if (error.code === '23505') {
                Alert.alert('Información', 'Este jugador ya está registrado.');
            } else {
                Alert.alert('Error', 'No se pudo registrar al jugador.');
            }
        } finally {
            setSavingPlayer(false);
        }
    };

    const togglePendingDoublesTeamMember = (playerId: string) => {
        setPendingDoublesTeamIds((currentIds) => {
            if (currentIds.includes(playerId)) {
                return currentIds.filter((currentId) => currentId !== playerId);
            }
            if (currentIds.length >= 2) {
                return [currentIds[1], playerId];
            }
            return [...currentIds, playerId];
        });
    };

    const savePendingDoublesTeam = async () => {
        if (pendingDoublesTeamIds.length !== 2) {
            Alert.alert('Información', 'Selecciona 2 jugadores para crear la dupla.');
            return;
        }

        const [p1Id, p2Id] = pendingDoublesTeamIds;
        const p1Name = getPlayerName(p1Id);
        const p2Name = getPlayerName(p2Id);

        await addManualParticipantToPool(p1Name, p2Name, { p1Id, p2Id });
        setPendingDoublesTeamIds([]);
        closePlayerSelectionModal();
    };

    const manualAssignments = useMemo(() => parseManualAssignments(tournament?.description), [tournament?.description]);
    const manualParticipants = useMemo(() => parseManualParticipants(tournament?.description), [tournament?.description]);

    const getMatchManualKey = (slot: MatchSlot) => {
        if (slot === 1) return 'player_a';
        if (slot === 2) return 'player_a2';
        if (slot === 3) return 'player_b';
        return 'player_b2';
    };

    const getMatchManualFallbackKey = (slot: MatchSlot) => (slot === 1 || slot === 2 ? 'player_a' : 'player_b');

    const getGroupManualKey = (slotIndex: number, member: GroupMember = 1) =>
        member === 2 ? `${slotIndex}:2` : String(slotIndex);

    const getAssignedNameForGroupSlot = (groupName: string, slotIndex: number, member: GroupMember = 1) =>
        manualAssignments.rrSlots?.[groupName]?.[getGroupManualKey(slotIndex, member)]?.name ||
        (!IS_DOUBLES && member === 2 ? manualAssignments.rrSlots?.[groupName]?.[String(slotIndex)]?.name : null) ||
        null;

    const getAssignedNameForMatchSlot = (matchId: string, slot: MatchSlot) =>
        manualAssignments.matchSlots?.[matchId]?.[getMatchManualKey(slot)]?.name ||
        (!IS_DOUBLES ? manualAssignments.matchSlots?.[matchId]?.[getMatchManualFallbackKey(slot)]?.name : null) ||
        null;

    const resetPlayerSelectionSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setManualPlayerName('');
        setManualPlayerName2('');
        setPendingDoublesTeamIds([]);
    };

    const setSelectionFromTarget = (target: AssignmentTarget) => {
        if (target.type === 'match') {
            setSelectedSlot({ matchId: target.matchId, slot: target.slot });
            setSelectedGroupSlot(null);
            return;
        }

        setSelectedGroupSlot({
            groupName: target.groupName,
            slotIndex: target.slotIndex,
            member: target.member
        });
        setSelectedSlot(null);
    };

    const openAssignmentModal = (targets: AssignmentTarget[], initialIndex = 0) => {
        if (!targets.length) return;
        const boundedIndex = Math.max(0, Math.min(initialIndex, targets.length - 1));
        setAssignmentTargets(targets);
        setActiveAssignmentIndex(boundedIndex);
        setSelectionFromTarget(targets[boundedIndex]);
        resetPlayerSelectionSearch();
        setIsPlayerModalVisible(true);
    };

    const getMatchTargetLabel = (slot: MatchSlot) => {
        if (!IS_DOUBLES) {
            return slot === 1 ? 'Jugador 1' : 'Jugador 2';
        }
        if (slot === 1) return 'Dupla 1 · Jugador 1';
        if (slot === 2) return 'Dupla 1 · Jugador 2';
        if (slot === 3) return 'Dupla 2 · Jugador 1';
        return 'Dupla 2 · Jugador 2';
    };

    const handlePlayerPress = (matchId: string, slot: MatchSlot) => {
        const orderedTargets = buildTargetsForMatch(matchId, slot);
        openAssignmentModal(orderedTargets, 0);
    };

    const handleGroupSlotPress = (groupName: string, slotIndex: number, member: GroupMember = 1) => {
        const orderedTargets = buildTargetsForGroupSlot(groupName, slotIndex, member);
        openAssignmentModal(orderedTargets, 0);
    };

    const setActiveAssignmentTarget = (targetIndex: number) => {
        const nextTarget = assignmentTargets[targetIndex];
        if (!nextTarget) return;
        setActiveAssignmentIndex(targetIndex);
        setSelectionFromTarget(nextTarget);
    };

    const resetAssignmentSelection = () => {
        setSelectedSlot(null);
        setSelectedGroupSlot(null);
        setAssignmentTargets([]);
        setActiveAssignmentIndex(0);
    };

    const closePlayerSelectionModal = () => {
        resetAssignmentSelection();
        resetPlayerSelectionSearch();
        setIsPlayerModalVisible(false);
    };

    const moveToNextAssignmentTarget = () => {
        if (assignmentTargets.length <= 1) return;
        const nextIndex = activeAssignmentIndex + 1;
        if (nextIndex >= assignmentTargets.length) return;
        setActiveAssignmentTarget(nextIndex);
    };

    const buildTargetsForMatch = (matchId: string, preferredSlot: MatchSlot = 1): AssignmentTarget[] => {
        const targets: AssignmentTarget[] = IS_DOUBLES
            ? [
                { type: 'match', label: getMatchTargetLabel(1), matchId, slot: 1 },
                { type: 'match', label: getMatchTargetLabel(2), matchId, slot: 2 },
                { type: 'match', label: getMatchTargetLabel(3), matchId, slot: 3 },
                { type: 'match', label: getMatchTargetLabel(4), matchId, slot: 4 },
            ]
            : [
                { type: 'match', label: getMatchTargetLabel(1), matchId, slot: 1 },
                { type: 'match', label: getMatchTargetLabel(3), matchId, slot: 3 },
            ];
        const initialIndex = Math.max(
            0,
            targets.findIndex((target) => target.type === 'match' && target.slot === preferredSlot)
        );
        return [targets[initialIndex], ...targets.filter((_, index) => index !== initialIndex)];
    };

    const buildTargetsForGroupSlot = (groupName: string, slotIndex: number, member: GroupMember = 1): AssignmentTarget[] => {
        const targets: AssignmentTarget[] = IS_DOUBLES
            ? [
                { type: 'group', label: 'Dupla · Jugador 1', groupName, slotIndex, member: 1 },
                { type: 'group', label: 'Dupla · Jugador 2', groupName, slotIndex, member: 2 },
            ]
            : [{ type: 'group', label: 'Jugador', groupName, slotIndex, member: 1 }];
        const initialIndex = Math.max(
            0,
            targets.findIndex((target) => target.type === 'group' && target.member === member)
        );
        return [targets[initialIndex], ...targets.filter((_, index) => index !== initialIndex)];
    };

    const getFirstAvailableAssignmentTargets = (): AssignmentTarget[] => {
        if (isRoundRobin) {
            for (const groupName of roundRobinGroupNames) {
                const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
                for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
                    const hasP1 = !!getAssignedNameForGroupSlot(groupName, slotIndex, 1) ||
                        !!roundRobinMatchesByGroup[groupName]?.some((m) => {
                            const pairSlot = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 1);
                            const pairSlotB = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 2);
                            return (pairSlot === slotIndex && !!m.player_a_id) || (pairSlotB === slotIndex && !!m.player_b_id);
                        });
                    const hasP2 = !IS_DOUBLES || !!getAssignedNameForGroupSlot(groupName, slotIndex, 2) ||
                        !!roundRobinMatchesByGroup[groupName]?.some((m) => {
                            const pairSlot = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 1);
                            const pairSlotB = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 2);
                            return (pairSlot === slotIndex && !!m.player_a2_id) || (pairSlotB === slotIndex && !!m.player_b2_id);
                        });
                    if (!hasP1 || !hasP2) {
                        return buildTargetsForGroupSlot(groupName, slotIndex, !hasP1 ? 1 : 2);
                    }
                }
            }
            return [];
        }

        const firstRoundMatches = matches
            .filter((match) =>
                !String(match.round || '').startsWith('Grupo ') &&
                !/^Consolaci/i.test(String(match.round || '')) &&
                !String(match.round || '').includes('RR') &&
                Number(match.round_number || 0) === 1
            )
            .sort((leftMatch, rightMatch) => (leftMatch.match_order || 0) - (rightMatch.match_order || 0));

        for (const match of firstRoundMatches) {
            const candidates: Array<{ slot: MatchSlot; empty: boolean }> = IS_DOUBLES
                ? [
                    { slot: 1, empty: !match.player_a_id && !getAssignedNameForMatchSlot(match.id, 1) },
                    { slot: 2, empty: !match.player_a2_id && !getAssignedNameForMatchSlot(match.id, 2) },
                    { slot: 3, empty: !match.player_b_id && !getAssignedNameForMatchSlot(match.id, 3) },
                    { slot: 4, empty: !match.player_b2_id && !getAssignedNameForMatchSlot(match.id, 4) },
                ]
                : [
                    { slot: 1, empty: !match.player_a_id && !getAssignedNameForMatchSlot(match.id, 1) },
                    { slot: 3, empty: !match.player_b_id && !getAssignedNameForMatchSlot(match.id, 3) },
                ];
            const firstEmpty = candidates.find((candidate) => candidate.empty);
            if (firstEmpty) return buildTargetsForMatch(match.id, firstEmpty.slot);
        }
        return [];
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchUsers();
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const searchUsers = async () => {
        setIsSearching(true);
        try {
            const query = supabase
                .from('public_profiles')
                .select('id, name')
                .ilike('name', `%${searchQuery}%`)
                .limit(10);

            const { data, error } = await query;

            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const createUuid = () => {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
            const random = Math.floor(Math.random() * 16);
            const value = char === 'x' ? random : (random & 0x3) | 0x8;
            return value.toString(16);
        });
    };
    const isUuid = (value?: string | null) =>
        !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    const getRoundRobinPairings = (slotCount: number) => {
        const pairings: Array<[number, number]> = [];
        for (let i = 0; i < slotCount; i++) {
            for (let j = i + 1; j < slotCount; j++) {
                pairings.push([i, j]);
            }
        }
        return pairings;
    };

    const isByeName = (value?: string | null) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase() === 'BYE';

    const isPlaceholderName = (value?: string | null) => {
        const normalized = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();
        return !normalized || normalized === 'POR DEFINIR' || normalized.startsWith('CUPO ');
    };

    const manualParticipantSingles = useMemo<string[]>(() => {
        const seen = new Set<string>();
        return (manualParticipants.singles || [])
            .map((name: string) => String(name || '').trim())
            .filter((name: string) => Boolean(name))
            .filter((name: string) => {
                if (isPlaceholderName(name) || isByeName(name)) return false;
                const key = normalizeManualNameKey(name);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [manualParticipants.singles]);

    const manualParticipantRows = useMemo<ManualParticipantRow[]>(
        () =>
            manualParticipantSingles.map((name: string, index: number): ManualParticipantRow => ({
                id: `manual:${normalizeManualNameKey(name)}:${index}`,
                name
            })),
        [manualParticipantSingles]
    );

    const manualDoublesTeams = useMemo<ManualDoublesTeam[]>(() => {
        const seen = new Set<string>();
        return (manualParticipants.doubles || [])
            .map((team: ManualDoublesTeam) => ({
                p1Name: String(team?.p1Name || '').trim(),
                p2Name: String(team?.p2Name || '').trim(),
                p1Id: UUID_PATTERN.test(String(team?.p1Id || '').trim()) ? String(team?.p1Id || '').trim() : null,
                p2Id: UUID_PATTERN.test(String(team?.p2Id || '').trim()) ? String(team?.p2Id || '').trim() : null
            }))
            .filter((team: ManualDoublesTeam) => team.p1Name && team.p2Name)
            .filter((team: ManualDoublesTeam) => {
                const key = buildManualDoublesTeamKey(team);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [manualParticipants.doubles]);

    const manualDoublesTeamRows = useMemo<ManualDoublesTeamRow[]>(
        () =>
            manualDoublesTeams.map((team, index) => ({
                id: `manual-team:${buildManualDoublesTeamKey(team)}:${index}`,
                p1Name: team.p1Name,
                p2Name: team.p2Name,
                p1Id: team.p1Id || null,
                p2Id: team.p2Id || null,
                label: `${team.p1Name} / ${team.p2Name}`
            })),
        [manualDoublesTeams]
    );

    const assignedRegisteredPlayerIds = useMemo(() => {
        const assignedIds = new Set<string>();
        matches.forEach((match) => {
            [match.player_a_id, match.player_a2_id, match.player_b_id, match.player_b2_id].forEach((playerId) => {
                if (typeof playerId === 'string' && UUID_PATTERN.test(playerId)) {
                    assignedIds.add(playerId);
                }
            });
        });
        return assignedIds;
    }, [matches]);

    const definedDoublesPlayerIds = useMemo(() => {
        const ids = new Set<string>();
        manualDoublesTeamRows.forEach((team) => {
            if (UUID_PATTERN.test(String(team.p1Id || ''))) ids.add(String(team.p1Id));
            if (UUID_PATTERN.test(String(team.p2Id || ''))) ids.add(String(team.p2Id));
        });
        return ids;
    }, [manualDoublesTeamRows]);

    const assignedManualNameKeys = useMemo(() => {
        const assignedNames = new Set<string>();
        const pushName = (name?: string | null) => {
            const normalizedName = String(name || '').trim();
            if (!normalizedName || isPlaceholderName(normalizedName) || isByeName(normalizedName)) return;
            assignedNames.add(normalizeManualNameKey(normalizedName));
        };

        Object.values(manualAssignments.matchSlots || {}).forEach((slotMap: any) => {
            Object.values(slotMap || {}).forEach((entry: any) => pushName(entry?.name));
        });
        Object.values(manualAssignments.rrSlots || {}).forEach((slotMap: any) => {
            Object.values(slotMap || {}).forEach((entry: any) => pushName(entry?.name));
        });
        return assignedNames;
    }, [manualAssignments]);

    const selectableRegisteredPlayers = useMemo(() => {
        if (assignmentTargets.length === 0) {
            if (!IS_DOUBLES) return players;
            return players.filter((registration) => !definedDoublesPlayerIds.has(String(registration.player_id || '')));
        }
        return players.filter((registration) => {
            const playerId = String(registration.player_id || '');
            if (assignedRegisteredPlayerIds.has(playerId)) return false;
            if (IS_DOUBLES && definedDoublesPlayerIds.has(playerId)) return false;
            return true;
        });
    }, [players, assignmentTargets.length, assignedRegisteredPlayerIds, IS_DOUBLES, definedDoublesPlayerIds]);

    const selectableManualParticipants = useMemo<ManualParticipantRow[]>(() => {
        if (assignmentTargets.length === 0) return manualParticipantRows;
        return manualParticipantRows.filter((participant: ManualParticipantRow) => !assignedManualNameKeys.has(normalizeManualNameKey(participant.name)));
    }, [manualParticipantRows, assignmentTargets.length, assignedManualNameKeys]);

    const selectableDoublesTeamRows = useMemo<ManualDoublesTeamRow[]>(() => {
        if (!IS_DOUBLES || assignmentTargets.length === 0) return [];
        return manualDoublesTeamRows;
    }, [IS_DOUBLES, assignmentTargets.length, manualDoublesTeamRows]);

    const shuffleArray = <T,>(items: T[]) => {
        const copy = [...items];
        for (let index = copy.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
        }
        return copy;
    };

    const buildSeedOrder = (seedCount: number) => {
        if (seedCount <= 0) return [] as number[];
        if (seedCount === 1) return [1];
        let order = [1, 2];
        while (order.length < seedCount) {
            const nextTotal = order.length * 2;
            order = order.flatMap((seedNumber, index) => {
                const complementary = nextTotal + 1 - seedNumber;
                return index % 2 === 0
                    ? [seedNumber, complementary]
                    : [complementary, seedNumber];
            });
        }
        return order.slice(0, seedCount);
    };

    const buildSeedLinesForDraw = (totalSlots: number, seedCount: number) => {
        const totalMatches = Math.floor(totalSlots / 2);
        const effectiveSeedCount = Math.max(0, Math.min(seedCount, totalMatches));
        if (effectiveSeedCount === 0 || totalMatches === 0) return [] as number[];

        const order = buildSeedOrder(effectiveSeedCount);
        const linesBySeed: number[] = Array.from({ length: effectiveSeedCount }, () => 0);

        for (let zoneIndex = 0; zoneIndex < effectiveSeedCount; zoneIndex++) {
            const seedNumber = order[zoneIndex];
            const zoneStartMatch = Math.floor((zoneIndex * totalMatches) / effectiveSeedCount) + 1;
            const zoneEndMatch = Math.max(zoneStartMatch, Math.floor(((zoneIndex + 1) * totalMatches) / effectiveSeedCount));
            const targetMatch = zoneIndex % 2 === 0 ? zoneStartMatch : zoneEndMatch;
            const targetLine = zoneIndex % 2 === 0
                ? ((targetMatch - 1) * 2) + 1
                : ((targetMatch - 1) * 2) + 2;
            linesBySeed[seedNumber - 1] = targetLine;
        }

        return linesBySeed;
    };

    const buildFullSeedLinesForBracket = (bracketSize: number, seedCount: number) => {
        const normalizedBracketSize = Math.max(2, Math.floor(bracketSize || 2));
        const effectiveSeedCount = Math.max(0, Math.min(Math.floor(seedCount || 0), normalizedBracketSize));
        if (effectiveSeedCount === 0) return [] as number[];

        const fullOrder = buildSeedOrder(normalizedBracketSize);
        return Array.from({ length: effectiveSeedCount }, (_value, index) => {
            const seedNumber = index + 1;
            const line = fullOrder.findIndex((candidateSeed) => candidateSeed === seedNumber);
            return line >= 0 ? line + 1 : seedNumber;
        });
    };

    const buildRoundRobinSeedSlots = () => {
        const groupSlots = roundRobinGroupNames.map((groupName) => ({
            groupName,
            count: getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length
        }));
        const maxRows = groupSlots.reduce((accumulator, groupSlot) => Math.max(accumulator, groupSlot.count), 0);
        const slots: Array<{ groupName: string; slotIndex: number }> = [];

        for (let row = 0; row < maxRows; row++) {
            const rowOrder = row % 2 === 0 ? groupSlots : [...groupSlots].reverse();
            rowOrder.forEach((groupSlot) => {
                if (row < groupSlot.count) {
                    slots.push({ groupName: groupSlot.groupName, slotIndex: row });
                }
            });
        }

        return slots;
    };

    const getUniqueRegisteredPlayerIds = () =>
        players
            .map((registration) => String(registration.player_id || '').trim())
            .filter((playerId, index, allPlayerIds) => UUID_PATTERN.test(playerId) && allPlayerIds.indexOf(playerId) === index);

    const getSeedingContext = () => {
        const totalSlots = isRoundRobin
            ? buildRoundRobinSeedSlots().length
            : matches
                .filter((match) =>
                    !String(match.round || '').startsWith('Grupo ') &&
                    !/^Consolaci/i.test(String(match.round || '')) &&
                    !String(match.round || '').includes('RR') &&
                    Number(match.round_number || 0) === 1
                ).length * 2;

        const registeredCount = getUniqueRegisteredPlayerIds().length;
        const registeredUnits = IS_DOUBLES
            ? Math.ceil(registeredCount / 2)
            : registeredCount;
        const maxSeedable = Math.max(0, Math.min(totalSlots, registeredUnits));
        const recommended = totalSlots >= 8
            ? Math.floor(totalSlots / 4)
            : (totalSlots >= 4 ? 2 : Math.min(1, totalSlots));

        return {
            totalSlots,
            maxSeedable,
            recommended: Math.max(0, Math.min(maxSeedable, recommended))
        };
    };

    const buildRankingMapForParticipants = async (playerIds: string[]) => {
        if (!playerIds.length || !tournament?.organization_id || !tournament?.level) {
            return {} as Record<string, number>;
        }

        const { data: rankingTournaments, error: rankingTournamentsError } = await supabase
            .from('tournaments')
            .select('id, description, format, status, modality')
            .eq('organization_id', tournament.organization_id)
            .eq('level', tournament.level)
            .in('status', ['completed', 'finalized', 'finished']);

        if (rankingTournamentsError) throw rankingTournamentsError;

        const filteredRankingTournaments = (rankingTournaments || []).filter((rankingTournament: any) => {
            if (String(tournament?.modality || '').toLowerCase() === 'dobles') return rankingTournament.modality === 'dobles';
            return !rankingTournament.modality || rankingTournament.modality === 'singles';
        });

        if (!filteredRankingTournaments.length) {
            return playerIds.reduce((acc: Record<string, number>, playerId) => {
                acc[playerId] = 0;
                return acc;
            }, {});
        }

        const rankingTournamentIds = filteredRankingTournaments.map((rankingTournament: any) => rankingTournament.id);
        const { data: rankingMatches, error: rankingMatchesError } = await supabase
            .from('matches')
            .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status')
            .in('tournament_id', rankingTournamentIds);

        if (rankingMatchesError) throw rankingMatchesError;

        const rankingMatchesByTournament = (rankingMatches || []).reduce((acc: Record<string, any[]>, match: any) => {
            acc[match.tournament_id] = [...(acc[match.tournament_id] || []), match];
            return acc;
        }, {});

        const rankingTotals: Record<string, number> = {};
        filteredRankingTournaments.forEach((rankingTournament: any) => {
            const placements = getTournamentPlacements(rankingTournament, rankingMatchesByTournament[rankingTournament.id] || []);
            placements.forEach((placement) => {
                if (placement.playerId) {
                    rankingTotals[placement.playerId] = (rankingTotals[placement.playerId] || 0) + (Number(placement.points) || 0);
                }
                if (placement.playerId2) {
                    rankingTotals[placement.playerId2] = (rankingTotals[placement.playerId2] || 0) + (Number(placement.points) || 0);
                }
            });
        });

        return playerIds.reduce((acc: Record<string, number>, playerId) => {
            acc[playerId] = rankingTotals[playerId] || 0;
            return acc;
        }, {});
    };

    const buildRegisteredSinglesEntries = (rankingMap: Record<string, number>) =>
        players
            .map((registration) => String(registration.player_id || '').trim())
            .filter((playerId, index, allPlayerIds) => UUID_PATTERN.test(playerId) && allPlayerIds.indexOf(playerId) === index)
            .sort((leftId, rightId) => {
                const pointsDiff = (rankingMap[rightId] || 0) - (rankingMap[leftId] || 0);
                if (pointsDiff !== 0) return pointsDiff;
                return getPlayerName(leftId).localeCompare(getPlayerName(rightId));
            })
            .map((playerId) => ({
                kind: 'registered' as const,
                p1Id: playerId,
                p1Name: getPlayerName(playerId),
                rankPoints: rankingMap[playerId] || 0
            }));

    const buildManualSinglesEntries = (manualNames: string[]) => {
        const seen = new Set<string>();
        const uniqueManualNames = manualNames
            .map((manualName) => String(manualName || '').trim())
            .filter((manualName) => !isPlaceholderName(manualName) && !isByeName(manualName))
            .filter((manualName) => {
                const key = normalizeManualNameKey(manualName);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

        return shuffleArray(uniqueManualNames).map((manualName) => ({
            kind: 'manual' as const,
            p1Id: null,
            p1Name: manualName,
            rankPoints: -1
        }));
    };

    const buildManualDoublesEntries = (manualTeams: ManualDoublesTeam[]) => {
        const seen = new Set<string>();
        const uniqueTeams = manualTeams
            .map((team) => ({
                p1Name: String(team?.p1Name || '').trim(),
                p2Name: String(team?.p2Name || '').trim(),
                p1Id: UUID_PATTERN.test(String(team?.p1Id || '').trim()) ? String(team?.p1Id || '').trim() : null,
                p2Id: UUID_PATTERN.test(String(team?.p2Id || '').trim()) ? String(team?.p2Id || '').trim() : null
            }))
            .filter((team) => team.p1Name && team.p2Name)
            .filter((team) => !(team.p1Id && team.p2Id))
            .filter((team) => {
                if (isPlaceholderName(team.p1Name) || isPlaceholderName(team.p2Name)) return false;
                if (isByeName(team.p1Name) || isByeName(team.p2Name)) return false;
                const teamKey = buildManualDoublesTeamKey(team);
                if (!teamKey || seen.has(teamKey)) return false;
                seen.add(teamKey);
                return true;
            });

        return shuffleArray(uniqueTeams).map((team) => ({
            kind: 'manual' as const,
            p1Id: null,
            p2Id: null,
            p1Name: team.p1Name,
            p2Name: team.p2Name,
            rankPoints: -1
        }));
    };

    const buildRegisteredDoublesEntries = (rankingMap: Record<string, number>) => {
        const registeredPlayerIds = players
            .map((registration) => String(registration.player_id || '').trim())
            .filter((playerId, index, allPlayerIds) => UUID_PATTERN.test(playerId) && allPlayerIds.indexOf(playerId) === index)
            .sort((leftId, rightId) => {
                const pointsDiff = (rankingMap[rightId] || 0) - (rankingMap[leftId] || 0);
                if (pointsDiff !== 0) return pointsDiff;
                return getPlayerName(leftId).localeCompare(getPlayerName(rightId));
            });

        const doublesEntries: Array<{
            kind: 'registered';
            p1Id: string;
            p2Id: string | null;
            p1Name: string;
            p2Name: string | null;
            rankPoints: number;
        }> = [];
        const usedPlayerIds = new Set<string>();

        manualDoublesTeams.forEach((team) => {
            const p1Id = String(team.p1Id || '').trim();
            const p2Id = String(team.p2Id || '').trim();
            if (!UUID_PATTERN.test(p1Id) || !UUID_PATTERN.test(p2Id)) return;
            if (!registeredPlayerIds.includes(p1Id) || !registeredPlayerIds.includes(p2Id)) return;
            if (usedPlayerIds.has(p1Id) || usedPlayerIds.has(p2Id)) return;

            usedPlayerIds.add(p1Id);
            usedPlayerIds.add(p2Id);
            doublesEntries.push({
                kind: 'registered',
                p1Id,
                p2Id,
                p1Name: getPlayerName(p1Id),
                p2Name: getPlayerName(p2Id),
                rankPoints: (rankingMap[p1Id] || 0) + (rankingMap[p2Id] || 0)
            });
        });

        const sortedPlayers = registeredPlayerIds.filter((playerId) => !usedPlayerIds.has(playerId));

        for (let index = 0; index < sortedPlayers.length; index += 2) {
            const player1 = sortedPlayers[index];
            const player2 = sortedPlayers[index + 1] || null;
            doublesEntries.push({
                kind: 'registered',
                p1Id: player1,
                p2Id: player2,
                p1Name: getPlayerName(player1),
                p2Name: player2 ? getPlayerName(player2) : null,
                rankPoints: (rankingMap[player1] || 0) + (player2 ? (rankingMap[player2] || 0) : 0)
            });
        }

        return doublesEntries.sort((leftEntry, rightEntry) => {
            const pointsDiff = (rightEntry.rankPoints || 0) - (leftEntry.rankPoints || 0);
            if (pointsDiff !== 0) return pointsDiff;
            const leftName = `${leftEntry.p1Name} ${leftEntry.p2Name || ''}`.trim();
            const rightName = `${rightEntry.p1Name} ${rightEntry.p2Name || ''}`.trim();
            return leftName.localeCompare(rightName);
        });
    };

    const buildByeEntries = (count: number, isDoubles = false) =>
        Array.from({ length: Math.max(0, count) }, () => ({
            kind: 'bye' as const,
            p1Id: null,
            p2Id: null,
            p1Name: 'BYE',
            p2Name: isDoubles ? 'BYE' : null,
            rankPoints: -9999
        }));

    const getEntryPlayerValue = (entry: any, member: GroupMember | 1) => {
        if (!entry) return null;
        if (entry.kind !== 'registered') return null;
        if (member === 1) {
            return entry.p1Id || null;
        }
        return entry.p2Id || null;
    };

    const applyMatchPatchLocally = useCallback((matchId: string, patch: Record<string, any>) => {
        setMatches((currentMatches) =>
            currentMatches.map((candidate) =>
                candidate.id === matchId ? { ...candidate, ...patch } : candidate
            )
        );
    }, []);

    const extractManualSinglesNamesFromMainBracket = (firstRoundMatches: any[]) => {
        const uniqueNames = new Set<string>();
        const addName = (name?: string | null) => {
            const normalizedName = String(name || '').trim();
            if (!normalizedName || isPlaceholderName(normalizedName) || isByeName(normalizedName)) return;
            uniqueNames.add(normalizedName);
        };

        firstRoundMatches.forEach((match) => {
            addName(getAssignedNameForMatchSlot(match.id, 1));
            addName(getAssignedNameForMatchSlot(match.id, 3));
        });
        return [...uniqueNames];
    };

    const extractManualDoublesTeamsFromMainBracket = (firstRoundMatches: any[]) => {
        const uniqueTeams = new Set<string>();
        const parsedTeams: Array<{ p1Name: string; p2Name: string }> = [];

        const addTeam = (p1Raw?: string | null, p2Raw?: string | null) => {
            const p1Name = String(p1Raw || '').trim();
            const p2Name = String(p2Raw || '').trim();
            if (!p1Name || !p2Name) return;
            if (isPlaceholderName(p1Name) || isPlaceholderName(p2Name)) return;
            if (isByeName(p1Name) || isByeName(p2Name)) return;
            const teamKey = `${p1Name.toUpperCase()}::${p2Name.toUpperCase()}`;
            if (uniqueTeams.has(teamKey)) return;
            uniqueTeams.add(teamKey);
            parsedTeams.push({ p1Name, p2Name });
        };

        firstRoundMatches.forEach((match) => {
            addTeam(getAssignedNameForMatchSlot(match.id, 1), getAssignedNameForMatchSlot(match.id, 2));
            addTeam(getAssignedNameForMatchSlot(match.id, 3), getAssignedNameForMatchSlot(match.id, 4));
        });

        return parsedTeams;
    };

    const extractManualSinglesNamesFromGroups = () => {
        const uniqueNames = new Set<string>();
        const addName = (name?: string | null) => {
            const normalizedName = String(name || '').trim();
            if (!normalizedName || isPlaceholderName(normalizedName) || isByeName(normalizedName)) return;
            uniqueNames.add(normalizedName);
        };

        roundRobinGroupNames.forEach((groupName) => {
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
                addName(getAssignedNameForGroupSlot(groupName, slotIndex, 1));
            }
        });
        return [...uniqueNames];
    };

    const extractManualDoublesTeamsFromGroups = () => {
        const uniqueTeams = new Set<string>();
        const parsedTeams: Array<{ p1Name: string; p2Name: string }> = [];

        roundRobinGroupNames.forEach((groupName) => {
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
                const p1Name = String(getAssignedNameForGroupSlot(groupName, slotIndex, 1) || '').trim();
                const p2Name = String(getAssignedNameForGroupSlot(groupName, slotIndex, 2) || '').trim();
                if (!p1Name || !p2Name) continue;
                if (isPlaceholderName(p1Name) || isPlaceholderName(p2Name)) continue;
                if (isByeName(p1Name) || isByeName(p2Name)) continue;
                const teamKey = `${p1Name.toUpperCase()}::${p2Name.toUpperCase()}`;
                if (uniqueTeams.has(teamKey)) continue;
                uniqueTeams.add(teamKey);
                parsedTeams.push({ p1Name, p2Name });
            }
        });

        return parsedTeams;
    };

    const seedEliminationBracket = async (rankingMap: Record<string, number>, requestedSeedCount: number) => {
        const firstRoundMatches = matches
            .filter((match) =>
                !String(match.round || '').startsWith('Grupo ') &&
                !/^Consolaci/i.test(String(match.round || '')) &&
                !String(match.round || '').includes('RR') &&
                Number(match.round_number || 0) === 1
            )
            .sort((leftMatch, rightMatch) => (leftMatch.match_order || 0) - (rightMatch.match_order || 0));

        if (!firstRoundMatches.length) {
            Alert.alert('Información', 'No hay llaves iniciales disponibles para sembrar.');
            return;
        }

        const totalSlots = firstRoundMatches.length * 2;
        let registeredEntries: any[] = [];
        let manualEntries: any[] = [];
        if (IS_DOUBLES) {
            registeredEntries = buildRegisteredDoublesEntries(rankingMap);
            manualEntries = buildManualDoublesEntries([
                ...extractManualDoublesTeamsFromMainBracket(firstRoundMatches),
                ...manualDoublesTeams
            ]);
        } else {
            registeredEntries = buildRegisteredSinglesEntries(rankingMap);
            const manualSingles = [...extractManualSinglesNamesFromMainBracket(firstRoundMatches), ...manualParticipantSingles];
            manualEntries = buildManualSinglesEntries(manualSingles);
        }

        if (!registeredEntries.length && !manualEntries.length) {
            Alert.alert('Información', 'No hay participantes para sembrar todavía.');
            return;
        }

        const maxSeedable = registeredEntries.length;
        const normalizedSeedCount = Math.max(0, Math.min(Math.floor(requestedSeedCount || 0), maxSeedable));
        const seedLineBySeed = buildSeedLinesForDraw(totalSlots, normalizedSeedCount);
        const seededRegisteredEntries = registeredEntries.slice(0, normalizedSeedCount);
        const nonSeededCompetitiveEntries = shuffleArray([
            ...registeredEntries.slice(normalizedSeedCount),
            ...manualEntries
        ]);
        const participantEntries = [...seededRegisteredEntries, ...nonSeededCompetitiveEntries];
        const byeEntries = buildByeEntries(
            Math.max(0, totalSlots - participantEntries.length),
            IS_DOUBLES
        );
        const defaultEntry: any = buildByeEntries(1, IS_DOUBLES)[0];
        const slotAssignments: any[] = Array.from({ length: totalSlots }, () => null);

        seededRegisteredEntries.forEach((entry, seedIndex) => {
            const drawLine = seedLineBySeed[seedIndex] || (seedIndex + 1);
            slotAssignments[drawLine - 1] = entry || null;
        });

        const allLines = Array.from({ length: totalSlots }, (_unused, index) => index + 1);
        const remainingLines = allLines.filter((line) => !slotAssignments[line - 1]);

        const preferredByeLines: number[] = [];
        seededRegisteredEntries.forEach((_entry, seedIndex) => {
            const seededLine = seedLineBySeed[seedIndex] || (seedIndex + 1);
            const opponentLine = seededLine % 2 === 1 ? seededLine + 1 : seededLine - 1;
            if (!remainingLines.includes(opponentLine)) return;
            if (preferredByeLines.includes(opponentLine)) return;
            preferredByeLines.push(opponentLine);
        });

        let pendingByeEntries = [...byeEntries];
        preferredByeLines.forEach((line) => {
            if (!pendingByeEntries.length) return;
            if (slotAssignments[line - 1]) return;
            slotAssignments[line - 1] = pendingByeEntries[0];
            pendingByeEntries = pendingByeEntries.slice(1);
        });

        const openLines = allLines.filter((line) => !slotAssignments[line - 1]);
        const randomizedOpenLines = shuffleArray(openLines);
        const remainingPool = shuffleArray([
            ...nonSeededCompetitiveEntries,
            ...pendingByeEntries
        ]);

        randomizedOpenLines.forEach((line, index) => {
            slotAssignments[line - 1] = remainingPool[index] || defaultEntry;
        });

        slotAssignments.forEach((entry, index) => {
            if (!entry) slotAssignments[index] = defaultEntry;
        });

        const matchSlots: Record<string, Record<string, { name: string }>> = {};

        for (let matchIndex = 0; matchIndex < firstRoundMatches.length; matchIndex++) {
            const match = firstRoundMatches[matchIndex];
            const slotA = slotAssignments[matchIndex * 2];
            const slotB = slotAssignments[(matchIndex * 2) + 1];

            const updatePayload: any = {
                player_a_id: getEntryPlayerValue(slotA, 1),
                player_b_id: getEntryPlayerValue(slotB, 1),
                score: null,
                winner_id: null,
                winner_2_id: null,
                status: 'pending'
            };

            if (IS_DOUBLES) {
                updatePayload.player_a2_id = getEntryPlayerValue(slotA, 2);
                updatePayload.player_b2_id = getEntryPlayerValue(slotB, 2);
            }

            const { error } = await supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', match.id);

            if (error) throw error;

            if (slotA?.kind !== 'registered') {
                matchSlots[match.id] = {
                    ...(matchSlots[match.id] || {}),
                    [getMatchManualKey(1)]: { name: slotA.p1Name }
                };
                if (IS_DOUBLES && slotA.p2Name) {
                    matchSlots[match.id][getMatchManualKey(2)] = { name: slotA.p2Name };
                }
            }

            if (slotB?.kind !== 'registered') {
                matchSlots[match.id] = {
                    ...(matchSlots[match.id] || {}),
                    [getMatchManualKey(3)]: { name: slotB.p1Name }
                };
                if (IS_DOUBLES && slotB.p2Name) {
                    matchSlots[match.id][getMatchManualKey(4)] = { name: slotB.p2Name };
                }
            }
        }

        const firstRoundIds = new Set(firstRoundMatches.map((match) => match.id));
        const dependentMatches = matches.filter((match) => !firstRoundIds.has(match.id));
        for (const dependentMatch of dependentMatches) {
            const resetPayload: any = {
                player_a_id: null,
                player_b_id: null,
                score: null,
                winner_id: null,
                winner_2_id: null,
                status: 'pending'
            };
            if (IS_DOUBLES) {
                resetPayload.player_a2_id = null;
                resetPayload.player_b2_id = null;
            }

            const { error } = await supabase.from('matches').update(resetPayload).eq('id', dependentMatch.id);
            if (error) throw error;
        }

        await updateTournamentDescription(() => ({
            rrSlots: {},
            matchSlots
        }));
    };

    const seedRoundRobinGroups = async (rankingMap: Record<string, number>, requestedSeedCount: number) => {
        const roundRobinSlots = buildRoundRobinSeedSlots();
        if (!roundRobinSlots.length) {
            Alert.alert('Información', 'No hay cupos disponibles para sembrar en grupos.');
            return;
        }

        let registeredEntries: any[] = [];
        let manualEntries: any[] = [];
        if (IS_DOUBLES) {
            registeredEntries = buildRegisteredDoublesEntries(rankingMap);
            manualEntries = buildManualDoublesEntries([
                ...extractManualDoublesTeamsFromGroups(),
                ...manualDoublesTeams
            ]);
        } else {
            registeredEntries = buildRegisteredSinglesEntries(rankingMap);
            const manualSingles = [...extractManualSinglesNamesFromGroups(), ...manualParticipantSingles];
            manualEntries = buildManualSinglesEntries(manualSingles);
        }

        if (!registeredEntries.length && !manualEntries.length) {
            Alert.alert('Información', 'No hay participantes para sembrar todavía.');
            return;
        }

        const totalGroupSlots = roundRobinSlots.length;
        const maxSeedable = registeredEntries.length;
        const normalizedSeedCount = Math.max(0, Math.min(Math.floor(requestedSeedCount || 0), maxSeedable));
        const seededRegisteredEntries = registeredEntries.slice(0, normalizedSeedCount);
        const remainingEntries = shuffleArray([
            ...registeredEntries.slice(normalizedSeedCount),
            ...manualEntries,
            ...buildByeEntries(
                Math.max(0, totalGroupSlots - (registeredEntries.length + manualEntries.length)),
                IS_DOUBLES
            )
        ]).slice(0, Math.max(0, totalGroupSlots - seededRegisteredEntries.length));
        const randomizedEntries = [...seededRegisteredEntries, ...remainingEntries].slice(0, totalGroupSlots);
        const assignmentsByGroup = roundRobinSlots.reduce((acc: Record<string, Record<number, any>>, slot, slotIndex) => {
            acc[slot.groupName] = acc[slot.groupName] || {};
            acc[slot.groupName][slot.slotIndex] = randomizedEntries[slotIndex];
            return acc;
        }, {});

        const rrSlots: Record<string, Record<string, { name: string }>> = {};

        for (const groupName of roundRobinGroupNames) {
            const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                (leftMatch, rightMatch) => (leftMatch.match_order || 0) - (rightMatch.match_order || 0)
            );
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            const pairings = getRoundRobinPairings(slotCount);
            const groupAssignments = assignmentsByGroup[groupName] || {};

            for (let matchIndex = 0; matchIndex < groupMatches.length; matchIndex++) {
                const match = groupMatches[matchIndex];
                const pairing = pairings[matchIndex];
                if (!pairing) continue;
                const slotA = groupAssignments[pairing[0]];
                const slotB = groupAssignments[pairing[1]];

                const updatePayload: any = {
                    player_a_id: getEntryPlayerValue(slotA, 1),
                    player_b_id: getEntryPlayerValue(slotB, 1),
                    score: null,
                    winner_id: null,
                    winner_2_id: null,
                    status: 'pending'
                };
                if (IS_DOUBLES) {
                    updatePayload.player_a2_id = getEntryPlayerValue(slotA, 2);
                    updatePayload.player_b2_id = getEntryPlayerValue(slotB, 2);
                }

                const { error } = await supabase
                    .from('matches')
                    .update(updatePayload)
                    .eq('id', match.id);

                if (error) throw error;
            }

            Object.entries(groupAssignments).forEach(([slotKeyRaw, entry]) => {
                const slotIndex = Number(slotKeyRaw);
                if (!entry || entry.kind === 'registered') return;
                rrSlots[groupName] = rrSlots[groupName] || {};
                rrSlots[groupName][getGroupManualKey(slotIndex, 1)] = { name: entry.p1Name };
                if (IS_DOUBLES && entry.p2Name) {
                    rrSlots[groupName][getGroupManualKey(slotIndex, 2)] = { name: entry.p2Name };
                }
            });
        }

        for (const finalMatch of finalRoundRobinMatches) {
            const resetPayload: any = {
                player_a_id: null,
                player_b_id: null,
                score: null,
                winner_id: null,
                winner_2_id: null,
                status: 'pending'
            };
            if (IS_DOUBLES) {
                resetPayload.player_a2_id = null;
                resetPayload.player_b2_id = null;
            }
            const { error } = await supabase.from('matches').update(resetPayload).eq('id', finalMatch.id);
            if (error) throw error;
        }

        await updateTournamentDescription(() => ({
            rrSlots,
            matchSlots: {}
        }));
    };

    const runAutoSeeding = async (requestedSeedCount: number) => {
        setIsSeeding(true);
        try {
            const registeredPlayerIds = players
                .map((registration) => String(registration.player_id || '').trim())
                .filter((playerId, index, allPlayerIds) => UUID_PATTERN.test(playerId) && allPlayerIds.indexOf(playerId) === index);
            const rankingMap = await buildRankingMapForParticipants(registeredPlayerIds);

            if (isRoundRobin) {
                await seedRoundRobinGroups(rankingMap, requestedSeedCount);
            } else {
                await seedEliminationBracket(rankingMap, requestedSeedCount);
            }

            await loadTournamentData();
            Alert.alert('Éxito', 'Sembrado realizado correctamente.');
        } catch (error: any) {
            const detail = String(error?.message || '').trim();
            Alert.alert(
                'Error',
                detail
                    ? `No se pudo completar el sembrado automático. ${detail}`
                    : 'No se pudo completar el sembrado automático.'
            );
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSeedTournament = () => {
        const seedingContext = getSeedingContext();
        if (seedingContext.totalSlots <= 0) {
            Alert.alert('Información', 'No hay cupos disponibles para sembrar todavía.');
            return;
        }

        setSeedCountLimit(seedingContext.maxSeedable);
        setSeedCountInput(String(seedingContext.recommended));
        setIsSeedCountModalVisible(true);
    };

    const handleConfirmSeedCount = () => {
        const parsedValue = Number(seedCountInput.replace(/\D/g, ''));
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            Alert.alert('Error', 'Ingresa una cantidad válida de sembrados.');
            return;
        }

        const normalizedSeedCount = Math.max(0, Math.min(Math.floor(parsedValue), seedCountLimit));
        setIsSeedCountModalVisible(false);
        runAutoSeeding(normalizedSeedCount);
    };

    const ensureRegisteredPlayer = async (profileId: string) => {
        const existingPlayer = players.find(p => p.player_id === profileId);
        if (existingPlayer) return;

        const { error } = await supabase
            .from('registrations')
            .insert({ 
                tournament_id: id, 
                player_id: profileId, 
                status: 'confirmed',
                fee_amount: tournament?.registration_fee || 0,
                is_paid: false
            });

        if (error) {
            if (error.code !== '23505') throw error;
        }

        // Update local players state so the player name shows immediately
        const profileName =
            searchResults.find((user: any) => user.id === profileId)?.name || null;

        let resolvedName = profileName;
        let resolvedAvatar: string | null = null;
        if (!resolvedName) {
            const { data: profileData } = await supabase
                .from('public_profiles')
                .select('id, name, avatar_url')
                .eq('id', profileId)
                .maybeSingle();
            resolvedName = profileData?.name || 'Jugador';
            resolvedAvatar = profileData?.avatar_url || null;
        }

        setPlayers((currentPlayers) => {
            if (currentPlayers.some((player: any) => player.player_id === profileId)) {
                return currentPlayers;
            }
            return [
                ...currentPlayers,
                {
                    id: createUuid(),
                    tournament_id: id,
                    player_id: profileId,
                    status: 'confirmed',
                    fee_amount: tournament?.registration_fee || 0,
                    is_paid: false,
                    profiles: {
                        id: profileId,
                        name: resolvedName,
                        avatar_url: resolvedAvatar,
                    },
                },
            ];
        });
    };

    const assignPlayerToSelectedSlot = async (profileId: string) => {
        await ensureRegisteredPlayer(profileId);
        if (selectedGroupSlot) {
            const { groupName, slotIndex, member } = selectedGroupSlot;
            const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                (a, b) => (a.match_order || 0) - (b.match_order || 0)
            );
            const assignPartnerSlot = IS_DOUBLES && member === 2;
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            const pairings = getRoundRobinPairings(slotCount);

            for (let index = 0; index < groupMatches.length; index++) {
                const match = groupMatches[index];
                const pairing = pairings[index];
                if (!pairing) continue;

                const updateData: any = {};
                if (pairing[0] === slotIndex) {
                    if (assignPartnerSlot) updateData.player_a2_id = profileId;
                    else updateData.player_a_id = profileId;
                }
                if (pairing[1] === slotIndex) {
                    if (assignPartnerSlot) updateData.player_b2_id = profileId;
                    else updateData.player_b_id = profileId;
                }
                if (Object.keys(updateData).length === 0) continue;

                const { error } = await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('id', match.id);

                if (error) throw error;
                applyMatchPatchLocally(match.id, updateData);
            }

            await updateTournamentDescription(current => {
                const next = {
                    rrSlots: { ...(current.rrSlots || {}) },
                    matchSlots: { ...(current.matchSlots || {}) }
                };
                if (next.rrSlots[groupName]) {
                    delete next.rrSlots[groupName][getGroupManualKey(slotIndex, member)];
                    if (!IS_DOUBLES && member === 2) {
                        delete next.rrSlots[groupName][String(slotIndex)];
                    }
                    if (Object.keys(next.rrSlots[groupName]).length === 0) delete next.rrSlots[groupName];
                }
                return next;
            });
            return;
        }

        if (!selectedSlot) return;
        const { matchId, slot } = selectedSlot;
        const updateData: any = {};
        if (slot === 1) updateData.player_a_id = profileId;
        else if (slot === 2) updateData.player_a2_id = profileId;
        else if (slot === 3) updateData.player_b_id = profileId;
        else if (slot === 4) updateData.player_b2_id = profileId;

        const { error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) throw error;
        applyMatchPatchLocally(matchId, updateData);

        await updateTournamentDescription(current => {
            const next = {
                rrSlots: { ...(current.rrSlots || {}) },
                matchSlots: { ...(current.matchSlots || {}) }
            };
            if (next.matchSlots[matchId]) {
                delete next.matchSlots[matchId][getMatchManualKey(slot)];
                if (!IS_DOUBLES && (slot === 2 || slot === 4)) {
                    delete next.matchSlots[matchId][getMatchManualFallbackKey(slot)];
                }
                if (Object.keys(next.matchSlots[matchId]).length === 0) delete next.matchSlots[matchId];
            }
            return next;
        });
    };

    const assignDoublesTeamToSelectedSlot = async (team: ManualDoublesTeamRow) => {
        if (!IS_DOUBLES) return;
        if (!selectedSlot && !selectedGroupSlot) return;

        const currentTargetRegisteredIds = new Set<string>();
        if (selectedSlot) {
            const selectedMatchData = matches.find((match) => match.id === selectedSlot.matchId);
            if (selectedMatchData) {
                if (selectedSlot.slot === 1 || selectedSlot.slot === 2) {
                    [selectedMatchData.player_a_id, selectedMatchData.player_a2_id].forEach((playerId) => {
                        const normalizedId = String(playerId || '').trim();
                        if (UUID_PATTERN.test(normalizedId)) currentTargetRegisteredIds.add(normalizedId);
                    });
                } else {
                    [selectedMatchData.player_b_id, selectedMatchData.player_b2_id].forEach((playerId) => {
                        const normalizedId = String(playerId || '').trim();
                        if (UUID_PATTERN.test(normalizedId)) currentTargetRegisteredIds.add(normalizedId);
                    });
                }
            }
        }

        if (selectedGroupSlot) {
            const { groupName, slotIndex } = selectedGroupSlot;
            const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                (a, b) => (a.match_order || 0) - (b.match_order || 0)
            );
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            const pairings = getRoundRobinPairings(slotCount);
            for (let index = 0; index < groupMatches.length; index++) {
                const match = groupMatches[index];
                const pairing = pairings[index];
                if (!pairing) continue;
                if (pairing[0] === slotIndex) {
                    [match.player_a_id, match.player_a2_id].forEach((playerId) => {
                        const normalizedId = String(playerId || '').trim();
                        if (UUID_PATTERN.test(normalizedId)) currentTargetRegisteredIds.add(normalizedId);
                    });
                }
                if (pairing[1] === slotIndex) {
                    [match.player_b_id, match.player_b2_id].forEach((playerId) => {
                        const normalizedId = String(playerId || '').trim();
                        if (UUID_PATTERN.test(normalizedId)) currentTargetRegisteredIds.add(normalizedId);
                    });
                }
            }
        }

        const candidateRegisteredIds = [team.p1Id, team.p2Id]
            .map((playerId) => String(playerId || '').trim())
            .filter((playerId) => UUID_PATTERN.test(playerId));

        const hasConflict = candidateRegisteredIds.some(
            (playerId) => assignedRegisteredPlayerIds.has(playerId) && !currentTargetRegisteredIds.has(playerId)
        );
        if (hasConflict) {
            Alert.alert('Información', 'Esa dupla ya está asignada en otra llave/grupo.');
            return;
        }

        if (selectedGroupSlot) {
            const { groupName, slotIndex } = selectedGroupSlot;
            const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                (a, b) => (a.match_order || 0) - (b.match_order || 0)
            );
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            const pairings = getRoundRobinPairings(slotCount);

            for (let index = 0; index < groupMatches.length; index++) {
                const match = groupMatches[index];
                const pairing = pairings[index];
                if (!pairing) continue;

                const updateData: any = {};
                if (pairing[0] === slotIndex) {
                    updateData.player_a_id = UUID_PATTERN.test(String(team.p1Id || '')) ? team.p1Id : null;
                    updateData.player_a2_id = UUID_PATTERN.test(String(team.p2Id || '')) ? team.p2Id : null;
                }
                if (pairing[1] === slotIndex) {
                    updateData.player_b_id = UUID_PATTERN.test(String(team.p1Id || '')) ? team.p1Id : null;
                    updateData.player_b2_id = UUID_PATTERN.test(String(team.p2Id || '')) ? team.p2Id : null;
                }
                if (Object.keys(updateData).length === 0) continue;

                const { error } = await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('id', match.id);
                if (error) throw error;
                applyMatchPatchLocally(match.id, updateData);
            }

            await updateTournamentDescription((current) => ({
                rrSlots: {
                    ...(current.rrSlots || {}),
                    [groupName]: {
                        ...((current.rrSlots || {})[groupName] || {}),
                        [getGroupManualKey(slotIndex, 1)]: { name: team.p1Name },
                        [getGroupManualKey(slotIndex, 2)]: { name: team.p2Name },
                    }
                },
                matchSlots: { ...(current.matchSlots || {}) }
            }));
            return;
        }

        if (!selectedSlot) return;
        const { matchId, slot } = selectedSlot;
        const updateData: any = {};
        if (slot === 1 || slot === 2) {
            updateData.player_a_id = UUID_PATTERN.test(String(team.p1Id || '')) ? team.p1Id : null;
            updateData.player_a2_id = UUID_PATTERN.test(String(team.p2Id || '')) ? team.p2Id : null;
        } else {
            updateData.player_b_id = UUID_PATTERN.test(String(team.p1Id || '')) ? team.p1Id : null;
            updateData.player_b2_id = UUID_PATTERN.test(String(team.p2Id || '')) ? team.p2Id : null;
        }

        const { error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', matchId);
        if (error) throw error;
        applyMatchPatchLocally(matchId, updateData);

        await updateTournamentDescription((current) => ({
            rrSlots: { ...(current.rrSlots || {}) },
            matchSlots: {
                ...(current.matchSlots || {}),
                [matchId]: {
                    ...((current.matchSlots || {})[matchId] || {}),
                    ...(slot === 1 || slot === 2
                        ? {
                            [getMatchManualKey(1)]: { name: team.p1Name },
                            [getMatchManualKey(2)]: { name: team.p2Name },
                        }
                        : {
                            [getMatchManualKey(3)]: { name: team.p1Name },
                            [getMatchManualKey(4)]: { name: team.p2Name },
                        })
                }
            }
        }));
    };

    const createManualProfileAndAssign = async (name: string, keepModalOpen = assignmentTargets.length > 1) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            Alert.alert('Error', 'Ingresa un nombre para el jugador manual.');
            return;
        }
        const assignPairBye = IS_DOUBLES && isByeName(trimmedName);

        try {
            await removeMatchPlayer(false, false);

            if (assignPairBye && selectedSlot) {
                const { matchId, slot } = selectedSlot;
                const pairField =
                    slot === 1
                        ? 'player_a2_id'
                        : slot === 2
                            ? 'player_a_id'
                            : slot === 3
                                ? 'player_b2_id'
                                : 'player_b_id';
                const clearPairPayload: any = { [pairField]: null };
                const { error: clearPairError } = await supabase
                    .from('matches')
                    .update(clearPairPayload)
                    .eq('id', matchId);
                if (clearPairError) throw clearPairError;
                applyMatchPatchLocally(matchId, clearPairPayload);
            }

            if (assignPairBye && selectedGroupSlot) {
                const { groupName, slotIndex, member } = selectedGroupSlot;
                const pairMember = member === 2 ? 1 : 2;
                const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                    (a, b) => (a.match_order || 0) - (b.match_order || 0)
                );
                const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
                const pairings = getRoundRobinPairings(slotCount);

                for (let index = 0; index < groupMatches.length; index++) {
                    const match = groupMatches[index];
                    const pairing = pairings[index];
                    if (!pairing) continue;

                    const updateData: any = {};
                    if (pairing[0] === slotIndex) {
                        updateData[pairMember === 2 ? 'player_a2_id' : 'player_a_id'] = null;
                    }
                    if (pairing[1] === slotIndex) {
                        updateData[pairMember === 2 ? 'player_b2_id' : 'player_b_id'] = null;
                    }
                    if (Object.keys(updateData).length === 0) continue;

                    const { error } = await supabase
                        .from('matches')
                        .update(updateData)
                        .eq('id', match.id);
                    if (error) throw error;
                    applyMatchPatchLocally(match.id, updateData);
                }
            }

            if (selectedGroupSlot) {
                const { groupName, slotIndex, member } = selectedGroupSlot;
                await updateTournamentDescription(current => ({
                    rrSlots: {
                        ...(current.rrSlots || {}),
                        [groupName]: {
                            ...((current.rrSlots || {})[groupName] || {}),
                            [getGroupManualKey(slotIndex, member)]: { name: trimmedName },
                            ...(assignPairBye ? { [getGroupManualKey(slotIndex, member === 2 ? 1 : 2)]: { name: 'BYE' } } : {})
                        }
                    },
                    matchSlots: { ...(current.matchSlots || {}) }
                }));
            } else if (selectedSlot) {
                const { matchId, slot } = selectedSlot;
                const pairSlot = slot === 1 ? 2 : slot === 2 ? 1 : slot === 3 ? 4 : 3;
                await updateTournamentDescription(current => ({
                    rrSlots: { ...(current.rrSlots || {}) },
                    matchSlots: {
                        ...(current.matchSlots || {}),
                        [matchId]: {
                            ...((current.matchSlots || {})[matchId] || {}),
                            [getMatchManualKey(slot)]: { name: trimmedName },
                            ...(assignPairBye ? { [getMatchManualKey(pairSlot)]: { name: 'BYE' } } : {})
                        }
                    }
                }));
            } else {
                return;
            }

            if (!IS_DOUBLES && !isByeName(trimmedName)) {
                await updateTournamentManualParticipants((current) => {
                    const normalizedNameKey = normalizeManualNameKey(trimmedName);
                    if (!normalizedNameKey) return current;

                    const alreadyExists = (current.singles || []).some(
                        (candidate) => normalizeManualNameKey(candidate) === normalizedNameKey
                    );

                    return {
                        singles: alreadyExists ? [...(current.singles || [])] : [...(current.singles || []), trimmedName],
                        doubles: [...(current.doubles || [])],
                    };
                });
            }

            setManualPlayerName('');
            setManualPlayerName2('');
            setSearchQuery('');
            setSearchResults([]);
            if (isByeName(trimmedName)) {
                await loadTournamentData();
            }
            if (keepModalOpen && assignmentTargets.length > 1) {
                moveToNextAssignmentTarget();
            } else {
                closePlayerSelectionModal();
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo crear el jugador manual.');
        }
    };

    const addManualParticipantToPool = async (
        name: string,
        secondName?: string | null,
        options?: { p1Id?: string | null; p2Id?: string | null }
    ) => {
        const trimmedName = String(name || '').trim();
        const trimmedSecondName = String(secondName || '').trim();
        if (!trimmedName) {
            Alert.alert('Error', IS_DOUBLES ? 'Ingresa el nombre del Jugador 1.' : 'Ingresa un nombre para el participante manual.');
            return;
        }

        if (isByeName(trimmedName) || (IS_DOUBLES && isByeName(trimmedSecondName))) {
            Alert.alert('Información', 'El valor BYE solo puede asignarse desde una llave o grupo.');
            return;
        }

        if (IS_DOUBLES && !trimmedSecondName) {
            Alert.alert('Error', 'Ingresa el nombre del Jugador 2 para crear la dupla.');
            return;
        }

        try {
            await updateTournamentManualParticipants((current) => {
                const nextSingles = [...(current.singles || [])];
                const nextDoubles = [...(current.doubles || [])];

                if (IS_DOUBLES) {
                    const nextTeam: ManualDoublesTeam = {
                        p1Name: trimmedName,
                        p2Name: trimmedSecondName,
                        p1Id: UUID_PATTERN.test(String(options?.p1Id || '').trim()) ? String(options?.p1Id || '').trim() : null,
                        p2Id: UUID_PATTERN.test(String(options?.p2Id || '').trim()) ? String(options?.p2Id || '').trim() : null
                    };
                    const nextTeamKey = buildManualDoublesTeamKey(nextTeam);
                    const alreadyExists = nextDoubles.some((team) => buildManualDoublesTeamKey(team) === nextTeamKey);
                    if (!alreadyExists) {
                        nextDoubles.push(nextTeam);
                    }
                } else {
                    const normalizedNameKey = normalizeManualNameKey(trimmedName);
                    const alreadyExists = nextSingles.some((candidate) => normalizeManualNameKey(candidate) === normalizedNameKey);
                    if (!alreadyExists) {
                        nextSingles.push(trimmedName);
                    }
                }

                return {
                    singles: nextSingles,
                    doubles: nextDoubles
                };
            });

            setManualPlayerName('');
            setManualPlayerName2('');
            setSearchQuery('');
            setSearchResults([]);
            setIsManualPlayerModalVisible(false);
        } catch (error) {
            Alert.alert('Error', IS_DOUBLES ? 'No se pudo agregar la dupla.' : 'No se pudo agregar el participante manual.');
        }
    };

    const removeManualParticipantFromPool = async (
        name: string,
        secondName?: string | null,
        options?: { p1Id?: string | null; p2Id?: string | null }
    ) => {
        const normalizedNameKey = normalizeManualNameKey(name);
        const normalizedSecondNameKey = normalizeManualNameKey(secondName);
        if (!normalizedNameKey) return;

        try {
            await updateTournamentManualParticipants((current) => {
                if (IS_DOUBLES) {
                    const removalKey = buildManualDoublesTeamKey({
                        p1Name: name,
                        p2Name: String(secondName || ''),
                        p1Id: options?.p1Id || null,
                        p2Id: options?.p2Id || null
                    });
                    return {
                        singles: [...(current.singles || [])],
                        doubles: (current.doubles || []).filter((team) => {
                            const teamKey = buildManualDoublesTeamKey(team);
                            if (teamKey && removalKey) return teamKey !== removalKey;
                            const p1Key = normalizeManualNameKey(team.p1Name);
                            const p2Key = normalizeManualNameKey(team.p2Name);
                            return !(p1Key === normalizedNameKey && p2Key === normalizedSecondNameKey);
                        })
                    };
                }

                return {
                    singles: (current.singles || []).filter(
                        (candidate) => normalizeManualNameKey(candidate) !== normalizedNameKey
                    ),
                    doubles: [...(current.doubles || [])]
                };
            });
        } catch (error) {
            Alert.alert('Error', IS_DOUBLES ? 'No se pudo eliminar la dupla.' : 'No se pudo eliminar el participante manual.');
        }
    };

    const updateMatchPlayer = async (profileId: string) => {
        if (!selectedSlot && !selectedGroupSlot) {
            await registerParticipant(profileId, { keepModalOpen: true });
            return;
        }

        const isAlreadyAssignedElsewhere = (() => {
            if (!UUID_PATTERN.test(profileId)) return false;

            if (selectedSlot) {
                const currentMatch = matches.find((match) => match.id === selectedSlot.matchId);
                const currentTargetId =
                    selectedSlot.slot === 1 ? currentMatch?.player_a_id :
                    selectedSlot.slot === 2 ? currentMatch?.player_a2_id :
                    selectedSlot.slot === 3 ? currentMatch?.player_b_id :
                    currentMatch?.player_b2_id;
                if (currentTargetId === profileId) return false;
            }

            if (selectedGroupSlot) {
                const { groupName, slotIndex, member } = selectedGroupSlot;
                const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                    (a, b) => (a.match_order || 0) - (b.match_order || 0)
                );
                const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
                const pairings = getRoundRobinPairings(slotCount);
                const currentTargetIds = new Set<string>();

                groupMatches.forEach((match, index) => {
                    const pairing = pairings[index];
                    if (!pairing) return;
                    if (pairing[0] === slotIndex) {
                        const candidateId = member === 2 ? match.player_a2_id : match.player_a_id;
                        if (UUID_PATTERN.test(String(candidateId || ''))) {
                            currentTargetIds.add(String(candidateId));
                        }
                    }
                    if (pairing[1] === slotIndex) {
                        const candidateId = member === 2 ? match.player_b2_id : match.player_b_id;
                        if (UUID_PATTERN.test(String(candidateId || ''))) {
                            currentTargetIds.add(String(candidateId));
                        }
                    }
                });

                if (currentTargetIds.has(profileId)) return false;
            }

            return assignedRegisteredPlayerIds.has(profileId);
        })();

        if (isAlreadyAssignedElsewhere) {
            Alert.alert('Información', 'Ese jugador ya está asignado en otra llave/grupo.');
            return;
        }

        try {
            await assignPlayerToSelectedSlot(profileId);
            resetPlayerSelectionSearch();
            if (assignmentTargets.length > 1) {
                moveToNextAssignmentTarget();
            } else {
                closePlayerSelectionModal();
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo asignar el jugador.');
        }
    };

    const rollbackWinnerFromFollowingRounds = async (
        originMatch: any,
        winnerId: string | null,
        winner2Id: string | null,
        sourceMatches: any[]
    ) => {
        if (!winnerId) return;

        const nextLink = getNextMatchLink(originMatch, sourceMatches);
        if (!nextLink) return;
        const { nextMatch, nextSlotField, nextSlotField2 } = nextLink;

        const slotMatchesWinner =
            nextMatch?.[nextSlotField] === winnerId &&
            (!IS_DOUBLES || (nextMatch?.[nextSlotField2] || null) === (winner2Id || null));

        if (!slotMatchesWinner) return;

        const nextWinnerId = nextMatch?.winner_id || null;
        const nextWinner2Id = nextMatch?.winner_2_id || null;

        const clearPayload: any = { [nextSlotField]: null };
        if (IS_DOUBLES) {
            clearPayload[nextSlotField2] = null;
        }

        if (
            String(nextMatch?.score || '').toUpperCase() === 'W.O.' ||
            nextMatch?.winner_id === winnerId ||
            (IS_DOUBLES && winner2Id && nextMatch?.winner_2_id === winner2Id)
        ) {
            clearPayload.score = null;
            clearPayload.status = 'pending';
            clearPayload.winner_id = null;
            clearPayload.winner_2_id = null;
        }

        const { error } = await supabase
            .from('matches')
            .update(clearPayload)
            .eq('id', nextMatch.id);

        if (error) throw error;

        const updatedMatches = sourceMatches.map((candidate) =>
            candidate.id === nextMatch.id ? { ...candidate, ...clearPayload } : candidate
        );

        if (nextWinnerId && (clearPayload.winner_id === null || clearPayload.score === null)) {
            await rollbackWinnerFromFollowingRounds(nextMatch, nextWinnerId, nextWinner2Id, updatedMatches);
        }
    };

    const removeMatchPlayer = async (closeModal = true, reload = true) => {
        try {
            if (selectedGroupSlot) {
                const { groupName, slotIndex, member } = selectedGroupSlot;
                const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                    (a, b) => (a.match_order || 0) - (b.match_order || 0)
                );
                const groupRows = getGroupRows(groupName);
                const pairings = getRoundRobinPairings(groupRows.length);

                for (let index = 0; index < groupMatches.length; index++) {
                    const match = groupMatches[index];
                    const pairing = pairings[index];
                    if (!pairing) continue;

                    const updateData: any = {};
                    if (pairing[0] === slotIndex) {
                        if (IS_DOUBLES && member === 2) updateData.player_a2_id = null;
                        else updateData.player_a_id = null;
                    }
                    if (pairing[1] === slotIndex) {
                        if (IS_DOUBLES && member === 2) updateData.player_b2_id = null;
                        else updateData.player_b_id = null;
                    }
                    if (Object.keys(updateData).length === 0) continue;

                    const { error } = await supabase
                        .from('matches')
                        .update(updateData)
                        .eq('id', match.id);

                    if (error) throw error;
                    applyMatchPatchLocally(match.id, updateData);
                }

                await updateTournamentDescription(current => {
                    const next = {
                        rrSlots: { ...(current.rrSlots || {}) },
                        matchSlots: { ...(current.matchSlots || {}) }
                    };
                    if (next.rrSlots[groupName]) {
                        delete next.rrSlots[groupName][getGroupManualKey(slotIndex, member)];
                        if (!IS_DOUBLES && member === 2) {
                            delete next.rrSlots[groupName][String(slotIndex)];
                        }
                        if (Object.keys(next.rrSlots[groupName]).length === 0) delete next.rrSlots[groupName];
                    }
                    return next;
                });
            } else if (selectedSlot) {
                const { matchId, slot } = selectedSlot;
                const selectedMatchData = matches.find((candidate) => candidate.id === matchId);
                const matchForRollback = selectedMatchData;

                if (matchForRollback && (matchForRollback.winner_id || matchForRollback.winner_2_id || matchForRollback.score)) {
                    await rollbackWinnerFromFollowingRounds(
                        matchForRollback,
                        matchForRollback.winner_id || null,
                        matchForRollback.winner_2_id || null,
                        matches
                    );
                }

                const updateData: any = {};
                if (slot === 1) updateData.player_a_id = null;
                else if (slot === 2) updateData.player_a2_id = null;
                else if (slot === 3) updateData.player_b_id = null;
                else if (slot === 4) updateData.player_b2_id = null;

                if (matchForRollback && (matchForRollback.winner_id || matchForRollback.winner_2_id || matchForRollback.score)) {
                    updateData.score = null;
                    updateData.winner_id = null;
                    updateData.winner_2_id = null;
                    updateData.status = 'pending';
                }

                const { error } = await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('id', matchId);

                if (error) throw error;
                applyMatchPatchLocally(matchId, updateData);

                await updateTournamentDescription(current => {
                    const next = {
                        rrSlots: { ...(current.rrSlots || {}) },
                        matchSlots: { ...(current.matchSlots || {}) }
                    };
                    if (next.matchSlots[matchId]) {
                        delete next.matchSlots[matchId][getMatchManualKey(slot)];
                        if (!IS_DOUBLES && (slot === 2 || slot === 4)) {
                            delete next.matchSlots[matchId][getMatchManualFallbackKey(slot)];
                        }
                        if (Object.keys(next.matchSlots[matchId]).length === 0) delete next.matchSlots[matchId];
                    }
                    return next;
                });
            }

            if (reload) {
                await loadTournamentData(false);
            }
            if (closeModal) {
                closePlayerSelectionModal();
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo quitar el jugador.');
        }
    };

    const tournamentFormat = tournament?.format;
    const tournamentMaxPlayers = tournament?.max_players || 2;
    const isRoundRobin = isRoundRobinFormat(tournamentFormat);
    const hasConsolation = hasConsolationBracket(tournamentFormat);

    const handleDeleteTournament = () => {
        Alert.alert(
            "Eliminar Torneo",
            "¿Estás seguro de que deseas eliminar este torneo completamente? Esta acción es irreversible.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('tournaments')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;

                            router.replace({
                                pathname: '/(tabs)/tournaments',
                                params: { orgId: tournament?.organization_id }
                            } as any);
                        } catch (error) {
                            Alert.alert('Error', 'Hubo un problema al eliminar el torneo.');
                        }
                    }
                }
            ]
        );
    };

    const sortStandingRows = (leftRow: any, rightRow: any) => {
        if (leftRow.finish !== rightRow.finish) return leftRow.finish - rightRow.finish;
        if (rightRow.points !== leftRow.points) return rightRow.points - leftRow.points;
        if (rightRow.diff !== leftRow.diff) return rightRow.diff - leftRow.diff;
        if (rightRow.gamesWon !== leftRow.gamesWon) return rightRow.gamesWon - leftRow.gamesWon;
        return String(leftRow.name || '').localeCompare(String(rightRow.name || ''));
    };

    const isValidStandingQualifier = (row: any) => {
        if (!row) return false;
        if (IS_DOUBLES) {
            const nameA = String(row.p1Name || '').trim();
            const nameB = String(row.p2Name || '').trim();
            if (!nameA || !nameB) return false;
            if (isPlaceholderName(nameA) || isPlaceholderName(nameB)) return false;
            if (isByeName(nameA) || isByeName(nameB)) return false;
            return true;
        }
        const name = String(row.p1Name || row.name || '').trim();
        if (!name) return false;
        if (isPlaceholderName(name)) return false;
        if (isByeName(name)) return false;
        return true;
    };

    const getStandingQualifierKey = (row: any) => {
        if (!row) return '';
        if (IS_DOUBLES) {
            const playerAId = UUID_PATTERN.test(String(row.p1Id || '').trim()) ? String(row.p1Id || '').trim() : null;
            const playerBId = UUID_PATTERN.test(String(row.p2Id || '').trim()) ? String(row.p2Id || '').trim() : null;
            if (playerAId && playerBId) {
                return [playerAId.toUpperCase(), playerBId.toUpperCase()].sort().join('::');
            }
            const nameA = normalizeManualNameKey(row.p1Name || '');
            const nameB = normalizeManualNameKey(row.p2Name || '');
            if (!nameA || !nameB) return '';
            return [nameA, nameB].sort().join('::');
        }

        const playerId = UUID_PATTERN.test(String(row.id || '').trim()) ? String(row.id || '').trim() : null;
        if (playerId) return playerId.toUpperCase();
        return normalizeManualNameKey(row.p1Name || row.name || '');
    };

    const getRoundRobinFinalStageContextFromPool = (pool: any[]) => {
        const candidateMatches = [...pool]
            .filter((match) => !/3er|4to|5to|6to|puesto/i.test(String(match.round || '')))
            .sort((leftMatch, rightMatch) => {
                if ((leftMatch.round_number || 0) !== (rightMatch.round_number || 0)) {
                    return (leftMatch.round_number || 0) - (rightMatch.round_number || 0);
                }
                return (leftMatch.match_order || 0) - (rightMatch.match_order || 0);
            });

        const minRoundNumber = candidateMatches.reduce(
            (minimumRound, currentMatch) =>
                Math.min(minimumRound, Number(currentMatch.round_number || minimumRound)),
            Number.MAX_SAFE_INTEGER
        );
        const firstRoundMatches = Number.isFinite(minRoundNumber)
            ? candidateMatches.filter((match) => Number(match.round_number || 0) === minRoundNumber)
            : [];

        const maxSlots = Math.max(2, firstRoundMatches.length * 2);

        return {
            firstRoundMatches,
            maxSlots,
        };
    };

    const getRoundRobinFinalStageContext = () => {
        const totalAvailableEntries = roundRobinGroupNames.reduce(
            (accumulator, groupName) => accumulator + getStandingsForGroup(groupName).length,
            0
        );
        return {
            ...getRoundRobinFinalStageContextFromPool(finalRoundRobinMatches),
            totalAvailableEntries,
        };
    };

    const fetchFinalRoundRobinMatchesFromDb = async () => {
        const { data, error } = await supabase
            .from('matches')
            .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, status, score, winner_id, winner_2_id, scheduled_at, court')
            .eq('tournament_id', id)
            .not('round', 'ilike', 'Grupo %')
            .order('round_number', { ascending: true })
            .order('match_order', { ascending: true });

        if (error) throw error;
        return data || [];
    };

    const nextPowerOfTwoForFinals = (value: number) => {
        let size = 2;
        while (size < value) size *= 2;
        return size;
    };

    const getEliminationRoundNameForFinals = (roundIndex: number, roundsCount: number) => {
        if (roundsCount === 1) return 'Gran Final RR';
        if (roundIndex === roundsCount) return 'Gran Final RR';
        if (roundIndex === roundsCount - 1) return 'Semifinales RR';
        if (roundIndex === roundsCount - 2) return 'Cuartos de Final RR';
        if (roundIndex === roundsCount - 3) return 'Octavos de Final RR';
        return `Ronda ${roundIndex} RR`;
    };

    const syncRoundRobinFinalBracket = async (qualifiersCount: number) => {
        const normalizedQualifiers = Math.max(2, qualifiersCount);
        const bracketSize = nextPowerOfTwoForFinals(normalizedQualifiers);
        const roundsCount = Math.log2(bracketSize);

        const desiredStructure: Array<{ round: string; round_number: number; match_order: number }> = [];
        let matchOrderCounter = 1;
        let matchesInRound = bracketSize / 2;
        for (let roundIndex = 1; roundIndex <= roundsCount; roundIndex++) {
            const roundName = getEliminationRoundNameForFinals(roundIndex, roundsCount);
            for (let index = 0; index < matchesInRound; index++) {
                desiredStructure.push({
                    round: roundName,
                    round_number: roundIndex,
                    match_order: matchOrderCounter++
                });
            }
            matchesInRound /= 2;
        }

        const currentPool = await fetchFinalRoundRobinMatchesFromDb();
        const editableMatches = currentPool
            .filter((match) => !/3er|4to|5to|6to|puesto/i.test(String(match.round || '')))
            .sort((leftMatch, rightMatch) => {
                if ((leftMatch.round_number || 0) !== (rightMatch.round_number || 0)) {
                    return (leftMatch.round_number || 0) - (rightMatch.round_number || 0);
                }
                return (leftMatch.match_order || 0) - (rightMatch.match_order || 0);
            });

        const baseResetPayload: any = {
            player_a_id: null,
            player_b_id: null,
            winner_id: null,
            winner_2_id: null,
            score: null,
            status: 'pending',
        };
        if (IS_DOUBLES) {
            baseResetPayload.player_a2_id = null;
            baseResetPayload.player_b2_id = null;
        }

        for (let index = 0; index < desiredStructure.length; index++) {
            const desiredMatch = desiredStructure[index];
            const existingMatch = editableMatches[index];
            const updatePayload: any = {
                ...baseResetPayload,
                round: desiredMatch.round,
                round_number: desiredMatch.round_number,
                match_order: desiredMatch.match_order
            };

            if (existingMatch) {
                const { error } = await supabase
                    .from('matches')
                    .update(updatePayload)
                    .eq('id', existingMatch.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('matches')
                    .insert({
                        tournament_id: id,
                        ...updatePayload
                    });
                if (error) throw error;
            }
        }

        const extraMatches = editableMatches.slice(desiredStructure.length);
        if (extraMatches.length > 0) {
            const extraIds = extraMatches.map((match) => match.id);
            const { error } = await supabase
                .from('matches')
                .delete()
                .in('id', extraIds);
            if (error) throw error;
        }

        return fetchFinalRoundRobinMatchesFromDb();
    };

    const generateRRPlacementMatches = async () => {
        try {
            const placementRoundNames = ['3er y 4to Puesto RR', '5to y 6to Puesto RR'];
            const matchesToCreate = [];
            let lastOrder = matches.length > 0 ? Math.max(...matches.map(m => m.match_order || 0)) : 0;

            for (const roundName of placementRoundNames) {
                // Check if already exists
                if (matches.some(m => m.round === roundName)) continue;
                
                matchesToCreate.push({
                    tournament_id: id,
                    round: roundName,
                    round_number: 10, // Higher number to avoid propagation conflicts
                    match_order: ++lastOrder,
                    status: 'pending',
                });
            }

            if (matchesToCreate.length === 0) {
                Alert.alert('Info', 'Los partidos de posicionamiento ya existen o no son aplicables.');
                return;
            }

            const { data, error } = await supabase.from('matches').insert(matchesToCreate).select();
            if (error) throw error;
            
            setMatches(prev => [...prev, ...(data || [])]);
            Alert.alert('Éxito', 'Partidos de posicionamiento generados.');
        } catch (error) {
            Alert.alert('Error', 'No se pudieron generar los partidos.');
        }
    };

    const generateRoundRobinFinals = async (qualifiersPerGroup: number) => {
        try {
            const seenQualifiers = new Set<string>();
            const groupedStandings = roundRobinGroupNames.map((groupName) => ({
                groupName,
                rows: getStandingsForGroup(groupName)
                    .map((row: any, index: number) => ({
                        ...row,
                        finish: index + 1,
                        groupName
                    }))
                    .filter(isValidStandingQualifier)
                    .filter((row: any) => {
                        const key = getStandingQualifierKey(row);
                        if (!key || seenQualifiers.has(key)) return false;
                        seenQualifiers.add(key);
                        return true;
                    })
            }));
            const sortedGlobalStandings = groupedStandings
                .flatMap((group) => group.rows)
                .sort(sortStandingRows);

            if (sortedGlobalStandings.length < 2) {
                Alert.alert('Error', 'No hay suficientes duplas válidas para generar las llaves.');
                return;
            }

            const parsedPerGroup = Math.max(1, Math.floor(qualifiersPerGroup || 1));
            const totalQualifiersRequested = roundRobinGroupNames.length <= 1
                ? parsedPerGroup
                : roundRobinGroupNames.length * parsedPerGroup;
            const requestedQualifiersCount = Math.max(
                2,
                Math.min(Math.floor(totalQualifiersRequested), sortedGlobalStandings.length)
            );

            const refreshedPool = await syncRoundRobinFinalBracket(requestedQualifiersCount);
            setMatches((currentMatches) => {
                const groupMatches = currentMatches.filter((match) => String(match.round || '').startsWith('Grupo '));
                return [...groupMatches, ...refreshedPool];
            });
            const stageContext = {
                ...getRoundRobinFinalStageContextFromPool(refreshedPool),
                totalAvailableEntries: groupedStandings.reduce((acc, group) => acc + group.rows.length, 0)
            };

            const bracketSize = stageContext.maxSlots;
            const normalizedQualifiersCount = Math.max(
                2,
                Math.min(requestedQualifiersCount, bracketSize, sortedGlobalStandings.length)
            );
            const selectedMatches = stageContext.firstRoundMatches;
            if (!selectedMatches.length) {
                Alert.alert('Error', 'No se pudieron preparar las llaves finales.');
                return;
            }

            let bracketSlots: any[] = Array.from({ length: bracketSize }, () => null);
            if (roundRobinGroupNames.length === 2) {
                const groupAQualifiers = groupedStandings[0]?.rows.slice(0, parsedPerGroup) || [];
                const groupBQualifiers = groupedStandings[1]?.rows.slice(0, parsedPerGroup) || [];
                const effectivePerGroup = Math.min(parsedPerGroup, groupAQualifiers.length, groupBQualifiers.length);

                if (effectivePerGroup > 0) {
                    const mirroredEntries: any[] = [];
                    const topBlockCount = Math.ceil(effectivePerGroup / 2);

                    // Group A top half vs Group B mirrored bottom half.
                    for (let index = 0; index < topBlockCount; index++) {
                        mirroredEntries.push(groupAQualifiers[index], groupBQualifiers[effectivePerGroup - 1 - index]);
                    }
                    // Group B top half vs Group A mirrored bottom half.
                    for (let index = 0; index < effectivePerGroup - topBlockCount; index++) {
                        mirroredEntries.push(groupBQualifiers[index], groupAQualifiers[effectivePerGroup - 1 - index]);
                    }

                    mirroredEntries.forEach((entry, index) => {
                        if (index < bracketSize) {
                            bracketSlots[index] = entry;
                        }
                    });
                }
            } else if (roundRobinGroupNames.length === 1 && parsedPerGroup === 4 && sortedGlobalStandings.length >= 4 && bracketSize === 4) {
                bracketSlots = [
                    sortedGlobalStandings[0],
                    sortedGlobalStandings[3],
                    sortedGlobalStandings[1],
                    sortedGlobalStandings[2]
                ];
            } else {
                const qualifiers = sortedGlobalStandings.slice(0, normalizedQualifiersCount);
                const seedLines = buildFullSeedLinesForBracket(bracketSize, normalizedQualifiersCount);
                qualifiers.forEach((entry, index) => {
                    const line = seedLines[index] || (index + 1);
                    if (line >= 1 && line <= bracketSize) {
                        bracketSlots[line - 1] = entry;
                    }
                });
            }

            const byeEntries = buildByeEntries(
                Math.max(0, bracketSize - bracketSlots.filter(Boolean).length),
                IS_DOUBLES
            );
            let byeCursor = 0;
            const completeQualifierList = bracketSlots.map((entry) => {
                if (entry) return entry;
                const byeEntry = byeEntries[byeCursor];
                byeCursor += 1;
                return byeEntry || buildByeEntries(1, IS_DOUBLES)[0];
            });

            for (let index = 0; index < selectedMatches.length; index++) {
                const match = selectedMatches[index];
                const playerA = completeQualifierList[index * 2];
                const playerB = completeQualifierList[(index * 2) + 1];

                const updateData: any = {
                    player_a_id: isUuid(playerA?.p1Id || playerA?.id) ? (playerA?.p1Id || playerA?.id) : null,
                    player_b_id: isUuid(playerB?.p1Id || playerB?.id) ? (playerB?.p1Id || playerB?.id) : null,
                    winner_id: null,
                    winner_2_id: null,
                    score: null,
                    status: 'pending',
                };

                if (IS_DOUBLES) {
                    updateData.player_a2_id = isUuid(playerA?.p2Id) ? playerA.p2Id : null;
                    updateData.player_b2_id = isUuid(playerB?.p2Id) ? playerB.p2Id : null;
                }

                const { error } = await supabase.from('matches').update(updateData).eq('id', match.id);
                if (error) throw error;
                applyMatchPatchLocally(match.id, updateData);

                await updateTournamentDescription(current => ({
                    rrSlots: { ...(current.rrSlots || {}) },
                    matchSlots: {
                        ...(current.matchSlots || {}),
                        [match.id]: {
                            player_a: { name: playerA?.p1Name || playerA?.name || 'BYE' },
                            ...(IS_DOUBLES ? { player_a2: { name: playerA?.p2Name || (isByeName(playerA?.p1Name) ? 'BYE' : 'Por definir') } } : {}),
                            player_b: { name: playerB?.p1Name || playerB?.name || 'BYE' },
                            ...(IS_DOUBLES ? { player_b2: { name: playerB?.p2Name || (isByeName(playerB?.p1Name) ? 'BYE' : 'Por definir') } } : {}),
                        }
                    }
                }));
            }

            Alert.alert('Éxito', 'Las llaves finales fueron generadas automáticamente.');
        } catch (error) {
            Alert.alert('Error', 'No se pudieron generar las llaves finales.');
        }
    };

    const handleGenerateRoundRobinFinals = () => {
        const context = getRoundRobinFinalStageContext();
        const suggestedPerGroup = roundRobinGroupNames.length <= 1
            ? Math.min(4, context.maxSlots, context.totalAvailableEntries)
            : Math.max(1, Math.min(2, Math.floor((context.maxSlots || 2) / roundRobinGroupNames.length)));
        setFinalsCountInput(String(Math.max(1, suggestedPerGroup)));
        setIsFinalsCountModalVisible(true);
    };

    const handleConfirmRoundRobinFinalsCount = () => {
        const parsedValue = Number(finalsCountInput.replace(/\D/g, ''));
        if (!Number.isFinite(parsedValue) || parsedValue < 1) {
            Alert.alert('Error', 'Ingresa una cantidad válida.');
            return;
        }

        setIsFinalsCountModalVisible(false);
        generateRoundRobinFinals(Math.floor(parsedValue));
    };

    const roundRobinGroupNames = useMemo(() => getRoundRobinGroupNames(tournamentFormat, tournament?.description), [tournamentFormat, tournament?.description]);
    const currentGroupName = activeTab.startsWith('group:') ? activeTab.replace('group:', '') : roundRobinGroupNames[0] || 'A';
    const roundRobinMatchesByGroup = useMemo(
        () =>
            roundRobinGroupNames.reduce((acc, groupName) => {
                acc[groupName] = matches.filter(m => m.round === `Grupo ${groupName}`);
                return acc;
            }, {} as Record<string, any[]>),
        [matches, roundRobinGroupNames]
    );
    const getRoundRobinSlotIndexForMatchSide = (groupName: string, matchId: string, slot: 1 | 2) => {
        const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
            (a, b) => (a.match_order || 0) - (b.match_order || 0)
        );
        const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
        const pairings = getRoundRobinPairings(slotCount);
        const matchIndex = groupMatches.findIndex(match => match.id === matchId);
        const pairing = pairings[matchIndex];
        if (!pairing) return null;
        return slot === 1 ? pairing[0] : pairing[1];
    };
    const finalRoundRobinMatches = useMemo(
        () => matches.filter(m => !String(m.round || '').includes('Grupo')),
        [matches]
    );

    const getGroupRows = (groupName: string) => {
        const groupMatches = roundRobinMatchesByGroup[groupName] || [];
        const fallbackSlots = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description);
        const playerPairs = groupMatches.reduce((acc: any, m) => {
            const slotA = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 1);
            const slotB = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 2);
            if (slotA !== null) {
                acc[slotA] = acc[slotA] || { p1: m.player_a_id, p2: m.player_a2_id };
            }
            if (slotB !== null) {
                acc[slotB] = acc[slotB] || { p1: m.player_b_id, p2: m.player_b2_id };
            }
            return acc;
        }, {});

        return fallbackSlots.map((slot, index) => {
            const pair = playerPairs[index];
            const p1Name = pair?.p1 ? getPlayerName(pair.p1) : (getAssignedNameForGroupSlot(groupName, index, 1) || slot.name);
            const p2Name = pair?.p2
                ? getPlayerName(pair.p2)
                : (IS_DOUBLES ? (getAssignedNameForGroupSlot(groupName, index, 2) || `${slot.name} (P2)`) : null);
            
            return {
                id: pair?.p1 || slot.id,
                name: p2Name ? `${p1Name} / ${p2Name}` : p1Name,
                p1Name,
                p2Name,
                p1Id: pair?.p1,
                p2Id: pair?.p2,
                slotIndex: index,
            };
        });
    };

    const getStandingsForGroup = (groupName: string) => {
        const groupMatches = roundRobinMatchesByGroup[groupName] || [];
        const rows = getGroupRows(groupName);
        const statsMap = rows.reduce((acc, row) => {
            acc[`${groupName}:${row.slotIndex}`] = {
                ...row,
                played: 0,
                won: 0,
                lost: 0,
                diff: 0,
                points: 0,
                gamesWon: 0,
                gamesLost: 0,
            };
            return acc;
        }, {} as Record<string, any>);

        groupMatches.forEach(match => {
            const scoreText = getScoreText(match.score);
            if (!scoreText || /^W\.?O\.?$/i.test(scoreText)) return;

            const slotA = getRoundRobinSlotIndexForMatchSide(groupName, match.id, 1);
            const slotB = getRoundRobinSlotIndexForMatchSide(groupName, match.id, 2);
            if (slotA === null || slotB === null) return;

            const rowA = statsMap[`${groupName}:${slotA}`];
            const rowB = statsMap[`${groupName}:${slotB}`];
            if (!rowA || !rowB) return;

            let playerAGames = 0;
            let playerBGames = 0;

            scoreText
                .split(/\s*,\s*/)
                .filter(Boolean)
                .forEach((setScore: string) => {
                    const [aRaw, bRaw] = setScore.split('-');
                    const a = Number(aRaw);
                    const b = Number(bRaw);
                    if (Number.isNaN(a) || Number.isNaN(b)) return;
                    playerAGames += a;
                    playerBGames += b;
                });

            if (playerAGames === 0 && playerBGames === 0) return;

            rowA.played += 1;
            rowB.played += 1;
            rowA.gamesWon += playerAGames;
            rowA.gamesLost += playerBGames;
            rowB.gamesWon += playerBGames;
            rowB.gamesLost += playerAGames;
            rowA.diff = rowA.gamesWon - rowA.gamesLost;
            rowB.diff = rowB.gamesWon - rowB.gamesLost;

            if (playerAGames > playerBGames) {
                rowA.won += 1;
                rowB.lost += 1;
                rowA.points += 1;
            } else if (playerBGames > playerAGames) {
                rowB.won += 1;
                rowA.lost += 1;
                rowB.points += 1;
            }
        });

        return Object.values(statsMap).sort((a: any, b: any) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
            return String(a.name).localeCompare(String(b.name));
        });
    };

    const getPlayerIdBySlot = (match: any, slot: MatchSlot) => {
        if (slot === 1) return match.player_a_id;
        if (slot === 2) return match.player_a2_id;
        if (slot === 3) return match.player_b_id;
        return match.player_b2_id;
    };

    const getDisplayName = (match: any, slot: MatchSlot) => {
        const playerId = getPlayerIdBySlot(match, slot);
        if (playerId) return getPlayerName(playerId);

        if (String(match.round || '').startsWith('Grupo ')) {
            const groupName = String(match.round || '').replace('Grupo ', '');
            const entrySlot = (slot === 1 || slot === 2) ? 1 : 2;
            const slotIndex = getRoundRobinSlotIndexForMatchSide(groupName, match.id, entrySlot as 1 | 2);
            if (slotIndex !== null) {
                const assignedName = getAssignedNameForGroupSlot(groupName, slotIndex, (slot === 2 || slot === 4) ? 2 : 1);
                if (assignedName) return assignedName;
                return `Cupo ${groupName}${slotIndex + 1}${ (slot === 2 || slot === 4) ? ' (P2)' : ''}`;
            }
        }

        const assignedName = getAssignedNameForMatchSlot(match.id, slot);
        if (assignedName) return assignedName;

        return 'Por definir';
    };

    const formatRoundLabel = (roundValue?: string | null) =>
        String(roundValue || '')
            .replace(/^Consolaci[oó]n\s*-\s*/i, 'Repechaje - ')
            .replace(/^Consolaci[oó]n\b/i, 'Repechaje')
            .trim();

    const getDisplayAvatar = (match: any, slot: MatchSlot) => {
        const playerId = getPlayerIdBySlot(match, slot);
        return getPlayerAvatar(playerId);
    };

    const getInitials = (name: string) => {
        const normalized = String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (normalized.length === 0) return 'PP';
        if (normalized.length === 1) return normalized[0].slice(0, 2).toUpperCase();
        return `${normalized[0][0] || ''}${normalized[1][0] || ''}`.toUpperCase();
    };

    const renderPlayerAvatar = (name: string, avatarUrl: string | null, size = 40) => (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.primary[500] + '20',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={{ width: size, height: size }} />
            ) : (
                <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: Math.max(10, size * 0.35) }}>
                    {getInitials(name)}
                </Text>
            )}
        </View>
    );

    const getAssignmentTargetCurrentName = (target: AssignmentTarget) => {
        if (target.type === 'match') {
            const match = matches.find((candidate) => candidate.id === target.matchId);
            if (!match) return 'Por definir';
            return getDisplayName(match, target.slot);
        }

        const groupRows = getGroupRows(target.groupName);
        const groupRow = groupRows[target.slotIndex];
        if (!groupRow) return 'Por definir';
        if (!IS_DOUBLES) return groupRow.p1Name || groupRow.name || 'Por definir';
        if (target.member === 2) return groupRow.p2Name || `Cupo ${target.groupName}${target.slotIndex + 1} (P2)`;
        return groupRow.p1Name || `Cupo ${target.groupName}${target.slotIndex + 1}`;
    };

    const currentGroupRows = useMemo(() => getGroupRows(currentGroupName), [currentGroupName, roundRobinMatchesByGroup, players, tournamentMaxPlayers, tournamentFormat, tournament?.description]);
    const currentGroupStandings = useMemo(() => getStandingsForGroup(currentGroupName), [currentGroupName, currentGroupRows, roundRobinMatchesByGroup]);
    const listedRegisteredPlayers = useMemo(
        () =>
            IS_DOUBLES
                ? players.filter((registration) => !definedDoublesPlayerIds.has(String(registration.player_id || '')))
                : players,
        [IS_DOUBLES, players, definedDoublesPlayerIds]
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centerAll, { paddingTop: insets.top }]}>
                <TennisSpinner size={34} />
            </View>
        );
    }

    if (!tournament) {
        return (
            <View style={[styles.container, styles.centerAll, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>Torneo no encontrado</Text>
                <TouchableOpacity onPress={goBackToParentOrTournaments} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary[500] }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={goBackToParentOrTournaments} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity style={[styles.actionButton, { padding: 4 }]} onPress={() => router.push(`/(admin)/tournaments/edit/${id}` as any)}>
                        <Ionicons name="pencil" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { padding: 4 }]} onPress={handleDeleteTournament}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {isRoundRobin ? (
                    <>
                        {roundRobinGroupNames.map(groupName => (
                            <TouchableOpacity key={groupName} style={[styles.tab, activeTab === `group:${groupName}` && styles.activeTab]} onPress={() => setActiveTab(`group:${groupName}`)}>
                                <Text numberOfLines={1} style={[styles.tabText, activeTab === `group:${groupName}` && styles.activeTabText]}>{`Grupo ${groupName}`}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.tab, activeTab === 'finales' && styles.activeTab]} onPress={() => setActiveTab('finales')}>
                            <Text numberOfLines={1} style={[styles.tabText, activeTab === 'finales' && styles.activeTabText]}>Finales</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tab, activeTab === 'participantes' && styles.activeTab]} onPress={() => setActiveTab('participantes')}>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                                style={[styles.tabText, activeTab === 'participantes' && styles.activeTabText]}
                            >
                                Participantes
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={[styles.tab, activeTab === 'main' && styles.activeTab]} onPress={() => setActiveTab('main')}>
                            <Text numberOfLines={1} style={[styles.tabText, activeTab === 'main' && styles.activeTabText]}>Cuadro Principal</Text>
                        </TouchableOpacity>
                        {hasConsolation && (
                            <TouchableOpacity style={[styles.tab, activeTab === 'consolacion' && styles.activeTab]} onPress={() => setActiveTab('consolacion')}>
                                <Text numberOfLines={1} style={[styles.tabText, activeTab === 'consolacion' && styles.activeTabText]}>Repechaje</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.tab, activeTab === 'participantes' && styles.activeTab]} onPress={() => setActiveTab('participantes')}>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                                style={[styles.tabText, activeTab === 'participantes' && styles.activeTabText]}
                            >
                                Participantes
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

                        <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Summary Info Card */}
                <View style={[styles.summaryCard, { paddingVertical: spacing.lg }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                            <Ionicons name="podium" size={20} color={colors.primary[500]} />
                            <Text style={[styles.summaryText, { flex: 1 }]} numberOfLines={2}>
                                Nivel {tournament.level?.toUpperCase().replace('-', ' ')} | {tournament.surface?.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    {tournament.status !== 'finished' && tournament.status !== 'completed' && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                            <TouchableOpacity
                                style={{
                                    alignSelf: 'flex-start',
                                    backgroundColor: colors.primary[500],
                                    paddingHorizontal: spacing.md,
                                    paddingVertical: spacing.xs,
                                    borderRadius: borderRadius.sm,
                                    opacity: isSeeding ? 0.7 : 1
                                }}
                                onPress={handleSeedTournament}
                                disabled={isSeeding}
                            >
                                {isSeeding ? (
                                    <TennisSpinner size={14} color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Sembrar</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ alignSelf: 'flex-start', backgroundColor: colors.primary[500], paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm }}
                                onPress={finalizeTournament}
                            >
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Finalizar Torneo</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {(tournament.status === 'finished' || tournament.status === 'completed') && (
                        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.success + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800' }}>FINALIZADO</Text>
                        </View>
                    )}
                    <Text style={[styles.summaryTextSecondary, { marginTop: spacing.xs }]}>
                        {IS_DOUBLES
                            ? `${manualDoublesTeamRows.length + listedRegisteredPlayers.length} Participantes visibles`
                            : `${listedRegisteredPlayers.length + manualParticipantRows.length} Jugadores`}
                        {' | '}{tournament.format} | {tournament.modality === 'dobles' ? 'Dobles' : 'Singles'} | Máx: {tournament.max_players}
                    </Text>
                </View>

                {activeTab === 'participantes' ? (
                    <View style={{ gap: spacing.md }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>Lista de Participantes</Text>
                        <TouchableOpacity 
                            style={[styles.generateBtn, { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' }]}
                            onPress={() => {
                                if (IS_DOUBLES) {
                                    resetAssignmentSelection();
                                    resetPlayerSelectionSearch();
                                    setIsPlayerModalVisible(true);
                                    return;
                                }
                                resetAssignmentSelection();
                                resetPlayerSelectionSearch();
                                setIsPlayerModalVisible(true);
                            }}
                        >
                            <Ionicons name="person-add-outline" size={18} color="#fff" />
                            <Text style={styles.generateBtnText}>{IS_DOUBLES ? 'Agregar dupla' : 'Agregar Participante'}</Text>
                        </TouchableOpacity>

                        {(listedRegisteredPlayers.length + (IS_DOUBLES ? manualDoublesTeamRows.length : manualParticipantRows.length)) > 0 ? (
                            <>
                                {listedRegisteredPlayers.map((p) => (
                                    <View key={p.player_id} style={styles.playerListItem}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <View style={styles.playerListItemAvatar}>
                                                <Text style={styles.playerListItemInitials}>
                                                    {p.profiles?.name?.substring(0, 2).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.playerListItemName}>{p.profiles?.name || 'Desconocido'}</Text>
                                                <Text style={styles.playerSearchRole}>Participante Inscrito</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity 
                                            style={{ padding: spacing.sm }} 
                                            onPress={() => removeParticipant(p.player_id)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {IS_DOUBLES ? manualDoublesTeamRows.map((team) => (
                                    <View key={team.id} style={styles.playerListItem}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <View style={styles.playerListItemAvatar}>
                                                <Text style={styles.playerListItemInitials}>
                                                    {team.p1Name.substring(0, 1).toUpperCase()}{team.p2Name.substring(0, 1).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.playerListItemName}>{team.label}</Text>
                                                <Text style={styles.playerSearchRole}>Dupla definida</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={{ padding: spacing.sm }}
                                            onPress={() =>
                                                removeManualParticipantFromPool(team.p1Name, team.p2Name, {
                                                    p1Id: team.p1Id,
                                                    p2Id: team.p2Id
                                                })
                                            }
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                )) : manualParticipantRows.map((participant) => (
                                    <View key={participant.id} style={styles.playerListItem}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <View style={styles.playerListItemAvatar}>
                                                <Text style={styles.playerListItemInitials}>
                                                    {participant.name.substring(0, 2).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.playerListItemName}>{participant.name}</Text>
                                                <Text style={styles.playerSearchRole}>Participante Manual</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={{ padding: spacing.sm }}
                                            onPress={() => removeManualParticipantFromPool(participant.name)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        ) : (
                            <View style={styles.emptyMatches}>
                                <Ionicons name="people-outline" size={48} color={colors.border} />
                                <Text style={styles.emptyMatchesText}>No hay participantes registrados aún.</Text>
                            </View>
                        )}
                    </View>
                ) : matches.length === 0 ? (
                    <View style={styles.emptyMatches}>
                        <Ionicons name="git-network-outline" size={48} color={colors.border} />
                        <Text style={styles.emptyMatchesText}>No hay partidos generados aún.</Text>
                    </View>
                ) : isRoundRobin ? (
                    activeTab === 'finales' ? (
                    <View style={{ gap: spacing.md }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSave, { flex: 1, minWidth: 120, paddingHorizontal: spacing.sm }]}
                                onPress={handleGenerateRoundRobinFinals}
                            >
                                <Text style={[styles.modalBtnSaveText, { textAlign: 'center' }]}>Generar llaves</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel, { flex: 1, minWidth: 120, paddingHorizontal: spacing.sm }]}
                                onPress={generateRRPlacementMatches}
                            >
                                <Text style={[styles.modalBtnCancelText, { textAlign: 'center' }]}>Generar partidos 3°/5°/etc.</Text>
                            </TouchableOpacity>
                        </View>
                        {finalRoundRobinMatches.map(m => (
                            <TouchableOpacity key={m.id} style={[styles.matchCard, { paddingVertical: spacing.lg }]} onPress={() => handleMatchPress(m)}>
                                <Text style={styles.roundText}>{formatRoundLabel(m.round)}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
                                    {/* Team A */}
                                    <View style={{ flex: 1, gap: spacing.sm }}>
                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 1)}>
                                            {renderPlayerAvatar(getDisplayName(m, 1), getDisplayAvatar(m, 1))}
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 1)}</Text>
                                        </TouchableOpacity>
                                        {IS_DOUBLES && (
                                            <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 2)}>
                                                {renderPlayerAvatar(getDisplayName(m, 2), getDisplayAvatar(m, 2))}
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 2)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }} onPress={() => handleMatchPress(m)}>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                                                {getScoreText(m.score) || 'Por definir'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Team B */}
                                    <View style={{ flex: 1, gap: spacing.sm }}>
                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 3)}>
                                            {renderPlayerAvatar(getDisplayName(m, 3), getDisplayAvatar(m, 3))}
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 3)}</Text>
                                        </TouchableOpacity>
                                        {IS_DOUBLES && (
                                            <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 4)}>
                                                {renderPlayerAvatar(getDisplayName(m, 4), getDisplayAvatar(m, 4))}
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 4)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {m.court || m.scheduled_at ? (
                                    <TouchableOpacity 
                                        onPress={() => handleSchedulePress(m)}
                                        activeOpacity={0.7}
                                        style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', gap: spacing.md }}>
                                            {m.scheduled_at && (
                                                <>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleDate(m.scheduled_at)}</Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleTime(m.scheduled_at)}</Text>
                                                    </View>
                                                </>
                                            )}
                                            {m.court && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{m.court}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                        onPress={() => handleSchedulePress(m)}
                                    >
                                        <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                                        <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Programar partido</Text>
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                    ) : (
                    // Round Robin (Tabla + Partidos)
                    <View style={{ gap: spacing.xl }}>
                        {/* Tabla General */}
                        <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.background }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text}}>{`Tabla General - Grupo ${currentGroupName}`}</Text>
                                <View style={{ backgroundColor: colors.primary[500] + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary[500] }}>VIVO</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                                <Text style={{ flex: 3, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>Jugador</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PJ</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PG</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PP</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>+/-</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PTS</Text>
                            </View>

                            {currentGroupStandings.length > 0 ? currentGroupStandings.map((playerRow: any, idx: number) => (
                                    <TouchableOpacity
                                        key={playerRow.id}
                                        onPress={() => {
                                            handleGroupSlotPress(currentGroupName, playerRow.slotIndex, 1);
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}
                                    >
                                        <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: idx === 0 ? colors.success : colors.textTertiary }} />
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{playerRow.p1Name || playerRow.name}</Text>
                                                {IS_DOUBLES && (
                                                    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{playerRow.p2Name || 'Jugador 2 por definir'}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.played}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.won}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.lost}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.diff > 0 ? `+${playerRow.diff}` : playerRow.diff}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary[500], textAlign: 'center' }}>{playerRow.points}</Text>
                                    </TouchableOpacity>
                                )) : (
                                    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                                        <Text style={{ color: colors.textTertiary }}>No hay jugadores asignados a este grupo.</Text>
                                    </View>
                                )}
                        </View>

                        {/* Rondas Partidos */}
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>Próximos Partidos</Text>
                            <View style={styles.matchesContainer}>
                                {(roundRobinMatchesByGroup[currentGroupName] || [])
                                    .map(m => (
                                        <TouchableOpacity key={m.id} style={[styles.matchCard, { paddingVertical: spacing.lg }]} onPress={() => handleMatchPress(m)}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
                                                {/* Team A */}
                                                <View style={{ flex: 1, gap: spacing.sm }}>
                                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 1)}>
                                                        {renderPlayerAvatar(getDisplayName(m, 1), getDisplayAvatar(m, 1))}
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 1)}</Text>
                                                    </TouchableOpacity>
                                                    {IS_DOUBLES && (
                                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 2)}>
                                                            {renderPlayerAvatar(getDisplayName(m, 2), getDisplayAvatar(m, 2))}
                                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 2)}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                                    <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                                                            {getScoreText(m.score) || 'Próximo'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Team B */}
                                                <View style={{ flex: 1, gap: spacing.sm }}>
                                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 3)}>
                                                        {renderPlayerAvatar(getDisplayName(m, 3), getDisplayAvatar(m, 3))}
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 3)}</Text>
                                                    </TouchableOpacity>
                                                    {IS_DOUBLES && (
                                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 4)}>
                                                            {renderPlayerAvatar(getDisplayName(m, 4), getDisplayAvatar(m, 4))}
                                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 4)}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                            {m.court || m.scheduled_at ? (
                                                <TouchableOpacity 
                                                    onPress={() => handleSchedulePress(m)}
                                                    activeOpacity={0.7}
                                                    style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                                                        {m.scheduled_at && (
                                                            <>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleDate(m.scheduled_at)}</Text>
                                                                </View>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleTime(m.scheduled_at)}</Text>
                                                                </View>
                                                            </>
                                                        )}
                                                        {m.court && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{m.court}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity 
                                                    style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                                    onPress={() => handleSchedulePress(m)}
                                                >
                                                    <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                                                    <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Programar partido</Text>
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        </View>
                    </View>
                    )
                ) : (
                    // Elimination Bracket Matching the HTML exact look
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.md }}>
                        <View style={{ flexDirection: 'row', gap: spacing['3xl'], paddingHorizontal: spacing.xl }}>
                            {(() => {
                                const filteredMatches = matches.filter(m => {
                                    const isConsolationMatch = /^Consolaci/i.test(String(m.round || ''));
                                    if (activeTab === 'consolacion') return isConsolationMatch;
                                    return !isConsolationMatch;
                                });
                                const rounds = [...new Set(filteredMatches.map(m => m.round_number))].sort((a, b) => a - b);

                                return rounds.map((roundNum, index) => {
                                    const roundMatches = filteredMatches.filter(m => m.round_number === roundNum);
                                    const initialMarginTop = (Math.pow(2, index) - 1) * (MATCH_HEIGHT + ROUND_GAP) / 2;
                                    const matchGap = (Math.pow(2, index) - 1) * MATCH_HEIGHT + (Math.pow(2, index)) * ROUND_GAP;

                                    return (
                                        <View key={roundNum} style={{ width: 260 }}>
                                            <Text style={[styles.roundTitle, { marginBottom: spacing.lg }]}>{formatRoundLabel(roundMatches[0]?.round)}</Text>

                                            <View style={{ marginTop: initialMarginTop }}>
                                                {roundMatches.map((m, mIdx) => {
                                                    const scoreText = getScoreText(m.score);
                                                    const scoreSetStrings = getScoreSetStrings(m.score);
                                                    const isUnplayed = !scoreText;
                                                    const isTBD = !m.player_a_id || !m.player_b_id;

                                                    // Special positioning for 3rd place match
                                                    const is3rdPlace = m.round?.includes('3er y 4to');
                                                    const currentMatchGap = is3rdPlace ? spacing.xl : matchGap;

                                                    return (
                                                        <View
                                                            key={m.id}
                                                            style={[
                                                                styles.bracketMatchCard,
                                                                {
                                                                    height: MATCH_HEIGHT,
                                                                    marginBottom: mIdx === roundMatches.length - 1 ? 0 :
                                                                        (roundMatches[mIdx + 1]?.round.includes('3er y 4to') ? spacing.xl : currentMatchGap)
                                                                }
                                                            ]}
                                                        >
                                                            {m.round === '3er y 4to Puesto' && (
                                                                <View style={{ backgroundColor: colors.background, paddingVertical: 4 }}>
                                                                    <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>{formatRoundLabel(m.round)}</Text>
                                                                </View>
                                                            )}
                                                            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.background, backgroundColor: (m.winner_id === m.player_a_id || m.winner_2_id === m.player_a2_id) ? colors.primary[500] + '15' : colors.surface }}>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                                                    <View style={{ flex: 1 }}>
                                                                        <TouchableOpacity
                                                                            style={{ paddingHorizontal: spacing.md, paddingVertical: IS_DOUBLES ? 4 : spacing.md, justifyContent: 'center' }}
                                                                            onPress={() => handlePlayerPress(m.id, 1)}
                                                                        >
                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                {renderPlayerAvatar(getDisplayName(m, 1), getDisplayAvatar(m, 1), 22)}
                                                                                <Text style={{ flex: 1, fontSize: IS_DOUBLES ? 11 : 13, fontWeight: m.winner_id === m.player_a_id ? '800' : (isTBD ? '400' : '600'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 1)}</Text>
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                        {IS_DOUBLES && (
                                                                            <TouchableOpacity
                                                                                style={{ paddingHorizontal: spacing.md, paddingVertical: 4, justifyContent: 'center' }}
                                                                                onPress={() => handlePlayerPress(m.id, 2)}
                                                                            >
                                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                    {renderPlayerAvatar(getDisplayName(m, 2), getDisplayAvatar(m, 2), 22)}
                                                                                    <Text style={{ flex: 1, fontSize: 11, fontWeight: m.winner_2_id === m.player_a2_id ? '800' : (isTBD ? '400' : '600'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 2)}</Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                    <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4, paddingRight: spacing.md }}>
                                                                        {(scoreSetStrings.length ? scoreSetStrings : ['-']).map((setStr: string, sIdx: number) => {
                                                                            const setScores = setStr.split(/[ -]/);
                                                                            return (
                                                                                <View key={sIdx} style={{ backgroundColor: isUnplayed ? colors.background : colors.primary[500], paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, minWidth: 24, alignItems: 'center' }}>
                                                                                    <Text style={{ color: isUnplayed ? colors.textSecondary : '#fff', fontSize: 11, fontWeight: '700' }}>
                                                                                        {isUnplayed ? '-' : setScores[0]}
                                                                                    </Text>
                                                                                </View>
                                                                            );
                                                                        })}
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>

                                                            <View style={{ flex: 1, opacity: isTBD ? 0.6 : 1, backgroundColor: (m.winner_id === m.player_b_id || m.winner_2_id === m.player_b2_id) ? colors.primary[500] + '15' : colors.surface }}>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                                                    <View style={{ flex: 1 }}>
                                                                        <TouchableOpacity
                                                                            style={{ paddingHorizontal: spacing.md, paddingVertical: IS_DOUBLES ? 4 : spacing.md, justifyContent: 'center' }}
                                                                            onPress={() => handlePlayerPress(m.id, 3)}
                                                                        >
                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                {renderPlayerAvatar(getDisplayName(m, 3), getDisplayAvatar(m, 3), 22)}
                                                                                <Text style={{ flex: 1, fontSize: IS_DOUBLES ? 11 : 13, fontWeight: m.winner_id === m.player_b_id ? '800' : (isTBD ? '400' : '500'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 3)}</Text>
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                        {IS_DOUBLES && (
                                                                            <TouchableOpacity
                                                                                style={{ paddingHorizontal: spacing.md, paddingVertical: 4, justifyContent: 'center' }}
                                                                                onPress={() => handlePlayerPress(m.id, 4)}
                                                                            >
                                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                    {renderPlayerAvatar(getDisplayName(m, 4), getDisplayAvatar(m, 4), 22)}
                                                                                    <Text style={{ flex: 1, fontSize: 11, fontWeight: m.winner_2_id === m.player_b2_id ? '800' : (isTBD ? '400' : '500'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 4)}</Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                    <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4, paddingRight: spacing.md }}>
                                                                        {(scoreSetStrings.length ? scoreSetStrings : ['-']).map((setStr: string, sIdx: number) => {
                                                                            const setScores = setStr.split(/[ -]/);
                                                                            return (
                                                                                <View key={sIdx} style={{ backgroundColor: isUnplayed ? colors.background : colors.primary[500], paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, minWidth: 24, alignItems: 'center' }}>
                                                                                    <Text style={{ color: isUnplayed ? colors.textSecondary : '#fff', fontSize: 11, fontWeight: '700' }}>
                                                                                        {isUnplayed ? '-' : setScores[1] || '0'}
                                                                                    </Text>
                                                                                </View>
                                                                            );
                                                                        })}
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                            <TouchableOpacity 
                                                                onPress={() => handleSchedulePress(m)}
                                                                activeOpacity={0.7}
                                                                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.background + '50' }}>
                                                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                                                    {m.scheduled_at && (
                                                                        <>
                                                                            <Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '600' }}>
                                                                                {formatScheduleDate(m.scheduled_at)}
                                                                            </Text>
                                                                            <Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '600' }}>
                                                                                {formatScheduleTime(m.scheduled_at)}
                                                                            </Text>
                                                                        </>
                                                                    )}
                                                                    {m.court && (
                                                                        <Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '600' }}>
                                                                            {m.court}
                                                                        </Text>
                                                                    )}
                                                                </View>
                                                                <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                                                            </TouchableOpacity>
                                                            {isTBD && (
                                                                <View style={{ backgroundColor: colors.primary[500] + '15', padding: 4, alignItems: 'center' }}>
                                                                    <Text style={{ color: colors.primary[500], fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>Próximamente</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    )
                                                })}
                                            </View>
                                        </View>
                                    )
                                })
                            })()}
                        </View>
                    </ScrollView>
                )}
            </ScrollView>

            <AdminQuickActionsBar active="tournaments" organizationId={tournament.organization_id} />

            {/* Edit Match Score Modal */}
            <Modal visible={isEditModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Editar Resultado</Text>
                        {selectedMatch && (
                            <Text style={styles.modalSubtitle}>
                                {getDisplayName(selectedMatch, 1)}{IS_DOUBLES ? ` / ${getDisplayName(selectedMatch, 2)}` : ''} vs {getDisplayName(selectedMatch, 3)}{IS_DOUBLES ? ` / ${getDisplayName(selectedMatch, 4)}` : ''}
                            </Text>
                        )}
                        {selectedMatch && (
                            <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                                {/* Column Headers */}
                                <View style={{ flexDirection: 'row', paddingLeft: 60, gap: spacing.md, marginBottom: -spacing.sm }}>
                                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
                                        {getDisplayName(selectedMatch, 1)}{IS_DOUBLES ? ` / ${getDisplayName(selectedMatch, 2)}` : ''}
                                    </Text>
                                    <View style={{ width: 10 }} />
                                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
                                        {getDisplayName(selectedMatch, 3)}{IS_DOUBLES ? ` / ${getDisplayName(selectedMatch, 4)}` : ''}
                                    </Text>
                                </View>

                                {setScores.map((set, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
                                        <Text style={{ color: colors.textSecondary, fontWeight: '700', width: 44 }}>Set {idx + 1}</Text>
                                        <TextInput
                                            style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            value={set.s1}
                                            ref={ref => { scoreInputRefs.current[idx * 2] = ref; }}
                                            onChangeText={(val) => {
                                                const newSets = [...setScores];
                                                newSets[idx] = { ...newSets[idx], s1: val };
                                                setSetScores(newSets);
                                                if (val && scoreInputRefs.current[(idx * 2) + 1]) {
                                                    scoreInputRefs.current[(idx * 2) + 1]?.focus();
                                                }
                                            }}
                                        />
                                        <Text style={{ color: colors.textTertiary }}>-</Text>
                                        <TextInput
                                            style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            value={set.s2}
                                            ref={ref => { scoreInputRefs.current[(idx * 2) + 1] = ref; }}
                                            onChangeText={(val) => {
                                                const newSets = [...setScores];
                                                newSets[idx] = { ...newSets[idx], s2: val };
                                                setSetScores(newSets);
                                                if (val && scoreInputRefs.current[(idx * 2) + 2]) {
                                                    scoreInputRefs.current[(idx * 2) + 2]?.focus();
                                                }
                                            }}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsEditModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveMatchScore} disabled={savingMatch}>
                                {savingMatch ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Select Player Modal */}
            <Modal
                visible={isPlayerModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <KeyboardAvoidingView
                    style={styles.modalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={[styles.modalHeader, { paddingTop: Math.max(spacing.xl, insets.top + spacing.sm) }]}>
                        <Text style={styles.modalTitle}>
                            {assignmentTargets.length > 0 ? 'Asignar Jugadores' : (IS_DOUBLES ? 'Agregar dupla' : 'Agregar Participante')}
                        </Text>
                        <TouchableOpacity onPress={closePlayerSelectionModal} style={styles.modalCloseBtn}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {assignmentTargets.length > 0 && (
                        <View style={styles.assignmentSectionsContainer}>
                            {assignmentTargets.map((target, index) => {
                                const isActiveTarget = index === activeAssignmentIndex;
                                const targetMeta =
                                    target.type === 'group'
                                        ? ` · Grupo ${target.groupName}${target.slotIndex + 1}`
                                        : '';
                                return (
                                    <View
                                        key={`${target.type}-${target.type === 'match' ? `${target.matchId}-${target.slot}` : `${target.groupName}-${target.slotIndex}-${target.member}`}`}
                                        style={[
                                            styles.assignmentTargetCard,
                                            isActiveTarget && styles.assignmentTargetCardActive
                                        ]}
                                    >
                                        <TouchableOpacity
                                            onPress={() => setActiveAssignmentTarget(index)}
                                            style={styles.assignmentTargetHeader}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.assignmentTargetLabel}>{target.label}{targetMeta}</Text>
                                                <Text style={styles.assignmentTargetValue} numberOfLines={1}>
                                                    {getAssignmentTargetCurrentName(target)}
                                                </Text>
                                            </View>
                                            {isActiveTarget && (
                                                <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                                            )}
                                        </TouchableOpacity>
                                        <View style={styles.assignmentActionRow}>
                                            <TouchableOpacity
                                                style={[styles.assignmentActionButton, styles.assignmentActionPrimary]}
                                                onPress={() => {
                                                    if (!isActiveTarget) {
                                                        setActiveAssignmentTarget(index);
                                                        return;
                                                    }
                                                    setManualCreationMode('assignment');
                                                    setIsManualPlayerModalVisible(true);
                                                }}
                                            >
                                                <Text style={styles.assignmentActionPrimaryText}>Agregar Manual</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.assignmentActionButton, styles.assignmentActionSecondary]}
                                                onPress={async () => {
                                                    if (!isActiveTarget) {
                                                        setActiveAssignmentTarget(index);
                                                        return;
                                                    }
                                                    await createManualProfileAndAssign('BYE', assignmentTargets.length > 1);
                                                }}
                                            >
                                                <Text style={styles.assignmentActionSecondaryText}>Asignar BYE</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.assignmentActionButton, styles.assignmentActionDanger]}
                                                onPress={async () => {
                                                    if (!isActiveTarget) {
                                                        setActiveAssignmentTarget(index);
                                                        return;
                                                    }
                                                    await removeMatchPlayer(false, false);
                                                    resetPlayerSelectionSearch();
                                                    if (assignmentTargets.length > 1) {
                                                        moveToNextAssignmentTarget();
                                                    }
                                                }}
                                            >
                                                <Text style={styles.assignmentActionDangerText}>Quitar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {assignmentTargets.length === 0 && (
                        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                                {IS_DOUBLES
                                    ? 'Selecciona 2 jugadores para crear una dupla definida, o agrégala manualmente.'
                                    : 'Busca usuarios o agrega participantes manuales para inscribirlos al torneo.'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.modalBtnSave]}
                                    onPress={() => {
                                        setManualCreationMode('participants');
                                        setIsManualPlayerModalVisible(true);
                                    }}
                                >
                                    <Text style={styles.modalBtnSaveText}>{IS_DOUBLES ? 'Agregar dupla manual' : 'Agregar Manual'}</Text>
                                </TouchableOpacity>
                                {IS_DOUBLES && (
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.modalBtnSave, { opacity: pendingDoublesTeamIds.length === 2 ? 1 : 0.6 }]}
                                        onPress={savePendingDoublesTeam}
                                        disabled={pendingDoublesTeamIds.length !== 2}
                                    >
                                        <Text style={styles.modalBtnSaveText}>Guardar dupla</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {IS_DOUBLES && pendingDoublesTeamIds.length > 0 && (
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                    Seleccionados: {pendingDoublesTeamIds.map((id) => getPlayerName(id)).join(' / ')}
                                </Text>
                            )}
                        </View>
                    )}

                    <Text style={styles.modalSectionTitle}>
                        {assignmentTargets.length > 0 ? 'Participantes Registrados (toque para asignar al bloque activo)' : 'Participantes Registrados'}
                    </Text>
                    <ScrollView style={{ maxHeight: 600 }}>
                        {IS_DOUBLES && assignmentTargets.length > 0 && selectableDoublesTeamRows.map((team) => (
                            <TouchableOpacity
                                key={team.id}
                                style={styles.playerSearchItem}
                                onPress={async () => {
                                    await assignDoublesTeamToSelectedSlot(team);
                                    resetPlayerSelectionSearch();
                                    const nextIndex = activeAssignmentIndex + 2;
                                    if (assignmentTargets.length > 1 && nextIndex < assignmentTargets.length) {
                                        setActiveAssignmentTarget(nextIndex);
                                    } else {
                                        closePlayerSelectionModal();
                                    }
                                }}
                            >
                                <View>
                                    <Text style={styles.playerSearchName}>{team.label}</Text>
                                    <Text style={styles.playerSearchRole}>Dupla definida</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                            </TouchableOpacity>
                        ))}
                        {selectableRegisteredPlayers.map((p) => (
                            <TouchableOpacity
                                key={p.player_id}
                                style={styles.playerSearchItem}
                                onPress={() => {
                                    if (assignmentTargets.length === 0 && IS_DOUBLES) {
                                        togglePendingDoublesTeamMember(p.player_id);
                                        return;
                                    }
                                    updateMatchPlayer(p.player_id);
                                }}
                            >
                                <View>
                                    <Text style={styles.playerSearchName}>{p.profiles?.name || 'Desconocido'}</Text>
                                    <Text style={styles.playerSearchRole}>Participante Inscrito</Text>
                                </View>
                                <Ionicons
                                    name={assignmentTargets.length === 0 && IS_DOUBLES && pendingDoublesTeamIds.includes(p.player_id)
                                        ? 'checkmark-circle'
                                        : 'add-circle-outline'}
                                    size={20}
                                    color={assignmentTargets.length === 0 && IS_DOUBLES && pendingDoublesTeamIds.includes(p.player_id)
                                        ? colors.success
                                        : colors.primary[500]}
                                />
                            </TouchableOpacity>
                        ))}
                        {selectableManualParticipants.map((participant) => (
                            <TouchableOpacity
                                key={participant.id}
                                style={styles.playerSearchItem}
                                onPress={async () => {
                                    if (assignmentTargets.length === 0) return;
                                    await createManualProfileAndAssign(participant.name, assignmentTargets.length > 1);
                                }}
                                disabled={assignmentTargets.length === 0}
                            >
                                <View>
                                    <Text style={styles.playerSearchName}>{participant.name}</Text>
                                    <Text style={styles.playerSearchRole}>Participante Manual</Text>
                                </View>
                                <Ionicons
                                    name={assignmentTargets.length > 0 ? 'add-circle-outline' : 'person-outline'}
                                    size={20}
                                    color={assignmentTargets.length > 0 ? colors.primary[500] : colors.textTertiary}
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.modalDivider}>
                        <Text style={styles.modalDividerText}>O buscar otros usuarios</Text>
                    </View>

                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color={colors.textTertiary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Buscar usuario..."
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

                    <View style={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
                        {isSearching ? (
                            <TennisSpinner size={18} style={{ marginTop: spacing.md }} />
                        ) : (
                            <ScrollView
                                style={{ maxHeight: 200 }}
                                contentContainerStyle={{ paddingBottom: playerSearchBottomPadding }}
                                keyboardShouldPersistTaps="handled"
                            >
                                {searchResults.map((user) => (
                                    <TouchableOpacity
                                        key={user.id}
                                        style={styles.playerSearchItem}
                                        onPress={async () => {
                                            if (assignmentTargets.length === 0 && IS_DOUBLES) {
                                                await registerParticipant(user.id, { keepModalOpen: true });
                                                togglePendingDoublesTeamMember(user.id);
                                                return;
                                            }
                                            await updateMatchPlayer(user.id);
                                        }}
                                    >
                                        <View>
                                            <Text style={styles.playerSearchName}>{user.name}</Text>
                                            <Text style={styles.playerSearchRole}>Usuario del sistema</Text>
                                        </View>
                                        <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={isManualPlayerModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {manualCreationMode === 'participants'
                                ? (IS_DOUBLES ? 'Dupla Manual' : 'Participante Manual')
                                : 'Jugador Manual'}
                        </Text>
                        {manualCreationMode === 'participants' && IS_DOUBLES && (
                            <TextInput
                                style={[styles.scoreInput, { color: colors.text, textAlign: 'left', marginBottom: spacing.sm }]}
                                placeholder="Jugador 1"
                                placeholderTextColor={colors.textTertiary}
                                value={manualPlayerName}
                                onChangeText={setManualPlayerName}
                                autoFocus
                            />
                        )}
                        <TextInput
                            style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                            placeholder={manualCreationMode === 'participants' && IS_DOUBLES ? 'Jugador 2' : 'Nombre del jugador'}
                            placeholderTextColor={colors.textTertiary}
                            value={manualCreationMode === 'participants' && IS_DOUBLES ? manualPlayerName2 : manualPlayerName}
                            onChangeText={manualCreationMode === 'participants' && IS_DOUBLES ? setManualPlayerName2 : setManualPlayerName}
                            autoFocus={!(manualCreationMode === 'participants' && IS_DOUBLES)}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsManualPlayerModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSave]}
                                onPress={async () => {
                                    if (manualCreationMode === 'participants' && assignmentTargets.length === 0) {
                                        await addManualParticipantToPool(manualPlayerName, manualPlayerName2);
                                        return;
                                    }
                                    await createManualProfileAndAssign(manualPlayerName);
                                    setIsManualPlayerModalVisible(false);
                                }}
                            >
                                <Text style={styles.modalBtnSaveText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Schedule Match Modal */}
            <Modal visible={isScheduleModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Programar Partido</Text>
                        <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                            <DateField 
                                label="Fecha del partido"
                                value={scheduleData.date}
                                onChange={(date) => setScheduleData({ ...scheduleData, date })}
                            />
                            
                            <View>
                                <Text style={[styles.modalDividerText, { textAlign: 'left', marginBottom: 4 }]}>Hora (HH:MM)</Text>
                                <TextInput
                                    style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                                    placeholder="Ej: 18:30"
                                    placeholderTextColor={colors.textTertiary}
                                    value={scheduleData.time}
                                    onChangeText={(time) => setScheduleData({ ...scheduleData, time })}
                                    maxLength={5}
                                />
                            </View>

                            <View>
                                <Text style={[styles.modalDividerText, { textAlign: 'left', marginBottom: 4 }]}>Cancha</Text>
                                <TouchableOpacity
                                    style={[styles.scoreInput, { justifyContent: 'center' }]}
                                    onPress={() => setIsCourtPickerVisible(true)}
                                >
                                    <Text style={{ color: scheduleData.court ? colors.text : colors.textTertiary, fontSize: 15, fontWeight: '600' }}>
                                        {scheduleData.court || 'Seleccionar cancha'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsScheduleModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveMatchSchedule} disabled={savingSchedule}>
                                {savingSchedule ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={isCourtPickerVisible} transparent animationType="fade" onRequestClose={() => setIsCourtPickerVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Seleccionar Cancha</Text>
                        <ScrollView style={{ maxHeight: 340 }}>
                            {COURT_OPTIONS.map((courtName) => (
                                <TouchableOpacity
                                    key={courtName}
                                    style={styles.playerSearchItem}
                                    onPress={() => {
                                        setScheduleData((current) => ({ ...current, court: courtName }));
                                        setIsCourtPickerVisible(false);
                                    }}
                                >
                                    <Text style={styles.playerSearchName}>{courtName}</Text>
                                    {scheduleData.court === courtName && (
                                        <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsCourtPickerVisible(false)}>
                            <Text style={styles.modalBtnCancelText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isSeedCountModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsSeedCountModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Sembrar cuadro</Text>
                        <Text style={[styles.modalHelperText, { marginBottom: spacing.sm }]}>
                            Ingresa la cantidad de cabezas de serie para el torneo. Estos lugares se asignarán a los jugadores con mejor ranking.
                        </Text>
                        <Text style={[styles.modalHelperText, { marginBottom: spacing.md }]}>
                            Máximo disponible: {seedCountLimit}
                        </Text>
                        <TextInput
                            style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                            placeholder="Ej: 4"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                            value={seedCountInput}
                            onChangeText={(value) => setSeedCountInput(value.replace(/\D/g, ''))}
                            maxLength={3}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setIsSeedCountModalVisible(false)}
                            >
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSave]}
                                onPress={handleConfirmSeedCount}
                            >
                                <Text style={styles.modalBtnSaveText}>Sembrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isFinalsCountModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsFinalsCountModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Generar llaves finales</Text>
                        <Text style={[styles.modalHelperText, { marginBottom: spacing.sm }]}>
                            ¿Cuántas duplas clasifican por grupo a la siguiente ronda?
                        </Text>
                        <TextInput
                            style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                            placeholder="Ej: 1 o 2"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                            value={finalsCountInput}
                            onChangeText={(value) => setFinalsCountInput(value.replace(/\D/g, ''))}
                            maxLength={3}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setIsFinalsCountModalVisible(false)}
                            >
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSave]}
                                onPress={handleConfirmRoundRobinFinalsCount}
                            >
                                <Text style={styles.modalBtnSaveText}>Generar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function getStyles(colors: any) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centerAll: { justifyContent: 'center', alignItems: 'center' },
        errorText: { fontSize: 16, color: colors.error },

        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.surface },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center'
        },
        actionButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
        headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

        tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
        tab: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
        activeTab: { borderBottomColor: colors.primary[500] },
        tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
        activeTabText: { color: colors.primary[500] },

        scrollContent: { padding: spacing.xl, paddingBottom: 130 },

        summaryCard: { backgroundColor: colors.primary[500] + '10', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.primary[500] + '20', marginBottom: spacing.xl, gap: spacing.xs },
        summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        summaryText: { fontSize: 15, fontWeight: '700', color: colors.text },
        summaryTextSecondary: { fontSize: 13, color: colors.textSecondary },

        emptyMatches: { alignItems: 'center', marginTop: spacing['4xl'], gap: spacing.md },
        emptyMatchesText: { fontSize: 16, color: colors.textSecondary },
        generateBtn: { backgroundColor: colors.primary[500], paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
        generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },

        matchesContainer: { gap: spacing.md },
        matchCard: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
        roundText: { fontSize: 12, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', marginBottom: spacing.sm },
        matchPlayersRow: { gap: spacing.xs },
        playerName: { fontSize: 14, fontWeight: '500', color: colors.text },
        scoreRow: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
        scoreText: { fontSize: 14, fontWeight: '700', color: colors.primary[500] },

        // Bracket Styles
        roundTitle: { color: colors.textTertiary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.sm, textAlign: 'center', letterSpacing: 1 },
        bracketMatchCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
        bracketPlayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.surface },
        bracketPlayerName: { fontSize: 13, fontWeight: '600', color: colors.text },
        scoreBadge: { backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
        scoreBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
        matchScoreFooter: { backgroundColor: colors.primary[500] + '15', padding: spacing.xs, alignItems: 'center' },
        matchScoreFooterText: { color: colors.primary[500], fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
        matchLabelText: { textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
        modalContent: { width: '100%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, gap: spacing.md },
        modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
        modalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
        scoreInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, height: 48, paddingHorizontal: spacing.md, fontSize: 16, textAlign: 'center' },
        modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
        modalBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
        modalBtnCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
        modalBtnSave: { backgroundColor: colors.primary[500] },
        modalBtnCancelText: { color: colors.text, fontWeight: '600', textAlign: 'center' },
        modalBtnSaveText: { color: '#fff', fontWeight: '700', textAlign: 'center' },

        // Player Selection Modal Styles
        modalContainer: { flex: 1, backgroundColor: colors.background },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
        modalCloseBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.md, height: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
        searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: 16, color: colors.text },
        modalList: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
        searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
        searchResultAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
        searchResultInitials: { fontSize: 14, fontWeight: '700', color: colors.primary[500] },
        searchResultName: { fontSize: 16, fontWeight: '500', color: colors.text },
        searchResultEmail: { fontSize: 13, color: colors.textSecondary },
        modalEmpty: { textAlign: 'center', color: colors.textTertiary, marginTop: spacing.xl },

        // New styles for participants list
        playerListItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
        },
        playerListItemAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primary[500] + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
        },
        playerListItemInitials: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.primary[500],
        },
        playerListItemName: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },

        // Player search item in modal
        playerSearchItem: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        playerSearchName: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        playerSearchRole: {
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: 2,
        },
        assignmentSectionsContainer: {
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            gap: spacing.sm,
        },
        assignmentTargetCard: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            padding: spacing.sm,
            gap: spacing.sm,
        },
        assignmentTargetCardActive: {
            borderColor: colors.primary[500],
            backgroundColor: colors.primary[500] + '08',
        },
        assignmentTargetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        assignmentTargetLabel: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textSecondary,
            textTransform: 'uppercase',
        },
        assignmentTargetValue: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
            marginTop: 2,
        },
        assignmentActionRow: {
            flexDirection: 'row',
            gap: spacing.xs,
        },
        assignmentActionButton: {
            flex: 1,
            minHeight: 34,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: spacing.sm,
        },
        assignmentActionPrimary: {
            backgroundColor: colors.primary[500],
        },
        assignmentActionSecondary: {
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
        },
        assignmentActionDanger: {
            backgroundColor: colors.error + '12',
            borderWidth: 1,
            borderColor: colors.error + '35',
        },
        assignmentActionPrimaryText: {
            color: '#fff',
            fontSize: 11,
            fontWeight: '800',
            textAlign: 'center',
        },
        assignmentActionSecondaryText: {
            color: colors.text,
            fontSize: 11,
            fontWeight: '700',
            textAlign: 'center',
        },
        assignmentActionDangerText: {
            color: colors.error,
            fontSize: 11,
            fontWeight: '800',
            textAlign: 'center',
        },
        modalSectionTitle: {
            fontSize: 14,
            fontWeight: '800',
            color: colors.primary[500],
            marginLeft: spacing.xl,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
            textTransform: 'uppercase',
        },
        modalDivider: {
            flexDirection: 'row',
            alignItems: 'center',
            margin: spacing.xl,
        },
        modalDividerText: {
            flex: 1,
            fontSize: 12,
            fontWeight: '700',
            color: colors.textTertiary,
            textAlign: 'center',
            backgroundColor: colors.background,
            paddingHorizontal: spacing.sm,
        },
        modalHelperText: {
            fontSize: 13,
            lineHeight: 19,
            fontWeight: '600',
            color: colors.textSecondary,
            textAlign: 'left',
        },
    });
}






