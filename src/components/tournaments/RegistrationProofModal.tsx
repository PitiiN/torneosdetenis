import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, useTheme } from '@/theme';
import { TennisSpinner } from '@/components/TennisSpinner';

type RegistrationProofModalProps = {
  visible: boolean;
  tournamentName?: string;
  selectedImageUri: string | null;
  submitting: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onSubmit: () => void;
};

export function RegistrationProofModal({
  visible,
  tournamentName,
  selectedImageUri,
  submitting,
  onClose,
  onPickImage,
  onSubmit,
}: RegistrationProofModalProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Inscribirse</Text>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Adjunta una imagen del comprobante de pago para {tournamentName || 'este torneo'}.
          </Text>

          <TouchableOpacity style={styles.pickerCard} onPress={onPickImage} disabled={submitting}>
            {selectedImageUri ? (
              <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.emptyPicker}>
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                <Text style={styles.emptyPickerText}>Seleccionar comprobante</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, (!selectedImageUri || submitting) && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={!selectedImageUri || submitting}
          >
            {submitting ? (
              <TennisSpinner size={18} color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Enviar comprobante</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  pickerCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 180,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  emptyPicker: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyPickerText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
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
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});

