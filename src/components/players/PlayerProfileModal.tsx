import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, Alert, ImageBackground } from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';
import { TennisSpinner } from '@/components/TennisSpinner';
import { DEFAULT_PROFILE_STATS, loadProfileStatsBundle, PlayerProfileStats, ProfileModality } from '@/services/playerProfileStats';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

const BACKHAND_FIELD = 'rev\u00E9s';

interface PlayerProfileModalProps {
  visible: boolean;
  playerId: string | null;
  tournamentOrgId?: string | null;
  tournamentLevel?: string | null;
  tournamentModality?: ProfileModality;
  initialPage?: 'profile' | 'headToHead';
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

interface HeadToHeadStats {
  totalMatches: number;
  currentUserWins: number;
  rivalWins: number;
  lastMatchLabel: string;
  lastMatchScore: string;
  lastMatchWinnerLabel: string;
}

const DEFAULT_STATS: PlayerProfileStats = DEFAULT_PROFILE_STATS;

const DEFAULT_HEAD_TO_HEAD: HeadToHeadStats = {
  totalMatches: 0,
  currentUserWins: 0,
  rivalWins: 0,
  lastMatchLabel: 'Sin partidos',
  lastMatchScore: '-',
  lastMatchWinnerLabel: 'Sin ganador',
};

const HEAD_TO_HEAD_SHARE_BG = require('../../../assets/RRSS/FrenteAFrente.png');
const APP_SHARE_LOGO = require('../../../assets/Logos/LogoAplicación.png');

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

const getMatchTime = (match: any) => {
  const value = match?.scheduled_at || match?.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export const PlayerProfileModal = ({
  visible,
  playerId,
  tournamentOrgId,
  tournamentLevel,
  tournamentModality = 'singles',
  initialPage = 'profile',
  onClose,
}: PlayerProfileModalProps) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerProfileStats>(DEFAULT_STATS);
  const [currentUserStats, setCurrentUserStats] = useState<PlayerProfileStats>(DEFAULT_STATS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Tú');
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'profile' | 'headToHead'>('profile');
  const [headToHead, setHeadToHead] = useState<HeadToHeadStats>(DEFAULT_HEAD_TO_HEAD);
  const [sharingHeadToHead, setSharingHeadToHead] = useState(false);
  const shareCardRef = useRef<any>(null);

  useEffect(() => {
    if (visible && playerId) {
      setActivePage(initialPage);
      loadPlayerData(playerId);
    } else {
      setProfile(null);
      setAvatarUrl(null);
      setStats(DEFAULT_STATS);
      setCurrentUserStats(DEFAULT_STATS);
      setCurrentUserId(null);
      setCurrentUserName('Tú');
      setCurrentUserAvatarUrl(null);
      setHeadToHead(DEFAULT_HEAD_TO_HEAD);
    }
  }, [visible, playerId, initialPage]);

  const getSessionDisplayName = (session: any) => {
    const metadata = (session?.user?.user_metadata || {}) as Record<string, unknown>;
    const firstLast = [metadata.first_name, metadata.last_name]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    return [
      metadata.name,
      metadata.full_name,
      metadata.display_name,
      firstLast,
      session?.user?.email ? String(session.user.email).split('@')[0] : '',
      'Tú',
    ]
      .map((value) => String(value || '').trim())
      .find(Boolean) || 'Tú';
  };

  const loadCurrentUserProfile = async (viewerId: string, session: any) => {
    setCurrentUserName(getSessionDisplayName(session));
    setCurrentUserAvatarUrl(null);

    try {
      const { data: viewerProfile, error } = await supabase
        .from('public_profiles')
        .select('id, name, avatar_url')
        .eq('id', viewerId)
        .maybeSingle();

      if (error) throw error;

      const resolvedName = String(viewerProfile?.name || '').trim() || getSessionDisplayName(session);
      setCurrentUserName(resolvedName);

      if (viewerProfile?.avatar_url) {
        const signed = await resolveStorageAssetUrlWithRetry(viewerProfile.avatar_url, { attempts: 3, baseDelayMs: 300 });
        setCurrentUserAvatarUrl(signed || null);
      }
    } catch (error) {
      console.error('Error loading current user profile:', error);
    }
  };

  const handleShareHeadToHead = async () => {
    if (!profile || !currentUserId || currentUserId === profile.id || sharingHeadToHead) return;

    setSharingHeadToHead(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert('No disponible', 'Tu dispositivo no permite compartir imágenes desde esta vista.');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 80));
      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error('No se pudo generar la imagen');

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir frente a frente',
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Error sharing head to head image:', error);
      Alert.alert('Error', 'No se pudo generar la imagen del enfrentamiento.');
    } finally {
      setSharingHeadToHead(false);
    }
  };

