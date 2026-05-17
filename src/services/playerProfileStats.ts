import { getScoreText, getTournamentPlacements, parseSetScore, resolveMatchWinnerSide } from '@/services/ranking';
import { supabase } from '@/services/supabase';

export type ProfileModality = 'singles' | 'dobles';

export type ProfileStatsContext = {
  org_id: string;
  org_name?: string;
  level: string;
};

export type PlayerProfileStats = {
  rank: string;
  trophies: number;
  wins: number;
  winRate: string;
  totalMatches: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  finalsPlayed: number;
  currentStreak: number;
  bestStreak: number;
  debutYear: string;
  bestRanking: string;
  worstRanking: string;
  mostFacedRivalName: string;
  mostFacedRivalMatches: number;
  mostFacedRivalId: string | null;
};

export type RankingHistoryPoint = {
  month: number;
  singlesRank: number | null;
  doblesRank: number | null;
};

export type PlayerAchievement = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  tone: 'gold' | 'silver' | 'bronze' | 'green' | 'blue' | 'purple';
  imageSource?: any;
};

type RankingAccumulator = {
  points: number;
  trophies: number;
  matchesWon: number;
  matchesPlayed: number;
  setsWon: number;
  gamesWon: number;
};

type MatchStats = {
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

const COMPLETED_STATUSES = new Set(['completed', 'finalized', 'finished']);
const CANCELLED_REGISTRATION_STATUSES = new Set(['cancelled', 'rejected']);

export const DEFAULT_PROFILE_STATS: PlayerProfileStats = {
  rank: '-',
  trophies: 0,
  wins: 0,
  winRate: '0%',
  totalMatches: 0,
  setsWon: 0,
  setsLost: 0,
  gamesWon: 0,
  gamesLost: 0,
  finalsPlayed: 0,
  currentStreak: 0,
  bestStreak: 0,
  debutYear: '-',
  bestRanking: '-',
  worstRanking: '-',
  mostFacedRivalName: '-',
  mostFacedRivalMatches: 0,
  mostFacedRivalId: null,
};

export const createEmptyRankingHistory = (): RankingHistoryPoint[] =>
  Array.from({ length: 12 }, (_unused, index) => ({
    month: index,
    singlesRank: null,
    doblesRank: null,
  }));

const normalizeKey = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isCompletedTournament = (tournament: any) =>
  COMPLETED_STATUSES.has(String(tournament?.status || '').toLowerCase());

const isFinishedMatch = (match: any) => String(match?.status || '').toLowerCase() === 'finished';

const isValidRegistration = (registration: any) => {
  const status = String(registration?.status || '').toLowerCase();
  return !CANCELLED_REGISTRATION_STATUSES.has(status);
};

const isTournamentModality = (tournament: any, modality: ProfileModality) => {
  if (modality === 'dobles') return tournament?.modality === 'dobles';
  return !tournament?.modality || tournament.modality === 'singles';
};

const parseDateParts = (value: unknown): { year: number; month: number; time: number } | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return { year: date.getFullYear(), month: date.getMonth(), time: date.getTime() };
    }
  }

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]) - 1;
    const day = Number(isoDate[3]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, time: new Date(year, month, day).getTime() };
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth(), time: date.getTime() };
};

const getTournamentDateParts = (tournament: any) =>
  parseDateParts(tournament?.start_date) ||
  parseDateParts(tournament?.end_date) ||
  parseDateParts(tournament?.created_at);

export const getTournamentYear = (tournament: any) => getTournamentDateParts(tournament)?.year || null;

const getTournamentTime = (tournament: any) => getTournamentDateParts(tournament)?.time || 0;

const getAvailableYears = (tournaments: any[]) =>
  Array.from(
    new Set(
      tournaments
        .map((tournament) => getTournamentYear(tournament))
        .filter((year): year is number => Number.isFinite(year))
    )
  ).sort((left, right) => right - left);

const isMainRoundName = (roundName: unknown) => {
  const normalized = normalizeKey(roundName);
  return !normalized.startsWith('grupo ') &&
    !normalized.includes('consolaci') &&
    !normalized.includes('repech') &&
    !normalized.includes('puesto') &&
    !/(^|\s)(3er|4to|5to|6to)\b/.test(normalized);
};

const isFinalRoundName = (roundName: unknown) => {
  const normalized = normalizeKey(roundName);
  if (!normalized) return false;
  if (normalized.includes('gran final')) return true;
  if (normalized.includes('semi') || normalized.includes('cuart') || normalized.includes('octav')) return false;
  if (normalized.includes('puesto')) return false;
  return /\bfinal\b/.test(normalized);
};

const getFinalMatch = (matches: any[]) => {
  const mainMatches = (matches || [])
    .filter((match) => isMainRoundName(match?.round))
    .sort((left, right) => {
      const roundDelta = Number(right?.round_number || 0) - Number(left?.round_number || 0);
      if (roundDelta !== 0) return roundDelta;
      return Number(right?.match_order || 0) - Number(left?.match_order || 0);
    });

  if (!mainMatches.length) return null;

  const namedFinal = mainMatches.find((match) => isFinalRoundName(match?.round));
  return namedFinal || mainMatches[0];
};

const isPlayerInMatch = (match: any, playerId: string) =>
  match?.player_a_id === playerId ||
  match?.player_a2_id === playerId ||
  match?.player_b_id === playerId ||
  match?.player_b2_id === playerId;

const getPlayerSide = (match: any, playerId: string): 'A' | 'B' | null => {
  if (match?.player_a_id === playerId || match?.player_a2_id === playerId) return 'A';
  if (match?.player_b_id === playerId || match?.player_b2_id === playerId) return 'B';
  return null;
};

