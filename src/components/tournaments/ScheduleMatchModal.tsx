import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { DateField } from '@/components/DateField';
import { TennisSpinner } from '@/components/TennisSpinner';

const COURT_OPTIONS = Array.from({ length: 20 }, (_current, index) => `Cancha ${index + 1}`);

interface ScheduleData {
  date: string;
  time: string;
  court: string;
}

interface ScheduleMatchModalProps {
  visible: boolean;
  initialData: ScheduleData;
  saving: boolean;
  onSave: (data: ScheduleData) => void;
  onClose: () => void;
}

/**
 * Isolated modal component for scheduling match date, time, and court.
 * 
 * Extracted from the main tournament detail screen to prevent
 * the massive parent component (~6500 lines, 50+ useState hooks)
 * from re-rendering on every keystroke in the TextInput fields.
 * 
 * This was causing iOS devices to freeze when the numeric keyboard
 * appeared because each keystroke triggered a full re-render of
 * the parent, blocking the UI thread.
 */
export const ScheduleMatchModal = React.memo(({
  visible,
  initialData,
  saving,
  onSave,
  onClose,
}: ScheduleMatchModalProps) => {
  const { colors } = useTheme();
  const [localData, setLocalData] = useState<ScheduleData>({ date: '', time: '', court: '' });
  const [isCourtPickerVisible, setIsCourtPickerVisible] = useState(false);

  // Sync initial data when modal opens
  useEffect(() => {
    if (visible) {
      setLocalData({ ...initialData });
      setIsCourtPickerVisible(false);
    }
  }, [visible, initialData]);

  const handleSave = useCallback(() => {
    onSave(localData);
  }, [localData, onSave]);

  const handleClose = useCallback(() => {
    setIsCourtPickerVisible(false);
    onClose();
  }, [onClose]);

  const styles = getStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Programar Partido</Text>
                <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                  <DateField
                    label="Fecha del partido"
                    value={localData.date}
                    onChange={(date) => setLocalData(prev => ({ ...prev, date }))}
                  />

                  <View>
                    <Text style={[styles.modalDividerText, { textAlign: 'left', marginBottom: 4 }]}>Hora (HHMM)</Text>
                    <TextInput
                      style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                      placeholder="Ej: 1830"
                      placeholderTextColor={colors.textTertiary}
                      value={localData.time}
                      onChangeText={(time) => setLocalData(prev => ({ ...prev, time: time.replace(/[^0-9]/g, '') }))}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={4}
                    />
                  </View>

                  <View>
                    <Text style={[styles.modalDividerText, { textAlign: 'left', marginBottom: 4 }]}>Cancha</Text>
                    <TouchableOpacity
                      style={[styles.scoreInput, { justifyContent: 'center' }]}
                      onPress={() => setIsCourtPickerVisible(current => !current)}
                    >
                      <Text style={{ color: localData.court ? colors.text : colors.textTertiary, fontSize: 15, fontWeight: '600' }}>
                        {localData.court || 'Seleccionar cancha'}
                      </Text>
                    </TouchableOpacity>
                    {isCourtPickerVisible && (
                      <ScrollView
                        style={{
                          maxHeight: 220,
                          marginTop: spacing.sm,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.surface,
                        }}
                        keyboardShouldPersistTaps="handled"
                      >
                        {COURT_OPTIONS.map((courtName) => (
                          <TouchableOpacity
                            key={courtName}
                            style={styles.courtItem}
                            onPress={() => {
                              setLocalData(prev => ({ ...prev, court: courtName }));
                              setIsCourtPickerVisible(false);
                            }}
                          >
                            <Text style={styles.courtItemText}>{courtName}</Text>
                            {localData.court === courtName && (
                              <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={handleClose}>
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSave} disabled={saving}>
                    {saving ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const getStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  modalDividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  scoreInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    height: 48,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    textAlign: 'center',
  },
  courtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  courtItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnSave: {
    backgroundColor: colors.primary[500],
  },
  modalBtnCancelText: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalBtnSaveText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
});
