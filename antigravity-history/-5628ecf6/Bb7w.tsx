import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, Switch } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { announcementService } from '../../services/announcementService';
import { pushService } from '../../services/pushService';

export default function ManageAnnouncementsScreen() {
    const { organizationId, user } = useAuth();
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [isImportant, setIsImportant] = useState(false);

    useEffect(() => {
        loadAnnouncements();
    }, [organizationId]);

    const loadAnnouncements = async () => {
        try {
            if (!organizationId) return;
            const data = await announcementService.getAnnouncements(organizationId);
            setAnnouncements(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreate = async () => {
        if (!newTitle || !newBody) {
            Alert.alert('Error', 'Título y mensaje son requeridos');
            return;
        }
        try {
            await announcementService.createAnnouncement({
                organization_id: organizationId!,
                title: newTitle,
                body: newBody,
                priority: isImportant ? 'important' : 'normal',
                created_by: user!.id,
            });

            // Send push notification via Edge Function
            await pushService.sendPushNotification({
                organization_id: organizationId!,
                title: isImportant ? `⚠️ ${newTitle}` : `📢 ${newTitle}`,
                body: newBody.length > 100 ? newBody.substring(0, 97) + '...' : newBody,
                type: 'announcement',
            });

            setIsCreating(false);
            setNewTitle('');
            setNewBody('');
            setIsImportant(false);
            loadAnnouncements();
            Alert.alert('Éxito', 'Comunicado creado y notificado');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Confirmar', '¿Eliminar este comunicado?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await announcementService.deleteAnnouncement(id);
                        loadAnnouncements();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    }
                }
            }
        ]);
    };

    if (isCreating) {
        return (
            <View className="flex-1 bg-surface-50 p-6">
                <Text className="text-2xl font-bold mb-6 text-slate-800">Crear Comunicado</Text>

                <TextInput
                    className="bg-white border border-slate-200 rounded-xl p-4 text-lg mb-4"
                    placeholder="Título del aviso"
                    value={newTitle}
                    onChangeText={setNewTitle}
                />

                <TextInput
                    className="bg-white border border-slate-200 rounded-xl p-4 text-lg mb-4 h-32"
                    placeholder="Mensaje detallado..."
                    multiline
                    textAlignVertical="top"
                    value={newBody}
                    onChangeText={setNewBody}
                />

                <View className="flex-row items-center justify-between bg-white p-4 rounded-xl border border-slate-200 mb-8">
                    <Text className="text-lg text-slate-700">Marcar como urgente (⚠️)</Text>
                    <Switch value={isImportant} onValueChange={setIsImportant} />
                </View>

                <TouchableOpacity
                    className="bg-primary-600 rounded-xl py-4 items-center mb-4 shadow-sm"
                    onPress={handleCreate}
                >
                    <Text className="text-white text-lg font-bold">Publicar y Notificar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="py-4 items-center"
                    onPress={() => setIsCreating(false)}
                >
                    <Text className="text-slate-500 font-bold">Cancelar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface-50">
            <FlatList
                data={announcements}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                ListHeaderComponent={
                    <TouchableOpacity
                        className="bg-primary-100 border border-primary-200 rounded-xl p-4 items-center mb-6 border-dashed"
                        onPress={() => setIsCreating(true)}
                    >
                        <Text className="text-primary-700 font-bold text-lg">+ Redactar Comunicado</Text>
                    </TouchableOpacity>
                }
                renderItem={({ item }) => (
                    <View className={`bg-white p-5 rounded-xl mb-3 shadow-sm border border-slate-100 ${item.priority === 'important' ? 'border-l-4 border-l-red-500' : ''}`}>
                        <Text className="font-bold text-slate-800 text-lg mb-1">{item.title}</Text>
                        <Text className="text-slate-600 mb-3" numberOfLines={2}>{item.body}</Text>
                        <View className="flex-row justify-between items-center mt-2 border-t border-slate-50 pt-3">
                            <Text className="text-xs text-slate-400">{new Date(item.published_at).toLocaleDateString()}</Text>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                <Text className="text-red-500 font-medium">Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}
