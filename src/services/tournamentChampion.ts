import { SupabaseClient } from '@supabase/supabase-js';

// Reusable logic for resolving tournament champions across different views

type MatchSlot = 1 | 2 | 3 | 4;

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
    const bracketMatches = matches.filter(m => 
        !String(m.round || '').includes('Grupo') && 
        !String(m.round || '').toLowerCase().includes('puesto') &&
        !String(m.round || '').toLowerCase().includes('consolaci')
    );

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
    const { w1, side } = resolveWinnerIds(finalMatch, finalMatch.score);
    
    if (w1 || side) {
        const name = getDisplayName(finalMatch, side === 'A' ? 1 : 3, manualAssignments, participants);
        return name === 'Por definir' ? null : name;
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
        if ((tourData.description || '').includes('[CHAMPION:')) {
            const match = tourData.description.match(/\[CHAMPION:(.*?)\]/);
            return match ? match[1] : null;
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
        const cleanDescription = (tourData.description || '').replace(/\[CHAMPION:.+?\]/g, '').trim();
        const newDescription = cleanDescription 
            ? `${cleanDescription} [CHAMPION:${championName}]`
            : `[CHAMPION:${championName}]`;

        await supabase
            .from('tournaments')
            .update({ description: newDescription.trim() })
            .eq('id', tournamentId);

        return championName;
    } catch (error) {
        console.error('Error syncing tournament champion:', error);
        return null;
    }
};
