import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { useAuth } from '@/hooks/useAuth';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG = [
    { name: 'index', title: 'Inicio', icon: 'home' },
    { name: 'my-classes', title: 'Mis Clases', icon: 'tennisball' },
    { name: 'payments', title: 'Pagos', icon: 'card' },
    { name: 'tournaments', title: 'Torneos', icon: 'trophy' },
    { name: 'profile', title: 'Perfil', icon: 'person' },
] as const;

export default function TabLayout() {
    const { isAdmin } = useAuth();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary[500],
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
                sceneContainerStyle: { backgroundColor: colors.background },
            }}
        >
            {TAB_CONFIG.map((tab) => (
                <Tabs.Screen
                    key={tab.name}
                    name={tab.name}
                    options={{
                        title: tab.title,
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name={tab.icon as IoniconsName} size={size} color={color} />
                        ),
                    }}
                />
            ))}
        </Tabs>
    );
}