const getSidePlayerIds = (match: any, side: 'A' | 'B') => {
  const ids = side === 'A'
    ? [match?.player_a_id, match?.player_a2_id]
    : [match?.player_b_id, match?.player_b2_id];
  return ids
    .map((id) => String(id || '').trim())
    .filter((id) => id && id !== 'BYE');
};

const isPlayerWinner = (match: any, playerId: string, tournamentMatches: any[] = []) => {
  if (match?.winner_id === playerId || match?.winner_2_id === playerId) return true;
  const winnerSide = resolveMatchWinnerSide(match, tournamentMatches);
  const playerSide = getPlayerSide(match, playerId);
  return !!winnerSide && winnerSide === playerSide;
};

const getMatchDateTime = (match: any, tournamentById: Record<string, any>) => {
  const scheduled = parseDateParts(match?.scheduled_at)?.time;
  if (scheduled) return scheduled;
  const tournamentTime = getTournamentTime(tournamentById[match?.tournament_id]);
  if (tournamentTime) return tournamentTime;
  return parseDateParts(match?.created_at)?.time || 0;
};

const sortPlayerMatches = (matches: any[], tournamentById: Record<string, any>) =>
  [...matches].sort((left, right) => {
    const dateDelta = getMatchDateTime(left, tournamentById) - getMatchDateTime(right, tournamentById);
    if (dateDelta !== 0) return dateDelta;
    const roundDelta = Number(left?.round_number || 0) - Number(right?.round_number || 0);
    if (roundDelta !== 0) return roundDelta;
    const orderDelta = Number(left?.match_order || 0) - Number(right?.match_order || 0);
    if (orderDelta !== 0) return orderDelta;
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  });

const getPlayerMatchStats = (match: any, playerId: string): MatchStats => {
  const emptyStats = { setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 };
  const playerSide = getPlayerSide(match, playerId);
  if (!playerSide) return emptyStats;

  const scoreText = getScoreText(match?.score);
  if (!scoreText || /^W\.?O\.?$/i.test(scoreText)) return emptyStats;

  return scoreText
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, setScore) => {
      const parsed = parseSetScore(setScore);
      if (!parsed) return acc;

      const myGames = playerSide === 'A' ? parsed.leftValue : parsed.rightValue;
      const opponentGames = playerSide === 'A' ? parsed.rightValue : parsed.leftValue;

      acc.gamesWon += myGames;
      acc.gamesLost += opponentGames;
      if (myGames > opponentGames) acc.setsWon += 1;
      if (opponentGames > myGames) acc.setsLost += 1;
      return acc;
    }, { ...emptyStats });
};

const hasRecordedScore = (match: any) => Boolean(getScoreText(match?.score));

const getMostFacedRival = async (matches: any[], playerId: string) => {
  const rivalCounts = new Map<string, number>();

  matches.forEach((match) => {
    const playerSide = getPlayerSide(match, playerId);
    if (!playerSide) return;
    const rivalSide = playerSide === 'A' ? 'B' : 'A';
    getSidePlayerIds(match, rivalSide).forEach((rivalId) => {
      rivalCounts.set(rivalId, (rivalCounts.get(rivalId) || 0) + 1);
    });
  });

  const [rivalId, matchCount] = Array.from(rivalCounts.entries())
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      if (countDelta !== 0) return countDelta;
      return left[0].localeCompare(right[0]);
    })[0] || [];

  if (!rivalId || !matchCount) {
    return { mostFacedRivalName: '-', mostFacedRivalMatches: 0, mostFacedRivalId: null };
  }

  const { data: rivalProfile } = await supabase
    .from('public_profiles')
    .select('name')
    .eq('id', rivalId)
    .maybeSingle();

  return {
    mostFacedRivalName: rivalProfile?.name || 'Jugador',
    mostFacedRivalMatches: matchCount,
    mostFacedRivalId: rivalId,
  };
};

const getInitialRankingAccumulator = (): RankingAccumulator => ({
  points: 0,
  trophies: 0,
  matchesWon: 0,
  matchesPlayed: 0,
  setsWon: 0,
  gamesWon: 0,
});

const ensureRankingAccumulator = (ranking: Record<string, RankingAccumulator>, playerId: string) => {
  if (!ranking[playerId]) ranking[playerId] = getInitialRankingAccumulator();
  return ranking[playerId];
};

