import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function HomeScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const displayName = user?.user_metadata?.full_name || 'Vecino';

    const quickActions = [
        { title: 'Comunicados', emoji: '📢', bg: '#EFF6FF', tab: 'Avisos' },
        { title: 'Emergencia', emoji: '🆘', bg: '#FEF2F2', tab: 'S.O.S' },
        { title: 'Agenda', emoji: '📅', bg: '#F0FDF4', tab: 'Agenda' },
        { title: 'Tickets', emoji: '🎫', bg: '#FFFBEB', tab: 'Más' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <View style={s.greeting}>
                    <Text style={s.greetEmoji}>👋</Text>
                    <Text style={s.greetTitle}>¡Hola, {displayName}!</Text>
                    <Text style={s.greetSub}>Bienvenido a tu Junta de Vecinos</Text>
                </View>

                <Text style={s.section}>Accesos rápidos</Text>

                <View style={s.grid}>
                    {quickActions.map((action, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[s.card, { backgroundColor: action.bg }]}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate(action.tab)}
                        >
                            <Text style={s.cardEmoji}>{action.emoji}</Text>
                            <Text style={s.cardTitle}>{action.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={s.infoCard}>
                    <Text style={s.infoTitle}>📌 Aviso importante</Text>
                    <Text style={s.infoText}>Mantente informado sobre las actividades de tu barrio. Revisa los comunicados frecuentemente.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    greeting: { backgroundColor: '#1E3A5F', borderRadius: 20, padding: 24, marginBottom: 24 },
    greetEmoji: { fontSize: 36 },
    greetTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
    greetSub: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
    section: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    card: { width: '48%', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, elevation: 2 },
    cardEmoji: { fontSize: 32, marginBottom: 8 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
    infoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderLeftWidth: 4, borderLeftColor: '#2563EB', elevation: 2 },
    infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 8 },
    infoText: { fontSize: 14, color: '#64748B', lineHeight: 20 },
});
