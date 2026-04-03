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

const getScoreText = (scoreValue: any): string => {
  if (!scoreValue) return '';
  if (typeof scoreValue === 'string') return scoreValue.trim();

  if (typeof scoreValue === 'object') {
    if (scoreValue.wo) return 'W.O.';
    if (scoreValue.text) return String(scoreValue.text).trim();
    if (scoreValue.score) return String(scoreValue.score).trim();
    if (Array.isArray(scoreValue.sets)) {
      return scoreValue.sets
        .map((setScore: any) => String(setScore || '').trim())
        .filter(Boolean)
        .join(', ');
    }
  }

  return String(scoreValue || '').trim();
};

const parseSetScore = (setScore: string) => {
  const normalized = String(setScore || '')
    .replace(/\u2013/g, '-')
    .trim();
  if (!normalized) return null;

  const [leftRaw = '', rightRaw = ''] = normalized.split('-');
  const leftMatch = leftRaw.match(/\d+/);
  const rightMatch = rightRaw.match(/\d+/);
  if (!leftMatch || !rightMatch) return null;

  const leftValue = Number(leftMatch[0]);
  const rightValue = Number(rightMatch[0]);
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return null;

  return { leftValue, rightValue };
};

const inferWinnerSideFromNextRound = (match: any, allMatches?: any[]): 'A' | 'B' | null => {
  if (!match || !Array.isArray(allMatches) || !allMatches.length) return null;

  const roundNumber = Number(match.round_number || 0);
  if (!Number.isFinite(roundNumber) || roundNumber <= 0) return null;

  const nextRoundMatches = allMatches.filter(
    (candidate) => Number(candidate?.round_number || 0) === roundNumber + 1
  );
  if (!nextRoundMatches.length) return null;

  const sideAIds = [match?.player_a_id, match?.player_a2_id]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== 'BYE');
  const sideBIds = [match?.player_b_id, match?.player_b2_id]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== 'BYE');

  const sideAppearsInNextRound = (candidateIds: string[]) =>
    nextRoundMatches.some((nextMatch) => {
      const nextIds = [
        nextMatch?.player_a_id,
        nextMatch?.player_a2_id,
        nextMatch?.player_b_id,
        nextMatch?.player_b2_id,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      return candidateIds.some((candidateId) => nextIds.includes(candidateId));
    });

  const sideAAdvanced = sideAIds.length > 0 && sideAppearsInNextRound(sideAIds);
  const sideBAdvanced = sideBIds.length > 0 && sideAppearsInNextRound(sideBIds);

  if (sideAAdvanced && !sideBAdvanced) return 'A';
  if (sideBAdvanced && !sideAAdvanced) return 'B';
  return null;
};

const resolveMatchWinnerSide = (match: any, allMatches?: any[]): 'A' | 'B' | null => {
  if (!match) return null;

  if (match.winner_id && match.winner_id === match.player_a_id) return 'A';
  if (match.winner_id && match.winner_id === match.player_b_id) return 'B';
  if (match.winner_2_id && match.winner_2_id === match.player_a2_id) return 'A';
  if (match.winner_2_id && match.winner_2_id === match.player_b2_id) return 'B';

  const scoreText = getScoreText(match.score);
  if (!scoreText || /^W\.?O\.?$/i.test(scoreText)) {
    return inferWinnerSideFromNextRound(match, allMatches);
  }

  const sets = scoreText
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  let playerAWins = 0;
  let playerBWins = 0;

  sets.forEach((setScore) => {
    const parsedSet = parseSetScore(setScore);
    if (!parsedSet) return;
    if (parsedSet.leftValue > parsedSet.rightValue) playerAWins += 1;
    if (parsedSet.rightValue > parsedSet.leftValue) playerBWins += 1;
  });

  if (playerAWins === playerBWins) {
    return inferWinnerSideFromNextRound(match, allMatches);
  }
  return playerAWins > playerBWins ? 'A' : 'B';
};

const resolveMatchWinnerIds = (match: any, allMatches?: any[]) => {
  const winnerSide = resolveMatchWinnerSide(match, allMatches);
  if (winnerSide === 'A') {
    return {
      w1: match?.player_a_id || null,
      w2: match?.player_a2_id || null,
    };
  }
  if (winnerSide === 'B') {
    return {
      w1: match?.player_b_id || null,
      w2: match?.player_b2_id || null,
    };
  }
  return { w1: null, w2: null };
};

