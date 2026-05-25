import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useTheme, spacing, borderRadius } from '@/theme';
import { TennisSpinner } from '@/components/TennisSpinner';

interface EditScoreModalProps {
  visible: boolean;
  playerALabel: string;
  playerBLabel: string;
  setsToShow: number;
  initialScores: { s1: string; s2: string }[];
  saving: boolean;
  onSave: (score: string) => void;
  onClose: () => void;
}

/**
 * Isolated modal component for editing match scores.
 * 
 * Extracted from the main tournament detail screen to prevent
 * the massive parent component (~6500 lines, 50+ useState hooks)
 * from re-rendering on every keystroke in the TextInput fields.
 * 
 * This was causing iOS devices to freeze when the numeric keyboard
 * appeared because each keystroke triggered a full re-render of
 * the parent, blocking the UI thread.
 */
export const EditScoreModal = React.memo(({
  visible,
  playerALabel,
  playerBLabel,
  setsToShow,
  initialScores,
  saving,
  onSave,
  onClose,
}: EditScoreModalProps) => {
  const { colors } = useTheme();
  const [localScores, setLocalScores] = useState<{ s1: string; s2: string }[]>([]);
  const scoreInputRefs = useRef<Array<TextInput | null>>([]);

  // Sync initial scores when modal opens or match changes
  useEffect(() => {
    if (visible) {
      setLocalScores(initialScores.map(s => ({ ...s })));
    }
  }, [visible, initialScores]);

  const handleSave = useCallback(() => {
    const finalScore = localScores
      .filter(set => set.s1 !== '' || set.s2 !== '')
      .map(set => `${set.s1}-${set.s2}`)
      .join(', ');
    onSave(finalScore);
  }, [localScores, onSave]);

  const handleScoreChange = useCallback((idx: number, field: 's1' | 's2', val: string) => {
    setLocalScores(prev => {
      const newSets = [...prev];
      newSets[idx] = { ...newSets[idx], [field]: val };
      return newSets;
    });

    if (val) {
      const nextRefIndex = field === 's1' ? (idx * 2) + 1 : (idx * 2) + 2;
      if (scoreInputRefs.current[nextRefIndex]) {
        scoreInputRefs.current[nextRefIndex]?.focus();
      }
    }
  }, []);

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
                <Text style={styles.modalTitle}>Editar Resultado</Text>
                <Text style={styles.modalSubtitle}>
                  {playerALabel} vs {playerBLabel}
                </Text>

                <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                  {/* Column Headers */}
                  <View style={{ flexDirection: 'row', paddingLeft: 60, gap: spacing.md, marginBottom: -spacing.sm }}>
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
                      {playerALabel}
                    </Text>
                    <View style={{ width: 10 }} />
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
                      {playerBLabel}
                    </Text>
                  </View>

                  {localScores.map((set, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '700', width: 44 }}>Set {idx + 1}</Text>
                      <TextInput
                        style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                        keyboardType="number-pad"
                        maxLength={2}
                        value={set.s1}
                        ref={ref => { scoreInputRefs.current[idx * 2] = ref; }}
                        onChangeText={(val) => handleScoreChange(idx, 's1', val)}
                      />
                      <Text style={{ color: colors.textTertiary }}>-</Text>
                      <TextInput
                        style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                        keyboardType="number-pad"
                        maxLength={2}
                        value={set.s2}
                        ref={ref => { scoreInputRefs.current[(idx * 2) + 1] = ref; }}
                        onChangeText={(val) => handleScoreChange(idx, 's2', val)}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={onClose}>
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
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
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
