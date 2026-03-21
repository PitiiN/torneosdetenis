import { Stack } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="admin/agenda" options={{
                        headerShown: true,
                        title: 'Agenda de Disponibilidad',
                        headerBackTitle: 'Atrás'
                    }} />
                    <Stack.Screen name="admin/financials" options={{
                        headerShown: true,
                        title: 'Panel Financiero',
                        headerBackTitle: 'Atrás'
                    }} />
                </Stack>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