export const getMatchLoserIds = (match: any, allMatches?: any[]) => {
  const winnerSide = resolveMatchWinnerSide(match, allMatches);
  if (winnerSide === 'A') {
    return { l1: match?.player_b_id || null, l2: match?.player_b2_id || null };
  }
  if (winnerSide === 'B') {
    return { l1: match?.player_a_id || null, l2: match?.player_a2_id || null };
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

  const rangeMatch = normalized.match(/^(\d+)\s*[-\u2013]\s*(\d+)$/);
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

  // Fallback for free-text ranges in late rounds.
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

const isGroupRound = (roundName: string) => normalizeKey(roundName).startsWith('grupo ');

const isConsolationRound = (roundName: string) => {
  const normalized = normalizeKey(roundName);
  return normalized.includes('consolaci') || normalized.includes('repech');
};

const isPlacementRound = (roundName: string) => {
  const normalized = normalizeKey(roundName);
  if (!normalized) return false;
  return /(^|\s)(3er|4to|5to|6to)\b/.test(normalized) || normalized.includes('puesto');
};

const isMainBracketRound = (roundName: string) =>
  !isGroupRound(roundName) &&
  !isConsolationRound(roundName) &&
  !isPlacementRound(roundName);

const isFinalRoundName = (roundName: string) => {
  const normalized = normalizeKey(roundName);
  if (!normalized) return false;
  if (normalized.includes('gran final')) return true;
  if (normalized.includes('semi')) return false;
  if (normalized.includes('cuart')) return false;
  if (normalized.includes('octav')) return false;
  if (normalized.includes('puesto')) return false;
  return /\bfinal\b/.test(normalized);
};

export const getTournamentPlacements = (tournament: any, matches: any[]) => {
  const pointsMap = parseRankingPoints(tournament?.description);
  const directEliminationMatches = (matches || [])
    .filter((match) => isMainBracketRound(String(match?.round || '')))
    .sort((a, b) => {
      if ((a.round_number || 0) !== (b.round_number || 0)) {
        return (a.round_number || 0) - (b.round_number || 0);
      }
      return (a.match_order || 0) - (b.match_order || 0);
    });

  const placements: Array<{ playerId: string; playerId2?: string; place: string; points: number }> = [];
  const seenPlacementIds = new Set<string>();

  const pushPlacement = (playerId: string | null, playerId2: string | null | undefined, stage: number) => {
    if (!playerId || playerId === 'BYE') return;
    const safePlayerId2 = playerId2 && playerId2 !== 'BYE' ? playerId2 : null;
    const uniqueKey = `${playerId}:${safePlayerId2 || ''}:${stage}`;
    if (seenPlacementIds.has(uniqueKey)) return;
    seenPlacementIds.add(uniqueKey);
    placements.push({
      playerId,
      playerId2: safePlayerId2 || undefined,
      place: String(stage),
      points: getPlacementPoints(pointsMap, stage),
    });
  };

  if (!directEliminationMatches.length) return placements;

  const numericRounds = directEliminationMatches
    .map((match) => Number(match.round_number || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericRounds.length) return placements;

  const maxRound = Math.max(...numericRounds);

  const maxRoundMatches = directEliminationMatches
    .filter((match) => Number(match.round_number || 0) === maxRound)
    .sort((a, b) => (a.match_order || 0) - (b.match_order || 0));

  const finalCandidates = maxRoundMatches.filter((match) => isFinalRoundName(String(match.round || '')));
  const finalPool = finalCandidates.length ? finalCandidates : maxRoundMatches;
  const finalMatch =
    finalPool.find((match) => !!resolveMatchWinnerIds(match, directEliminationMatches).w1) ||
    finalPool[finalPool.length - 1] ||
    null;

  if (finalMatch) {
    const { w1, w2 } = resolveMatchWinnerIds(finalMatch, directEliminationMatches);
    if (w1) {
      pushPlacement(w1, w2, 1);

      const { l1, l2 } = getMatchLoserIds(finalMatch, directEliminationMatches);
      pushPlacement(l1, l2, 2);
    }
  }

  for (let round = maxRound - 1; round >= 1; round--) {
    const stage = maxRound - round + 2;
    directEliminationMatches
      .filter((match) => Number(match.round_number || 0) === round)
      .forEach((match) => {
        const { l1, l2 } = getMatchLoserIds(match, directEliminationMatches);
        pushPlacement(l1, l2, stage);
      });
  }

  return placements;
};
