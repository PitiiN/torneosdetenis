import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { colors, spacing, borderRadius } from '@/theme';

export default function ProfileScreen() {
    const { profile, isAdmin, isCoach } = useAuth();
    const router = useRouter();
    const reset = useAuthStore((s) => s.reset);

    const handleLogout = () => {
        Alert.alert('Cerrar sesión', '¿Estás seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Cerrar sesión',
                style: 'destructive',
                onPress: async () => {
                    await authService.signOut();
                    reset();
                },
            },
        ]);
    };

    const roleBadge = isAdmin ? 'Administrador' : isCoach ? 'Coach' : 'Alumno';
    const roleColor = isAdmin ? colors.primary[500] : isCoach ? colors.accent[500] : colors.secondary[500];

    const menuItems = [
        ...(isAdmin ? [{ icon: 'shield', label: 'Panel Admin', onPress: () => router.push('/(admin)/dashboard' as any) }] : []),
        { icon: 'notifications-outline', label: 'Notificaciones', onPress: () => router.push('/notifications' as any) },
        { icon: 'help-circle-outline', label: 'Ayuda', onPress: () => { } },
        { icon: 'information-circle-outline', label: 'Acerca de', onPress: () => { } },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Perfil</Text>
            </View>

            {/* Profile card */}
            <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                </View>
                <Text style={styles.name}>{profile?.full_name}</Text>
                <Text style={styles.email}>{profile?.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                    <Text style={[styles.roleText, { color: roleColor }]}>{roleBadge}</Text>
                </View>
            </View>

            {/* Menu */}
            <View style={styles.menuSection}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
                        <Ionicons name={item.icon as any} size={22} color={colors.text} />
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color={colors.error} />
                <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>

            <Text style={styles.version}>v1.0.0 — Escuela de Tenis</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    profileCard: {
        alignItems: 'center', backgroundColor: colors.surface,
        marginHorizontal: spacing.xl, borderRadius: borderRadius.xl,
        padding: spacing['2xl'], marginBottom: spacing.xl,
    },
    avatarCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.primary[500], justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
    name: { fontSize: 20, fontWeight: '700', color: colors.text },
    email: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    roleBadge: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
        borderRadius: borderRadius.full, marginTop: spacing.md,
    },
    roleText: { fontSize: 13, fontWeight: '600' },
    menuSection: {
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        borderRadius: borderRadius.xl, overflow: 'hidden', marginBottom: spacing.xl,
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    menuLabel: { flex: 1, fontSize: 16, color: colors.text },
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        marginHorizontal: spacing.xl, padding: spacing.lg,
        backgroundColor: colors.surface, borderRadius: borderRadius.xl,
        justifyContent: 'center',
    },
    logoutText: { fontSize: 16, fontWeight: '600', color: colors.error },
    version: {
        textAlign: 'center', fontSize: 12, color: colors.textTertiary,
        marginTop: spacing.xl, marginBottom: spacing['4xl'],
    },
});