  const loadPlayerData = async (pid: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const viewerId = session?.user?.id || null;
      setCurrentUserId(viewerId);
      let resolvedViewerName = 'Tú';
      if (viewerId) {
        resolvedViewerName = await loadCurrentUserProfile(viewerId, session);
        await calculateCurrentUserStats(viewerId);
      }

      // Load profile info (using public_profiles view to bypass RLS restrictions)
      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select(`id, name, avatar_url, location, "${BACKHAND_FIELD}", mano_dominante`)
        .eq('id', pid)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        Alert.alert('Información', 'Este jugador no tiene registro en la aplicación');
        onClose();
        return;
      }

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
      if (viewerId && viewerId !== pid) {
        await calculateHeadToHead(viewerId, pid, playerProfile, resolvedViewerName);
      } else {
        setHeadToHead(DEFAULT_HEAD_TO_HEAD);
      }
    } catch (error) {
      console.error('Error loading player profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHeadToHead = async (viewerId: string, rivalId: string, rivalProfile: PlayerProfile, viewerName?: string) => {
    try {
      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, score, status, scheduled_at, created_at')
        .or(`player_a_id.eq.${viewerId},player_a2_id.eq.${viewerId},player_b_id.eq.${viewerId},player_b2_id.eq.${viewerId}`)
        .eq('status', 'finished');

      if (matchError) throw matchError;

      const oppositeSideMatches = (matchRows || []).filter((match: any) => {
        const viewerOnA = match.player_a_id === viewerId || match.player_a2_id === viewerId;
        const viewerOnB = match.player_b_id === viewerId || match.player_b2_id === viewerId;
        const rivalOnA = match.player_a_id === rivalId || match.player_a2_id === rivalId;
        const rivalOnB = match.player_b_id === rivalId || match.player_b2_id === rivalId;
        return (viewerOnA && rivalOnB) || (viewerOnB && rivalOnA);
      });

      if (oppositeSideMatches.length === 0) {
        setHeadToHead(DEFAULT_HEAD_TO_HEAD);
        return;
      }

      const tournamentIds = [...new Set(oppositeSideMatches.map((match: any) => match.tournament_id).filter(Boolean))] as string[];
      let validTournamentIds = new Set(tournamentIds);
      if ((tournamentOrgId || tournamentLevel) && tournamentIds.length > 0) {
        let query = supabase
          .from('tournaments')
          .select('id')
          .in('id', tournamentIds);

        if (tournamentOrgId) query = query.eq('organization_id', tournamentOrgId);
        if (tournamentLevel) query = query.eq('level', tournamentLevel);

        const { data: tournamentRows, error: tournamentError } = await query;
        if (tournamentError) throw tournamentError;
        validTournamentIds = new Set((tournamentRows || []).map((tournament: any) => tournament.id));
      }

      const filteredMatches = oppositeSideMatches
        .filter((match: any) => validTournamentIds.has(match.tournament_id))
        .sort((a: any, b: any) => getMatchTime(b) - getMatchTime(a));

      let currentUserWins = 0;
      let rivalWins = 0;
      filteredMatches.forEach((match: any) => {
        const winnerIds = [match.winner_id, match.winner_2_id].filter(Boolean);
        if (winnerIds.includes(viewerId)) currentUserWins += 1;
        if (winnerIds.includes(rivalId)) rivalWins += 1;
      });

      const lastMatch = filteredMatches[0];
      const lastScore = getScoreText(lastMatch?.score);
      const currentUserNameToUse = viewerName || currentUserName || 'Tú';
      const winnerName = [lastMatch?.winner_id, lastMatch?.winner_2_id].includes(viewerId)
        ? (currentUserNameToUse === 'Tú' ? 'Tú' : currentUserNameToUse)
        : [lastMatch?.winner_id, lastMatch?.winner_2_id].includes(rivalId)
          ? rivalProfile.name
          : 'Sin ganador';

      let lastMatchLabel = 'Sin partidos';
      if (lastMatch) {
        const isViewer = [lastMatch.winner_id, lastMatch.winner_2_id].includes(viewerId);
        const isRival = [lastMatch.winner_id, lastMatch.winner_2_id].includes(rivalId);
        let winnerText = 'Sin ganador';
        if (isViewer) {
          winnerText = currentUserNameToUse === 'Tú' ? 'Tú ganaste' : `${currentUserNameToUse} gan\u00f3`;
        } else if (isRival) {
          winnerText = `${rivalProfile.name} gan\u00f3`;
        }
        lastMatchLabel = `${winnerText}${lastScore ? ` · ${lastScore}` : ''}`;
      }

      setHeadToHead({
        totalMatches: filteredMatches.length,
        currentUserWins,
        rivalWins,
        lastMatchLabel,
        lastMatchScore: lastScore || '-',
        lastMatchWinnerLabel: winnerName,
      });
    } catch (error) {
      console.error('Error calculating head to head stats:', error);
      setHeadToHead(DEFAULT_HEAD_TO_HEAD);
    }
  };

  const calculatePlayerStats = async (pid: string, playerProfile: PlayerProfile) => {
    try {
      if (!tournamentOrgId || !tournamentLevel) {
        setStats(DEFAULT_STATS);
        return;
      }
      const bundle = await loadProfileStatsBundle({
        playerId: pid,
        context: {
          org_id: tournamentOrgId,
          level: tournamentLevel,
        },
        modality: tournamentModality,
        selectedYear: null,
      });

      setStats(bundle.stats || DEFAULT_STATS);
    } catch (error) {
      console.error('Error calculating player stats:', error);
      setStats(DEFAULT_STATS);
    }
  };

  const calculateCurrentUserStats = async (viewerId: string) => {
    try {
      if (!tournamentOrgId || !tournamentLevel) {
        setCurrentUserStats(DEFAULT_STATS);
        return;
      }

      const bundle = await loadProfileStatsBundle({
        playerId: viewerId,
        context: {
          org_id: tournamentOrgId,
          level: tournamentLevel,
        },
        modality: tournamentModality,
        selectedYear: null,
      });

      setCurrentUserStats(bundle.stats || DEFAULT_STATS);
    } catch (error) {
      console.error('Error calculating current user stats:', error);
      setCurrentUserStats(DEFAULT_STATS);
    }
  };

  const getInitials = (name: string) => {
    const chunks = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (chunks.length === 0) return 'PP';
    if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
  };

  const rivalShareName = profile?.name || 'Rival';
  const rivalShareRank = String(stats.rank || '-').startsWith('#') ? String(stats.rank || '-') : `#${stats.rank || '-'}`;
  const currentShareRank = String(currentUserStats.rank || '-').startsWith('#') ? String(currentUserStats.rank || '-') : `#${currentUserStats.rank || '-'}`;
  const currentShareName = currentUserName || 'Tú';
  const rivalWinsLabel = `${rivalShareName.toUpperCase()} GANÓ`;
  const currentWinsLabel = `${currentShareName.toUpperCase()} GANÓ`;
  const lastWinnerLabel = headToHead.lastMatchWinnerLabel === 'Sin ganador'
    ? 'SIN GANADOR'
    : headToHead.lastMatchWinnerLabel === 'Tú'
    ? currentWinsLabel
    : `${String(headToHead.lastMatchWinnerLabel || 'Sin ganador').toUpperCase()} GANÓ`;
  const profileMostFacedLabel = stats.mostFacedRivalMatches > 0
    ? `${stats.mostFacedRivalName} · ${stats.mostFacedRivalMatches} partidos`
    : (stats.mostFacedRivalName || '-');

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

              {currentUserId && currentUserId !== profile.id ? (
                <View style={styles.pageSelector}>
                  <TouchableOpacity
                    style={[styles.pageSelectorButton, activePage === 'profile' && styles.pageSelectorButtonActive]}
                    onPress={() => setActivePage('profile')}
                  >
                    <Text style={[styles.pageSelectorText, activePage === 'profile' && styles.pageSelectorTextActive]}>Perfil</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pageSelectorButton, activePage === 'headToHead' && styles.pageSelectorButtonActive]}
                    onPress={() => setActivePage('headToHead')}
                  >
                    <Text style={[styles.pageSelectorText, activePage === 'headToHead' && styles.pageSelectorTextActive]}>Enfrentamientos</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {activePage === 'headToHead' && currentUserId && currentUserId !== profile.id ? (
                <View style={styles.statsSection}>
                  <View style={styles.headToHeadHeaderRow}>
                    <Text style={styles.statsTitle}>Enfrentamientos</Text>
                    <TouchableOpacity
                      style={[styles.shareButton, sharingHeadToHead && styles.shareButtonDisabled]}
                      onPress={handleShareHeadToHead}
                      disabled={sharingHeadToHead}
                    >
                      <Ionicons name="share-social-outline" size={16} color="#fff" />
                      <Text style={styles.shareButtonText}>{sharingHeadToHead ? 'Generando...' : 'Compartir'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.headToHeadGrid}>
                    <View style={styles.headToHeadCard}>
                      <Ionicons name="tennisball" size={22} color={colors.primary[500]} />
                      <Text style={styles.headToHeadValue}>{headToHead.totalMatches}</Text>
                      <Text 
                        style={styles.headToHeadLabel}
                        adjustsFontSizeToFit
                        numberOfLines={2}
                        minimumScaleFactor={0.7}
                      >
                        PARTIDOS JUGADOS
                      </Text>
                    </View>
                    <View style={styles.headToHeadCard}>
                      <Ionicons name="person-circle-outline" size={22} color={colors.primary[500]} />
                      <Text style={styles.headToHeadValue}>{headToHead.currentUserWins}</Text>
                      <Text 
                        style={styles.headToHeadLabel}
                        adjustsFontSizeToFit
                        numberOfLines={2}
                        minimumScaleFactor={0.7}
                      >
                        TU GANASTE
                      </Text>
                    </View>
                    <View style={styles.headToHeadCard}>
                      <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} />
                      <Text style={styles.headToHeadValue}>{headToHead.rivalWins}</Text>
                      <Text 
                        style={styles.headToHeadLabel}
                        adjustsFontSizeToFit
                        numberOfLines={2}
                        minimumScaleFactor={0.7}
                      >
                        {`${profile.name} gan\u00f3`.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.lastMatchCard}>
                    <Text style={styles.lastMatchLabel}>ULTIMO PARTIDO</Text>
                    <Text style={styles.lastMatchValue}>{headToHead.lastMatchLabel}</Text>
                  </View>
                </View>
              ) : (
              <View style={styles.statsSection}>
                <View style={styles.headToHeadHeaderRow}>
                  <Text style={styles.statsTitle}>Estadísticas</Text>
                </View>

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
                      <Ionicons name="medal" size={20} color="#10b981" />
                      <Text style={stats.wins > 0 ? [styles.miniStatValue, { color: colors.text }] : styles.miniStatValue}>{stats.wins}</Text>
                      <Text style={styles.miniStatLabel}>VICTORIAS</Text>
                    </View>
                  </View>

                  <View style={styles.miniStatsRow}>
                    <View style={styles.miniStatCard}>
                      <FontAwesome5 name="fist-raised" size={18} color="#10b981" />
                      <Text style={styles.miniStatValue}>{stats.winRate}</Text>
                      <Text style={styles.miniStatLabel}>WIN RATE</Text>
                    </View>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="tennisball" size={20} color="#10b981" />
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

                  <View style={styles.miniStatsRow}>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="calendar" size={20} color="#3b82f6" />
                      <Text style={styles.miniStatValue}>{stats.debutYear}</Text>
                      <Text style={styles.miniStatLabel}>AÑO DEBUT</Text>
                    </View>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="flag" size={20} color="#10b981" />
                      <Text style={styles.miniStatValue}>{stats.finalsPlayed}</Text>
                      <Text style={styles.miniStatLabel}>FINALES JUGADAS</Text>
                    </View>
                  </View>

                  <View style={styles.miniStatsRow}>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="flame" size={20} color="#f97316" />
                      <Text style={styles.miniStatValue}>{stats.currentStreak}</Text>
                      <Text style={styles.miniStatLabel}>RACHA ACTUAL</Text>
                    </View>
                    <View style={styles.miniStatCard}>
                      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="flame" size={16} color="#f97316" />
                        <Ionicons name="flame" size={16} color="#f97316" />
                        <Ionicons name="flame" size={16} color="#f97316" />
                      </View>
                      <Text style={styles.miniStatValue}>{stats.bestStreak}</Text>
                      <Text style={styles.miniStatLabel}>MEJOR RACHA</Text>
                    </View>
                  </View>

                  <View style={styles.miniStatsRow}>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="trending-up" size={20} color="#10b981" />
                      <Text style={styles.miniStatValue}>{stats.bestRanking}</Text>
                      <Text style={styles.miniStatLabel}>MEJOR RANKING</Text>
                    </View>
                    <View style={styles.miniStatCard}>
                      <Ionicons name="trending-down" size={20} color={colors.error} />
                      <Text style={styles.miniStatValue}>{stats.worstRanking}</Text>
                      <Text style={styles.miniStatLabel}>PEOR RANKING</Text>
                    </View>
                  </View>

                  <View style={styles.lastMatchCard}>
                    <Text style={styles.lastMatchLabel}>RIVAL MÁS ENFRENTADO</Text>
                    <Text style={styles.lastMatchValue}>{profileMostFacedLabel}</Text>
                  </View>
                </View>
              </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="person-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.loadingText}>No se pudo cargar el perfil</Text>
            </View>
          )}

          {profile && currentUserId && currentUserId !== profile.id ? (
            <View style={styles.hiddenShareCanvas} pointerEvents="none">
              <ViewShot
                ref={shareCardRef}
                style={styles.shareShot}
                options={{
                  format: 'png',
                  quality: 1,
                  result: 'tmpfile',
                  width: 1080,
                  height: 1920,
                }}
              >
                <ImageBackground source={HEAD_TO_HEAD_SHARE_BG} resizeMode="cover" style={styles.sharePoster}>
                  <View style={styles.sharePosterOverlay} />
                  <View style={styles.sharePosterInner}>
                    <View style={styles.shareBrandBlock}>
                      <View style={styles.shareBrandLogoWrap}>
                        <Image source={APP_SHARE_LOGO} style={styles.shareBrandLogo} resizeMode="contain" />
                      </View>
                    </View>
                    <Text style={styles.sharePosterTitle}>FRENTE-A-FRENTE</Text>

                    <View style={styles.sharePlayersRow}>
                      <View style={styles.sharePlayerBlock}>
                        <View style={styles.shareAvatarRing}>
                          {avatarUrl ? (
                            <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={styles.shareAvatar} />
                          ) : (
                            <View style={[styles.shareAvatar, styles.shareAvatarFallback]}>
                              <Text style={styles.shareAvatarInitials}>{getInitials(rivalShareName)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.sharePlayerName}>{rivalShareName.toUpperCase()}</Text>
                        <Text style={styles.sharePlayerRank}>{rivalShareRank}</Text>
                      </View>

                      <View style={styles.shareVersusWrap}>
                        <View style={styles.shareVersusBadge}>
                          <Text style={styles.shareVersusText}>VS</Text>
                        </View>
                      </View>

                      <View style={styles.sharePlayerBlock}>
                        <View style={styles.shareAvatarRing}>
                          {currentUserAvatarUrl ? (
                            <Image source={{ uri: currentUserAvatarUrl, cache: 'force-cache' }} style={styles.shareAvatar} />
                          ) : (
                            <View style={[styles.shareAvatar, styles.shareAvatarFallback]}>
                              <Text style={styles.shareAvatarInitials}>{getInitials(currentShareName)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.sharePlayerName}>{currentShareName.toUpperCase()}</Text>
                        <Text style={styles.sharePlayerRank}>{currentShareRank}</Text>
                      </View>
                    </View>

                    <View style={styles.shareTotalsSection}>
                      <View style={styles.shareStatSeparator}>
                        <View style={styles.shareStatLine} />
                        <Text style={styles.shareStatHeading}>PARTIDOS TOTALES</Text>
                        <View style={styles.shareStatLine} />
                      </View>
                      <Text style={styles.shareTotalMatches}>{headToHead.totalMatches}</Text>
                    </View>

                    <View style={styles.sharePanel}>
                      <View style={styles.shareStatSeparator}>
                        <View style={styles.shareStatLineShort} />
                        <Text style={styles.shareStatHeading}>VICTORIAS</Text>
                        <View style={styles.shareStatLineShort} />
                      </View>

                      <View style={styles.shareWinsRow}>
                        <View style={styles.shareWinsBlock}>
                          <Text style={styles.shareWinsValue}>{headToHead.rivalWins}</Text>
                          <Text style={styles.shareWinsLabel}>{rivalWinsLabel}</Text>
                        </View>
                        <View style={styles.shareWinsDivider} />
                        <View style={styles.shareWinsBlock}>
                          <Text style={styles.shareWinsValue}>{headToHead.currentUserWins}</Text>
                          <Text style={styles.shareWinsLabel}>{currentWinsLabel}</Text>
                        </View>
                      </View>

                      <View style={styles.shareBottomDivider} />

                      <View style={styles.shareStatSeparator}>
                        <View style={styles.shareStatLineShort} />
                        <Text style={styles.shareStatHeading}>ÚLTIMO PARTIDO</Text>
                        <View style={styles.shareStatLineShort} />
                      </View>
                      <Text style={styles.shareLastScore}>{headToHead.lastMatchScore}</Text>
                      <Text style={styles.shareLastWinner}>{lastWinnerLabel}</Text>
                    </View>
                  </View>
                </ImageBackground>
              </ViewShot>
            </View>
          ) : null}

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
  pageSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  pageSelectorButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  pageSelectorButtonActive: {
    backgroundColor: colors.surface,
  },
  pageSelectorText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  pageSelectorTextActive: {
    color: colors.primary[500],
  },
  statsSection: {
    gap: spacing.md,
  },
  headToHeadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
  headToHeadGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headToHeadCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
    minHeight: 96,
  },
  headToHeadValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  headToHeadLabel: {
    color: colors.textTertiary,
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  lastMatchCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 4,
  },
  lastMatchLabel: {
    color: colors.textTertiary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  lastMatchValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  shareButtonDisabled: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  hiddenShareCanvas: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 1,
  },
  shareShot: {
    width: 1080,
    height: 1920,
  },
  sharePoster: {
    width: 1080,
    height: 1920,
    backgroundColor: '#09121a',
  },
  sharePosterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 15, 23, 0.82)',
  },
  sharePosterInner: {
    flex: 1,
    paddingHorizontal: 70,
    paddingTop: 54,
    paddingBottom: 48,
    alignItems: 'center',
  },
  shareBrandBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  shareBrandLogoWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBrandLogo: {
    width: 180,
    height: 180,
    opacity: 0.96,
  },
  sharePosterTitle: {
    width: '100%',
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 72,
    lineHeight: 88,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  sharePlayersRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 64,
  },
  shareTotalsSection: {
    width: '100%',
    marginTop: 52,
    alignItems: 'center',
  },
  sharePlayerBlock: {
    width: 320,
    alignItems: 'center',
  },
  shareAvatarRing: {
    width: 248,
    height: 248,
    borderRadius: 124,
    borderWidth: 10,
    borderColor: '#38c86b',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dce4ec',
    shadowColor: '#38c86b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  shareAvatar: {
    width: 228,
    height: 228,
    borderRadius: 114,
  },
  shareAvatarFallback: {
    backgroundColor: '#1a2630',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareAvatarInitials: {
    color: '#ffffff',
    fontSize: 72,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  sharePlayerName: {
    marginTop: 18,
    paddingHorizontal: 8,
    color: '#ffffff',
    fontSize: 46,
    lineHeight: 60,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  sharePlayerRank: {
    marginTop: 6,
    paddingHorizontal: 6,
    color: '#38c86b',
    fontSize: 34,
    lineHeight: 44,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  shareVersusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareVersusBadge: {
    width: 230,
    height: 170,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareVersusText: {
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 88,
    lineHeight: 112,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(34,197,94,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  shareStatSeparator: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  shareStatLine: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(56, 200, 107, 0.7)',
  },
  shareStatLineShort: {
    flex: 1,
    maxWidth: 220,
    height: 3,
    backgroundColor: 'rgba(56, 200, 107, 0.7)',
  },
  shareStatHeading: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
  },
  shareTotalMatches: {
    marginTop: 18,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 80,
    lineHeight: 108,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 10,
  },
  sharePanel: {
    width: '100%',
    marginTop: 36,
    paddingHorizontal: 32,
    paddingTop: 38,
    paddingBottom: 34,
    backgroundColor: 'rgba(7, 19, 28, 0.62)',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(56, 200, 107, 0.18)',
  },
  shareWinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
  },
  shareWinsBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  shareWinsDivider: {
    width: 2,
    height: 170,
    backgroundColor: 'rgba(56, 200, 107, 0.4)',
    marginHorizontal: 24,
  },
  shareWinsValue: {
    paddingHorizontal: 14,
    color: '#38c86b',
    fontSize: 72,
    lineHeight: 98,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  shareWinsLabel: {
    paddingHorizontal: 6,
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  shareBottomDivider: {
    width: '100%',
    height: 1,
    marginVertical: 30,
    backgroundColor: 'rgba(56, 200, 107, 0.25)',
  },
  shareLastScore: {
    marginTop: 22,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 82,
    lineHeight: 110,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 10,
  },
  shareLastWinner: {
    marginTop: 10,
    paddingHorizontal: 20,
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
