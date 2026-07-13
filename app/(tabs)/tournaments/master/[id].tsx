import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Keyboard, Image, Modal, Linking, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { borderRadius, spacing, useTheme } from '@/theme';
import { supabase } from '@/services/supabase';
import { TennisSpinner } from '@/components/TennisSpinner';
import * as Clipboard from 'expo-clipboard';
import { getModalityLabel, sortChampionships } from '@/services/championshipSorting';
import {
  getRequestStatusLabel,
  isRegistrationWindowClosed,
  submitTournamentRegistrationRequest,
} from '@/services/registrationRequests';
import { RegistrationProofModal } from '@/components/tournaments/RegistrationProofModal';
import { normalizeTournamentStatus } from '@/services/tournamentStatus';
import { extractChampionFromDescription, resolveChampionFromMatches } from '@/services/tournamentChampion';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';

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
  poster_url?: string | null;
  transfer_info?: string | null;
  ball_brand?: string | null;
  referee_phone?: string | null;
};


type Championship = {
  id: string;
  name: string;
  status: string;
  level: string | null;
  modality: string | null;
  format: string | null;
  registration_fee: number | null;
  start_date: string | null;
  description: string | null;
};

type LatestRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  updated_at: string;
};

const OPEN_STATUSES = new Set(['open', 'in_progress']);

const formatStatus = (status?: string | null) => {
  const normalizedStatus = normalizeTournamentStatus(status);
  if (normalizedStatus === 'open') return 'Inscripciones abiertas';
  if (normalizedStatus === 'in_progress') return 'En curso';
  if (normalizedStatus === 'finished') return 'Finalizado';
  if (normalizedStatus === 'draft') return 'No publicado';
  return String(status || 'Sin estado');
};

const toErrorMessage = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message || 'Error desconocido');
  }
  return 'Error desconocido';
};

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatRegistrationDeadline = (dateValue?: string | null, timeValue?: string | null) => {
  if (!dateValue) return 'Sin definir';
  const parsedDate = new Date(`${dateValue}T00:00:00`);
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? dateValue
    : parsedDate.toLocaleDateString('es-ES');
  const timeLabel = String(timeValue || '').slice(0, 5) || '23:59';
  return `${dateLabel} ${timeLabel}`;
};

function ChampionName({ championship }: { championship: Championship }) {
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const tagManager = extractChampionFromDescription(championship.description);
  const shouldForceResolve = String(championship.modality || '').toLowerCase().includes('doble')
    || String(championship.format || '').toLowerCase().includes('repech');

  useEffect(() => {
    if ((!shouldForceResolve && tagManager) || championship.status !== 'finished') return;

    const resolve = async () => {
      try {
        const [matchesRes, participantsRes] = await Promise.all([
          supabase.from('matches').select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status, scheduled_at, created_at').eq('tournament_id', championship.id),
          supabase.from('tournament_participants').select('player_id, profiles(name)').eq('tournament_id', championship.id)
        ]);

        if (matchesRes.data) {
          const name = resolveChampionFromMatches(
            matchesRes.data,
            participantsRes.data || [],
            championship.description,
            championship.modality || championship.name
          );
          if (name) setResolvedName(name);
        }
      } catch (e) {
        console.error('Error resolving champion:', e);
      }
    };
    resolve();
  }, [championship.id, championship.status, championship.description, championship.format, championship.modality, shouldForceResolve, tagManager]);

  const displayName = resolvedName || tagManager || 'Finalizado';

  return (
    <Text style={{ fontSize: 13, color: '#333', fontWeight: '800' }}>
      {displayName}
    </Text>
  );
}

const isDoublesChampionshipLegacyAware = (championship: Championship) => {
  const modalityText = normalizeText(championship.modality);
  if (modalityText.includes('doble') || modalityText.includes('double')) return true;

  const nameText = normalizeText(championship.name);
  return nameText.includes('doble') || nameText.includes('double');
};

const getChampionshipModalityLabel = (championship: Championship) =>
  isDoublesChampionshipLegacyAware(championship) ? 'Dobles' : 'Singles';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getSpanishDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  
  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  
  return `${dayName} ${dayNum} DE ${monthName}`;
};

