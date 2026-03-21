import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/theme';

const QUICK_ACTIONS = [
    { icon: 'shield', label: 'Panel', color: colors.textSecondary, route: '/(admin)/dashboard' },
    { icon: 'add-circle', label: 'Crear', color: colors.primary[500], route: '/(admin)/classes/create' },
    { icon: 'calendar', label: 'Agenda', color: colors.secondary[500], route: '/(admin)/schedule' },
    { icon: 'list', label: 'Lista', color: colors.info, route: '/(admin)/students' },
    { icon: 'card', label: 'Finanzas', color: colors.accent[500], route: '/(admin)/payments' },
    { icon: 'trophy', label: 'Torneos', color: colors.error, route: '/(tabs)/tournaments' },
    { icon: 'chatbubbles', label: 'Opiniones', color: colors.warning, route: '/(admin)/reviews' },
];

export default function AdminBottomBar() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + spacing.sm }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {QUICK_ACTIONS.map((action) => {
                    const isActive = pathname === action.route;
                    return (
                        <TouchableOpacity
                            key={action.label}
                            style={styles.actionBtn}
                            onPress={() => {
                                if (!isActive) {
                                    if (action.route.startsWith('/(tabs)')) {
                                        router.push(action.route as any);
                                    } else {
                                        router.replace(action.route as any);
                                    }
                                }
                            }}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: action.color + (isActive ? '40' : '15') }]}>
                                <Ionicons name={action.icon as any} size={22} color={action.color} />
                            </View>
                            <Text style={[styles.label, isActive && styles.labelActive]}>{action.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderTopWidth: 1, borderTopColor: colors.border,
        paddingTop: spacing.md,
    },
    scroll: {
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
    },
    actionBtn: {
        alignItems: 'center',
        gap: 4,
    },
    iconCircle: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
    },
    label: {
        fontSize: 11, color: colors.textSecondary, fontWeight: '500',
    },
    labelActive: {
        color: colors.text, fontWeight: '700',
    },
});
