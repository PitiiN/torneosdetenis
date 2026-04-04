import { SupabaseClient } from '@supabase/supabase-js';

// Reusable logic for resolving tournament champions across different views

type MatchSlot = 1 | 2 | 3 | 4;

const CHAMPION_TAG_PREFIX = '[CHAMPION:';

const normalizeChampionName = (value?: string | null): string | null => {
    let cleaned = String(value || '').trim();
    if (!cleaned) return null;

    // Defensive cleanup for malformed values like "] [CHAMPION:Name"
    const nestedTagIndex = cleaned.lastIndexOf(CHAMPION_TAG_PREFIX);
    if (nestedTagIndex >= 0) {
        cleaned = cleaned.slice(nestedTagIndex + CHAMPION_TAG_PREFIX.length);
    }

    cleaned = cleaned.replace(/\].*$/g, '').trim();
    cleaned = cleaned.replace(/^[:\]\s-]+/g, '').trim();
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    return cleaned || null;
};

export const extractChampionFromDescription = (description?: string | null): string | null => {
    const text = String(description || '');
    if (!text.includes(CHAMPION_TAG_PREFIX)) return null;

    const allValidTags = [...text.matchAll(/\[CHAMPION:([^\]]+)\]/g)];
    if (allValidTags.length > 0) {
        const lastMatch = allValidTags[allValidTags.length - 1];
        return normalizeChampionName(lastMatch[1]);
    }

    // Fallback for malformed trailing tag without closing "]"
    const fallbackStart = text.lastIndexOf(CHAMPION_TAG_PREFIX);
    if (fallbackStart >= 0) {
        return normalizeChampionName(text.slice(fallbackStart + CHAMPION_TAG_PREFIX.length));
    }

    return null;
};

