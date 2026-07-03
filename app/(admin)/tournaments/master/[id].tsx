import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Image, Linking, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from '@/utils/SecureStore';
import { borderRadius, spacing, useTheme } from '@/theme';
import { supabase } from '@/services/supabase';
import { TOURNAMENT_CATEGORIES, TOURNAMENT_SET_TYPES, getCategoriesByModality } from '@/constants/tournamentOptions';
import {
  buildTournamentDescription,
  buildTournamentFormatLabel,
  createInitialMatches,
  normalizeTournamentFormat,
} from '@/services/tournamentStructure';
import { buildDescriptionWithRankingPoints, DEFAULT_RANKING_POINTS } from '@/services/ranking';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { getModalityLabel, sortChampionships } from '@/services/championshipSorting';
import { TennisSpinner } from '@/components/TennisSpinner';
import { AdminQuickActionsBar } from '@/components/navigation/AdminQuickActionsBar';
import { formatDateDDMMYYYY } from '@/utils/datetime';
import {
  buildDescriptionWithChampion,
  extractChampionFromDescription,
  resolveChampionFromMatches,
  syncTournamentChampion
} from '@/services/tournamentChampion';
import * as ImagePicker from 'expo-image-picker';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';
import { ScheduleMatchModal } from '@/components/tournaments/ScheduleMatchModal';
import { notifyTournamentUsers } from '@/services/pushNotifications';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB for posters
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURT_OPTIONS = Array.from({ length: 20 }, (_current, index) => `Cancha ${index + 1}`);
const BASE64_CHAR_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const sanitizeBase64Payload = (value: string) => value.replace(/\s/g, '');

const decodeBase64ToUint8Array = (value: string) => {
  const sanitized = sanitizeBase64Payload(value);
  if (!sanitized) return new Uint8Array(0);

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of sanitized) {
    if (char === '=') break;
    const currentIndex = BASE64_CHAR_MAP.indexOf(char);
    if (currentIndex < 0) continue;

    buffer = (buffer << 6) | currentIndex;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
};

type MasterTournament = {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  registration_close_at: string | null;
  registration_close_time: string | null;
  address: string | null;
  comuna: string | null;
  surface: string | null;
  is_tournament_master: boolean;
  poster_url: string | null;
  ball_brand?: string | null;
  referee_phone?: string | null;
};


type Championship = {
  id: string;
  name: string;
  modality: string | null;
  level: string | null;
  format: string | null;
  registration_fee: number | null;
  max_players: number;
  set_type: string;
  status: string;
  description: string | null;
};

const FORMATS = ['Eliminación Directa', 'Round Robin', 'Eliminación Directa con Repechaje'];
const MODALITIES = ['singles', 'dobles'] as const;
type RankingPointRow = {
  id: string;
  place: string;
  label: string;
  points: string;
  isDefault: boolean;
};

const DEFAULT_RANKING_ROWS = (): RankingPointRow[] => [
  { id: 'rank-default-1', place: '1', label: 'Campeon', points: String(DEFAULT_RANKING_POINTS['1']), isDefault: true },
  { id: 'rank-default-2', place: '2', label: 'Finalista', points: String(DEFAULT_RANKING_POINTS['2']), isDefault: true },
  { id: 'rank-default-3', place: '3', label: 'Semifinalistas', points: String(DEFAULT_RANKING_POINTS['3']), isDefault: true },
  { id: 'rank-default-4', place: '4', label: 'Cuartos', points: String(DEFAULT_RANKING_POINTS['4']), isDefault: true },
];

const createRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getSpanishDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  
  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  
  return `${dayName} ${dayNum} DE ${monthName}`;
};

