import { Tabs } from 'expo-router';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Inicio',
                    // tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
