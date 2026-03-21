import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EmergencyScreen() {
    const call = async (number: string) => {
        try {
            if (Platform.OS === 'android') {
                // Request CALL_PHONE permission and dial directly
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CALL_PHONE,
                    {
                        title: 'Permiso para llamar',
                        message: 'La app necesita permiso para realizar llamadas de emergencia directamente.',
                        buttonPositive: 'Permitir',
                        buttonNegative: 'Cancelar',
                    }
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    // tel: with CALL_PHONE permission auto-dials on Android
                    await Linking.openURL(`tel:${number}`);
                } else {
                    // Fallback: open dialer if permission denied
                    await Linking.openURL(`tel:${number}`);
                }
            } else {
                // iOS: telprompt shows a confirm dialog then calls
                await Linking.openURL(`telprompt:${number}`);
            }
        } catch {
            Alert.alert('Error', 'No se pudo realizar la llamada.');
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.container}>
                <Text style={s.title}>🆘 Emergencia</Text>
                <Text style={s.sub}>Presiona para llamar inmediatamente</Text>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#EF4444' }]} onPress={() => call('131')}>
                    <Text style={s.emoji}>🚒</Text>
                    <Text style={s.btnTitle}>Bomberos</Text>
                    <Text style={s.btnNum}>131</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#2563EB' }]} onPress={() => call('133')}>
                    <Text style={s.emoji}>🚔</Text>
                    <Text style={s.btnTitle}>Carabineros</Text>
                    <Text style={s.btnNum}>133</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#22C55E' }]} onPress={() => call('131')}>
                    <Text style={s.emoji}>🚑</Text>
                    <Text style={s.btnTitle}>Ambulancia (SAMU)</Text>
                    <Text style={s.btnNum}>131</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#7C3AED' }]} onPress={() => call('132')}>
                    <Text style={s.emoji}>🔐</Text>
                    <Text style={s.btnTitle}>PDI</Text>
                    <Text style={s.btnNum}>132</Text>
                </TouchableOpacity>

                <Text style={s.hint}>📞 La llamada se inicia al presionar el botón</Text>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#FEF2F2' },
    container: { flex: 1, padding: 20, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#991B1B', textAlign: 'center' },
    sub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
    btn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 20, marginBottom: 12, elevation: 4 },
    emoji: { fontSize: 32, marginRight: 16 },
    btnTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
    btnNum: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
    hint: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 16 },
});
