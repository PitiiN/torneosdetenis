export const DEFAULT_RANKING_POINTS: Record<string, number> = {
  '1': 100,
  '2': 60,
  '3': 40,
  '4': 20,
};

export const parseRankingPoints = (description?: string | null) => {
  const match = (description || '').match(/\[RANKING_POINTS:([^\]]+)\]/);
  if (!match?.[1]) return DEFAULT_RANKING_POINTS;

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return { ...DEFAULT_RANKING_POINTS, ...parsed };
  } catch {
    return DEFAULT_RANKING_POINTS;
  }
};

export const buildDescriptionWithRankingPoints = (
  points: Record<string, number>,
  description?: string | null
) => {
  const baseDescription = (description || '')
    .replace(/\s*\[RANKING_POINTS:[^\]]+\]/g, '')
    .trim();
  const encodedPoints = encodeURIComponent(JSON.stringify(points));
  return [baseDescription, `[RANKING_POINTS:${encodedPoints}]`].filter(Boolean).join(' ').trim();
};

export const getMatchLoserIds = (match: any) => {
  if (!match?.winner_id) return { l1: null, l2: null };
  if (match.winner_id === match.player_a_id) {
    return { l1: match.player_b_id || null, l2: match.player_b2_id || null };
  }
  if (match.winner_id === match.player_b_id) {
    return { l1: match.player_a_id || null, l2: match.player_a2_id || null };
  }
  return { l1: null, l2: null };
};

const normalizeKey = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getStagePositionRange = (stage: number) => {
  if (stage <= 1) return { start: 1, end: 1 };
  if (stage === 2) return { start: 2, end: 2 };
  const start = Math.pow(2, stage - 2) + 1;
  const end = Math.pow(2, stage - 1);
  return { start, end };
};

const getStageFromKeyword = (key: string) => {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  if (normalized.includes('campeon')) return 1;
  if (normalized.includes('finalista') || (normalized.includes('final') && !normalized.includes('semi'))) return 2;
  if (normalized.includes('semi')) return 3;
  if (normalized.includes('cuart')) return 4;
  if (normalized.includes('octav')) return 5;
  return null;
};

const parseNumericRangeKey = (key: string): { start: number; end: number } | null => {
  const normalized = normalizeKey(key).replace(/\s+/g, '');
  if (!normalized) return null;

  const exactMatch = normalized.match(/^(\d+)$/);
  if (exactMatch) {
    const value = Number(exactMatch[1]);
    return Number.isFinite(value) ? { start: value, end: value } : null;
  }

  const rangeMatch = normalized.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  return null;
};

const getPlacementPoints = (
  pointsMap: Record<string, number>,
  stage: number
) => {
  const stageKey = String(stage);
  if (Object.prototype.hasOwnProperty.call(pointsMap, stageKey)) {
    return Number(pointsMap[stageKey]) || 0;
  }

  const stageRange = getStagePositionRange(stage);

  for (const [key, rawPoints] of Object.entries(pointsMap)) {
    const keywordStage = getStageFromKeyword(key);
    if (keywordStage !== null && keywordStage === stage) {
      return Number(rawPoints) || 0;
    }
  }

  for (const [key, rawPoints] of Object.entries(pointsMap)) {
    const parsedRange = parseNumericRangeKey(key);
    if (!parsedRange) continue;
    if (parsedRange.start <= stageRange.start && parsedRange.end >= stageRange.end) {
      return Number(rawPoints) || 0;
    }
  }

  // Fallback: permitir rangos manuales de texto libre para fases posteriores.
  // Se asignan por orden de creación a partir de la etapa 5 (Octavos / Ronda 1).
  if (stage >= 5) {
    const fallbackKeys = Object.keys(pointsMap).filter((key) => {
      const normalized = normalizeKey(key);
      const parsedNumeric = parseNumericRangeKey(key);
      const keywordStage = getStageFromKeyword(key);
      const exactStage = Number(normalized);
      if (parsedNumeric) return false;
      if (keywordStage !== null) return false;
      if (Number.isFinite(exactStage) && String(exactStage) === normalized) return false;
      return normalized.length > 0;
    });
    const fallbackKey = fallbackKeys[stage - 5];
    if (fallbackKey) {
      return Number(pointsMap[fallbackKey]) || 0;
    }
  }

  return 0;
};

export const getTournamentPlacements = (tournament: any, matches: any[]) => {
  const pointsMap = parseRankingPoints(tournament?.description);
  const directEliminationMatches = (matches || [])
    .filter((match) => {
      const roundName = String(match?.round || '');
      if (roundName.startsWith('Grupo ')) return false;
      if (/^Consolaci/i.test(roundName)) return false;
      return true;
    })
    .sort((a, b) => {
      if ((a.round_number || 0) !== (b.round_number || 0)) {
        return (a.round_number || 0) - (b.round_number || 0);
      }
      return (a.match_order || 0) - (b.match_order || 0);
    });

  const finalMatch = [...directEliminationMatches]
    .reverse()
    .find((match) => String(match.round || '').includes('Gran Final'));

  const placements: Array<{ playerId: string; playerId2?: string; place: string; points: number }> = [];
  const seenPlacementIds = new Set<string>();

  const pushPlacement = (playerId: string | null, playerId2: string | null | undefined, stage: number) => {
    if (!playerId) return;
    const uniqueKey = `${playerId}:${playerId2 || ''}:${stage}`;
    if (seenPlacementIds.has(uniqueKey)) return;
    seenPlacementIds.add(uniqueKey);
    placements.push({
      playerId,
      playerId2: playerId2 || undefined,
      place: String(stage),
      points: getPlacementPoints(pointsMap, stage),
    });
  };

  if (finalMatch?.winner_id) {
    pushPlacement(finalMatch.winner_id, finalMatch.winner_2_id || null, 1);

    const { l1, l2 } = getMatchLoserIds(finalMatch);
    pushPlacement(l1, l2, 2);
  }

  if (!directEliminationMatches.length) return placements;

  const maxRound = Math.max(...directEliminationMatches.map((match) => Number(match.round_number || 0)));

  for (let round = maxRound - 1; round >= 1; round--) {
    const stage = maxRound - round + 2;
    directEliminationMatches
      .filter((match) => Number(match.round_number || 0) === round)
      .forEach((match) => {
        const { l1, l2 } = getMatchLoserIds(match);
        pushPlacement(l1, l2, stage);
      });
  }

  return placements;
};
