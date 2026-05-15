import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';
import { getTournamentPlacements } from '@/services/ranking';
import { TennisSpinner } from '@/components/TennisSpinner';

const BACKHAND_FIELD = 'rev\u00E9s';

interface PlayerProfileModalProps {
  visible: boolean;
  playerId: string | null;
  tournamentOrgId?: string | null;
  tournamentLevel?: string | null;
  onClose: () => void;
}

interface PlayerProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  location: string | null;
  backhand: string | null;
  dominantHand: string | null;
}

interface PlayerStats {
  rank: string;
  trophies: number;
  wins: number;
  winRate: string;
  totalMatches: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
}

const DEFAULT_STATS: PlayerStats = {
  rank: '-',
  trophies: 0,
  wins: 0,
  winRate: '0%',
  totalMatches: 0,
  setsWon: 0,
  setsLost: 0,
  gamesWon: 0,
  gamesLost: 0,
};

const getScoreText = (scoreValue: any): string => {
  if (!scoreValue) return '';
  if (typeof scoreValue === 'string') return scoreValue.trim();
  if (typeof scoreValue === 'object') {
    if (scoreValue?.wo) return 'W.O.';
    if (typeof scoreValue?.text === 'string') return scoreValue.text.trim();
    if (typeof scoreValue?.score === 'string') return scoreValue.score.trim();
    if (Array.isArray(scoreValue?.sets)) {
      return scoreValue.sets
        .map((s: any) => String(s || '').trim())
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }
  const fallback = String(scoreValue || '').trim();
  return fallback === '[object Object]' ? '' : fallback;
};

export const PlayerProfileModal = ({
  visible,
  playerId,
  tournamentOrgId,
  tournamentLevel,
  onClose,
}: PlayerProfileModalProps) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);

  useEffect(() => {
    if (visible && playerId) {
      loadPlayerData(playerId);
    } else {
      setProfile(null);
      setAvatarUrl(null);
      setStats(DEFAULT_STATS);
    }
  }, [visible, playerId]);

  const loadPlayerData = async (pid: string) => {
    setLoading(true);
    try {
      // Load profile info (using public_profiles view to bypass RLS restrictions)
      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select(`id, name, avatar_url, location, "${BACKHAND_FIELD}", mano_dominante`)
        .eq('id', pid)
        .maybeSingle();

      if (profileError) throw profileError;

      const playerProfile: PlayerProfile = {
        id: profileData?.id || pid,
        name: profileData?.name || 'Jugador',
        avatar_url: profileData?.avatar_url || null,
        location: profileData?.location || null,
        backhand: profileData?.[BACKHAND_FIELD] || null,
        dominantHand: profileData?.mano_dominante || null,
      };
      setProfile(playerProfile);

      // Resolve avatar
      if (profileData?.avatar_url) {
        const signed = await resolveStorageAssetUrlWithRetry(profileData.avatar_url, { attempts: 3, baseDelayMs: 300 });
        setAvatarUrl(signed || null);
      } else {
        setAvatarUrl(null);
      }

      // Calculate stats if we have org + level context
      await calculatePlayerStats(pid, playerProfile);
    } catch (error) {
      console.error('Error loading player profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlayerStats = async (pid: string, playerProfile: PlayerProfile) => {
    try {
      // Get all tournaments for this player from matches (bypasses RLS on registrations)
      const { data: playerMatchRows, error: pmError } = await supabase
        .from('matches')
        .select('tournament_id')
        .or(`player_a_id.eq.${pid},player_b_id.eq.${pid},player_a2_id.eq.${pid},player_b2_id.eq.${pid}`);

      if (pmError) throw pmError;
      const tournamentIds = [...new Set((playerMatchRows || []).map((r: any) => r.tournament_id).filter(Boolean))] as string[];
      if (tournamentIds.length === 0) {
        setStats(DEFAULT_STATS);
        return;
      }

      // Get tournament data, filtering by org and level if available
      let query = supabase
        .from('tournaments')
        .select('id, name, organization_id, level, status, format, modality, description, max_players, start_date, end_date, set_type')
        .in('id', tournamentIds)
        .eq('status', 'finished');

      if (tournamentOrgId) query = query.eq('organization_id', tournamentOrgId);
      if (tournamentLevel) query = query.eq('level', tournamentLevel);

      const { data: completedTournaments, error: tourError } = await query;
      if (tourError) throw tourError;
      if (!completedTournaments || completedTournaments.length === 0) {
        setStats(DEFAULT_STATS);
        return;
      }

      const completedTournamentIds = completedTournaments.map((t: any) => t.id);

      // Load matches for completed tournaments
      const { data: allMatchesRows, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .in('tournament_id', completedTournamentIds);

      if (matchError) throw matchError;

      // Load registrations for ranking
      const { data: completedRegistrationsRows, error: regErr2 } = await supabase
        .from('registrations')
        .select('player_id, status')
        .in('tournament_id', completedTournamentIds);

      if (regErr2) throw regErr2;

      let wins = 0;
      let totalMatches = 0;
      let setsWon = 0;
      let setsLost = 0;
      let gamesWon = 0;
      let gamesLost = 0;
      let trophies = 0;
      const allPlayersPoints: Record<string, number> = {};
      const rankingPlayerIds = new Set<string>();

      // Calculate match stats for this player
      (allMatchesRows || []).forEach((match: any) => {
        const isPlayerA = match.player_a_id === pid || match.player_a2_id === pid;
        const isPlayerB = match.player_b_id === pid || match.player_b2_id === pid;
        if (!isPlayerA && !isPlayerB) return;
        if (match.status !== 'finished') return;

        totalMatches += 1;
        const winnerId = match.winner_id;
        const winner2Id = match.winner_2_id;
        const isWinner = winnerId === pid || winner2Id === pid;
        if (isWinner) wins += 1;

        const scoreText = getScoreText(match.score);
        if (scoreText && !/^W\.?O\.?$/i.test(scoreText)) {
          scoreText.split(/\s*,\s*/).forEach((setScore: string) => {
            const [aRaw, bRaw] = setScore.split('-');
            const a = Number((aRaw || '').match(/\d+/)?.[0]);
            const b = Number((bRaw || '').match(/\d+/)?.[0]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) return;

            const myGames = isPlayerA ? a : b;
            const oppGames = isPlayerA ? b : a;
            gamesWon += myGames;
            gamesLost += oppGames;
            if (myGames > oppGames) setsWon += 1;
            else if (oppGames > myGames) setsLost += 1;
          });
        }
      });

      const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

      // Calculate ranking position
      const matchesByTour = (allMatchesRows || []).reduce((acc: any, m: any) => {
        acc[m.tournament_id] = [...(acc[m.tournament_id] || []), m];
        return acc;
      }, {});

      completedTournaments.forEach((t: any) => {
        const placements = getTournamentPlacements(t, matchesByTour[t.id] || []);
        placements.forEach((p: any) => {
          if ((p.playerId === pid || p.playerId2 === pid) && String(p.place) === '1') trophies += 1;
          if (p.playerId) {
            allPlayersPoints[p.playerId] = (allPlayersPoints[p.playerId] || 0) + (Number(p.points) || 0);
            rankingPlayerIds.add(p.playerId);
          }
          if (p.playerId2) {
            allPlayersPoints[p.playerId2] = (allPlayersPoints[p.playerId2] || 0) + (Number(p.points) || 0);
            rankingPlayerIds.add(p.playerId2);
          }
        });
      });

      (completedRegistrationsRows || []).forEach((registration: any) => {
        const regPlayerId = String(registration?.player_id || '').trim();
        const regStatus = String(registration?.status || '').toLowerCase();
        if (!regPlayerId || regStatus === 'cancelled' || regStatus === 'rejected') return;
        rankingPlayerIds.add(regPlayerId);
        if (!Object.prototype.hasOwnProperty.call(allPlayersPoints, regPlayerId)) {
          allPlayersPoints[regPlayerId] = 0;
        }
      });

      if (Object.keys(allPlayersPoints).length > 0 && !Object.prototype.hasOwnProperty.call(allPlayersPoints, pid)) {
        allPlayersPoints[pid] = 0;
        rankingPlayerIds.add(pid);
      }

      const userScore = allPlayersPoints[pid] || 0;
      const playersAhead = Object.values(allPlayersPoints).filter(score => score > userScore).length;
      const hasCompetitiveData = totalMatches > 0 || userScore > 0;
      const rank = Object.prototype.hasOwnProperty.call(allPlayersPoints, pid) && hasCompetitiveData
        ? `#${playersAhead + 1}`
        : '-';

      setStats({
        rank,
        trophies,
        wins,
        winRate: `${winRate}%`,
        totalMatches,
        setsWon,
        setsLost,
        gamesWon,
        gamesLost,
      });
    } catch (error) {
      console.error('Error calculating player stats:', error);
      setStats(DEFAULT_STATS);
    }
  };

  const getInitials = (name: string) => {
    const chunks = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (chunks.length === 0) return 'PP';
    if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingContainer}>
              <TennisSpinner size={40} />
              <Text style={styles.loadingText}>Cargando perfil...</Text>
            </View>
          ) : profile ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Avatar + Name */}
              <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitials}>{getInitials(profile.name)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.playerName}>{profile.name}</Text>

                {/* Meta info */}
                <View style={styles.metaRow}>
                  {profile.location ? (
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{profile.location}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Play style info */}
                <View style={styles.playStyleRow}>
                  {profile.dominantHand ? (
                    <View style={styles.playStyleChip}>
                      <Ionicons name="hand-left-outline" size={14} color={colors.primary[500]} />
                      <Text style={styles.playStyleText}>{profile.dominantHand}</Text>
                    </View>
                  ) : null}
                  {profile.backhand ? (
                    <View style={styles.playStyleChip}>
                      <Ionicons name="tennisball-outline" size={14} color={colors.primary[500]} />
                      <Text style={styles.playStyleText}>Revés {profile.backhand}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Estadísticas</Text>

                <View style={styles.statsGrid}>
                  {/* Ranking */}
                  <View style={styles.rankCard}>
                    <Text style={styles.rankLabel}>RANKING</Text>
                    <Text style={styles.rankValue}>{stats.rank}</Text>
                  </View>

                  {/* Mini stats row */}
                  <View style={styles.miniStatsRow}>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="trophy" size={20} color={colors.primary[500]} />
                      <Text style={styles.miniStatValue}>{stats.trophies}</Text>
                      <Text style={styles.miniStatLabel}>TROFEOS</Text>
                    </View>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="medal" size={20} color={colors.textSecondary} />
                      <Text style={styles.miniStatValue}>{stats.wins}</Text>
                      <Text style={styles.miniStatLabel}>VICTORIAS</Text>
                    </View>
                  </View>

                  <View style={styles.miniStatsRow}>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="analytics" size={20} color={colors.textSecondary} />
                      <Text style={styles.miniStatValue}>{stats.winRate}</Text>
                      <Text style={styles.miniStatLabel}>WIN RATE</Text>
                    </View>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="tennisball" size={20} color={colors.textSecondary} />
                      <Text style={styles.miniStatValue}>{stats.totalMatches}</Text>
                      <Text style={styles.miniStatLabel}>PARTIDOS</Text>
                    </View>
                  </View>

                  {/* Sets */}
                  <View style={styles.setsCard}>
                    <View style={styles.setStatItem}>
                      <Text style={[styles.setStatValue, { color: colors.success }]}>{stats.setsWon}</Text>
                      <Text style={styles.setStatLabel}>SETS GANADOS</Text>
                    </View>
                    <View style={styles.setDivider} />
                    <View style={styles.setStatItem}>
                      <Text style={[styles.setStatValue, { color: colors.error }]}>{stats.setsLost}</Text>
                      <Text style={styles.setStatLabel}>SETS PERDIDOS</Text>
                    </View>
                  </View>

                  {/* Games */}
                  <View style={styles.setsCard}>
                    <View style={styles.setStatItem}>
                      <Text style={[styles.setStatValue, { color: colors.success }]}>{stats.gamesWon}</Text>
                      <Text style={styles.setStatLabel}>GAMES GANADOS</Text>
                    </View>
                    <View style={styles.setDivider} />
                    <View style={styles.setStatItem}>
                      <Text style={[styles.setStatValue, { color: colors.error }]}>{stats.gamesLost}</Text>
                      <Text style={styles.setStatLabel}>GAMES PERDIDOS</Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="person-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.loadingText}>No se pudo cargar el perfil</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    gap: spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    backgroundColor: colors.primary[500] + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.primary[500],
    fontSize: 28,
    fontWeight: '900',
  },
  playerName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  playStyleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  playStyleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[500] + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.lg,
  },
  playStyleText: {
    color: colors.primary[500],
    fontSize: 12,
    fontWeight: '700',
  },
  statsSection: {
    gap: spacing.md,
  },
  statsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  statsGrid: {
    gap: spacing.sm,
  },
  rankCard: {
    backgroundColor: colors.primary[500] + '10',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[500] + '30',
  },
  rankLabel: {
    color: colors.primary[500],
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rankValue: {
    color: colors.primary[500],
    fontSize: 36,
    fontWeight: '900',
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  miniStatCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  miniStatValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  miniStatLabel: {
    color: colors.textTertiary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  setStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  setStatValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  setStatLabel: {
    color: colors.textTertiary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
});