export default function TournamentMasterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const masterTournamentId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [masterTournament, setMasterTournament] = useState<MasterTournament | null>(null);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [registeredTournamentIds, setRegisteredTournamentIds] = useState<Set<string>>(new Set());
  const [latestRequestsByTournamentId, setLatestRequestsByTournamentId] = useState<Record<string, LatestRequest>>({});
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isPosterModalVisible, setIsPosterModalVisible] = useState(false);
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
  const [selectedProofUri, setSelectedProofUri] = useState<string | null>(null);
  const [selectedProofMimeType, setSelectedProofMimeType] = useState<string | null>(null);
  const [isProofModalVisible, setIsProofModalVisible] = useState(false);
  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const horizontalScrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);


  const loadMasterData = useCallback(async () => {
    if (!masterTournamentId) return;

    setLoading(true);
    try {
      const { data: masterData, error: masterError } = await supabase
        .from('tournaments')
        .select('id, organization_id, name, status, start_date, end_date, registration_close_at, registration_close_time, address, comuna, surface, is_tournament_master, poster_url, transfer_info, ball_brand, referee_phone')
        .eq('id', masterTournamentId)
        .single();

      if (masterError) throw masterError;

      const masterRow = {
        ...(masterData as MasterTournament),
        status: normalizeTournamentStatus((masterData as MasterTournament).status),
      };
      if (!masterRow?.is_tournament_master) {
        router.replace(`/(tabs)/tournaments/${masterTournamentId}`);
        return;
      }

      setMasterTournament(masterRow);

      if (masterRow.poster_url) {
        const resolvedPosterUrl = await resolveStorageAssetUrlWithRetry(masterRow.poster_url);
        setPosterUrl(resolvedPosterUrl);
      } else {
        setPosterUrl(null);
      }

      const { data: championshipsData, error: championshipsError } = await supabase
        .from('tournaments')
        .select('id, name, status, level, modality, format, registration_fee, start_date, description')
        .eq('parent_tournament_id', masterRow.id);

      if (championshipsError) throw championshipsError;

      const loadedChampionships = sortChampionships(
        (championshipsData || []).map((championship: any) => ({
          ...championship,
          status: normalizeTournamentStatus(championship.status),
        })) as Championship[]
      );
      setChampionships(loadedChampionships);

      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id;
      if (!userId || loadedChampionships.length === 0) {
        setRegisteredTournamentIds(new Set());
        setLatestRequestsByTournamentId({});
        return;
      }

      const championshipIds = loadedChampionships.map((championship) => championship.id);

      const { data: registrationRows, error: registrationError } = await supabase
        .from('registrations')
        .select('tournament_id')
        .eq('player_id', userId)
        .in('tournament_id', championshipIds);

      if (registrationError) throw registrationError;

      const registeredIds = new Set(
        (registrationRows || [])
          .map((row: any) => String(row?.tournament_id || ''))
          .filter(Boolean)
      );
      setRegisteredTournamentIds(registeredIds);

      const { data: requestRows, error: requestsError } = await supabase
        .from('tournament_registration_requests')
        .select('id, tournament_id, status, rejection_reason, updated_at, created_at')
        .eq('player_id', userId)
        .in('tournament_id', championshipIds)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      const nextMap: Record<string, LatestRequest> = {};
      (requestRows || []).forEach((request: any) => {
        const tournamentId = String(request?.tournament_id || '');
        if (!tournamentId || nextMap[tournamentId]) return;

        nextMap[tournamentId] = {
          id: request.id,
          status: request.status,
          rejection_reason: request.rejection_reason || null,
          updated_at: request.updated_at,
        };
      });
      setLatestRequestsByTournamentId(nextMap);

      // Consultar partidos de los campeonatos hijos
      const champIds = loadedChampionships.map(c => c.id);
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
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar la informacion del torneo.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [masterTournamentId, router]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

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

  const [activeSlide, setActiveSlide] = useState(0);

  const getLocalDateString = (isoString: string) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getLocalTimeString = (isoString: string) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    matches.forEach(m => {
      if (m.scheduled_at) {
        const localDate = getLocalDateString(m.scheduled_at);
        if (localDate) dates.add(localDate);
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
      if (m.scheduled_at) {
        const localDate = getLocalDateString(m.scheduled_at);
        if (localDate === selectedDate) {
          const localTime = getLocalTimeString(m.scheduled_at);
          if (localTime) hours.add(localTime);
        }
      }
    });
    return Array.from(hours).sort();
  }, [matches, selectedDate]);

  const uniqueCourts = useMemo(() => {
    if (!selectedDate) return [];
    const courts = new Set<string>();
    matches.forEach(m => {
      if (m.scheduled_at && m.court) {
        const localDate = getLocalDateString(m.scheduled_at);
        if (localDate === selectedDate) {
          courts.add(m.court.trim());
        }
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

  const openProofModal = (championship: Championship) => {
    const championshipStatus = normalizeTournamentStatus(championship?.status);
    if (!OPEN_STATUSES.has(championshipStatus)) {
      Alert.alert('No disponible', 'Este campeonato ya no acepta solicitudes.');
      return;
    }

    setSelectedChampionship(championship);
    setSelectedProofUri(null);
    setSelectedProofMimeType(null);
    setIsProofModalVisible(true);
  };

  const closeProofModal = () => {
    if (submitting) return;
    Keyboard.dismiss();
    setIsProofModalVisible(false);
    setSelectedChampionship(null);
    setSelectedProofUri(null);
    setSelectedProofMimeType(null);
  };

  const handlePickProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'SweetSpot necesita acceso a tu galer\u00eda para que puedas adjuntar el comprobante de pago del torneo.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setSelectedProofUri(asset.uri);
    setSelectedProofMimeType(asset.mimeType || null);
  };

  const handleSubmitRequest = async () => {
    if (!masterTournament || !selectedChampionship || !selectedProofUri) return;

    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id;
      if (!userId) {
        Alert.alert('Sesion requerida', 'Debes iniciar sesion para inscribirte.');
        return;
      }

      await submitTournamentRegistrationRequest({
        tournamentId: selectedChampionship.id,
        organizationId: masterTournament.organization_id,
        playerId: userId,
        assetUri: selectedProofUri,
        mimeType: selectedProofMimeType,
        tournamentName: selectedChampionship.name,
      });

      Alert.alert('Solicitud enviada', 'Tu comprobante fue enviado al admin. Quedaste pendiente de revisión.');
      Keyboard.dismiss();
      closeProofModal();
      await loadMasterData();
    } catch (error) {
      const message = toErrorMessage(error);
      if (message.includes('duplicate') || message.includes('pending_uidx')) {
        Alert.alert('Solicitud pendiente', 'Ya tienes una solicitud pendiente para este torneo.');
      } else if (message.includes('registration request deadline reached')) {
        Alert.alert('Inscripcion cerrada', 'Se cumplio la fecha de cierre de inscripciones.');
      } else if (message.includes('registration request window is closed')) {
        Alert.alert('Error', 'Este torneo ya no acepta solicitudes.');
      } else if (message.includes('invalid proof_path')) {
        Alert.alert('Error', 'El comprobante no cumple el formato permitido. Usa JPG, PNG o WEBP.');
      } else {
        Alert.alert('Error', message || 'No se pudo enviar el comprobante. Intenta nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cardRows = useMemo(() => {
    const isDeadlineReached = isRegistrationWindowClosed(
      masterTournament?.registration_close_at,
      masterTournament?.registration_close_time
    );
    const isMasterOpen = OPEN_STATUSES.has(normalizeTournamentStatus(masterTournament?.status));

    return championships.map((championship) => {
      const latestRequest = latestRequestsByTournamentId[championship.id];
      const isRegistered = registeredTournamentIds.has(championship.id);
      const championshipStatus = normalizeTournamentStatus(championship.status);
      const isChampionshipOpen = OPEN_STATUSES.has(championshipStatus);
      const isOpen = isMasterOpen && isChampionshipOpen;

      let canRequest = true;
      let requestButtonText = 'Inscribirse';
      let helperText: string | null = null;

      if (!isMasterOpen) {
        canRequest = false;
        requestButtonText = 'No disponible';
      } else if (!isChampionshipOpen) {
        canRequest = false;
        requestButtonText = championshipStatus === 'finished' ? 'Finalizado' : 'No disponible';
      } else if (isDeadlineReached) {
        canRequest = false;
        requestButtonText = 'Inscripcion cerrada';
      } else if (isRegistered || latestRequest?.status === 'approved') {
        canRequest = false;
        requestButtonText = 'Inscripcion aprobada';
      } else if (latestRequest?.status === 'pending') {
        canRequest = false;
        requestButtonText = 'Solicitud pendiente';
      } else if (latestRequest?.status === 'rejected') {
        requestButtonText = 'Reenviar solicitud';
        helperText = latestRequest.rejection_reason || 'Pago rechazado por administracion.';
      }

      return {
        championship,
        latestRequest,
        canRequest,
        canViewBracket: isRegistered || latestRequest?.status === 'approved',
        requestButtonText,
        helperText,
      };
    });
  }, [
    championships,
    latestRequestsByTournamentId,
    masterTournament?.registration_close_at,
    masterTournament?.registration_close_time,
    masterTournament?.status,
    registeredTournamentIds,
  ]);

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
          <TouchableOpacity
            onPress={() => {
              if (activeSlide === 1) {
                horizontalScrollRef.current?.scrollTo({ x: 0, animated: true });
                setActiveSlide(0);
              } else {
                router.push({
                  pathname: '/(tabs)/tournaments',
                  params: { orgId: masterTournament.organization_id },
                });
              }
            }}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{masterTournament.name}</Text>
          <TouchableOpacity onPress={loadMasterData} style={styles.iconButton}>
            <Ionicons name="refresh-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        ref={horizontalScrollRef}
        style={{ flex: 1 }}
      >
        {/* Slide 1: Información General y Categorías */}
        <View style={{ width: screenWidth }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {posterUrl && (
          <TouchableOpacity
            style={styles.posterContainer}
            activeOpacity={0.95}
            onPress={() => setIsPosterModalVisible(true)}
          >
            <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
            <View style={styles.posterHint}>
              <Text style={styles.posterHintText}>Toca para ampliar</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.masterInfoCard}>
          <Text style={styles.masterInfoText}>
            {masterTournament.start_date
              ? `Inicio: ${new Date(masterTournament.start_date).toLocaleDateString('es-ES')}`
              : 'Inicio por confirmar'}
          </Text>
          {masterTournament.end_date && (
            <Text style={styles.masterInfoText}>
              Término: {new Date(masterTournament.end_date).toLocaleDateString('es-ES')}
            </Text>
          )}
          <Text style={styles.masterInfoText}>
            Cierre inscripciones: {formatRegistrationDeadline(masterTournament.registration_close_at, masterTournament.registration_close_time)}
          </Text>
          {(masterTournament.address || masterTournament.comuna) && (
            <Text style={styles.masterInfoText}>
              {masterTournament.address || ''}{masterTournament.address && masterTournament.comuna ? ', ' : ''}{masterTournament.comuna || ''}
            </Text>
          )}
          {masterTournament.surface && (
            <Text style={styles.masterInfoText}>Superficie: {masterTournament.surface}</Text>
          )}
          {masterTournament.ball_brand && (
            <Text style={styles.masterInfoText}>Pelota del torneo: {masterTournament.ball_brand}</Text>
          )}
          <Text style={styles.masterInfoStatus}>{formatStatus(masterTournament.status)}</Text>
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
              <Text style={[styles.refereeButtonText, { textAlign: 'center', flexShrink: 1 }]} numberOfLines={2}>Contacto Árbitro</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.courtScheduleButton}
            onPress={() => {
              horizontalScrollRef.current?.scrollTo({ x: screenWidth, animated: true });
              setActiveSlide(1);
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={[styles.courtScheduleButtonText, { textAlign: 'center', flexShrink: 1 }]} numberOfLines={2}>Programación por Cancha</Text>
          </TouchableOpacity>
        </View>


        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías disponibles</Text>
          <Text style={styles.sectionCount}>{championships.length}</Text>
        </View>

        {cardRows.map(({ championship, latestRequest, canRequest, canViewBracket, requestButtonText, helperText }) => (
          <View key={championship.id} style={styles.championshipCard}>
            <TouchableOpacity
              onPress={() => {
                if (!canViewBracket) {
                  Alert.alert('Acceso restringido', 'Debes tener la inscripcion aprobada para ver el cuadro.');
                  return;
                }
                router.push(`/(tabs)/tournaments/${championship.id}`);
              }}
              activeOpacity={0.85}
            >
              {(() => {
                const isDoublesChampionship = isDoublesChampionshipLegacyAware(championship);
                return (
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>{championship.name}</Text>
                    <View
                      style={[
                        styles.modalityChip,
                        isDoublesChampionship ? styles.modalityChipDoubles : styles.modalityChipSingles,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalityChipText,
                          isDoublesChampionship ? styles.modalityChipTextDoubles : styles.modalityChipTextSingles,
                        ]}
                      >
                        {getChampionshipModalityLabel(championship)}
                      </Text>
                    </View>
                  </View>
                );
              })()}
              <View style={styles.cardRows}>
                <Text style={styles.cardMeta}>Categoria: {championship.level || 'Sin categoria'}</Text>
                <Text style={styles.cardMeta}>Valor de Inscripcion: ${Number(championship.registration_fee || 0)}</Text>
                <Text style={styles.cardMeta}>Formato: {championship.format || 'Sin formato'}</Text>
              </View>

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
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginBottom: 1 }}>
                        Campeón
                      </Text>
                      <ChampionName championship={championship} />
                    </View>
                  </View>
                );
              })()}
            </TouchableOpacity>

            {latestRequest && (
              <View style={styles.requestStatusRow}>
                <Text style={styles.requestStatusText}>
                  Estado solicitud: {getRequestStatusLabel(latestRequest.status)}
                </Text>
              </View>
            )}

            {helperText && (
              <Text style={styles.rejectionText}>{helperText}</Text>
            )}

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.requestButton, !canRequest && styles.requestButtonDisabled]}
                onPress={() => openProofModal(championship)}
                disabled={!canRequest}
              >
                <Text style={styles.requestButtonText}>{requestButtonText}</Text>
              </TouchableOpacity>
              {!registeredTournamentIds.has(championship.id) && latestRequest?.status !== 'approved' && masterTournament?.transfer_info ? (
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => setIsTransferModalVisible(true)}
                >
                  <Text style={styles.detailsButtonText}>Ver datos de transferencia</Text>
                </TouchableOpacity>
              ) : canViewBracket ? (
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => router.push(`/(tabs)/tournaments/${championship.id}`)}
                >
                  <Text style={styles.detailsButtonText}>Ver cuadro</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}

        {championships.length === 0 && (
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
                  Los partidos programados aparecerán aquí.
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
                  const matchesForDate = matches.filter(m => {
                    if (!m.scheduled_at) return false;
                    return getLocalDateString(m.scheduled_at) === selectedDate;
                  });
                  
                  if (uniqueCourts.length === 0) {
                    return (
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                          No hay canchas asignadas para este día.
                        </Text>
                      </View>
                    );
                  }

                  const courtColumnWidth = (screenWidth - 40) / 3;

                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                      <View style={{ flexDirection: 'column' }}>
                        {/* Headers Row */}
                        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                          {uniqueCourts.map(courtName => (
                            <View key={courtName} style={[styles.courtColumnHeader, { width: courtColumnWidth, marginRight: 6, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs }]}>
                              <Text style={[styles.courtColumnHeaderLabel, { fontSize: 11 }]} numberOfLines={1}>{courtName.toUpperCase()}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Hours Rows */}
                        {uniqueHours.map(hourStr => (
                          <View key={hourStr} style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 6 }}>
                            {uniqueCourts.map(courtName => {
                              const cellMatches = matchesForDate.filter(m => {
                                if (!m.court || m.court.trim() !== courtName) return false;
                                const mHour = getLocalTimeString(m.scheduled_at);
                                return mHour === hourStr;
                              });

                              return (
                                <View key={courtName} style={[styles.courtCell, { width: courtColumnWidth, marginRight: 6, flexDirection: 'column', alignItems: 'stretch' }]}>
                                  {cellMatches.length > 0 ? (
                                    cellMatches.map(m => {
                                      const champ = championships.find(c => c.id === m.tournament_id);
                                      const isDoubles = champ ? isDoublesChampionshipLegacyAware(champ) : false;
                                      const p1Name = getMatchPlayerName(m, 1, champ, profiles);
                                      const p2Name = isDoubles ? getMatchPlayerName(m, 2, champ, profiles) : null;
                                      const p3Name = getMatchPlayerName(m, 3, champ, profiles);
                                      const p4Name = isDoubles ? getMatchPlayerName(m, 4, champ, profiles) : null;

                                      return (
                                        <View
                                          key={m.id}
                                          style={[styles.matchScheduleCard, { padding: 6, borderWidth: 1, flex: 1 }]}
                                        >
                                          <Text style={[styles.matchScheduleTime, { fontSize: 12 }]}>{hourStr}</Text>
                                          <Text style={[styles.matchScheduleCategory, { fontSize: 8, textAlign: 'center' }]} numberOfLines={2}>
                                            {String(champ?.name || '').replace(/fecha\s*\d+/i, '').replace(/\s+f\s*\d+/i, '').trim().toUpperCase()}
                                          </Text>
                                          
                                          <View style={styles.matchSchedulePlayersContainer}>
                                            <Text style={[styles.matchSchedulePlayerText, { fontSize: 9 }]}>
                                              {isDoubles ? `${p1Name}\n/\n${p2Name}` : p1Name}
                                            </Text>
                                            <Text style={[styles.matchScheduleVs, { marginVertical: 1, fontSize: 8 }]}>VS</Text>
                                            <Text style={[styles.matchSchedulePlayerText, { fontSize: 9 }]}>
                                              {isDoubles ? `${p3Name}\n/\n${p4Name}` : p3Name}
                                            </Text>
                                          </View>
                                        </View>
                                      );
                                    })
                                  ) : (
                                    <View style={[styles.emptyCourtCell, { flex: 1, minHeight: 90 }]} />
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  );
                })()}
              </>
            )}
          </ScrollView>
        </View>
      </ScrollView>

      <Modal
        visible={isPosterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPosterModalVisible(false)}
      >
        <View style={styles.posterModalOverlay}>
          <TouchableOpacity
            style={styles.posterModalClose}
            onPress={() => setIsPosterModalVisible(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.posterModalTouchable}
            activeOpacity={1}
            onPress={() => setIsPosterModalVisible(false)}
          >
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.posterModalImage} resizeMode="contain" />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>

      <RegistrationProofModal
        visible={isProofModalVisible}
        tournamentName={selectedChampionship?.name}
        selectedImageUri={selectedProofUri}
        submitting={submitting}
        onClose={closeProofModal}
        onPickImage={handlePickProof}
        onSubmit={handleSubmitRequest}
      />

      {/* Transfer Info Modal */}
      <Modal
        visible={isTransferModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTransferModalVisible(false)}
      >
        <View style={styles.posterModalOverlay}>
          <View style={styles.transferModalContent}>
            <View style={styles.transferModalHeader}>
              <Text style={styles.transferModalTitle}>Datos de Transferencia</Text>
              <TouchableOpacity onPress={() => setIsTransferModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.transferModalText} selectable={true}>{masterTournament?.transfer_info || ''}</Text>
            <TouchableOpacity
              style={styles.transferCopyButton}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(masterTournament?.transfer_info || '');
                  Alert.alert('Copiado', 'Los datos de transferencia se copiaron al portapapeles.');
                } catch (err) {
                  Alert.alert('Aviso', 'Por favor, mantén presionado el texto arriba para copiarlo manualmente.');
                }
              }}
            >
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={styles.transferCopyButtonText}>Copiar datos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
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
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 42,
    gap: spacing.lg,
  },
  masterInfoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
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
  masterInfoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  masterInfoText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  masterInfoStatus: {
    marginTop: spacing.xs,
    color: colors.primary[500],
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardName: {
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
  cardRows: {
    gap: 2,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  requestStatusRow: {
    marginTop: spacing.xs,
  },
  requestStatusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rejectionText: {
    color: colors.error,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  requestButton: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonDisabled: {
    opacity: 0.55,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  detailsButton: {
    minWidth: 92,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
  },
  detailsButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
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
  transferModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  transferModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  transferModalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  transferModalText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  transferCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  transferCopyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  alertCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  alertButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  refereeButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: 8,
    borderRadius: borderRadius.lg,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  refereeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  courtScheduleButton: {
    backgroundColor: '#0A1A3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: 8,
    borderRadius: borderRadius.lg,
    flex: 1.3,
  },
  courtScheduleButtonText: {
    color: '#fff',
    fontSize: 11,
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
    height: '100%',
    minHeight: 90,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    backgroundColor: '#F8F9FA',
  },
});
