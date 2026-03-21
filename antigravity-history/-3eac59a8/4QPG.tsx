import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EmergencyScreen() {
    const call = (number: string) => {
        Linking.openURL(`tel:${number}`).catch(() =>
            Alert.alert('Error', 'No se pudo realizar la llamada. Verifica que tu dispositivo soporte llamadas.')
        );
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.container}>
                <Text style={s.title}>🆘 Emergencia</Text>
                <Text style={s.sub}>Presiona para llamar al servicio de emergencia</Text>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#EF4444' }]} onPress={() => call('131')} activeOpacity={0.6}>
                    <Text style={s.emoji}>🚒</Text>
                    <View style={s.btnInfo}>
                        <Text style={s.btnTitle}>Bomberos</Text>
                        <Text style={s.btnSub}>Incendios y rescate</Text>
                    </View>
                    <Text style={s.btnNum}>131</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#2563EB' }]} onPress={() => call('133')} activeOpacity={0.6}>
                    <Text style={s.emoji}>🚔</Text>
                    <View style={s.btnInfo}>
                        <Text style={s.btnTitle}>Carabineros</Text>
                        <Text style={s.btnSub}>Seguridad pública</Text>
                    </View>
                    <Text style={s.btnNum}>133</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#22C55E' }]} onPress={() => call('131')} activeOpacity={0.6}>
                    <Text style={s.emoji}>🚑</Text>
                    <View style={s.btnInfo}>
                        <Text style={s.btnTitle}>Ambulancia (SAMU)</Text>
                        <Text style={s.btnSub}>Emergencia médica</Text>
                    </View>
                    <Text style={s.btnNum}>131</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btn, { backgroundColor: '#7C3AED' }]} onPress={() => call('132')} activeOpacity={0.6}>
                    <Text style={s.emoji}>🔐</Text>
                    <View style={s.btnInfo}>
                        <Text style={s.btnTitle}>PDI</Text>
                        <Text style={s.btnSub}>Policía de Investigaciones</Text>
                    </View>
                    <Text style={s.btnNum}>132</Text>
                </TouchableOpacity>
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
    btnInfo: { flex: 1 },
    btnTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
    btnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    btnNum: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
});
