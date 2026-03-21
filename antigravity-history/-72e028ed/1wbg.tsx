import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { announcementService } from '../../services/announcementService';
import * as Speech from 'expo-speech';

export default function AnnouncementsScreen() {
    const { organizationId } = useAuth();
    const { fontScale, highContrast } = useAccessibility();
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [speakingId, setSpeakingId] = useState<string | null>(null);

    useEffect(() => {
        if (organizationId) {
            loadAnnouncements();
        }
    }, [organizationId]);

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const data = await announcementService.getAnnouncements(organizationId!);
            setAnnouncements(data);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', 'No se pudieron cargar los comunicados');
        } finally {
            setLoading(false);
        }
    };

    const toggleSpeech = async (id: string, title: string, body: string) => {
        if (speakingId === id) {
            Speech.stop();
            setSpeakingId(null);
        } else {
            Speech.stop();
            setSpeakingId(id);
            Speech.speak(`${title}... ${body}`, {
                language: 'es-CL', // Chilean Spanish
                onDone: () => setSpeakingId(null),
                onError: () => setSpeakingId(null),
            });
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isImportant = item.priority === 'important';
        const isSpeaking = speakingId === item.id;
        const date = new Date(item.published_at).toLocaleDateString('es-CL');

        return (
            <View className={`p-5 rounded-2xl mb-4 shadow-sm border ${isImportant ? 'bg-red-50 border-red-200' :
                    highContrast ? 'bg-black border-white' : 'bg-white border-slate-100'
                }`}>
                <View className="flex-row justify-between items-start mb-2">
                    <Text
                        className={`font-bold flex-1 ${isImportant ? 'text-red-700' :
                                highContrast ? 'text-white' : 'text-slate-800'
                            }`}
                        style={{ fontSize: 20 * fontScale }}
                    >
                        {isImportant && '⚠️ '}{item.title}
                    </Text>
                    <Text className={`text-sm ${highContrast ? 'text-gray-300' : 'text-slate-500'}`}>{date}</Text>
                </View>

                <Text
                    className={`mb-4 ${highContrast ? 'text-white' : 'text-slate-600'}`}
                    style={{ fontSize: 16 * fontScale }}
                >
                    {item.body}
                </Text>

                <TouchableOpacity
                    className={`py-3 px-4 rounded-xl flex-row justify-center items-center ${isSpeaking ? 'bg-slate-200' : 'bg-primary-50'
                        }`}
                    onPress={() => toggleSpeech(item.id, item.title, item.body)}
                    accessibilityLabel={isSpeaking ? "Detener lectura" : "Leer comunicado en voz alta"}
                >
                    <Text className={`font-bold ${isSpeaking ? 'text-slate-700' : 'text-primary-700'}`} style={{ fontSize: 16 * fontScale }}>
                        {isSpeaking ? '⏹️ Detener audio' : '🔊 Escuchar este aviso'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-surface-50">
                <ActivityIndicator size="large" color="#1E3A5F" />
            </View>
        );
    }

    return (
        <View className={`flex-1 ${highContrast ? 'bg-gray-900' : 'bg-surface-50'}`}>
            <FlatList
                data={announcements}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                    <Text className="text-center text-lg text-slate-500 mt-10">
                        No hay comunicados recientes.
                    </Text>
                }
            />
        </View>
    );
}
