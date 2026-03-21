import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../lib/store';

export default function HomeScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const announcements = useAppStore(s => s.announcements);
    const displayName = user?.user_metadata?.full_name || 'Vecino';
    const importantAvisos = announcements.filter(a => a.priority === 'important').slice(0, 3);

    const goToTab = (tabName: string) => {
        // Reset the target tab's stack to its initial screen
        navigation.dispatch(
            CommonActions.navigate({
                name: tabName,
                params: {},
            })
        );
    };

    const quickActions = [
        { title: 'Avisos', emoji: '📢', bg: '#EFF6FF', onPress: () => goToTab('Avisos') },
        { title: 'Emergencia', emoji: '🆘', bg: '#FEF2F2', onPress: () => goToTab('S.O.S') },
        { title: 'Agenda', emoji: '📅', bg: '#F0FDF4', onPress: () => goToTab('Agenda') },
        {
            title: 'Solicitudes', emoji: '📝', bg: '#FFFBEB', onPress: () => {
                navigation.navigate('Más', { screen: 'Solicitudes' });
            }
        },
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
                        <TouchableOpacity key={i} style={[s.card, { backgroundColor: action.bg }]} activeOpacity={0.7} onPress={action.onPress}>
                            <Text style={s.cardEmoji}>{action.emoji}</Text>
                            <Text style={s.cardTitle}>{action.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {importantAvisos.length > 0 ? (
                    <>
                        <Text style={s.section}>🔴 Avisos Importantes</Text>
                        {importantAvisos.map(a => (
                            <TouchableOpacity key={a.id} style={s.infoCard} onPress={() => goToTab('Avisos')} activeOpacity={0.7}>
                                <Text style={s.infoTitle}>{a.title}</Text>
                                <Text style={s.infoText} numberOfLines={2}>{a.body}</Text>
                                <Text style={s.infoDate}>{a.date}</Text>
                            </TouchableOpacity>
                        ))}
                    </>
                ) : (
                    <View style={s.noInfo}>
                        <Text style={s.noInfoText}>✅ No hay avisos importantes por el momento</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' }, scroll: { padding: 20 },
    greeting: { backgroundColor: '#1E3A5F', borderRadius: 20, padding: 24, marginBottom: 24 },
    greetEmoji: { fontSize: 36 }, greetTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 }, greetSub: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
    section: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    card: { width: '48%', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, elevation: 2 },
    cardEmoji: { fontSize: 32, marginBottom: 8 }, cardTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
    infoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#EF4444', elevation: 2, marginBottom: 10 },
    infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 4 },
    infoText: { fontSize: 13, color: '#64748B', lineHeight: 18 },
    infoDate: { fontSize: 11, color: '#94A3B8', marginTop: 6, textAlign: 'right' },
    noInfo: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, alignItems: 'center' },
    noInfoText: { color: '#22C55E', fontWeight: '600', fontSize: 14 },
});
