import { supabase } from '@/services/supabase';
import { resolveCachedData } from './runtimeCache';

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
  dateEarned?: string;
  tournamentName?: string;
  matchDetail?: string;
};

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

const getMedalSource = (filename: string | null) => {
  switch(filename) {
    case '10Triunfos.png': return require('../../assets/Medallas/10Triunfos.png');
    case '25Triunfos.png': return require('../../assets/Medallas/25Triunfos.png');
    case '50Triunfos.png': return require('../../assets/Medallas/50Triunfos.png');
    case '100Triunfos.png': return require('../../assets/Medallas/100Triunfos.png');
    case '150Triunfos.png': return require('../../assets/Medallas/150Triunfos.png');
    case '200Triunfos.png': return require('../../assets/Medallas/200Triunfos.png');
    case '250Triunfos.png': return require('../../assets/Medallas/250Triunfos.png');
    case 'CampeonCuarta.png': return require('../../assets/Medallas/CampeonCuarta.png');
    case 'CampeonEscalafon.png': return require('../../assets/Medallas/CampeonEscalafon.png');
    case 'CampeonHonor.png': return require('../../assets/Medallas/CampeonHonor.png');
    case 'CampeonInicial.png': return require('../../assets/Medallas/CampeonInicial.png');
    case 'CampeónInvicto.png':
    case 'CampeonInvicta.png': return require('../../assets/Medallas/CampeonInvicta.png');
    case 'CampeonPrimera.png': return require('../../assets/Medallas/CampeonPrimera.png');
    case 'CampeonQuinta.png': return require('../../assets/Medallas/CampeonQuinta.png');
    case 'CampeonSegunda.png': return require('../../assets/Medallas/CampeonSegunda.png');
    case 'CampeonSinCederGames.png': return require('../../assets/Medallas/CampeonSinCederGames.png');
    case 'CampeonSinCederSets.png': return require('../../assets/Medallas/CampeonSinCederSets.png');
    case 'CampeonTercera.png': return require('../../assets/Medallas/CampeonTercera.png');
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
    case 'Top10RankingEscalafon.png': return require('../../assets/Medallas/Top10RankingEscalafon.png');
    case 'Top10RankingHonor.png': return require('../../assets/Medallas/Top10RankingHonor.png');
    case 'Top10RankingInicial.png': return require('../../assets/Medallas/Top10RankingInicial.png');
    case 'Top10RankingPrimera.png': return require('../../assets/Medallas/Top10RankingPrimera.png');
    case 'Top10RankingQuinta.png': return require('../../assets/Medallas/Top10RankingQuinta.png');
    case 'Top10RankingSegunda.png': return require('../../assets/Medallas/Top10RankingSegunda.png');
    case 'Top10RankingTercera.png': return require('../../assets/Medallas/Top10RankingTercera.png');
    case 'Top1RankingCuarta.png': return require('../../assets/Medallas/Top1RankingCuarta.png');
    case 'Top1RankingEscalafon.png': return require('../../assets/Medallas/Top1RankingEscalafon.png');
    case 'Top1RankingHonor.png': return require('../../assets/Medallas/Top1RankingHonor.png');
    case 'Top1RankingInicial.png': return require('../../assets/Medallas/Top1RankingInicial.png');
    case 'Top1RankingPrimera.png': return require('../../assets/Medallas/Top1RankingPrimera.png');
    case 'Top1RankingQuinta.png': return require('../../assets/Medallas/Top1RankingQuinta.png');
    case 'Top1RankingSegunda.png': return require('../../assets/Medallas/Top1RankingSegunda.png');
    case 'Top1RankingTercera.png': return require('../../assets/Medallas/Top1RankingTercera.png');
    case 'Top5RankingCuarta.png': return require('../../assets/Medallas/Top5RankingCuarta.png');
    case 'Top5RankingEscalafon.png': return require('../../assets/Medallas/Top5RankingEscalafon.png');
    case 'Top5RankingHonor.png': return require('../../assets/Medallas/Top5RankingHonor.png');
    case 'Top5RankingInicial.png': return require('../../assets/Medallas/Top5RankingInicial.png');
    case 'Top5RankingPrimera.png': return require('../../assets/Medallas/Top5RankingPrimera.png');
    case 'Top5RankingQuinta.png': return require('../../assets/Medallas/Top5RankingQuinta.png');
    case 'Top5RankingSegunda.png': return require('../../assets/Medallas/Top5RankingSegunda.png');
    case 'Top5RankingTercera.png': return require('../../assets/Medallas/Top5RankingTercera.png');
    case 'NadaEsImposible.png': return require('../../assets/Medallas/NadaEsImposible.png');
    case 'Bombardero.png': return require('../../assets/Medallas/Bombardero.png');
    case 'NoEstoyNiAhi.png': return require('../../assets/Medallas/NoEstoyNiAhi.png');
    case 'CeHacheI.png': return require('../../assets/Medallas/CeHacheI.png');
    case 'PrimerTorneoJugado.png': return require('../../assets/Medallas/PrimerTorneoJugado.png');
    default: return undefined;
  }
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
  const cacheKey = `profileStats:${playerId}:${context.org_id}:${context.level}:${modality}:${selectedYear || 'all'}`;

  return resolveCachedData({
    key: cacheKey,
    ttlMs: 300_000, // 5 minutes standard
    fetchFn: async () => {
      const { data, error } = await supabase.rpc('get_player_profile_stats', {
        p_player_id: playerId,
        p_org_id: context.org_id,
        p_level: context.level,
        p_modality: modality,
        p_selected_year: selectedYear,
      });

      if (error) {
        console.error('Error fetching player profile stats from RPC:', error);
        throw error;
      }

      if (!data) {
        return {
          stats: DEFAULT_PROFILE_STATS,
          rankingHistory: createEmptyRankingHistory(),
          availableYears: [],
          effectiveYear: null,
        };
      }

      const rawRankingHistory = (data.rankingHistory || []) as any[];
      const rankingHistory = rawRankingHistory.map((point: any) => ({
        month: Number(point.month),
        singlesRank: point.singlesRank !== null ? Number(point.singlesRank) : null,
        doblesRank: point.doblesRank !== null ? Number(point.doblesRank) : null,
      }));

      const statsObj = data.stats || {};
      const stats: PlayerProfileStats = {
        rank: String(statsObj.rank || '-'),
        trophies: Number(statsObj.trophies || 0),
        wins: Number(statsObj.wins || 0),
        winRate: String(statsObj.winRate || '0%'),
        totalMatches: Number(statsObj.totalMatches || 0),
        setsWon: Number(statsObj.setsWon || 0),
        setsLost: Number(statsObj.setsLost || 0),
        gamesWon: Number(statsObj.gamesWon || 0),
        gamesLost: Number(statsObj.gamesLost || 0),
        finalsPlayed: Number(statsObj.finalsPlayed || 0),
        currentStreak: Number(statsObj.currentStreak || 0),
        bestStreak: Number(statsObj.bestStreak || 0),
        debutYear: String(statsObj.debutYear || '-'),
        bestRanking: String(statsObj.bestRanking || '-'),
        worstRanking: String(statsObj.worstRanking || '-'),
        mostFacedRivalName: String(statsObj.mostFacedRivalName || '-'),
        mostFacedRivalMatches: Number(statsObj.mostFacedRivalMatches || 0),
        mostFacedRivalId: statsObj.mostFacedRivalId ? String(statsObj.mostFacedRivalId) : null,
      };

      const availableYears = (data.availableYears || []) as number[];
      const effectiveYear = data.effectiveYear !== null ? Number(data.effectiveYear) : null;

      return {
        stats,
        rankingHistory,
        availableYears,
        effectiveYear,
      };
    },
  });
};

export const loadPlayerAchievements = async (playerId: string): Promise<PlayerAchievement[]> => {
  const cacheKey = `playerAchievements:${playerId}`;
  return resolveCachedData({
    key: cacheKey,
    ttlMs: 300_000, // 5 minutes standard
    fetchFn: async () => {
      const { data, error } = await supabase.rpc('get_player_achievements', {
        p_player_id: playerId,
      });

      if (error) {
        console.error('Error fetching player achievements from RPC:', error);
        throw error;
      }

      const rawAchievements = (data || []) as any[];

      return rawAchievements.map((ach: any) => ({
        id: String(ach.id),
        title: String(ach.title),
        detail: String(ach.detail),
        icon: String(ach.icon),
        tone: ach.tone as any,
        imageSource: getMedalSource(ach.imageName),
        dateEarned: ach.dateEarned ? String(ach.dateEarned) : undefined,
        tournamentName: ach.tournamentName ? String(ach.tournamentName) : undefined,
        matchDetail: ach.matchDetail ? String(ach.matchDetail) : undefined,
      }));
    },
  });
};
