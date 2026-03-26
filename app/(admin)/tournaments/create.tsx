import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { DateField } from '@/components/DateField';
import { CHILEAN_COMUNAS, TOURNAMENT_SURFACES, TOURNAMENT_SET_TYPES } from '@/constants/tournamentOptions';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';

const STATUS_OPTIONS = ['Publicado', 'No Publicado'];
const STATUS_MAP: Record<string, string> = {
  Publicado: 'open',
  'No Publicado': 'draft',
};
const MASTER_FALLBACK_LEVEL = 'Escalafón';
const MASTER_FALLBACK_MODALITY = 'singles';
const MASTER_FALLBACK_FORMAT = 'Eliminacion Directa';
const MASTER_FALLBACK_SET_TYPE = TOURNAMENT_SET_TYPES[0] || 'Mejor de 3 Sets';

export default function CreateTournamentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orgId } = useLocalSearchParams<{ orgId: string | string[] }>();
  const routeOrgId = Array.isArray(orgId) ? orgId[0] : orgId;
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [activeOrgId, setActiveOrgId] = useState<string | null>(routeOrgId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [address, setAddress] = useState('');
  const [comuna, setComuna] = useState('');
  const [surface, setSurface] = useState(TOURNAMENT_SURFACES[0]);
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);

  const [showComunaModal, setShowComunaModal] = useState(false);
  const [showSurfaceModal, setShowSurfaceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const access = await getCurrentUserAccessContext();
      if (!access) {
        router.replace('/(auth)/login');
        return;
      }

      let resolvedOrgId = routeOrgId || null;
      if (!resolvedOrgId && !access.isSuperAdmin && access.profile.org_id) {
        resolvedOrgId = access.profile.org_id;
      }

      if (!resolvedOrgId) {
        router.replace('/(tabs)/tournaments');
        return;
      }

      setActiveOrgId(resolvedOrgId);
      if (!canManageOrganization(access, resolvedOrgId)) {
        router.replace('/(tabs)/tournaments');
      }
    };

    checkAccess();
  }, [routeOrgId, router]);

  const handleCreateMasterTournament = async () => {
    if (!activeOrgId) {
      Alert.alert('Error', 'No se encontro la organizacion activa.');
      return;
    }

    if (!name.trim() || !startDate || !endDate || !address.trim() || !comuna) {
      Alert.alert('Error', 'Debes completar todos los campos obligatorios.');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Error', 'La fecha de termino no puede ser menor a la fecha de inicio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const access = await getCurrentUserAccessContext();
      if (!access || !canManageOrganization(access, activeOrgId)) {
        Alert.alert('Error', 'No tienes permisos para crear torneos en esta organizacion.');
        return;
      }

      const { data: createdTournament, error } = await supabase
        .from('tournaments')
        .insert({
          organization_id: activeOrgId,
          parent_tournament_id: null,
          is_tournament_master: true,
          name: name.trim(),
          status: STATUS_MAP[status] || 'open',
          start_date: startDate,
          end_date: endDate,
          address: address.trim(),
          comuna,
          surface,
          // Backward-compatible placeholders for schemas where these fields are NOT NULL.
          level: MASTER_FALLBACK_LEVEL,
          modality: MASTER_FALLBACK_MODALITY,
          format: MASTER_FALLBACK_FORMAT,
          set_type: MASTER_FALLBACK_SET_TYPE,
          max_players: 2,
          registration_fee: 0,
          description: 'Torneo completo principal',
        })
        .select('id')
        .single();

      if (error) throw error;

      Alert.alert('Exito', 'Torneo completo creado. Ahora agrega los campeonatos por categoria y modalidad.');
      router.replace(`/(admin)/tournaments/master/${createdTournament.id}`);
    } catch (error: any) {
      const detail = String(error?.message || '').trim();
      Alert.alert(
        'Error',
        detail
          ? `No se pudo crear el torneo completo. ${detail}`
          : 'No se pudo crear el torneo completo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(tabs)/tournaments', params: { orgId: activeOrgId || '' } })}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo Torneo Completo</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Ej. Torneo Marzo Chile Open"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <DateField label="Fecha de Inicio" value={startDate} onChange={setStartDate} />
          <DateField label="Fecha de Termino" value={endDate} onChange={setEndDate} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Direccion</Text>
            <TextInput
              style={styles.textInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Ej. Avenida Principal 123"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Comuna</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowComunaModal(true)}>
              <Text style={styles.dropdownText}>{comuna || 'Seleccionar comuna'}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Superficie</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowSurfaceModal(true)}>
              <Text style={styles.dropdownText}>{surface}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Estado Inicial</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowStatusModal(true)}>
              <Text style={styles.dropdownText}>{status}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          disabled={isSubmitting}
          onPress={handleCreateMasterTournament}
        >
          {isSubmitting ? (
            <TennisSpinner size={18} color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.submitButtonText}>Crear Torneo Completo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <SelectionModal
        visible={showComunaModal}
        title="Seleccionar Comuna"
        options={CHILEAN_COMUNAS}
        onSelect={(value: string) => {
          setComuna(value);
          setShowComunaModal(false);
        }}
        onClose={() => setShowComunaModal(false)}
      />
      <SelectionModal
        visible={showSurfaceModal}
        title="Seleccionar Superficie"
        options={TOURNAMENT_SURFACES}
        onSelect={(value: string) => {
          setSurface(value);
          setShowSurfaceModal(false);
        }}
        onClose={() => setShowSurfaceModal(false)}
      />
      <SelectionModal
        visible={showStatusModal}
        title="Estado Inicial"
        options={STATUS_OPTIONS}
        onSelect={(value: string) => {
          setStatus(value);
          setShowStatusModal(false);
        }}
        onClose={() => setShowStatusModal(false)}
      />
    </View>
  );
}

function SelectionModal({ visible, title, options, onSelect, onClose }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView>
            {options.map((option: string) => (
              <TouchableOpacity key={option} style={styles.modalOption} onPress={() => onSelect(option)}>
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancelar</Text>
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
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerContent: {
    height: 58,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 120,
  },
  formCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  textInput: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdown: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  submitButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  modalOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalClose: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  modalCloseText: {
    color: colors.primary[500],
    fontSize: 14,
    fontWeight: '700',
  },
});
