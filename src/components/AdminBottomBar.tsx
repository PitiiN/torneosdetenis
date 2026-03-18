import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/theme';

const QUICK_ACTIONS = [
    { icon: 'home-outline', label: 'Inicio', color: colors.primary[500], route: '/(tabs)/index' },
    { icon: 'trophy-outline', label: 'Torneos', color: colors.primary[500], route: '/(tabs)/tournaments' },
    { icon: 'people-outline', label: 'Ranking', color: colors.primary[500], route: '/(tabs)/players' },
    { icon: 'card-outline', label: 'Finanzas', color: colors.primary[500], route: '/(tabs)/finance' },
    { icon: 'settings-outline', label: 'Config', color: colors.primary[500], route: '/(tabs)/settings' },
    { icon: 'person-outline', label: 'Perfil', color: colors.primary[500], route: '/(tabs)/profile' },
];

export default function AdminBottomBar() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const tabs = QUICK_ACTIONS.map(action => ({
        icon: action.icon,
        label: action.label,
        href: action.route,
        color: action.color,
    }));

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.content}>
                {tabs.map((tab) => {
                    // Normalize pathname and href for comparison (remove route groups like (admin))
                    const normalize = (p: string) => p.replace(/\/\(.*\)\//g, '/').replace(/^\/\(.*\)\//, '/');
                    const normalizedPath = normalize(pathname);
                    const normalizedHref = normalize(tab.href);

                    const isActive = normalizedHref === '/'
                        ? normalizedPath === '/'
                        : normalizedPath.startsWith(normalizedHref);

                    return (
                        <TouchableOpacity
                            key={tab.href}
                            style={[
                                styles.tab,
                                isActive && styles.activeTab
                            ]}
                            onPress={() => router.push(tab.href as any)}
                        >
                            <Ionicons
                                name={tab.icon as any}
                                size={20}
                                color={isActive ? colors.primary[500] : colors.textTertiary}
                            />
                            <Text
                                style={[
                                    styles.tabLabel,
                                    isActive && styles.activeTabLabel
                                ]}
                                numberOfLines={1}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
    },
    tab: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        flex: 1,
        gap: 2,
    },
    activeTab: {
        // Optional: add a indicator or different background
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textTertiary,
        textAlign: 'center',
    },
    activeTabLabel: {
        color: colors.primary[500],
    },
});
