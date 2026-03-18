import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing } from '@/theme';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const pad = (value: number) => String(value).padStart(2, '0');

const parseIsoDate = (value?: string | null) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const formatDisplayDate = (value?: string | null) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
};

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const DateField = ({ label, value, onChange }: DateFieldProps) => {
  const initialDate = useMemo(() => parseIsoDate(value), [value]);
  const [visible, setVisible] = useState(false);
  const [cursor, setCursor] = useState(initialDate);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const adjustedStart = (startDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = Array.from({ length: adjustedStart }, () => null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const open = () => {
    setCursor(parseIsoDate(value));
    setVisible(true);
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={open}>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, !value && styles.placeholder]}>
            {value ? formatDisplayDate(value) : 'Seleccionar fecha'}
          </Text>
        </View>
        <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
              </Text>
              <TouchableOpacity onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {[
                { key: 'lu', label: 'L' },
                { key: 'ma', label: 'M' },
                { key: 'mi', label: 'M' },
                { key: 'ju', label: 'J' },
                { key: 'vi', label: 'V' },
                { key: 'sa', label: 'S' },
                { key: 'do', label: 'D' },
              ].map(day => (
                <Text key={day.key} style={styles.weekDay}>
                  {day.label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {days.map((day, index) => {
                const selectedIso = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(day || 1)}`;
                const isSelected = !!day && selectedIso === value;

                return (
                  <TouchableOpacity
                    key={`${index}-${day}`}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected, !day && styles.dayCellEmpty]}
                    disabled={!day}
                    onPress={() => {
                      onChange(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(day || 1)}`);
                      setVisible(false);
                    }}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day || ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontWeight: '700',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  dayCellEmpty: {
    opacity: 0,
  },
  dayCellSelected: {
    backgroundColor: colors.primary[500],
  },
  dayText: {
    color: colors.text,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#fff',
  },
  closeButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  closeText: {
    color: colors.primary[500],
    fontWeight: '700',
  },
});
