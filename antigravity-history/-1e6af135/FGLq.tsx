import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomBar from '@/components/AdminBottomBar';
import { colors, spacing } from '@/theme';

export default function AdminTournamentsScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Gestión de Torneos</Text>
            </View>

            <View style={styles.content}>
                <Ionicons name="trophy-outline" size={80} color={colors.textTertiary} />
                <Text style={styles.subtitle}>Módulo de Torneos</Text>
                <Text style={styles.description}>
                    Próximamente podrás crear y gestionar torneos desde aquí. 😉
                </Text>
            </View>

            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    subtitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.xl },
    description: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 24 },
});