const buildRanking = (
  tournaments: any[],
  matchesByTournament: Record<string, any[]>,
  registrationsByTournament: Record<string, any[]>
) => {
  const ranking: Record<string, RankingAccumulator> = {};

  tournaments.forEach((tournament) => {
    const tournamentMatches = matchesByTournament[tournament.id] || [];
    const placements = getTournamentPlacements(tournament, tournamentMatches);

    placements.forEach((placement) => {
      const ids = [placement.playerId, placement.playerId2].filter(Boolean) as string[];
      ids.forEach((id) => {
        const playerRanking = ensureRankingAccumulator(ranking, id);
        playerRanking.points += Number(placement.points) || 0;
        if (String(placement.place) === '1') playerRanking.trophies += 1;
      });
    });

    tournamentMatches
      .filter(isFinishedMatch)
      .forEach((match) => {
        const winnerSide = resolveMatchWinnerSide(match, tournamentMatches);
        (['A', 'B'] as const).forEach((side) => {
          getSidePlayerIds(match, side).forEach((id) => {
            const playerRanking = ensureRankingAccumulator(ranking, id);
            const matchStats = getPlayerMatchStats(match, id);
            playerRanking.matchesPlayed += 1;
            playerRanking.setsWon += matchStats.setsWon;
            playerRanking.gamesWon += matchStats.gamesWon;
            if (winnerSide === side) playerRanking.matchesWon += 1;
          });
        });
      });

    (registrationsByTournament[tournament.id] || [])
      .filter(isValidRegistration)
      .forEach((registration) => {
        const playerId = String(registration?.player_id || '').trim();
        if (playerId) ensureRankingAccumulator(ranking, playerId);
      });
  });

  const getWinRate = (entry: RankingAccumulator) =>
    entry.matchesPlayed > 0 ? entry.matchesWon / entry.matchesPlayed : 0;

  const isTie = (left: RankingAccumulator, right: RankingAccumulator) =>
    left.points === right.points &&
    left.trophies === right.trophies &&
    getWinRate(left) === getWinRate(right) &&
    left.setsWon === right.setsWon &&
    left.gamesWon === right.gamesWon;

  const rows = Object.entries(ranking)
    .map(([playerId, entry]) => ({ playerId, ...entry }))
    .sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      if (right.trophies !== left.trophies) return right.trophies - left.trophies;
      const winRateDelta = getWinRate(right) - getWinRate(left);
      if (winRateDelta !== 0) return winRateDelta;
      if (right.setsWon !== left.setsWon) return right.setsWon - left.setsWon;
      if (right.gamesWon !== left.gamesWon) return right.gamesWon - left.gamesWon;
      return left.playerId.localeCompare(right.playerId);
    });

  let lastRank = 0;
  let previousEntry: RankingAccumulator | null = null;
  return rows.map((row, index) => {
    const rank = previousEntry && isTie(previousEntry, row) ? lastRank : index + 1;
    lastRank = rank;
    previousEntry = row;
    return { ...row, rank };
  });
};

const getPlayerRank = (
  playerId: string,
  tournaments: any[],
  matchesByTournament: Record<string, any[]>,
  registrationsByTournament: Record<string, any[]>
) => {
  const rankingRows = buildRanking(tournaments, matchesByTournament, registrationsByTournament);
  const playerRow = rankingRows.find((row) => row.playerId === playerId);
  if (!playerRow) return null;
  if (playerRow.points <= 0 && playerRow.matchesPlayed <= 0) return null;
  return playerRow.rank;
};

const groupRowsByTournament = (rows: any[]) =>
  (rows || []).reduce((acc: Record<string, any[]>, row: any) => {
    const tournamentId = row?.tournament_id;
    if (!tournamentId) return acc;
    acc[tournamentId] = [...(acc[tournamentId] || []), row];
    return acc;
  }, {});

