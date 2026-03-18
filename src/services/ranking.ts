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

export const getTournamentPlacements = (tournament: any, matches: any[]) => {
  const pointsMap = parseRankingPoints(tournament?.description);
  const finalMatch =
    matches.find(match => String(match.round || '').includes('Gran Final RR')) ||
    matches.find(match => String(match.round || '').includes('Gran Final'));
  const thirdPlaceMatch =
    matches.find(match => String(match.round || '').includes('3er y 4to Puesto RR')) ||
    matches.find(match => String(match.round || '').includes('3er y 4to'));

  const placements: Array<{ playerId: string; playerId2?: string; place: string; points: number }> = [];

  if (finalMatch?.winner_id) {
    placements.push({
      playerId: finalMatch.winner_id,
      playerId2: finalMatch.winner_2_id || undefined,
      place: '1',
      points: pointsMap['1'] || 0,
    });

    const { l1, l2 } = getMatchLoserIds(finalMatch);
    if (l1) {
      placements.push({
        playerId: l1,
        playerId2: l2 || undefined,
        place: '2',
        points: pointsMap['2'] || 0,
      });
    }
  }

  if (thirdPlaceMatch?.winner_id) {
    placements.push({
      playerId: thirdPlaceMatch.winner_id,
      playerId2: thirdPlaceMatch.winner_2_id || undefined,
      place: '3',
      points: pointsMap['3'] || 0,
    });

    const { l1, l2 } = getMatchLoserIds(thirdPlaceMatch);
    if (l1) {
      placements.push({
        playerId: l1,
        playerId2: l2 || undefined,
        place: '4',
        points: pointsMap['4'] || 0,
      });
    }
  }

  return placements;
};
