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
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { TennisSpinner } from '@/components/TennisSpinner';

interface EditScoreModalProps {
  visible: boolean;
  playerALabel: string;
  playerBLabel: string;
  setsToShow: number;
  initialScores: { s1: string; s2: string }[];
  saving: boolean;
  onSave: (score: string, isLive: boolean) => void;
  onClose: () => void;
}

interface LocalSetScore {
  s1: string;
  s2: string;
  hasTb?: boolean;
  tb1?: string;
  tb2?: string;
}

/**
 * Isolated modal component for editing match scores.
 * 
 * Extracted from the main tournament detail screen to prevent
 * the massive parent component (~6500 lines, 50+ useState hooks)
 * from re-rendering on every keystroke in the TextInput fields.
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
  const [localScores, setLocalScores] = useState<LocalSetScore[]>([]);
  const scoreInputRefs = useRef<Array<TextInput | null>>([]);

  // Sync initial scores when modal opens or match changes
  useEffect(() => {
    if (visible) {
      setLocalScores(initialScores.map(s => {
        let s1Val = s.s1 || '';
        let s2Val = s.s2 || '';
        let hasTb = false;
        let tb1Val = '';
        let tb2Val = '';

        // Extract tiebreak values: e.g. "6(7/5)" or "7(7/5)" or "6(7:5)"
        const tbMatch1 = s1Val.match(/\(([^)]+)\)/);
        if (tbMatch1) {
          hasTb = true;
          const parts = tbMatch1[1].split(/[\/:]/);
          tb1Val = parts[0] || '';
          tb2Val = parts[1] || '';
          s1Val = s1Val.replace(/\([^)]+\)/, '');
        }

        const tbMatch2 = s2Val.match(/\(([^)]+)\)/);
        if (tbMatch2) {
          hasTb = true;
          const parts = tbMatch2[1].split(/[\/:]/);
          tb1Val = parts[0] || '';
          tb2Val = parts[1] || '';
          s2Val = s2Val.replace(/\([^)]+\)/, '');
        }

        return { s1: s1Val, s2: s2Val, hasTb, tb1: tb1Val, tb2: tb2Val };
      }));
    }
  }, [visible, initialScores]);

  const handleSave = useCallback((isLive: boolean) => {
    const finalScore = localScores
      .filter(set => set.s1 !== '' || set.s2 !== '')
      .map(set => {
        let scoreStr = `${set.s1}-${set.s2}`;
        if (set.hasTb && (set.tb1 || set.tb2)) {
          scoreStr += `(${set.tb1 || '0'}/${set.tb2 || '0'})`;
        }
        return scoreStr;
      })
      .join(', ');
    onSave(finalScore, isLive);
  }, [localScores, onSave]);

  const handleScoreChange = useCallback((idx: number, field: keyof LocalSetScore, val: string) => {
    setLocalScores(prev => {
      const newSets = [...prev];
      newSets[idx] = { ...newSets[idx], [field]: val } as LocalSetScore;
      return newSets;
    });

    if (val) {
      let nextRefIndex = -1;
      if (field === 's1') {
        nextRefIndex = (idx * 4) + 1; // Focus s2
      } else if (field === 's2') {
        const hasTb = localScores[idx]?.hasTb;
        if (hasTb) {
          nextRefIndex = (idx * 4) + 2; // Focus tb1
        } else {
          nextRefIndex = ((idx + 1) * 4); // Focus next set's s1
        }
      } else if (field === 'tb1') {
        nextRefIndex = (idx * 4) + 3; // Focus tb2
      } else if (field === 'tb2') {
        nextRefIndex = ((idx + 1) * 4); // Focus next set's s1
      }

      if (nextRefIndex !== -1 && scoreInputRefs.current[nextRefIndex]) {
        scoreInputRefs.current[nextRefIndex]?.focus();
      }
    }
  }, [localScores]);

  const handleToggleTb = useCallback((idx: number) => {
    setLocalScores(prev => {
      const newSets = [...prev];
      const hasTb = !newSets[idx].hasTb;
      newSets[idx] = {
        ...newSets[idx],
        hasTb,
        tb1: hasTb ? newSets[idx].tb1 || '' : '',
        tb2: hasTb ? newSets[idx].tb2 || '' : '',
      };
      return newSets;
    });
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
                  <View style={{ flexDirection: 'row', paddingLeft: 60, alignItems: 'center' }}>
                    <Text style={{ width: 48, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
                      {playerALabel}
                    </Text>
                    <View style={{ width: 20 }} />
                    <Text style={{ width: 48, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
                      {playerBLabel}
                    </Text>
                    <Text style={{ width: 50, marginLeft: spacing.sm + 4, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                      Tiebreak
                    </Text>
                  </View>

                  {localScores.map((set, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '700', width: 44 }}>Set {idx + 1}</Text>
                      
                      <TextInput
                        style={[styles.scoreInput, { width: 48, color: colors.text, textAlign: 'center', paddingHorizontal: 0 }]}
                        keyboardType="number-pad"
                        maxLength={2}
                        value={set.s1}
                        ref={ref => { scoreInputRefs.current[idx * 4] = ref; }}
                        onChangeText={(val) => handleScoreChange(idx, 's1', val)}
                      />
                      
                      <Text style={{ color: colors.textTertiary, width: 12, textAlign: 'center' }}>-</Text>
                      
                      <TextInput
                        style={[styles.scoreInput, { width: 48, color: colors.text, textAlign: 'center', paddingHorizontal: 0 }]}
                        keyboardType="number-pad"
                        maxLength={2}
                        value={set.s2}
                        ref={ref => { scoreInputRefs.current[(idx * 4) + 1] = ref; }}
                        onChangeText={(val) => handleScoreChange(idx, 's2', val)}
                      />

                      {/* Checkbox for Tiebreak */}
                      <TouchableOpacity
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: set.hasTb ? colors.primary[500] : colors.background,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginLeft: spacing.sm,
                        }}
                        onPress={() => handleToggleTb(idx)}
                      >
                        {set.hasTb && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </TouchableOpacity>

                      {/* Optional Tiebreak Inputs */}
                      <View style={{ width: 84, marginLeft: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {set.hasTb && (
                          <>
                            <TextInput
                              style={[styles.scoreInput, { width: 36, height: 36, fontSize: 13, color: colors.text, textAlign: 'center', paddingHorizontal: 0 }]}
                              keyboardType="number-pad"
                              maxLength={2}
                              value={set.tb1}
                              placeholder="7"
                              placeholderTextColor={colors.textTertiary}
                              ref={ref => { scoreInputRefs.current[(idx * 4) + 2] = ref; }}
                              onChangeText={(val) => handleScoreChange(idx, 'tb1', val)}
                            />
                            <Text style={{ color: colors.textTertiary, fontSize: 10 }}>/</Text>
                            <TextInput
                              style={[styles.scoreInput, { width: 36, height: 36, fontSize: 13, color: colors.text, textAlign: 'center', paddingHorizontal: 0 }]}
                              keyboardType="number-pad"
                              maxLength={2}
                              value={set.tb2}
                              placeholder="5"
                              placeholderTextColor={colors.textTertiary}
                              ref={ref => { scoreInputRefs.current[(idx * 4) + 3] = ref; }}
                              onChangeText={(val) => handleScoreChange(idx, 'tb2', val)}
                            />
                          </>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={onClose}>
                      <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalBtn, { backgroundColor: colors.info || '#3b82f6' }]} 
                      onPress={() => handleSave(true)} 
                      disabled={saving}
                    >
                      {saving ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar Parcial</Text>}
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity 
                    style={[styles.modalBtnFull, styles.modalBtnSave]} 
                    onPress={() => handleSave(false)} 
                    disabled={saving}
                  >
                    {saving ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar Resultado Final</Text>}
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
  modalBtnFull: {
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