export const stripChampionTagFromDescription = (description?: string | null): string => {
    return String(description || '')
        .replace(/\[CHAMPION:[^\]]*\]/g, ' ')
        .replace(/\[CHAMPION:[^\]]*$/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

export const buildDescriptionWithChampion = (
    description: string | null | undefined,
    championName?: string | null
): string | null => {
    const cleanDescription = stripChampionTagFromDescription(description);
    const normalizedChampion = normalizeChampionName(championName || null);

    if (!normalizedChampion) return cleanDescription || null;

    return cleanDescription
        ? `${cleanDescription} [CHAMPION:${normalizedChampion}]`
        : `[CHAMPION:${normalizedChampion}]`;
};

export const parseManualAssignments = (description?: string | null) => {
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

export const resolveWinnerIds = (match: any, scoreValue: any) => {
    const getScoreText = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'object') {
            if (val.wo) return 'W.O.';
            if (val.text) return String(val.text).trim();
            if (val.score) return String(val.score).trim();
            if (Array.isArray(val.sets)) return val.sets.map((s: any) => String(s || '').trim()).filter(Boolean).join(', ');
        }
        return String(val || '').trim();
    };

    const scoreText = getScoreText(scoreValue);
    if (!scoreText || /^W\.?O\.?$/i.test(scoreText)) {
        // If it's W.O., we might need to check which side won if winner_id is set
        if (match.winner_id) {
            const isSideA = match.winner_id === match.player_a_id;
            return { 
                w1: match.winner_id, 
                w2: isSideA ? match.player_a2_id : match.player_b2_id, 
                side: isSideA ? 'A' : 'B' 
            };
        }
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

    if (playerAWins === playerBWins) {
        if (match.winner_id) {
             const isSideA = match.winner_id === match.player_a_id;
             return { w1: match.winner_id, w2: isSideA ? match.player_a2_id : match.player_b2_id, side: isSideA ? 'A' : 'B' };
        }
        return { w1: null, w2: null, side: null };
    }

    return playerAWins > playerBWins 
        ? { w1: match.player_a_id, w2: match.player_a2_id, side: 'A' }
        : { w1: match.player_b_id, w2: match.player_b2_id, side: 'B' };
};

export const getDisplayName = (
    match: any, 
    slot: MatchSlot, 
    manualAssignments: any, 
    players: any[] = []
) => {
    const getPlayerIdBySlot = (m: any, s: MatchSlot) => {
        if (s === 1) return m.player_a_id;
        if (s === 2) return m.player_a2_id;
        if (s === 3) return m.player_b_id;
        return m.player_b2_id;
    };

    const getPlayerName = (pId: string) => {
        if (!pId) return 'Por definir';
        if (pId === 'BYE') return 'BYE';
        const player = players.find(p => p.player_id === pId || p.id === pId);
        return player ? (player.profiles?.name || player.name || 'Desconocido') : 'Por definir';
    };

    const getMatchManualKey = (s: MatchSlot) => {
        if (s === 1) return 'player_a';
        if (s === 2) return 'player_a2';
        if (s === 3) return 'player_b';
        return 'player_b2';
    };

    const getMatchManualFallbackKey = (s: MatchSlot) => (s === 1 || s === 2 ? 'player_a' : 'player_b');

    const playerId = getPlayerIdBySlot(match, slot);
    if (playerId) return getPlayerName(playerId);

    const matchId = match.id;
    const isDoubles = !!(match.player_a2_id || match.player_b2_id || manualAssignments.matchSlots?.[matchId]?.player_a2 || manualAssignments.matchSlots?.[matchId]?.player_b2);

    const assignedName = manualAssignments.matchSlots?.[matchId]?.[getMatchManualKey(slot)]?.name ||
        (!isDoubles ? manualAssignments.matchSlots?.[matchId]?.[getMatchManualFallbackKey(slot)]?.name : null);

    if (assignedName) return assignedName;

    return 'Por definir';
};

/**
 * Resolves the champion name from a set of matches and participants.
 * This is the core logic used by both sync and on-the-fly resolution.
 */
export const resolveChampionFromMatches = (
    matches: any[],
    participants: any[],
    description?: string | null
): string | null => {
    if (!matches || matches.length === 0) return null;

    // 1. Find potential final match (highest round number, not consolation/repechage/groups/puesto)
    const bracketMatches = matches.filter(m => {
        const roundText = String(m.round || '').toLowerCase();
        return !roundText.includes('grupo') &&
            !roundText.includes('puesto') &&
            !roundText.includes('consolaci') &&
            !roundText.includes('repech');
    });

    if (bracketMatches.length === 0) {
        // Fallback for Round Robin only tournaments - highest match_order in the last group?
        // For now let's focus on Elimination as per user request
        return null;
    }

    const sorted = [...bracketMatches].sort((a, b) => (b.round_number || 0) - (a.round_number || 0));
    const finalMatch = sorted[0];

    // Verify if it has a score or is finished
    const hasScore = !!finalMatch.score && String(finalMatch.score).trim().length > 0;
    if (finalMatch.status !== 'finished' && !hasScore) return null;

    // 2. Resolve winner
    const manualAssignments = parseManualAssignments(description);
    const { w1, w2, side } = resolveWinnerIds(finalMatch, finalMatch.score);
    
    const getParticipantNameById = (playerId?: string | null) => {
        if (!playerId) return null;
        const participant = participants.find(
            (candidate: any) => candidate?.player_id === playerId || candidate?.id === playerId
        );
        const candidateName = participant?.profiles?.name || participant?.name || null;
        const normalized = String(candidateName || '').trim();
        if (!normalized || normalized === 'Por definir' || normalized === 'BYE') return null;
        return normalized;
    };

    if (w1 || side || w2) {
        const winnerStartSlot = side === 'A' ? 1 : 3;
        const winnerPrimaryName = getDisplayName(finalMatch, winnerStartSlot, manualAssignments, participants);
        if (winnerPrimaryName === 'Por definir') return null;

        const isDoublesFinal = !!(
            finalMatch.player_a2_id ||
            finalMatch.player_b2_id ||
            manualAssignments.matchSlots?.[finalMatch.id]?.player_a2 ||
            manualAssignments.matchSlots?.[finalMatch.id]?.player_b2 ||
            w2
        );

        if (!isDoublesFinal) return winnerPrimaryName;

        const winnerSecondarySlot = (winnerStartSlot + 1) as MatchSlot;
        const winnerSecondaryName = getDisplayName(finalMatch, winnerSecondarySlot, manualAssignments, participants);
        if (!winnerSecondaryName || winnerSecondaryName === 'Por definir' || winnerSecondaryName === 'BYE') {
            // Fallback: when the second slot is missing in the final match row, resolve by winner_2_id.
            const fallbackSecondary = getParticipantNameById(w2);
            if (fallbackSecondary) {
                return winnerPrimaryName.includes('/')
                    ? winnerPrimaryName
                    : `${winnerPrimaryName} / ${fallbackSecondary}`;
            }
            return winnerPrimaryName;
        }

        return `${winnerPrimaryName} / ${winnerSecondaryName}`;
    }

    return null;
};

/**
 * Syncs the champion tag in the tournament description based on final match results.
 * Returns the champion name if successfully resolved and updated.
 */
export const syncTournamentChampion = async (
    tournamentId: string, 
    supabase: SupabaseClient
): Promise<string | null> => {
    try {
        // 1. Fetch tournament data
        const { data: tourData, error: tourError } = await supabase
            .from('tournaments')
            .select('id, description, status, modality')
            .eq('id', tournamentId)
            .single();

        if (tourError || !tourData) return null;

        // Skip if it already has a champion tag (unless we want to force re-sync)
        const existingChampion = extractChampionFromDescription(tourData.description);
        if (existingChampion) {
            return existingChampion;
        }

        // 2. Fetch matches and participants for this tournament
        const [matchesRes, participantsRes] = await Promise.all([
            supabase.from('matches').select('*').eq('tournament_id', tournamentId),
            supabase.from('tournament_participants').select('player_id, profiles(name)').eq('tournament_id', tournamentId)
        ]);

        if (matchesRes.error || !matchesRes.data) return null;

        const championName = resolveChampionFromMatches(
            matchesRes.data,
            participantsRes.data || [],
            tourData.description
        );

        if (!championName) return null;

        // 3. Update tournament description
        const newDescription = buildDescriptionWithChampion(tourData.description, championName);

        await supabase
            .from('tournaments')
            .update({ description: newDescription })
            .eq('id', tournamentId);

        return championName;
    } catch (error) {
        console.error('Error syncing tournament champion:', error);
        return null;
    }
};