const extractFechaNumber = (value?: string | null) => {
  const match = String(value || '').match(/\bfecha\s*(\d+)\b/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const isDoublesChampionshipLegacyAware = (championship: { modality?: string | null; name?: string | null }) => {
  const modalityText = normalizeText(championship.modality);
  if (modalityText.includes('doble') || modalityText.includes('double')) return true;

  const nameText = normalizeText(championship.name);
  return nameText.includes('doble') || nameText.includes('double');
};

const getChampionshipModalityLabel = (championship: { modality?: string | null; name?: string | null }) =>
  isDoublesChampionshipLegacyAware(championship) ? 'Dobles' : 'Singles';

function ChampionName({ championship }: { championship: Championship }) {
  const { colors } = useTheme();
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const championFromTag = extractChampionFromDescription(championship.description);
  const shouldForceResolve = String(championship.modality || '').toLowerCase().includes('doble')
    || String(championship.format || '').toLowerCase().includes('repech');

  useEffect(() => {
    if ((!shouldForceResolve && championFromTag) || championship.status !== 'finished') return;

    let isMounted = true;
    const resolve = async () => {
      try {
        const [matchesRes, participantsRes] = await Promise.all([
          supabase.from('matches').select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status, scheduled_at, created_at').eq('tournament_id', championship.id),
          supabase.from('tournament_participants').select('player_id, profiles(name)').eq('tournament_id', championship.id)
        ]);

        if (!isMounted || !matchesRes.data) return;
        const championName = resolveChampionFromMatches(
          matchesRes.data,
          participantsRes.data || [],
          championship.description,
          championship.modality || championship.name
        );
        if (championName) setResolvedName(championName);
      } catch (error) {
        console.error('Error resolving championship champion:', error);
      }
    };

    resolve();
    return () => { isMounted = false; };
  }, [championship.id, championship.status, championship.description, championship.format, championship.modality, championFromTag, shouldForceResolve]);

  const displayName = resolvedName || championFromTag || 'Finalizado';
  return (
    <Text style={{ fontSize: 14, color: colors.text, fontWeight: '800' }}>
      {displayName}
    </Text>
  );
}

const formatRegistrationDeadline = (dateValue?: string | null, timeValue?: string | null) => {
  if (!dateValue) return 'Sin definir';
  const dateLabel = formatDateDDMMYYYY(dateValue);
  const timeLabel = String(timeValue || '').slice(0, 5) || '23:59';
  return `${dateLabel} ${timeLabel}`;
};

const toDbFormatLabel = (uiFormat: string) => {
  const normalized = normalizeTournamentFormat(uiFormat);
  if (normalized === 'round_robin') return 'Round Robin';
  if (normalized === 'single_elimination_repechage') return 'Eliminaci\u00F3n Directa con Repechaje';
  return 'Eliminaci\u00F3n Directa';
};

export default function MasterTournamentAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const masterTournamentId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [masterTournament, setMasterTournament] = useState<MasterTournament | null>(null);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const horizontalScrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  // For scheduling matches in the grid
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', court: '' });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [expandedPosterUrl, setExpandedPosterUrl] = useState<string | null>(null);

  const [modality, setModality] = useState<typeof MODALITIES[number]>('singles');
  const [category, setCategory] = useState(TOURNAMENT_CATEGORIES[0]);
  const [format, setFormat] = useState(FORMATS[0]);
  const [setType, setSetType] = useState(TOURNAMENT_SET_TYPES[0]);
  const [registrationFee, setRegistrationFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('16');
  const [groupCount, setGroupCount] = useState('2');
  const [rankingPointRows, setRankingPointRows] = useState<RankingPointRow[]>(() => DEFAULT_RANKING_ROWS());
  const modalScrollRef = useRef<ScrollView | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showSetTypeModal, setShowSetTypeModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!masterTournamentId) return;

    setLoading(true);
    try {
      const access = await getCurrentUserAccessContext();
      if (!access) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: masterData, error: masterError } = await supabase
        .from('tournaments')
        .select('id, organization_id, name, status, start_date, end_date, registration_close_at, registration_close_time, address, comuna, surface, is_tournament_master, poster_url, ball_brand, referee_phone')
        .eq('id', masterTournamentId)
        .single();

      if (masterError) throw masterError;
      const masterRow = masterData as MasterTournament;

      if (!canManageOrganization(access, masterRow.organization_id)) {
        router.replace('/(tabs)/tournaments');
        return;
      }

      if (!masterRow.is_tournament_master) {
        router.replace({
          pathname: '/(admin)/tournaments/[id]',
          params: { id: masterRow.id },
        });
        return;
      }

      setMasterTournament(masterRow);
      await SecureStore.setItemAsync('selected_org_id', String(masterRow.organization_id));

      const { data: championshipRows, error: championshipError } = await supabase
        .from('tournaments')
        .select('id, name, modality, level, format, registration_fee, max_players, set_type, status, description')
        .eq('parent_tournament_id', masterRow.id);

      if (championshipError) throw championshipError;
      const championships = sortChampionships((championshipRows || []) as Championship[]);
      setChampionships(championships);

      if (masterRow.poster_url) {
        const resolvedPosterUrl = await resolveStorageAssetUrlWithRetry(masterRow.poster_url);
        setPosterUrl(resolvedPosterUrl);
      } else {
        setPosterUrl(null);
      }

      // Pro-actively sync championships that are finished but missing the champion tag
      for (const champ of championships) {
        if (champ.status === 'finished' && !extractChampionFromDescription(champ.description)) {
          syncTournamentChampion(champ.id, supabase).then(newChampName => {
            if (newChampName) {
              setChampionships(current => 
                current.map(c => c.id === champ.id 
                  ? { ...c, description: extractChampionFromDescription(c.description)
                      ? c.description 
                      : buildDescriptionWithChampion(c.description, newChampName)
                  } 
                  : c
                )
              );
            }
          });
        }
      }

      // Consultar partidos de los campeonatos hijos
      const champIds = championships.map(c => c.id);
      let matchesList: any[] = [];
      let profilesMap: Record<string, string> = {};
      if (champIds.length > 0) {
        const { data: matchesRows, error: matchesError } = await supabase
          .from('matches')
          .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, score, status, scheduled_at, court, round')
          .in('tournament_id', champIds);

        if (matchesError) throw matchesError;
        matchesList = matchesRows || [];

        // Consultar perfiles de los jugadores en partidos
        const playerIds = new Set<string>();
        matchesList.forEach(m => {
          if (m.player_a_id) playerIds.add(m.player_a_id);
          if (m.player_a2_id) playerIds.add(m.player_a2_id);
          if (m.player_b_id) playerIds.add(m.player_b_id);
          if (m.player_b2_id) playerIds.add(m.player_b2_id);
        });

        const playerIdsArr = Array.from(playerIds);
        if (playerIdsArr.length > 0) {
          const { data: profilesRows, error: profilesError } = await supabase
            .from('public_profiles')
            .select('id, name')
            .in('id', playerIdsArr);

          if (profilesError) throw profilesError;
          (profilesRows || []).forEach(p => {
            profilesMap[p.id] = p.name;
          });
        }
      }
      setMatches(matchesList);
      setProfiles(profilesMap);
    } catch (error: any) {
      const detail = String(error?.message || '').trim();
      Alert.alert(
        'Error',
        detail
          ? `No se pudo cargar la configuracion del torneo completo. ${detail}`
          : 'No se pudo cargar la configuracion del torneo completo.'
      );
      setMasterTournament(null);
      setChampionships([]);
    } finally {
      setLoading(false);
    }
  }, [masterTournamentId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const parseManualAssignments = (description?: string | null) => {
    const match = (description || '').match(/\[MANUAL_ASSIGNMENTS:([^\]]+)\]/);
    if (!match?.[1]) return { rrSlots: {}, matchSlots: {} };
    try {
      return JSON.parse(decodeURIComponent(match[1]));
    } catch {
      return { rrSlots: {}, matchSlots: {} };
    }
  };

  const getMatchPlayerName = (match: any, slot: 1 | 2 | 3 | 4, championship: any, profilesMap: Record<string, string>) => {
    let playerId = null;
    if (slot === 1) playerId = match.player_a_id;
    else if (slot === 2) playerId = match.player_a2_id;
    else if (slot === 3) playerId = match.player_b_id;
    else playerId = match.player_b2_id;

    if (playerId && profilesMap[playerId]) {
      return profilesMap[playerId];
    }

    if (championship) {
      const manualAssignments = parseManualAssignments(championship.description);
      const numKey = String(slot);
      const fallbackKey = slot === 1 || slot === 2 ? 'player_a' : 'player_b';
      const assigned = manualAssignments.matchSlots?.[match.id]?.[numKey]?.name ||
                       manualAssignments.matchSlots?.[match.id]?.[fallbackKey]?.name;
      if (assigned) return assigned;
    }

    return 'Por definir';
  };

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    matches.forEach(m => {
      if (m.scheduled_at) {
        const datePart = m.scheduled_at.split('T')[0];
        dates.add(datePart);
      }
    });
    return Array.from(dates).sort();
  }, [matches]);

  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
      setSelectedDate(uniqueDates[0]);
    }
  }, [uniqueDates, selectedDate]);

  const uniqueHours = useMemo(() => {
    if (!selectedDate) return [];
    const hours = new Set<string>();
    matches.forEach(m => {
      if (m.scheduled_at && m.scheduled_at.startsWith(selectedDate)) {
        const timePart = m.scheduled_at.split('T')[1]?.slice(0, 5); // "HH:MM"
        if (timePart) hours.add(timePart);
      }
    });
    return Array.from(hours).sort();
  }, [matches, selectedDate]);

  const uniqueCourts = useMemo(() => {
    if (!selectedDate) return [];
    const courts = new Set<string>();
    matches.forEach(m => {
      if (m.scheduled_at && m.scheduled_at.startsWith(selectedDate) && m.court) {
        courts.add(m.court.trim());
      }
    });
    return Array.from(courts).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [matches, selectedDate]);

  const getNotifiablePlayerIdsFromMatch = (match: any) => {
    const candidateIds = [match?.player_a_id, match?.player_a2_id, match?.player_b_id, match?.player_b2_id]
      .map((value) => String(value || '').trim())
      .filter((value) => UUID_PATTERN.test(value));
    return [...new Set(candidateIds)];
  };

  const buildMatchPairingLabel = (match: any, championship: any) => {
    const isDoubles = championship ? isDoublesChampionshipLegacyAware(championship) : false;
    const teamA = isDoubles
      ? `${getMatchPlayerName(match, 1, championship, profiles)} / ${getMatchPlayerName(match, 2, championship, profiles)}`
      : getMatchPlayerName(match, 1, championship, profiles);
    const teamB = isDoubles
      ? `${getMatchPlayerName(match, 3, championship, profiles)} / ${getMatchPlayerName(match, 4, championship, profiles)}`
      : getMatchPlayerName(match, 3, championship, profiles);
    return `${teamA} vs ${teamB}`;
  };

  const notifyScheduledMatchUpdate = async (match: any, championship: any, nextScheduledAt: string | null, nextCourt: string) => {
    const tournamentId = masterTournamentId;
    if (!tournamentId || !UUID_PATTERN.test(String(tournamentId))) return;

    const recipientIds = getNotifiablePlayerIdsFromMatch(match);
    if (!recipientIds.length) return;

    const dateLabel = nextScheduledAt ? (formatDateDDMMYYYY(nextScheduledAt) || 'Sin fecha') : 'Sin fecha';
    const timeLabel = nextScheduledAt ? (new Date(nextScheduledAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) || '') : '';
    const courtLabel = nextCourt || 'Cancha por definir';
    const scheduleLabel = `${dateLabel}${timeLabel ? ` ${timeLabel}` : ''}`.trim();

    await notifyTournamentUsers({
      tournamentId: String(tournamentId),
      userIds: recipientIds,
      type: 'match_schedule_updated',
      title: 'Partido reprogramado',
      body: `Se actualizó el partido ${buildMatchPairingLabel(match, championship)}. Nueva programación: ${scheduleLabel} - ${courtLabel}.`,
      matchId: String(match?.id || '').trim() || null,
      data: {
        type: 'match_schedule_updated',
        tournamentId: String(tournamentId),
        matchId: String(match?.id || '').trim() || null,
      },
    });
  };

  const padTwo = (num: number) => String(num).padStart(2, '0');

  const handleSchedulePress = (match: any) => {
    setSelectedMatch(match);
    let initialDate = '';
    let initialTime = '';
    if (match.scheduled_at) {
      const d = new Date(match.scheduled_at);
      if (!Number.isNaN(d.getTime())) {
        initialDate = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
        initialTime = `${padTwo(d.getHours())}${padTwo(d.getMinutes())}`;
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

  const saveMatchSchedule = async (data: { date: string; time: string; court: string }) => {
    if (!selectedMatch) return;
    setSavingSchedule(true);

    try {
      const previousScheduledAt = selectedMatch.scheduled_at || null;
      const previousCourt = String(selectedMatch.court || '');
      const normalizedDate = String(data.date || '').trim();
      const normalizedTime = String(data.time || '').trim();
      const normalizedCourt = COURT_OPTIONS.includes(String(data.court || '').trim())
        ? String(data.court || '').trim()
        : '';
      let scheduledAt: string | null = null;

      if (!normalizedDate && normalizedTime) {
        Alert.alert('Error', 'Para guardar la hora primero debes seleccionar una fecha.');
        setSavingSchedule(false);
        return;
      }

      if (normalizedDate) {
        const cleanTime = normalizedTime.replace(/\D/g, '');
        if (cleanTime.length !== 4) {
          Alert.alert('Error', 'Ingresa una hora válida (ej: 18:30 o 1830).');
          setSavingSchedule(false);
          return;
        }
        const hour = parseInt(cleanTime.slice(0, 2), 10);
        const minute = parseInt(cleanTime.slice(2, 4), 10);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          Alert.alert('Error', 'Hora fuera de rango.');
          setSavingSchedule(false);
          return;
        }
        const localDateTime = new Date(`${normalizedDate}T${padTwo(hour)}:${padTwo(minute)}:00`);
        if (Number.isNaN(localDateTime.getTime())) {
          Alert.alert('Error', 'La fecha u hora ingresada no es válida.');
          setSavingSchedule(false);
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

      setMatches(prev => prev.map(m => m.id === selectedMatch.id ? { ...m, scheduled_at: scheduledAt, court: normalizedCourt } : m));

      const championship = championships.find(c => c.id === selectedMatch.tournament_id);
      const hasSchedulingChanges = previousScheduledAt !== scheduledAt || previousCourt !== normalizedCourt;
      if (hasSchedulingChanges) {
        await notifyScheduledMatchUpdate(
          { ...selectedMatch, scheduled_at: scheduledAt, court: normalizedCourt },
          championship,
          scheduledAt,
          normalizedCourt
        );
      }

      setIsScheduleModalVisible(false);
      Alert.alert('Éxito', 'Horario y cancha guardados.');

      if (scheduledAt) {
        const newDateStr = scheduledAt.split('T')[0];
        setSelectedDate(newDateStr);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la programación.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const resetCreateForm = () => {
    setModality('singles');
    setCategory(TOURNAMENT_CATEGORIES[0]);
    setFormat(FORMATS[0]);
    setSetType(TOURNAMENT_SET_TYPES[0]);
    setRegistrationFee('');
    setMaxPlayers('16');
    setGroupCount('2');
    setRankingPointRows(DEFAULT_RANKING_ROWS());
  };

  const handleAddManualRankingRow = () => {
    setRankingPointRows((current) => [
      ...current,
      {
        id: `rank-manual-${createRowId()}`,
        place: '',
        label: 'Rango manual',
        points: '',
        isDefault: false,
      },
    ]);
    setTimeout(() => {
      modalScrollRef.current?.scrollToEnd({ animated: true });
    }, 90);
  };

  const handleUpdateRankingRow = (
    rowId: string,
    patch: Partial<Pick<RankingPointRow, 'place' | 'points'>>
  ) => {
    setRankingPointRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  };

  const handleRemoveRankingRow = (rowId: string) => {
    setRankingPointRows((current) => current.filter((row) => row.id !== rowId));
  };

  const handleRankingInputFocus = useCallback(() => {
    requestAnimationFrame(() => {
      modalScrollRef.current?.scrollToEnd({ animated: true });
    });
    setTimeout(() => {
      modalScrollRef.current?.scrollToEnd({ animated: true });
    }, 220);
  }, []);

  const handleCreateChampionship = async () => {
    if (!masterTournament) return;

    const maxPlayersValue = Number(maxPlayers);
    if (!Number.isFinite(maxPlayersValue) || maxPlayersValue < 2) {
      Alert.alert('Error', 'Debes ingresar un numero de jugadores valido (minimo 2).');
      return;
    }

    setCreating(true);
    try {
      const rankingPoints: Record<string, number> = {};
      const usedPlaces = new Set<string>();
      for (const row of rankingPointRows) {
        const placeKey = row.place.trim();
        const pointsRaw = row.points.trim();
        const isEmptyManualRow = !row.isDefault && !placeKey && !pointsRaw;
        if (isEmptyManualRow) {
          continue;
        }

        if (!placeKey) {
          Alert.alert('Error', 'Completa el rango en los puntos de ranking manuales.');
          return;
        }

        const uniqueKey = placeKey.toLowerCase();
        if (usedPlaces.has(uniqueKey)) {
          Alert.alert('Error', `El rango "${placeKey}" está duplicado en los puntos para ranking.`);
          return;
        }
        usedPlaces.add(uniqueKey);

        const parsedPoints = Number(pointsRaw || '0');
        if (!Number.isFinite(parsedPoints)) {
          Alert.alert('Error', `Los puntos para el rango "${placeKey}" deben ser numéricos.`);
          return;
        }

        rankingPoints[placeKey] = parsedPoints;
      }

      const normalizedGroupCount = Math.max(2, Math.min(8, Number(groupCount) || 2));
      const uiTournamentFormat = buildTournamentFormatLabel(format, { groupCount: normalizedGroupCount });
      const tournamentFormat = toDbFormatLabel(uiTournamentFormat);
      const descriptionWithGroup = buildTournamentDescription(
        normalizeTournamentFormat(format) === 'round_robin' ? normalizedGroupCount : 2
      );
      const tournamentDescription = buildDescriptionWithRankingPoints(rankingPoints, descriptionWithGroup);

      // Build a robust "Fecha N" sequence across all championships in the organization,
      // even when historical rows have inconsistent modality casing or missing suffixes.
      const modalityLabel = getModalityLabel(modality);
      const baseName = `${category} ${modalityLabel}`;
      const normalizedCategory = normalizeText(category);
      const normalizedModality = normalizeText(modality);

      const { data: orgChampionships, error: orgChampionshipsError } = await supabase
        .from('tournaments')
        .select('id, name, level, modality, is_tournament_master')
        .eq('organization_id', masterTournament.organization_id)
        .eq('is_tournament_master', false);

      if (orgChampionshipsError) throw orgChampionshipsError;

      const championshipsForSeries = (orgChampionships || []).filter((championship: any) => {
        const sameCategory = normalizeText(championship?.level) === normalizedCategory;
        const normalizedChampModality = normalizeText(championship?.modality);
        const sameModality =
          normalizedChampModality === normalizedModality ||
          (normalizedModality === 'dobles' && normalizedChampModality.includes('doble')) ||
          (normalizedModality === 'singles' && normalizedChampModality.includes('single'));
        return sameCategory && sameModality;
      });

      const maxExistingFecha = championshipsForSeries.reduce((maxValue: number, championship: any) => {
        const parsedFecha = extractFechaNumber(championship?.name);
        if (!parsedFecha) return maxValue;
        return Math.max(maxValue, parsedFecha);
      }, 0);

      const fallbackCount = championshipsForSeries.length;
      const fechaNumber = Math.max(maxExistingFecha, fallbackCount) + 1;
      const championshipName = `${baseName} Fecha ${fechaNumber}`;

      const { data: createdTournamentId, error: createError } = await supabase.rpc('create_championship_tournament', {
        p_master_tournament_id: masterTournament.id,
        p_name: championshipName,
        p_modality: modality,
        p_level: category,
        p_format: tournamentFormat,
        p_set_type: setType,
        p_max_players: maxPlayersValue,
        p_registration_fee: Number(registrationFee) || 0,
        p_description: tournamentDescription,
      });

      if (createError || !createdTournamentId) {
        throw createError || new Error('No se obtuvo el id del campeonato creado.');
      }

      const matches = createInitialMatches({
        tournamentId: String(createdTournamentId),
        format: tournamentFormat,
        description: tournamentDescription,
        maxPlayers: maxPlayersValue,
        participants: [],
        modality,
      });

      if (matches.length > 0) {
        const { error: matchError } = await supabase.from('matches').insert(matches);
        if (matchError) throw matchError;
      }

      Alert.alert('Éxito', 'Campeonato creado correctamente.');
      resetCreateForm();
      setShowCreateModal(false);
      await loadData();
    } catch (error: any) {
      const detail = String(error?.message || '').trim();
      const normalizedDetail = detail.toLowerCase();
      if (normalizedDetail.includes('forbidden create championship') || normalizedDetail.includes('row-level security')) {
        Alert.alert('Permisos insuficientes', 'Tu usuario no tiene permisos para crear campeonatos en este torneo.');
        return;
      }
      Alert.alert(
        'Error',
        detail
          ? `No se pudo crear el campeonato. ${detail}`
          : 'No se pudo crear el campeonato.'
      );
    } finally {
      setCreating(false);
    }
  };

  const championshipCards = useMemo(() => sortChampionships(championships), [championships]);
  const handleBackToTournaments = () => {
    router.push({
      pathname: '/(tabs)/tournaments',
      params: { orgId: masterTournament?.organization_id || '' },
    });
  };

  const handlePickPoster = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'SweetSpot necesita acceso a tu galer\u00eda para que puedas seleccionar una imagen relacionada con el torneo.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      uploadPoster(result.assets[0]);
    }
  };

  const uploadPoster = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!masterTournamentId || !masterTournament) return;
    setUploadingPoster(true);
    try {
      const uri = asset.uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `posters/${masterTournament.organization_id}/${masterTournamentId}/${fileName}`;

      let fileData: Uint8Array | Blob | ArrayBuffer;

      if (asset.base64) {
        fileData = decodeBase64ToUint8Array(asset.base64);
      } else {
        const response = await fetch(uri);
        fileData = await (response.blob ? response.blob() : (response as any).arrayBuffer());
      }

      const { error: uploadError } = await supabase.storage
        .from('organizations')
        .upload(filePath, fileData, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ poster_url: filePath })
        .eq('id', masterTournamentId);

      if (updateError) throw updateError;

      const signedUrl = await resolveStorageAssetUrlWithRetry(filePath);
      setPosterUrl(signedUrl || uri);
      setMasterTournament(prev => prev ? { ...prev, poster_url: filePath } : null);
      Alert.alert('Éxito', 'Afiche subido correctamente.');
    } catch (error: any) {
      console.error('Error uploading poster:', error);
      Alert.alert('Error', 'No se pudo subir el afiche: ' + (error.message || 'Error desconocido'));
    } finally {
      setUploadingPoster(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <TennisSpinner size={34} />
      </View>
    );
  }

  if (!masterTournament) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <Text style={styles.emptyText}>No se encontro el torneo completo.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={handleBackToTournaments}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{masterTournament.name}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={loadData}>
            <Ionicons name="refresh-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        ref={horizontalScrollRef}
        style={{ flex: 1 }}
      >
        {/* Slide 1: Informacion General y Categorias */}
        <View style={{ width: screenWidth }}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.posterContainer}>
          {uploadingPoster ? (
            <TennisSpinner size={24} />
          ) : posterUrl ? (
            <>
              <TouchableOpacity
                activeOpacity={0.95}
                style={styles.posterTapTarget}
                onPress={() => setExpandedPosterUrl(posterUrl)}
              >
                <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
                <View style={styles.posterHint}>
                  <Text style={styles.posterHintText}>Toca para ampliar</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadPosterBtn} onPress={handlePickPoster}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.uploadPosterText}>Cambiar Afiche</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickPoster}>
              <Ionicons name="image-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.uploadPlaceholderText}>Subir Afiche (Poster)</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.masterCard}>
          <Text style={styles.masterText}>Inicio: {formatDateDDMMYYYY(masterTournament.start_date)}</Text>
          <Text style={styles.masterText}>Término: {formatDateDDMMYYYY(masterTournament.end_date)}</Text>
          <Text style={styles.masterText}>
            Cierre inscripciones: {formatRegistrationDeadline(masterTournament.registration_close_at, masterTournament.registration_close_time)}
          </Text>
          <Text style={styles.masterText}>
            {masterTournament.address || ''}{(masterTournament.address && masterTournament.comuna) ? ', ' : ''}{masterTournament.comuna || ''}
          </Text>
          <Text style={styles.masterText}>Superficie: {masterTournament.surface || 'Sin superficie'}</Text>
          {masterTournament.ball_brand && (
            <Text style={styles.masterText}>Pelota del torneo: {masterTournament.ball_brand}</Text>
          )}
        </View>

        <View style={styles.buttonsRow}>
          {masterTournament.referee_phone && (
            <TouchableOpacity
              style={[styles.refereeButton, { flex: 1, marginTop: 0, marginBottom: 0, alignSelf: 'stretch' }]}
              onPress={() => {
                const cleanNumber = masterTournament.referee_phone?.replace(/\D/g, '');
                if (cleanNumber) {
                  Linking.openURL(`https://wa.me/${cleanNumber}`);
                } else {
                  Alert.alert('Información', 'El torneo no tiene un número de contacto de árbitro válido.');
                }
              }}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#fff" />
              <Text style={styles.refereeButtonText} numberOfLines={1}>Contacto Árbitro</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.courtScheduleButton}
            onPress={() => {
              horizontalScrollRef.current?.scrollTo({ x: screenWidth, animated: true });
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.courtScheduleButtonText} numberOfLines={1}>Programación por Cancha</Text>
          </TouchableOpacity>
        </View>


        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.createButtonText}>Crear campeonato</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías</Text>
          <Text style={styles.sectionCount}>{championshipCards.length}</Text>
        </View>

        {championshipCards.map((championship) => (
          <TouchableOpacity
            key={championship.id}
            style={styles.championshipCard}
            onPress={() => router.push({ pathname: '/(admin)/tournaments/[id]', params: { id: championship.id } })}
          >
            <View style={styles.championshipRow}>
              <Text style={styles.championshipName} numberOfLines={1}>{championship.name}</Text>
              {(() => {
                const isDoublesChampionship = isDoublesChampionshipLegacyAware(championship);
                return (
                  <View style={[styles.modalityChip, isDoublesChampionship ? styles.modalityChipDoubles : styles.modalityChipSingles]}>
                    <Text style={[styles.modalityChipText, isDoublesChampionship ? styles.modalityChipTextDoubles : styles.modalityChipTextSingles]}>
                      {getChampionshipModalityLabel(championship)}
                    </Text>
                  </View>
                );
              })()}
            </View>
            <Text style={styles.championshipMeta}>Categoria: {championship.level || 'Sin categoria'}</Text>
            <Text style={styles.championshipMeta}>Valor de Inscripcion: ${Number(championship.registration_fee || 0)}</Text>
            <Text style={styles.championshipMeta}>Formato: {championship.format || 'Sin formato'}</Text>
            
            {(() => {
              const championName = extractChampionFromDescription(championship.description);
              const isFinished = championship.status === 'finished';
              if (!championName && !isFinished) return null;
              
              return (
                <View style={{ 
                  marginTop: spacing.sm, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: '#FFD70015', 
                  padding: 8, 
                  borderRadius: borderRadius.sm, 
                  borderWidth: 1, 
                  borderColor: '#FFD70040' 
                }}>
                  <Ionicons name="trophy" size={16} color="#FFD700" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginBottom: 1 }}>
                      Campeón
                    </Text>
                    <ChampionName championship={championship} />
                  </View>
                </View>
              );
            })()}
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ alignSelf: 'flex-end' }} />
          </TouchableOpacity>
        ))}

        {championshipCards.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="tennisball-outline" size={44} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Aún no hay competencias creadas.</Text>
          </View>
        )}
      </ScrollView>
        </View>

        {/* Slide 2: Programación por Cancha */}
        <View style={{ width: screenWidth, flex: 1, backgroundColor: '#FFFFFF' }}>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
            {uniqueDates.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, minHeight: 400 }}>
                <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' }}>
                  No hay partidos programados
                </Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' }}>
                  Programa partidos desde las categorías correspondientes para visualizarlos aquí.
                </Text>
              </View>
            ) : (
              <>
                {(() => {
                  if (!selectedDate) return null;
                  const currentIndex = uniqueDates.indexOf(selectedDate);
                  const dateLabel = getSpanishDateLabel(selectedDate);

                  return (
                    <View style={styles.schedulerHeader}>
                      <TouchableOpacity 
                        disabled={currentIndex <= 0}
                        onPress={() => setSelectedDate(uniqueDates[currentIndex - 1])}
                        style={[styles.arrowButton, currentIndex <= 0 && { opacity: 0.1 }]}
                      >
                        <Ionicons name="chevron-back" size={24} color="#0A1A3A" />
                      </TouchableOpacity>
                      
                      <View style={styles.schedulerHeaderTitleContainer}>
                        <Text style={styles.schedulerTitleSmall}>PROGRAMACIÓN</Text>
                        <Text style={styles.schedulerTitleLarge}>{dateLabel}</Text>
                      </View>

                      <TouchableOpacity 
                        disabled={currentIndex >= uniqueDates.length - 1}
                        onPress={() => setSelectedDate(uniqueDates[currentIndex + 1])}
                        style={[styles.arrowButton, currentIndex >= uniqueDates.length - 1 && { opacity: 0.1 }]}
                      >
                        <Ionicons name="chevron-forward" size={24} color="#0A1A3A" />
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {(() => {
                  if (!selectedDate) return null;
                  const matchesForDate = matches.filter(m => m.scheduled_at && m.scheduled_at.startsWith(selectedDate));
                  
                  if (uniqueCourts.length === 0) {
                    return (
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                          No hay canchas asignadas para este día.
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                      {uniqueCourts.map(courtName => {
                        return (
                          <View key={courtName} style={styles.courtColumn}>
                            {/* Court Column Header */}
                            <View style={styles.courtColumnHeader}>
                              <Text style={styles.courtColumnHeaderLabel}>{courtName.toUpperCase()}</Text>
                            </View>

                            {/* Rows of match cards corresponding to unique hours */}
                            {uniqueHours.map(hourStr => {
                              const cellMatches = matchesForDate.filter(m => {
                                if (!m.court || m.court.trim() !== courtName) return false;
                                const mHour = m.scheduled_at.split('T')[1]?.slice(0, 5);
                                return mHour === hourStr;
                              });

                              return (
                                <View key={hourStr} style={styles.courtCell}>
                                  {cellMatches.length > 0 ? (
                                    cellMatches.map(m => {
                                      const champ = championships.find(c => c.id === m.tournament_id);
                                      const isDoubles = champ ? isDoublesChampionshipLegacyAware(champ) : false;
                                      const p1Name = getMatchPlayerName(m, 1, champ, profiles);
                                      const p2Name = isDoubles ? getMatchPlayerName(m, 2, champ, profiles) : null;
                                      const p3Name = getMatchPlayerName(m, 3, champ, profiles);
                                      const p4Name = isDoubles ? getMatchPlayerName(m, 4, champ, profiles) : null;

                                      return (
                                        <TouchableOpacity
                                          key={m.id}
                                          activeOpacity={0.8}
                                          onPress={() => handleSchedulePress(m)}
                                          style={styles.matchScheduleCard}
                                        >
                                          <Text style={styles.matchScheduleTime}>{hourStr}</Text>
                                          <Text style={styles.matchScheduleCategory} numberOfLines={1}>
                                            {String(champ?.name || '').toUpperCase()}
                                          </Text>
                                          
                                          <View style={styles.matchSchedulePlayersContainer}>
                                            <Text style={styles.matchSchedulePlayerText} numberOfLines={1}>
                                              {isDoubles ? `${p1Name} / ${p2Name}` : p1Name}
                                            </Text>
                                            <Text style={styles.matchScheduleVs}>VS</Text>
                                            <Text style={styles.matchSchedulePlayerText} numberOfLines={1}>
                                              {isDoubles ? `${p3Name} / ${p4Name}` : p3Name}
                                            </Text>
                                          </View>
                                        </TouchableOpacity>
                                      );
                                    })
                                  ) : (
                                    <View style={styles.emptyCourtCell} />
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })}
                    </ScrollView>
                  );
                })()}
              </>
            )}
          </ScrollView>
        </View>
      </ScrollView>

      <AdminQuickActionsBar active="tournaments" organizationId={masterTournament.organization_id} />

      <Modal
        visible={Boolean(expandedPosterUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPosterUrl(null)}
      >
        <View style={styles.posterModalOverlay}>
          <TouchableOpacity
            style={styles.posterModalClose}
            onPress={() => setExpandedPosterUrl(null)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.posterModalTouchable}
            activeOpacity={1}
            onPress={() => setExpandedPosterUrl(null)}
          >
            {expandedPosterUrl ? (
              <Image source={{ uri: expandedPosterUrl }} style={styles.posterModalImage} resizeMode="contain" />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => !creating && setShowCreateModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior="padding"
          keyboardVerticalOffset={Math.max(insets.top, spacing.md)}
        >
          <View style={[styles.modalContainer, { paddingTop: Math.max(insets.top, spacing.md) }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => !creating && setShowCreateModal(false)} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Campeonato</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            ref={modalScrollRef}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Modalidad</Text>
              <View style={styles.modalityRow}>
                {MODALITIES.map((currentModality) => (
                  <TouchableOpacity
                    key={currentModality}
                    style={[styles.modalityOption, modality === currentModality && styles.modalityOptionActive]}
                    onPress={() => {
                      setModality(currentModality);
                      const validCategories = getCategoriesByModality(currentModality);
                      if (!validCategories.includes(category)) {
                        setCategory(validCategories[0]);
                      }
                    }}
                  >
                    <Text style={[styles.modalityOptionText, modality === currentModality && styles.modalityOptionTextActive]}>
                      {getModalityLabel(currentModality)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Categoria</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowCategoryModal(true)}>
                <Text style={styles.dropdownText}>{category}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Formato del Torneo</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowFormatModal(true)}>
                <Text style={styles.dropdownText}>{format}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {normalizeTournamentFormat(format) === 'round_robin' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cantidad de Grupos (RR)</Text>
                <TextInput
                  style={styles.textInput}
                  value={groupCount}
                  onChangeText={setGroupCount}
                  keyboardType="number-pad"
                  placeholder="2"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Valor de Inscripcion</Text>
              <TextInput
                style={styles.textInput}
                value={registrationFee}
                onChangeText={setRegistrationFee}
                keyboardType="numeric"
                placeholder="Ej. 20000"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numero de Jugadores</Text>
              <TextInput
                style={styles.textInput}
                value={maxPlayers}
                onChangeText={setMaxPlayers}
                keyboardType="number-pad"
                placeholder="Ej. 16"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Sets</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowSetTypeModal(true)}>
                <Text style={styles.dropdownText}>{setType}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pointsCard}>
              <Text style={styles.pointsTitle}>Puntos para Ranking</Text>
              {rankingPointRows.map((row) => (
                <View key={row.id} style={styles.pointsRow}>
                  <View style={styles.pointsRowLeft}>
                    {row.isDefault ? (
                      <Text style={styles.pointsLabel}>{row.label}</Text>
                    ) : (
                      <TextInput
                        style={styles.pointsPlaceInput}
                        value={row.place}
                        onChangeText={(nextPlace) => handleUpdateRankingRow(row.id, { place: nextPlace })}
                        onFocus={handleRankingInputFocus}
                        placeholder="Rango (ej. 5 o 5-8)"
                        placeholderTextColor={colors.textTertiary}
                      />
                    )}
                  </View>
                  <View style={styles.pointsRowRight}>
                    <TextInput
                      style={styles.pointsInput}
                      value={row.points}
                      onChangeText={(nextPoints) => handleUpdateRankingRow(row.id, { points: nextPoints })}
                      onFocus={handleRankingInputFocus}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                    {!row.isDefault && (
                      <TouchableOpacity
                        style={styles.removeManualRankButton}
                        onPress={() => handleRemoveRankingRow(row.id)}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.addRankButton} onPress={handleAddManualRankingRow}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary[500]} />
                <Text style={styles.addRankButtonText}>Agregar rango manual</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <TouchableOpacity
              style={[styles.modalCreateButton, creating && styles.modalCreateButtonDisabled]}
              onPress={handleCreateChampionship}
              disabled={creating}
            >
              {creating ? (
                <TennisSpinner size={18} color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.modalCreateButtonText}>Crear campeonato</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <SelectionModal
            visible={showCategoryModal}
            title="Categoria"
            options={getCategoriesByModality(modality)}
            onSelect={(value: string) => {
              setCategory(value);
              setShowCategoryModal(false);
            }}
            onClose={() => setShowCategoryModal(false)}
          />
          <SelectionModal
            visible={showFormatModal}
            title="Formato"
            options={FORMATS}
            onSelect={(value: string) => {
              setFormat(value);
              setShowFormatModal(false);
            }}
            onClose={() => setShowFormatModal(false)}
          />
          <SelectionModal
            visible={showSetTypeModal}
            title="Tipo de Sets"
            options={TOURNAMENT_SET_TYPES}
            onSelect={(value: string) => {
              setSetType(value);
              setShowSetTypeModal(false);
            }}
            onClose={() => setShowSetTypeModal(false)}
          />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Schedule Match Modal */}
      <ScheduleMatchModal
        visible={isScheduleModalVisible}
        initialData={scheduleData}
        saving={savingSchedule}
        onSave={saveMatchSchedule}
        onClose={() => setIsScheduleModalVisible(false)}
      />
    </View>
  );
}

function SelectionModal({ visible, title, options, onSelect, onClose }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.selectionOverlay}>
        <View style={styles.selectionContent}>
          <Text style={styles.selectionTitle}>{title}</Text>
          <ScrollView>
            {options.map((option: string) => (
              <TouchableOpacity key={option} style={styles.selectionOption} onPress={() => onSelect(option)}>
                <Text style={styles.selectionOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.selectionClose} onPress={onClose}>
            <Text style={styles.selectionCloseText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerAll: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerRow: {
    height: 58,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 124,
    gap: spacing.md,
  },
  masterCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  masterTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  masterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterTapTarget: {
    width: '100%',
    height: '100%',
  },
  posterHint: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  posterHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  posterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterModalClose: {
    position: 'absolute',
    top: 48,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    zIndex: 2,
  },
  posterModalTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  posterModalImage: {
    width: '100%',
    height: '100%',
  },
  uploadPosterBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadPosterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadPlaceholderText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  championshipCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 2,
  },
  championshipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  championshipName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  modalityChipSingles: {
    backgroundColor: colors.primary[500] + '20',
    borderColor: colors.primary[500] + '35',
  },
  modalityChipDoubles: {
    backgroundColor: colors.warning + '20',
    borderColor: colors.warning + '35',
  },
  modalityChipText: {
    fontSize: 10,
    fontWeight: '900',
  },
  modalityChipTextSingles: {
    color: colors.primary[500],
  },
  modalityChipTextDoubles: {
    color: colors.warning,
  },
  championshipMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    height: 58,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modalContent: {
    padding: spacing.xl,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  textInput: {
    height: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdown: {
    height: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalityOption: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  modalityOptionActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500] + '15',
  },
  modalityOptionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalityOptionTextActive: {
    color: colors.primary[500],
  },
  pointsCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pointsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pointsRowLeft: {
    flex: 1,
  },
  pointsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pointsLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pointsPlaceInput: {
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
  },
  pointsInput: {
    width: 96,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    textAlign: 'right',
    paddingHorizontal: spacing.sm,
    fontWeight: '700',
  },
  removeManualRankButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRankButton: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  addRankButtonText: {
    color: colors.primary[500],
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  modalCreateButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  modalCreateButtonDisabled: {
    opacity: 0.6,
  },
  modalCreateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  selectionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  selectionContent: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  selectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  selectionOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectionClose: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  selectionCloseText: {
    color: colors.primary[500],
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  refereeButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  refereeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xl,
  },
  courtScheduleButton: {
    backgroundColor: '#0A1A3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    flex: 1,
  },
  courtScheduleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  schedulerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  schedulerHeaderTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  schedulerTitleSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00A8E8',
    letterSpacing: 1.5,
  },
  schedulerTitleLarge: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1A3A',
    marginTop: 2,
  },
  courtColumn: {
    width: 280,
    marginRight: spacing.md,
  },
  courtColumnHeader: {
    backgroundColor: '#0A1A3A',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  courtColumnHeaderLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  courtCell: {
    minHeight: 110,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  matchScheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  matchScheduleTime: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1A3A',
    textAlign: 'center',
  },
  matchScheduleCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00A8E8',
    marginTop: 2,
    textAlign: 'center',
  },
  matchSchedulePlayersContainer: {
    marginTop: spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  matchSchedulePlayerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  matchScheduleVs: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginVertical: 2,
    textAlign: 'center',
  },
  emptyCourtCell: {
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    backgroundColor: '#F8F9FA',
  },
});

