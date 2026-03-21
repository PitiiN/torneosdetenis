import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

export default function AccessibilityScreen({ navigation }: any) {
    const [fontSize, setFontSize] = useState(1.0);
    const [highContrast, setHighContrast] = useState(false);
    const [simpleMode, setSimpleMode] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>♿ Accesibilidad</Text>
                <Text style={s.subtitle}>Configura la app para una mejor experiencia</Text>

                <View style={s.card}>
                    <Text style={s.cardTitle}>🔤 Tamaño de texto</Text>
                    <Text style={s.preview} numberOfLines={1}>
                        Texto de ejemplo ({Math.round(fontSize * 100)}%)
                    </Text>
                    <View style={s.sliderRow}>
                        <Text style={s.sliderLabel}>A</Text>
                        <View style={s.sliderContainer}>
                            <View style={s.sliderTrack}>
                                <View style={[s.sliderFill, { width: `${((fontSize - 0.8) / 0.7) * 100}%` }]} />
                            </View>
                            <View style={s.sliderButtons}>
                                <TouchableOpacity onPress={() => setFontSize(Math.max(0.8, fontSize - 0.1))} style={s.sliderBtn}>
                                    <Text style={s.sliderBtnText}>−</Text>
                                </TouchableOpacity>
                                <Text style={s.sliderValue}>{Math.round(fontSize * 100)}%</Text>
                                <TouchableOpacity onPress={() => setFontSize(Math.min(1.5, fontSize + 0.1))} style={s.sliderBtn}>
                                    <Text style={s.sliderBtnText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={s.sliderLabelBig}>A</Text>
                    </View>
                </View>

                <View style={s.card}>
                    <View style={s.toggleRow}>
                        <View style={s.toggleInfo}>
                            <Text style={s.cardTitle}>🌗 Alto contraste</Text>
                            <Text style={s.desc}>Mejora la visibilidad de textos y bordes</Text>
                        </View>
                        <Switch value={highContrast} onValueChange={setHighContrast} trackColor={{ true: '#2563EB' }} />
                    </View>
                </View>

                <View style={s.card}>
                    <View style={s.toggleRow}>
                        <View style={s.toggleInfo}>
                            <Text style={s.cardTitle}>🧩 Modo simplificado</Text>
                            <Text style={s.desc}>Reduce elementos visuales para mayor claridad</Text>
                        </View>
                        <Switch value={simpleMode} onValueChange={setSimpleMode} trackColor={{ true: '#2563EB' }} />
                    </View>
                </View>

                <View style={s.card}>
                    <View style={s.toggleRow}>
                        <View style={s.toggleInfo}>
                            <Text style={s.cardTitle}>🔊 Lectura en voz alta</Text>
                            <Text style={s.desc}>Habilita los botones de audio en avisos</Text>
                        </View>
                        <Switch value={ttsEnabled} onValueChange={setTtsEnabled} trackColor={{ true: '#2563EB' }} />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    back: { marginBottom: 16 },
    backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
    desc: { fontSize: 13, color: '#64748B', marginTop: 2 },
    preview: { fontSize: 16, color: '#475569', marginVertical: 8, textAlign: 'center' },
    sliderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    sliderLabel: { fontSize: 14, color: '#94A3B8', marginRight: 8 },
    sliderLabelBig: { fontSize: 22, color: '#94A3B8', marginLeft: 8 },
    sliderContainer: { flex: 1 },
    sliderTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3 },
    sliderFill: { height: 6, backgroundColor: '#2563EB', borderRadius: 3 },
    sliderButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    sliderBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    sliderBtnText: { fontSize: 20, color: '#2563EB', fontWeight: 'bold' },
    sliderValue: { fontSize: 14, fontWeight: '600', color: '#334155' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleInfo: { flex: 1, marginRight: 12 },
});
