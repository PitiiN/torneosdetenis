import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

export default function TournamentsScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Torneos y Ranking</Text>
            </View>
            <View style={styles.content}>
                <Ionicons name="construct-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.message}>En construcción...</Text>
                <Text style={styles.submessage}>
                    Próximamente podrás ver los cuadros de torneos, rankings de jugadores y registrar resultados de partidos.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing['2xl'],
        gap: spacing.lg,
    },
    message: { fontSize: 20, fontWeight: '700', color: colors.text },
    submessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
