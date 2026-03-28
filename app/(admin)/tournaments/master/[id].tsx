import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { borderRadius, spacing, useTheme } from '@/theme';
import { supabase } from '@/services/supabase';
import { TOURNAMENT_CATEGORIES, TOURNAMENT_SET_TYPES } from '@/constants/tournamentOptions';
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
import { syncTournamentChampion } from '@/services/tournamentChampion';

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
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        .select('id, organization_id, name, status, start_date, end_date, registration_close_at, registration_close_time, address, comuna, surface, is_tournament_master')
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

      // Pro-actively sync championships that are finished but missing the champion tag
      for (const champ of championships) {
        if (champ.status === 'finished' && !(champ.description || '').includes('[CHAMPION:')) {
          syncTournamentChampion(champ.id, supabase).then(newChampName => {
            if (newChampName) {
              setChampionships(current => 
                current.map(c => c.id === champ.id 
                  ? { ...c, description: (c.description || '').includes('[CHAMPION:') 
                      ? c.description 
                      : `${c.description || ''} [CHAMPION:${newChampName}]`.trim() 
                  } 
                  : c
                )
              );
            }
          });
        }
      }
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
      const championshipName = `${category} ${getModalityLabel(modality)}`;

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

      Alert.alert('Exito', 'Campeonato creado correctamente.');
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.masterCard}>
          <Text style={styles.masterText}>Inicio: {formatDateDDMMYYYY(masterTournament.start_date)}</Text>
          <Text style={styles.masterText}>Termino: {formatDateDDMMYYYY(masterTournament.end_date)}</Text>
          <Text style={styles.masterText}>
            Cierre inscripciones: {formatRegistrationDeadline(masterTournament.registration_close_at, masterTournament.registration_close_time)}
          </Text>
          <Text style={styles.masterText}>
            {masterTournament.address || ''}{(masterTournament.address && masterTournament.comuna) ? ', ' : ''}{masterTournament.comuna || ''}
          </Text>
          <Text style={styles.masterText}>Superficie: {masterTournament.surface || 'Sin superficie'}</Text>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.createButtonText}>Crear campeonato</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Campeonatos</Text>
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
              <View style={styles.modalityChip}>
                <Text style={styles.modalityChipText}>{getModalityLabel(championship.modality)}</Text>
              </View>
            </View>
            <Text style={styles.championshipMeta}>Categoria: {championship.level || 'Sin categoria'}</Text>
            <Text style={styles.championshipMeta}>Valor de Inscripcion: ${Number(championship.registration_fee || 0)}</Text>
            <Text style={styles.championshipMeta}>Formato: {championship.format || 'Sin formato'}</Text>
            
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
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginBottom: 1 }}>
                      Campeón
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.text, fontWeight: '800' }}>
                      {championName || 'Finalizado'}
                    </Text>
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
            <Text style={styles.emptyText}>Aun no hay campeonatos creados.</Text>
          </View>
        )}
      </ScrollView>

      <AdminQuickActionsBar active="tournaments" organizationId={masterTournament.organization_id} />

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
                    onPress={() => setModality(currentModality)}
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
            options={TOURNAMENT_CATEGORIES}
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
  createButton: {
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
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
    backgroundColor: colors.primary[500] + '20',
  },
  modalityChipText: {
    color: colors.primary[500],
    fontSize: 10,
    fontWeight: '900',
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
  },
});
