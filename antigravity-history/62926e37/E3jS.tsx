import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import AdminBottomBar from '@/components/AdminBottomBar';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminConfigScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { profile } = useAuth();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Configuración</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.profileSection}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
                        </Text>
                    </View>
                    <Text style={styles.name}>{profile?.full_name}</Text>
                    <Text style={styles.email}>{profile?.email}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>ADMINISTRADOR</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Accesos</Text>
                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: colors.primary[500] + '20' }]}>
                            <Ionicons name="eye" size={20} color={colors.primary[500]} />
                        </View>
                        <Text style={styles.actionText}>Cambiar a vista Usuario</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </View>

            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    content: { flex: 1, paddingHorizontal: spacing.xl },

    profileSection: {
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.xl,
    },
    avatarCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.primary[500] + '20',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarText: { fontSize: 32, fontWeight: '700', color: colors.primary[500] },
    name: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
    email: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
    badge: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: 12, paddingVertical: 4,
        borderRadius: 12
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: colors.white },

    section: { gap: spacing.sm },
    sectionLabel: {
        fontSize: 13, fontWeight: '600', color: colors.textTertiary,
        marginLeft: spacing.xs, marginBottom: spacing.xs, textTransform: 'uppercase'
    },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.surface, padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    iconBox: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
    },
    actionText: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
});
