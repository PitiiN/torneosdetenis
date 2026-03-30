import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Keyboard, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { borderRadius, spacing, useTheme } from '@/theme';
import { supabase } from '@/services/supabase';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getModalityLabel, sortChampionships } from '@/services/championshipSorting';
import {
  getRequestStatusLabel,
  isRegistrationWindowClosed,
  submitTournamentRegistrationRequest,
} from '@/services/registrationRequests';
import { RegistrationProofModal } from '@/components/tournaments/RegistrationProofModal';
import { normalizeTournamentStatus } from '@/services/tournamentStatus';
import { resolveChampionFromMatches } from '@/services/tournamentChampion';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';

type MasterTournament = {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  start_date: string | null;
  registration_close_at: string | null;
  registration_close_time: string | null;
  address: string | null;
  comuna: string | null;
  surface: string | null;
  is_tournament_master: boolean;
  poster_url?: string | null;
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
const MASTER_POSTER_URL_CACHE = new Map<string, string | null>();

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
  const tagManager = (championship.description || '').match(/\[CHAMPION:(.+?)\]/)?.[1];

  useEffect(() => {
    if (tagManager || championship.status !== 'finished') return;

    const resolve = async () => {
      try {
        const [matchesRes, participantsRes] = await Promise.all([
          supabase.from('matches').select('*').eq('tournament_id', championship.id),
          supabase.from('tournament_participants').select('player_id, profiles(name)').eq('tournament_id', championship.id)
        ]);

        if (matchesRes.data) {
          const name = resolveChampionFromMatches(matchesRes.data, participantsRes.data || [], championship.description);
          if (name) setResolvedName(name);
        }
      } catch (e) {
        console.error('Error resolving champion:', e);
      }
    };
    resolve();
  }, [championship.id, championship.status, championship.description, tagManager]);

  const displayName = tagManager || resolvedName || 'Finalizado';

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
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
  const [selectedProofUri, setSelectedProofUri] = useState<string | null>(null);
  const [selectedProofMimeType, setSelectedProofMimeType] = useState<string | null>(null);
  const [isProofModalVisible, setIsProofModalVisible] = useState(false);

  const loadMasterData = useCallback(async () => {
    if (!masterTournamentId) return;

    setLoading(true);
    try {
      const { data: masterData, error: masterError } = await supabase
        .from('tournaments')
        .select('id, organization_id, name, status, start_date, registration_close_at, registration_close_time, address, comuna, surface, is_tournament_master, poster_url')
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
        const posterKey = String(masterRow.poster_url);
        const cachedPosterUrl = MASTER_POSTER_URL_CACHE.get(posterKey);
        if (cachedPosterUrl) {
          setPosterUrl(cachedPosterUrl);
        } else {
          const resolvedPosterUrl = await resolveStorageAssetUrlWithRetry(masterRow.poster_url);
          if (resolvedPosterUrl) {
            MASTER_POSTER_URL_CACHE.set(posterKey, resolvedPosterUrl);
            setPosterUrl(resolvedPosterUrl);
          } else {
            setPosterUrl(null);
          }
        }
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

  const openProofModal = (championship: Championship) => {
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
      Alert.alert('Permiso requerido', 'Debes permitir acceso a tu galeria para adjuntar el comprobante.');
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
      });

      Alert.alert('Solicitud enviada', 'Tu comprobante fue enviado al admin. Quedaste pendiente de revision.');
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
      const isOpen = isMasterOpen;

      let canRequest = true;
      let requestButtonText = 'Inscribirse';
      let helperText: string | null = null;

      if (!isOpen) {
        canRequest = false;
        requestButtonText = 'No disponible';
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
            onPress={() =>
              router.push({
                pathname: '/(tabs)/tournaments',
                params: { orgId: masterTournament.organization_id },
              })
            }
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {posterUrl && (
          <View style={styles.posterContainer}>
            <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
          </View>
        )}

        <View style={styles.masterInfoCard}>
          <Text style={styles.masterInfoText}>
            {masterTournament.start_date
              ? `Inicio: ${new Date(masterTournament.start_date).toLocaleDateString('es-ES')}`
              : 'Inicio por confirmar'}
          </Text>
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
          <Text style={styles.masterInfoStatus}>{formatStatus(masterTournament.status)}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Campeonatos disponibles</Text>
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
                const championName = (championship.description || '').match(/\[CHAMPION:(.+?)\]/)?.[1];
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
              <TouchableOpacity
                style={[styles.detailsButton, !canViewBracket && styles.requestButtonDisabled]}
                onPress={() => {
                  if (!canViewBracket) {
                    Alert.alert('Acceso restringido', 'Debes tener la inscripcion aprobada para ver el cuadro.');
                    return;
                  }
                  router.push(`/(tabs)/tournaments/${championship.id}`);
                }}
              >
                <Text style={styles.detailsButtonText}>{canViewBracket ? 'Ver cuadro' : 'Sin acceso'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {championships.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="tennisball-outline" size={44} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Este torneo aun no tiene campeonatos configurados.</Text>
          </View>
        )}
      </ScrollView>

      <RegistrationProofModal
        visible={isProofModalVisible}
        tournamentName={selectedChampionship?.name}
        selectedImageUri={selectedProofUri}
        submitting={submitting}
        onClose={closeProofModal}
        onPickImage={handlePickProof}
        onSubmit={handleSubmitRequest}
      />
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
    height: 240,
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
});
