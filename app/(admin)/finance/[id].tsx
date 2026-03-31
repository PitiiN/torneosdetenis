import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackHandler } from 'react-native';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { resolveStorageAssetUrl } from '@/services/storage';
import { AdminQuickActionsBar } from '@/components/navigation/AdminQuickActionsBar';
import { notifyTournamentUsers } from '@/services/pushNotifications';

type Registration = {
  id: string;
  player_id: string;
  fee_amount: number;
  is_paid: boolean;
  player_name: string | null;
};

type RegistrationRequest = {
  id: string;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  proof_path: string;
  created_at: string;
  updated_at: string;
  player_name: string | null;
  proof_signed_url: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestStatusLabel = (status: RegistrationRequest['status']) => {
  if (status === 'approved') return 'APROBADA';
  if (status === 'rejected') return 'RECHAZADA';
  return 'PENDIENTE';
};

export default function TournamentFinanceDetail() {
  const { id } = useLocalSearchParams();
  const tournamentId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [savingRegistration, setSavingRegistration] = useState<string | null>(null);
  const [savingRequest, setSavingRequest] = useState<string | null>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);

  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedProofUrl, setExpandedProofUrl] = useState<string | null>(null);

  const navigateBack = useCallback(() => {
    router.replace('/(tabs)/finance');
  }, [router]);

  useEffect(() => {
    if (tournamentId) {
      loadTournamentFinance();
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigateBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigateBack, tournamentId]);

  const loadTournamentFinance = async () => {
    setLoading(true);
    try {
      const access = await getCurrentUserAccessContext();
      if (!access) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id, name, organization_id, status, registration_fee')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      if (!canManageOrganization(access, tournamentData.organization_id)) {
        router.replace('/(tabs)/finance');
        return;
      }
      setTournament(tournamentData);

      const { data: registrationRows, error: registrationError } = await supabase
        .from('registrations')
        .select('id, player_id, fee_amount, is_paid')
        .eq('tournament_id', tournamentId);

      if (registrationError) throw registrationError;

      const { data: requestRows, error: requestError } = await supabase
        .from('tournament_registration_requests')
        .select('id, player_id, status, rejection_reason, proof_path, created_at, updated_at')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false });

      if (requestError) throw requestError;

      const playerIds = [...new Set(
        [...(registrationRows || []), ...(requestRows || [])]
          .map((row: any) => String(row?.player_id || ''))
          .filter((playerId) => UUID_PATTERN.test(playerId))
      )];

      let playerNamesById: Record<string, string> = {};
      if (playerIds.length > 0) {
        const { data: playerRows, error: playersError } = await supabase
          .from('public_profiles')
          .select('id, name')
          .in('id', playerIds);

        if (playersError) throw playersError;
        playerNamesById = (playerRows || []).reduce((acc: Record<string, string>, player: any) => {
          acc[player.id] = player.name || 'Jugador';
          return acc;
        }, {});
      }

      const proofPaths = [...new Set(
        (requestRows || [])
          .map((request: any) => String(request?.proof_path || '').trim())
          .filter(Boolean)
      )];
      const signedProofByPath = new Map<string, string | null>();
      await Promise.all(
        proofPaths.map(async (proofPath) => {
          const signedUrl = await resolveStorageAssetUrl(proofPath, 300);
          signedProofByPath.set(proofPath, signedUrl || null);
        })
      );

      setRegistrations(
        (registrationRows || []).map((registration: any) => ({
          ...registration,
          player_name: playerNamesById[registration.player_id] || null,
        }))
      );

      setRequests(
        (requestRows || []).map((request: any) => ({
          ...request,
          player_name: playerNamesById[request.player_id] || null,
          proof_signed_url: signedProofByPath.get(String(request.proof_path || '').trim()) || null,
        }))
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar la informacion financiera.');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    return registrations.reduce((acc, registration) => {
      const amount = registration.fee_amount || 0;
      if (registration.is_paid) {
        acc.income += amount;
      } else {
        acc.debt += amount;
      }
      return acc;
    }, { income: 0, debt: 0 });
  }, [registrations]);

  const handleUpdateRegistration = async (registrationId: string, updates: Partial<Registration>) => {
    setSavingRegistration(registrationId);
    try {
      const { error } = await supabase
        .from('registrations')
        .update(updates)
        .eq('id', registrationId);

      if (error) throw error;

      setRegistrations((current) =>
        current.map((registration) =>
          registration.id === registrationId ? { ...registration, ...updates } : registration
        )
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el registro.');
    } finally {
      setSavingRegistration(null);
    }
  };

  const handleRequestDecision = async (request: RegistrationRequest, status: 'approved' | 'rejected', reason?: string) => {
    if (status === 'rejected' && (!reason || reason.trim().length < 3)) {
      Alert.alert('Motivo requerido', 'Debes ingresar un motivo de rechazo de al menos 3 caracteres.');
      return;
    }

    setSavingRequest(request.id);
    try {
      const payload = status === 'approved'
        ? { status: 'approved', rejection_reason: null }
        : { status: 'rejected', rejection_reason: reason?.trim() || null };

      const { error } = await supabase
        .from('tournament_registration_requests')
        .update(payload)
        .eq('id', request.id);

      if (error) throw error;

      // Limpieza post-revision: el comprobante ya no se necesita almacenado.
      if (request.proof_path) {
        await supabase.storage
          .from('organizations')
          .remove([request.proof_path]);
      }

      // La solicitud deja de existir una vez revisada (aprobada o rechazada).
      const { error: deleteRequestError } = await supabase
        .from('tournament_registration_requests')
        .delete()
        .eq('id', request.id);

      if (deleteRequestError) throw deleteRequestError;

      if (status === 'approved') {
        const playerId = String(request.player_id || '').trim();
        if (UUID_PATTERN.test(playerId) && tournamentId) {
          await notifyTournamentUsers({
            tournamentId: String(tournamentId),
            userIds: [playerId],
            type: 'registration_approved',
            title: 'Inscripcion aprobada',
            body: `Tu inscripcion a ${tournament?.name || 'este torneo'} fue aprobada.`,
          });
        }
      }

      setRejectTarget(null);
      setRejectReason('');
      await loadTournamentFinance();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la solicitud.');
    } finally {
      setSavingRequest(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <TennisSpinner size={34} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title} numberOfLines={1}>{tournament?.name}</Text>
          <Text style={styles.subtitle}>Finanzas y Solicitudes</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Ingresos Reales</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>${totals.income}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Deuda Pendiente</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>${totals.debt}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Solicitudes de Inscripcion</Text>
            <View style={styles.requestList}>
              {requests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName}>{request.player_name || 'Jugador'}</Text>
                      <Text style={styles.requestDate}>{new Date(request.created_at).toLocaleString()}</Text>
                    </View>
                    <View style={[
                      styles.requestStatusBadge,
                      request.status === 'approved'
                        ? styles.requestStatusApproved
                        : request.status === 'rejected'
                          ? styles.requestStatusRejected
                          : styles.requestStatusPending,
                    ]}>
                      <Text style={styles.requestStatusText}>{requestStatusLabel(request.status)}</Text>
                    </View>
                  </View>

                  {request.proof_signed_url ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.proofPreviewCard}
                      onPress={() => setExpandedProofUrl(request.proof_signed_url)}
                    >
                      <Image source={{ uri: request.proof_signed_url }} style={styles.proofImage} />
                      <Text style={styles.proofHintText}>Tocar para ampliar</Text>
                    </TouchableOpacity>
                  ) : (
                    request.status === 'pending' ? (
                      <View style={styles.noProofRow}>
                        <Ionicons name="warning-outline" size={16} color={colors.error} />
                        <Text style={styles.noProofText}>No se pudo cargar el comprobante.</Text>
                      </View>
                    ) : (
                      <View style={styles.archivedProofRow}>
                        <Ionicons name="archive-outline" size={14} color={colors.textTertiary} />
                        <Text style={styles.archivedProofText}>Comprobante archivado tras revisión.</Text>
                      </View>
                    )
                  )}

                  {request.status === 'rejected' && request.rejection_reason && (
                    <Text style={styles.rejectReasonText}>Motivo: {request.rejection_reason}</Text>
                  )}

                  {request.status === 'pending' && (
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.requestActionButton, styles.requestRejectButton]}
                        onPress={() => {
                          setRejectTarget(request);
                          setRejectReason('');
                        }}
                        disabled={savingRequest === request.id}
                      >
                        <Text style={styles.requestActionText}>Rechazar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.requestActionButton, styles.requestApproveButton]}
                        onPress={() => handleRequestDecision(request, 'approved')}
                        disabled={savingRequest === request.id}
                      >
                        <Text style={styles.requestActionText}>
                          {savingRequest === request.id ? '...' : 'Aprobar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {request.status === 'approved' && (
                    <Text style={styles.approvedHint}>Inscripcion aplicada automaticamente en el campeonato.</Text>
                  )}
                </View>
              ))}

              {requests.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="mail-outline" size={42} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>No hay solicitudes de inscripcion para este torneo.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inscripciones Confirmadas</Text>
            <View style={styles.playersList}>
              {registrations.map((registration) => (
                <View key={registration.id} style={styles.playerCard}>
                  <View style={styles.playerHeader}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{registration.player_name || 'Jugador'}</Text>
                      <View style={[styles.paidBadge, registration.is_paid ? styles.paidBadgeActive : styles.unpaidBadge]}>
                        <Text
                          style={[
                            styles.paidBadgeText,
                            { color: registration.is_paid ? colors.success : colors.error },
                          ]}
                        >
                          {registration.is_paid ? 'PAGADO' : 'NO PAGADO'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentToggleGroup}>
                      <TouchableOpacity
                        style={[
                          styles.paymentToggleButton,
                          styles.paymentTogglePaid,
                          registration.is_paid && styles.paymentTogglePaidActive,
                          savingRegistration === registration.id && styles.paymentToggleDisabled,
                        ]}
                        onPress={() => handleUpdateRegistration(registration.id, { is_paid: true })}
                        disabled={savingRegistration === registration.id}
                      >
                        <Text
                          style={[
                            styles.paymentToggleText,
                            registration.is_paid && styles.paymentToggleTextActive,
                          ]}
                        >
                          Pagado
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.paymentToggleButton,
                          styles.paymentToggleUnpaid,
                          !registration.is_paid && styles.paymentToggleUnpaidActive,
                          savingRegistration === registration.id && styles.paymentToggleDisabled,
                        ]}
                        onPress={() => handleUpdateRegistration(registration.id, { is_paid: false })}
                        disabled={savingRegistration === registration.id}
                      >
                        <Text
                          style={[
                            styles.paymentToggleText,
                            !registration.is_paid && styles.paymentToggleTextActive,
                          ]}
                        >
                          No Pagado
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Valor Inscripcion:</Text>
                    <View style={styles.feeInputWrapper}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.feeInput}
                        value={String(registration.fee_amount || 0)}
                        keyboardType="numeric"
                        onChangeText={(value) => {
                          const feeAmount = Number(value) || 0;
                          setRegistrations((current) =>
                            current.map((item) => item.id === registration.id ? { ...item, fee_amount: feeAmount } : item)
                          );
                        }}
                        onBlur={() => handleUpdateRegistration(registration.id, { fee_amount: registration.fee_amount })}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {registrations.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={42} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>No hay jugadores inscritos en este torneo.</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AdminQuickActionsBar active="finance" organizationId={tournament?.organization_id || null} />

      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rechazar solicitud</Text>
            <Text style={styles.modalSubtitle}>Jugador: {rejectTarget?.player_name || 'Jugador'}</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Motivo del rechazo"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={250}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
                disabled={!!savingRequest}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnReject]}
                onPress={() => rejectTarget && handleRequestDecision(rejectTarget, 'rejected', rejectReason)}
                disabled={!!savingRequest}
              >
                <Text style={styles.modalBtnRejectText}>{savingRequest ? '...' : 'Rechazar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!expandedProofUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedProofUrl(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseButton}
            onPress={() => setExpandedProofUrl(null)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.previewBackdrop}
            activeOpacity={1}
            onPress={() => setExpandedProofUrl(null)}
          >
            {expandedProofUrl ? (
              <Image
                source={{ uri: expandedProofUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTextContainer: {
      flex: 1,
      paddingHorizontal: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.primary[500],
      fontWeight: '700',
    },
    content: {
      padding: spacing.xl,
      paddingBottom: 120,
      gap: spacing.xl,
    },
    summaryGrid: {
      gap: spacing.md,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '900',
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    requestList: {
      gap: spacing.sm,
    },
    requestCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    requestHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    requestDate: {
      color: colors.textTertiary,
      fontSize: 11,
      marginTop: 2,
    },
    requestStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
    },
    requestStatusPending: {
      backgroundColor: '#fef3c7',
    },
    requestStatusApproved: {
      backgroundColor: colors.success + '20',
    },
    requestStatusRejected: {
      backgroundColor: colors.error + '20',
    },
    requestStatusText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '900',
    },
    proofPreviewCard: {
      gap: 6,
      alignSelf: 'flex-start',
    },
    proofImage: {
      width: 132,
      height: 132,
      borderRadius: borderRadius.lg,
      resizeMode: 'cover',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    proofHintText: {
      color: colors.textTertiary,
      fontSize: 10,
      fontWeight: '700',
    },
    noProofRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    noProofText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '600',
    },
    archivedProofRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    archivedProofText: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: '600',
    },
    rejectReasonText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    requestActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    requestActionButton: {
      flex: 1,
      height: 42,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestRejectButton: {
      backgroundColor: colors.error + '20',
      borderWidth: 1,
      borderColor: colors.error,
    },
    requestApproveButton: {
      backgroundColor: colors.success + '20',
      borderWidth: 1,
      borderColor: colors.success,
    },
    requestActionText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    approvedHint: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '700',
    },
    playersList: {
      gap: spacing.xs,
    },
    playerCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    playerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    playerInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    playerName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    paidBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
    },
    paidBadgeActive: {
      backgroundColor: colors.success + '15',
    },
    unpaidBadge: {
      backgroundColor: colors.error + '15',
    },
    paidBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      color: colors.success,
    },
    paymentToggleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    paymentToggleButton: {
      height: 30,
      minWidth: 76,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
    },
    paymentTogglePaid: {
      borderColor: colors.success,
    },
    paymentToggleUnpaid: {
      borderColor: colors.error,
    },
    paymentTogglePaidActive: {
      backgroundColor: colors.success + '20',
    },
    paymentToggleUnpaidActive: {
      backgroundColor: colors.error + '20',
    },
    paymentToggleText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    paymentToggleTextActive: {
      color: colors.text,
    },
    paymentToggleDisabled: {
      opacity: 0.7,
    },
    feeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xs,
      borderTopWidth: 0,
      borderTopColor: colors.border,
    },
    feeLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    feeInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
    },
    currencySymbol: {
      color: colors.textTertiary,
      fontSize: 14,
      fontWeight: '700',
    },
    feeInput: {
      color: colors.text,
      paddingHorizontal: spacing.xs,
      paddingVertical: 5,
      fontSize: 12,
      fontWeight: '800',
      width: 70,
      textAlign: 'right',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textTertiary,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      gap: spacing.md,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    modalSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    modalInput: {
      minHeight: 90,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.text,
      padding: spacing.md,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    modalBtn: {
      flex: 1,
      height: 44,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnCancel: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalBtnReject: {
      backgroundColor: colors.error,
    },
    modalBtnCancelText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
      textAlign: 'center',
    },
    modalBtnRejectText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 13,
      textAlign: 'center',
    },
    previewOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
    },
    previewBackdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    previewImage: {
      width: '100%',
      height: '82%',
    },
    previewCloseButton: {
      alignSelf: 'flex-end',
      marginTop: spacing.xl,
      marginRight: spacing.lg,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
  });
}