const calculateStreaks = (
  matches: any[],
  playerId: string,
  tournamentById: Record<string, any>,
  matchesByTournament: Record<string, any[]> = {}
) => {
  let current = 0;
  let best = 0;

  sortPlayerMatches(matches.filter(isFinishedMatch), tournamentById).forEach((match) => {
    const tournamentMatches = matchesByTournament[match.tournament_id] ||
      matches.filter((candidate) => candidate.tournament_id === match.tournament_id);
    if (isPlayerWinner(match, playerId, tournamentMatches)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return { current, best };
};

const buildRankingHistory = (
  playerId: string,
  contextTournaments: any[],
  modality: ProfileModality,
  selectedYear: number | null,
  matchesByTournament: Record<string, any[]>,
  registrationsByTournament: Record<string, any[]>
) => {
  if (!selectedYear) return createEmptyRankingHistory();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return createEmptyRankingHistory().map((point) => {
    const isFutureMonth = selectedYear > currentYear ||
      (selectedYear === currentYear && point.month > currentMonth);
    if (isFutureMonth) return point;

    const snapshotTime = new Date(selectedYear, point.month, 1).getTime();
    const sourceTournaments = contextTournaments.filter((tournament) =>
      isCompletedTournament(tournament) &&
      isTournamentModality(tournament, modality) &&
      getTournamentTime(tournament) < snapshotTime
    );
    const rank = sourceTournaments.length
      ? getPlayerRank(playerId, sourceTournaments, matchesByTournament, registrationsByTournament)
      : null;

    return {
      ...point,
      singlesRank: modality === 'singles' ? rank : null,
      doblesRank: modality === 'dobles' ? rank : null,
    };
  });
};

const getRankingRange = (
  playerId: string,
  contextTournaments: any[],
  modality: ProfileModality,
  years: number[],
  matchesByTournament: Record<string, any[]>,
  registrationsByTournament: Record<string, any[]>,
  currentRank?: number | null
) => {
  const snapshotRanks = years
    .flatMap((year) =>
      buildRankingHistory(playerId, contextTournaments, modality, year, matchesByTournament, registrationsByTournament)
    )
    .map((point) => modality === 'dobles' ? point.doblesRank : point.singlesRank)
    .filter((rank): rank is number => typeof rank === 'number' && Number.isFinite(rank));
  const ranks = [
    ...snapshotRanks,
    ...(typeof currentRank === 'number' && Number.isFinite(currentRank) ? [currentRank] : []),
  ];

  if (!ranks.length) return { bestRanking: '-', worstRanking: '-' };
  return {
    bestRanking: `#${Math.min(...ranks)}`,
    worstRanking: `#${Math.max(...ranks)}`,
  };
};

export const loadProfileStatsBundle = async ({
  playerId,
  context,
  modality,
  selectedYear,
}: {
  playerId: string;
  context: ProfileStatsContext;
  modality: ProfileModality;
  selectedYear: number | null;
}) => {
  const { data: scopedTournaments, error: scopedTournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, status, format, description, modality, level, organization_id, start_date, end_date, created_at')
    .eq('organization_id', context.org_id)
    .eq('level', context.level);

  if (scopedTournamentsError) throw scopedTournamentsError;

  const contextTournaments = scopedTournaments || [];
  const tournamentById = contextTournaments.reduce((acc: Record<string, any>, tournament: any) => {
    acc[tournament.id] = tournament;
    return acc;
  }, {});
  const tournamentIds = contextTournaments.map((tournament: any) => tournament.id).filter(Boolean);

  if (!tournamentIds.length) {
    return {
      stats: DEFAULT_PROFILE_STATS,
      rankingHistory: createEmptyRankingHistory(),
      availableYears: [],
      effectiveYear: null,
    };
  }

  const { data: allMatchesRows, error: allMatchesError } = await supabase
    .from('matches')
    .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status, scheduled_at, created_at')
    .in('tournament_id', tournamentIds);

  if (allMatchesError) throw allMatchesError;

  const { data: registrationRows, error: registrationsError } = await supabase
    .from('registrations')
    .select('tournament_id, player_id, status')
    .in('tournament_id', tournamentIds);

  if (registrationsError) throw registrationsError;

  const allMatches = allMatchesRows || [];
  const registrations = registrationRows || [];
  const matchesByTournament = groupRowsByTournament(allMatches);
  const registrationsByTournament = groupRowsByTournament(registrations);

  const playerTournamentIds = new Set<string>();
  allMatches
    .filter((match) => isPlayerInMatch(match, playerId))
    .forEach((match) => playerTournamentIds.add(match.tournament_id));
  registrations
    .filter((registration) => registration.player_id === playerId && isValidRegistration(registration))
    .forEach((registration) => playerTournamentIds.add(registration.tournament_id));

  const playerContextTournaments = contextTournaments.filter((tournament: any) => playerTournamentIds.has(tournament.id));
  const availableYears = getAvailableYears(playerContextTournaments.length ? playerContextTournaments : contextTournaments);
  const effectiveYear = availableYears.includes(Number(selectedYear))
    ? Number(selectedYear)
    : availableYears[0] || null;

  const modalityTournaments = contextTournaments.filter((tournament: any) => isTournamentModality(tournament, modality));
  const selectedYearTournaments = effectiveYear
    ? modalityTournaments.filter((tournament: any) => getTournamentYear(tournament) === effectiveYear)
    : [];
  const selectedCompletedTournaments = selectedYearTournaments.filter(isCompletedTournament);
  const selectedTournamentIds = new Set(selectedYearTournaments.map((tournament: any) => tournament.id));

  const selectedPlayerMatches = allMatches.filter((match: any) =>
    selectedTournamentIds.has(match.tournament_id) &&
    isFinishedMatch(match) &&
    isPlayerInMatch(match, playerId)
  );

  const selectedStats = selectedPlayerMatches.reduce((acc, match) => {
    const tournamentMatches = matchesByTournament[match.tournament_id] || [];
    const matchStats = getPlayerMatchStats(match, playerId);
    acc.totalMatches += 1;
    acc.setsWon += matchStats.setsWon;
    acc.setsLost += matchStats.setsLost;
    acc.gamesWon += matchStats.gamesWon;
    acc.gamesLost += matchStats.gamesLost;
    if (isPlayerWinner(match, playerId, tournamentMatches)) acc.wins += 1;
    return acc;
  }, {
    totalMatches: 0,
    wins: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  });

  const rankingRows = buildRanking(selectedCompletedTournaments, matchesByTournament, registrationsByTournament);
  const playerRankingRow = rankingRows.find((row) => row.playerId === playerId);
  const hasCompetitiveData = !!playerRankingRow && (playerRankingRow.points > 0 || playerRankingRow.matchesPlayed > 0 || selectedStats.totalMatches > 0);
  const rank = playerRankingRow && hasCompetitiveData ? `#${playerRankingRow.rank}` : '-';

  const finalsPlayed = selectedCompletedTournaments.reduce((count, tournament: any) => {
    const finalMatch = getFinalMatch(matchesByTournament[tournament.id] || []);
    if (!finalMatch || !isPlayerInMatch(finalMatch, playerId)) return count;
    return count + 1;
  }, 0);

  const allModalityPlayerMatches = allMatches.filter((match: any) =>
    isPlayerInMatch(match, playerId) &&
    modalityTournaments.some((tournament: any) => tournament.id === match.tournament_id)
  );
  const selectedBestStreak = calculateStreaks(selectedPlayerMatches, playerId, tournamentById, matchesByTournament).best;
  const currentStreak = calculateStreaks(allModalityPlayerMatches, playerId, tournamentById, matchesByTournament).current;

  const debutTournament = [...modalityTournaments]
    .filter((tournament: any) => {
      const playerHadMatch = (matchesByTournament[tournament.id] || []).some((match) =>
        isFinishedMatch(match) && isPlayerInMatch(match, playerId)
      );
      const playerRegistered = (registrationsByTournament[tournament.id] || []).some((registration) =>
        registration.player_id === playerId && isValidRegistration(registration)
      );
      return playerHadMatch || playerRegistered;
    })
    .sort((left: any, right: any) => getTournamentTime(left) - getTournamentTime(right))[0];
  const debutYear = debutTournament ? String(getTournamentYear(debutTournament) || '-') : '-';

  const winRate = selectedStats.totalMatches > 0
    ? `${Math.round((selectedStats.wins / selectedStats.totalMatches) * 100)}%`
    : '0%';
  const rankingRange = getRankingRange(
    playerId,
    contextTournaments,
    modality,
    availableYears,
    matchesByTournament,
    registrationsByTournament,
    playerRankingRow?.rank || null
  );
  const mostFacedRival = await getMostFacedRival(selectedPlayerMatches, playerId);

  return {
    stats: {
      ...DEFAULT_PROFILE_STATS,
      rank,
      trophies: playerRankingRow?.trophies || 0,
      wins: selectedStats.wins,
      winRate,
      totalMatches: selectedStats.totalMatches,
      setsWon: selectedStats.setsWon,
      setsLost: selectedStats.setsLost,
      gamesWon: selectedStats.gamesWon,
      gamesLost: selectedStats.gamesLost,
      finalsPlayed,
      currentStreak,
      bestStreak: selectedBestStreak,
      debutYear,
      bestRanking: rankingRange.bestRanking,
      worstRanking: rankingRange.worstRanking,
      mostFacedRivalName: mostFacedRival.mostFacedRivalName,
      mostFacedRivalMatches: mostFacedRival.mostFacedRivalMatches,
      mostFacedRivalId: mostFacedRival.mostFacedRivalId,
    },
    rankingHistory: buildRankingHistory(playerId, contextTournaments, modality, effectiveYear, matchesByTournament, registrationsByTournament),
    availableYears,
    effectiveYear,
  };
};

const getContextKey = (tournament: any) =>
  [
    tournament?.organization_id || '',
    tournament?.level || '',
    tournament?.modality || 'singles',
  ].join('|');

const getYearContextKey = (tournament: any) => `${getContextKey(tournament)}|${getTournamentYear(tournament) || ''}`;

const getChampionPlacements = (playerId: string, tournaments: any[], matchesByTournament: Record<string, any[]>) =>
  tournaments.flatMap((tournament) => {
    const placements = getTournamentPlacements(tournament, matchesByTournament[tournament.id] || []);
    const championPlacement = placements.find((placement) =>
      String(placement.place) === '1' &&
      (placement.playerId === playerId || placement.playerId2 === playerId)
    );
    return championPlacement ? [{ tournament, placement: championPlacement }] : [];
  });

export const loadPlayerAchievements = async (playerId: string): Promise<PlayerAchievement[]> => {
  const { data: playerMatchRows, error: playerMatchesError } = await supabase
    .from('matches')
    .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status, scheduled_at, created_at')
    .or(`player_a_id.eq.${playerId},player_a2_id.eq.${playerId},player_b_id.eq.${playerId},player_b2_id.eq.${playerId}`);

  if (playerMatchesError) throw playerMatchesError;

  const { data: playerRegistrationsRows, error: playerRegistrationsError } = await supabase
    .from('registrations')
    .select('tournament_id, player_id, status')
    .eq('player_id', playerId);

  if (playerRegistrationsError) throw playerRegistrationsError;

  const playerTournamentIds = Array.from(new Set([
    ...(playerMatchRows || []).map((match: any) => match.tournament_id).filter(Boolean),
    ...(playerRegistrationsRows || [])
      .filter(isValidRegistration)
      .map((registration: any) => registration.tournament_id)
      .filter(Boolean),
  ]));

  if (!playerTournamentIds.length) return [];

  const { data: playerTournamentsRows, error: playerTournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, status, format, description, modality, level, organization_id, start_date, end_date, created_at')
    .in('id', playerTournamentIds);

  if (playerTournamentsError) throw playerTournamentsError;

  const playerTournaments = playerTournamentsRows || [];
  const playerTournamentById = playerTournaments.reduce((acc: Record<string, any>, tournament: any) => {
    acc[tournament.id] = tournament;
    return acc;
  }, {});

  const { data: allPlayerTournamentMatchesRows, error: allPlayerTournamentMatchesError } = await supabase
    .from('matches')
    .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status, scheduled_at, created_at')
    .in('tournament_id', playerTournamentIds);

  if (allPlayerTournamentMatchesError) throw allPlayerTournamentMatchesError;

  const { data: allPlayerTournamentRegistrationsRows, error: allPlayerTournamentRegistrationsError } = await supabase
    .from('registrations')
    .select('tournament_id, player_id, status')
    .in('tournament_id', playerTournamentIds);

  if (allPlayerTournamentRegistrationsError) throw allPlayerTournamentRegistrationsError;

  const allPlayerTournamentMatches = allPlayerTournamentMatchesRows || [];
  const matchesByPlayerTournament = groupRowsByTournament(allPlayerTournamentMatches);
  const registrationsByPlayerTournament = groupRowsByTournament(allPlayerTournamentRegistrationsRows || []);
  const achievements: PlayerAchievement[] = [];

  const playedTournaments = [...playerTournaments]
    .filter((tournament: any) => {
      const playerHadMatch = (matchesByPlayerTournament[tournament.id] || []).some((match) =>
        isFinishedMatch(match) && isPlayerInMatch(match, playerId)
      );
      const playerRegistered = (registrationsByPlayerTournament[tournament.id] || []).some((registration) =>
        registration.player_id === playerId && isValidRegistration(registration)
      );
      return playerHadMatch || playerRegistered;
    })
    .sort((left: any, right: any) => getTournamentTime(left) - getTournamentTime(right));

  if (playedTournaments[0]) {
    achievements.push({
      id: 'first-tournament',
      title: 'Primer torneo jugado',
      detail: [playedTournaments[0].name || 'Torneo', getTournamentYear(playedTournaments[0])]
        .filter(Boolean)
        .join(' - '),
      icon: 'tennisball',
      tone: 'silver',
      imageSource: require('../../assets/Medallas/PrimerTorneoJugado.png'),
    });
  }

  const finishedPlayerMatches = (playerMatchRows || [])
    .filter(isFinishedMatch)
    .sort((left: any, right: any) => getMatchDateTime(left, playerTournamentById) - getMatchDateTime(right, playerTournamentById));
  const firstWin = finishedPlayerMatches.find((match: any) =>
    isPlayerWinner(match, playerId, matchesByPlayerTournament[match.tournament_id] || [])
  );

  if (firstWin) {
    const tournament = playerTournamentById[firstWin.tournament_id];
    achievements.push({
      id: 'first-win',
      title: 'Primer triunfo',
      detail: tournament?.name || 'Partido ganado',
      icon: 'tennisball',
      tone: 'gold',
      imageSource: require('../../assets/Medallas/PrimerTriunfo.png'),
    });
  }

  const contextKeys = Array.from(new Set(playerTournaments.filter(isCompletedTournament).map(getContextKey)));
  const orgIds = Array.from(new Set(playerTournaments.map((tournament: any) => tournament.organization_id).filter(Boolean)));
  const levels = Array.from(new Set(playerTournaments.map((tournament: any) => tournament.level).filter(Boolean)));
  const topTenLevels = new Set<string>();
  const topFiveLevels = new Set<string>();
  const topOneLevels = new Set<string>();

  if (contextKeys.length && orgIds.length && levels.length) {
    const { data: rankingPoolTournamentsRows } = await supabase
      .from('tournaments')
      .select('id, name, status, format, description, modality, level, organization_id, start_date, end_date, created_at')
      .in('organization_id', orgIds)
      .in('level', levels)
      .in('status', Array.from(COMPLETED_STATUSES));

    const rankingPoolTournaments = (rankingPoolTournamentsRows || []).filter((tournament: any) =>
      contextKeys.includes(getContextKey(tournament))
    );

    if (rankingPoolTournaments.length) {
      const rankingTournamentIds = rankingPoolTournaments.map((tournament: any) => tournament.id);
      const { data: rankingMatchesRows } = await supabase
        .from('matches')
        .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status, scheduled_at, created_at')
        .in('tournament_id', rankingTournamentIds);
      const { data: rankingRegistrationsRows } = await supabase
        .from('registrations')
        .select('tournament_id, player_id, status')
        .in('tournament_id', rankingTournamentIds);

      const rankingMatchesByTournament = groupRowsByTournament(rankingMatchesRows || []);
      const rankingRegistrationsByTournament = groupRowsByTournament(rankingRegistrationsRows || []);
      const rankingGroups = new Map<string, any[]>();

      rankingPoolTournaments.forEach((tournament: any) => {
        [getContextKey(tournament), getYearContextKey(tournament)].forEach((key) => {
          rankingGroups.set(key, [...(rankingGroups.get(key) || []), tournament]);
        });
      });

      Array.from(rankingGroups.values()).forEach((groupTournaments) => {
        const rank = getPlayerRank(playerId, groupTournaments, rankingMatchesByTournament, rankingRegistrationsByTournament);
        if (!rank) return;
        const level = String(groupTournaments[0]?.level || 'Categoria').trim();
        const levelKey = level || 'Categoria';
        if (rank <= 10) topTenLevels.add(levelKey);
        if (rank <= 5) topFiveLevels.add(levelKey);
        if (rank === 1) topOneLevels.add(levelKey);
      });
    }
  }


  const getLevelImageName = (type: string, level: string) => {
    const l = normalizeKey(level);
    if (l === 'primera' || l === '1ra') return `${type}Primera.png`;
    if (l === 'segunda' || l === '2da') return `${type}Segunda.png`;
    if (l === 'tercera' || l === '3ra') return `${type}Tercera.png`;
    if (l === 'cuarta' || l === '4ta') return `${type}Cuarta.png`;
    if (l === 'quinta' || l === '5ta') return `${type}Quinta.png`;
    if (l === 'honor') return `${type}Honor.png`;
    if (l === 'escalafon') return `${type}Escalafón.png`;
    if (l === 'inicial') return `${type}Inicial.png`;
    return null;
  };

  const getMedalSource = (filename: string | null) => {
    switch(filename) {
      case '10Triunfos.png': return require('../../assets/Medallas/10Triunfos.png');
      case '25Triunfos.png': return require('../../assets/Medallas/25Triunfos.png');
      case '50Triunfos.png': return require('../../assets/Medallas/50Triunfos.png');
      case '100Triunfos.png': return require('../../assets/Medallas/100Triunfos.png');
      case '150Triunfos.png': return require('../../assets/Medallas/150Triunfos.png');
      case '200Triunfos.png': return require('../../assets/Medallas/200Triunfos.png');
      case '250Triunfos.png': return require('../../assets/Medallas/250Triunfos.png');
      case 'CampeónCuarta.png': return require('../../assets/Medallas/CampeónCuarta.png');
      case 'CampeónEscalafón.png': return require('../../assets/Medallas/CampeónEscalafón.png');
      case 'CampeónHonor.png': return require('../../assets/Medallas/CampeónHonor.png');
      case 'CampeónInicial.png': return require('../../assets/Medallas/CampeónInicial.png');
      case 'CampeónInvicto.png': return require('../../assets/Medallas/CampeónInvicto.png');
      case 'CampeónPrimera.png': return require('../../assets/Medallas/CampeónPrimera.png');
      case 'CampeónQuinta.png': return require('../../assets/Medallas/CampeónQuinta.png');
      case 'CampeónSegunda.png': return require('../../assets/Medallas/CampeónSegunda.png');
      case 'CampeónSinCederGames.png': return require('../../assets/Medallas/CampeónSinCederGames.png');
      case 'CampeónSinCederSets.png': return require('../../assets/Medallas/CampeónSinCederSets.png');
      case 'CampeónTercera.png': return require('../../assets/Medallas/CampeónTercera.png');
      case 'DiosDelTenis.png': return require('../../assets/Medallas/DiosDelTenis.png');
      case 'Racha100Victorias.png': return require('../../assets/Medallas/Racha100Victorias.png');
      case 'Racha10Victorias.png': return require('../../assets/Medallas/Racha10Victorias.png');
      case 'Racha15Victorias.png': return require('../../assets/Medallas/Racha15Victorias.png');
      case 'Racha20Victorias.png': return require('../../assets/Medallas/Racha20Victorias.png');
      case 'Racha30Victorias.png': return require('../../assets/Medallas/Racha30Victorias.png');
      case 'Racha40Victorias.png': return require('../../assets/Medallas/Racha40Victorias.png');
      case 'Racha50Victorias.png': return require('../../assets/Medallas/Racha50Victorias.png');
      case 'Racha5Victorias.png': return require('../../assets/Medallas/Racha5Victorias.png');
      case 'Racha60Victorias.png': return require('../../assets/Medallas/Racha60Victorias.png');
      case 'Racha70Victorias.png': return require('../../assets/Medallas/Racha70Victorias.png');
      case 'Racha80Victorias.png': return require('../../assets/Medallas/Racha80Victorias.png');
      case 'Racha90Victorias.png': return require('../../assets/Medallas/Racha90Victorias.png');
      case 'Top10RankingCuarta.png': return require('../../assets/Medallas/Top10RankingCuarta.png');
      case 'Top10RankingEscalafón.png': return require('../../assets/Medallas/Top10RankingEscalafón.png');
      case 'Top10RankingHonor.png': return require('../../assets/Medallas/Top10RankingHonor.png');
      case 'Top10RankingInicial.png': return require('../../assets/Medallas/Top10RankingInicial.png');
      case 'Top10RankingPrimera.png': return require('../../assets/Medallas/Top10RankingPrimera.png');
      case 'Top10RankingQuinta.png': return require('../../assets/Medallas/Top10RankingQuinta.png');
      case 'Top10RankingSegunda.png': return require('../../assets/Medallas/Top10RankingSegunda.png');
      case 'Top10RankingTercera.png': return require('../../assets/Medallas/Top10RankingTercera.png');
      case 'Top1RankingCuarta.png': return require('../../assets/Medallas/Top1RankingCuarta.png');
      case 'Top1RankingEscalafón.png': return require('../../assets/Medallas/Top1RankingEscalafón.png');
      case 'Top1RankingHonor.png': return require('../../assets/Medallas/Top1RankingHonor.png');
      case 'Top1RankingInicial.png': return require('../../assets/Medallas/Top1RankingInicial.png');
      case 'Top1RankingPrimera.png': return require('../../assets/Medallas/Top1RankingPrimera.png');
      case 'Top1RankingQuinta.png': return require('../../assets/Medallas/Top1RankingQuinta.png');
      case 'Top1RankingSegunda.png': return require('../../assets/Medallas/Top1RankingSegunda.png');
      case 'Top1RankingTercera.png': return require('../../assets/Medallas/Top1RankingTercera.png');
      case 'Top5RankingCuarta.png': return require('../../assets/Medallas/Top5RankingCuarta.png');
      case 'Top5RankingEscalafón.png': return require('../../assets/Medallas/Top5RankingEscalafón.png');
      case 'Top5RankingHonor.png': return require('../../assets/Medallas/Top5RankingHonor.png');
      case 'Top5RankingInicial.png': return require('../../assets/Medallas/Top5RankingInicial.png');
      case 'Top5RankingPrimera.png': return require('../../assets/Medallas/Top5RankingPrimera.png');
      case 'Top5RankingQuinta.png': return require('../../assets/Medallas/Top5RankingQuinta.png');
      case 'Top5RankingSegunda.png': return require('../../assets/Medallas/Top5RankingSegunda.png');
      case 'Top5RankingTercera.png': return require('../../assets/Medallas/Top5RankingTercera.png');
      default: return undefined;
    }
  };

  Array.from(topOneLevels)
    .sort((left, right) => left.localeCompare(right))
    .forEach((level) => {
      const normalizedLevel = normalizeKey(level) || 'categoria';
      achievements.push({
        id: `top-one-${normalizedLevel}`,
        title: `Top 1 de ranking ${level}`,
        detail: `Alcanzo el primer lugar en ${level}`,
        icon: 'podium',
        tone: 'gold',
        imageSource: getMedalSource(getLevelImageName('Top1Ranking', level)),
      });
    });

  Array.from(topFiveLevels)
    .sort((left, right) => left.localeCompare(right))
    .forEach((level) => {
      const normalizedLevel = normalizeKey(level) || 'categoria';
      achievements.push({
        id: `top-five-${normalizedLevel}`,
        title: `Top 5 de ranking ${level}`,
        detail: `Entro por primera vez entre los mejores 5 de ${level}`,
        icon: 'tennisball',
        tone: 'silver',
        imageSource: getMedalSource(getLevelImageName('Top5Ranking', level)),
      });
    });

  Array.from(topTenLevels)
    .sort((left, right) => left.localeCompare(right))
    .forEach((level) => {
      const normalizedLevel = normalizeKey(level) || 'categoria';
      achievements.push({
        id: `top-ten-${normalizedLevel}`,
        title: `Top 10 de ranking ${level}`,
        detail: `Entro por primera vez entre los mejores 10 de ${level}`,
        icon: 'tennisball',
        tone: 'bronze',
        imageSource: getMedalSource(getLevelImageName('Top10Ranking', level)),
      });
    });

  const totalWins = finishedPlayerMatches.filter((match: any) =>
    isPlayerWinner(match, playerId, matchesByPlayerTournament[match.tournament_id] || [])
  ).length;

  [10, 25, 50, 100, 150, 200, 250].forEach((threshold) => {
    if (totalWins >= threshold) {
      achievements.push({
        id: `wins-${threshold}`,
        title: `${threshold} Triunfos`,
        detail: `${threshold} partidos ganados en total`,
        icon: 'tennisball',
        tone: threshold >= 100 ? 'gold' : 'silver',
        imageSource: getMedalSource(`${threshold}Triunfos.png`),
      });
    }
  });

  const completedPlayerTournaments = playerTournaments.filter(isCompletedTournament);
  const championEntries = getChampionPlacements(playerId, completedPlayerTournaments, matchesByPlayerTournament)
    .sort((left, right) => getTournamentTime(left.tournament) - getTournamentTime(right.tournament));

  const championLevels = new Set<string>();
  championEntries.forEach(({ tournament }) => {
    const level = String(tournament?.level || 'Categoria').trim();
    const achievementId = `champion-${normalizeKey(level) || 'categoria'}`;
    if (championLevels.has(achievementId)) return;
    championLevels.add(achievementId);
    achievements.push({
      id: achievementId,
      title: `Campeon ${level}`,
      detail: tournament?.name || 'Campeonato ganado',
      icon: 'trophy',
      tone: 'gold',
      imageSource: getMedalSource(getLevelImageName('Campeón', level)),
    });
  });

  const championCountByLevel = championEntries.reduce((acc: Record<string, number>, { tournament }) => {
    const level = String(tournament?.level || 'Categoria').trim() || 'Categoria';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  Object.entries(championCountByLevel)
    .sort(([leftLevel], [rightLevel]) => leftLevel.localeCompare(rightLevel))
    .forEach(([level, count]) => {
      [5, 10, 15, 20].forEach((threshold) => {
        if (count < threshold) return;
        achievements.push({
          id: `championships-${threshold}-${normalizeKey(level) || 'categoria'}`,
          title: `${threshold} Campeonatos Logrados ${level}`,
          detail: `${count} campeonatos ganados en ${level}`,
          icon: threshold >= 15 ? 'trophy' : 'medal',
          tone: threshold >= 10 ? 'gold' : 'silver',
        });
      });
    });

  const allStreaks = calculateStreaks(finishedPlayerMatches, playerId, playerTournamentById, matchesByPlayerTournament);
  [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach((threshold) => {
    if (allStreaks.best >= threshold) {
      achievements.push({
        id: `streak-${threshold}`,
        title: `Racha de ${threshold} victorias`,
        detail: `${allStreaks.best} victorias como mejor racha`,
        icon: 'tennisball',
        tone: threshold >= 30 ? 'gold' : threshold >= 15 ? 'silver' : 'bronze',
        imageSource: getMedalSource(`Racha${threshold}Victorias.png`),
      });
    }
  });

  const hasUndefeatedChampion = championEntries.some(({ tournament }) => {
    const tournamentMatches = (matchesByPlayerTournament[tournament.id] || [])
      .filter((match) => isFinishedMatch(match) && isPlayerInMatch(match, playerId));
    return tournamentMatches.length > 0 &&
      tournamentMatches.every((match) => isPlayerWinner(match, playerId, matchesByPlayerTournament[tournament.id] || []));
  });

  if (hasUndefeatedChampion) {
    achievements.push({
      id: 'undefeated-champion',
      title: 'Campeon invicto',
      detail: 'Titulo ganado sin perder partidos',
      icon: 'trophy',
      tone: 'gold',
      imageSource: getMedalSource('CampeónInvicto.png'),
    });
  }

  const hasNoSetLostChampion = championEntries.some(({ tournament }) => {
    const tournamentMatches = (matchesByPlayerTournament[tournament.id] || [])
      .filter((match) => isFinishedMatch(match) && isPlayerInMatch(match, playerId));
    return tournamentMatches.length > 0 &&
      tournamentMatches.every((match) => hasRecordedScore(match) && getPlayerMatchStats(match, playerId).setsLost === 0);
  });

  if (hasNoSetLostChampion) {
    achievements.push({
      id: 'no-set-lost-champion',
      title: 'Campeon sin ceder sets',
      detail: 'Titulo ganado sin perder sets',
      icon: 'ribbon',
      tone: 'silver',
      imageSource: getMedalSource('CampeónSinCederSets.png'),
    });
  }

  const hasNoGameLostChampion = championEntries.some(({ tournament }) => {
    const tournamentMatches = (matchesByPlayerTournament[tournament.id] || [])
      .filter((match) => isFinishedMatch(match) && isPlayerInMatch(match, playerId));
    return tournamentMatches.length > 0 &&
      tournamentMatches.every((match) => hasRecordedScore(match) && getPlayerMatchStats(match, playerId).gamesLost === 0);
  });

  if (hasNoGameLostChampion) {
    achievements.push({
      id: 'no-game-lost-champion',
      title: 'Campeon sin ceder games',
      detail: 'Titulo ganado sin perder games',
      icon: 'medal',
      tone: 'gold',
      imageSource: getMedalSource('CampeónSinCederGames.png'),
    });
  }

  if (hasUndefeatedChampion && hasNoSetLostChampion && hasNoGameLostChampion) {
    achievements.push({
      id: 'dios-del-tenis',
      title: 'Dios del Tenis',
      detail: 'Campeon invicto, sin perder sets y sin ceder games',
      icon: 'star',
      tone: 'gold',
      imageSource: getMedalSource('DiosDelTenis.png'),
    });
  }

  return achievements;
};
