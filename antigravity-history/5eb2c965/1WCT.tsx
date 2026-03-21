import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ticketService } from '../../services/ticketService';

export default function ManageTicketsScreen() {
    const { organizationId } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTickets();
    }, [organizationId]);

    const loadTickets = async () => {
        if (!organizationId) return;
        try {
            setLoading(true);
            const data = await ticketService.getAllTickets(organizationId);
            setTickets(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-yellow-100 text-yellow-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'Abierto';
            case 'in_progress': return 'En Proceso';
            case 'resolved': return 'Resuelto';
            case 'rejected': return 'Rechazado';
            default: return status;
        }
    };

    const updateStatus = (id: string) => {
        Alert.alert('Actualizar Estado', 'Selecciona el nuevo estado', [
            { text: 'En Proceso', onPress: () => setStatusDB(id, 'in_progress') },
            { text: 'Resuelto', onPress: () => setStatusDB(id, 'resolved') },
            { text: 'Rechazado', onPress: () => setStatusDB(id, 'rejected'), style: 'destructive' },
            { text: 'Cancelar', style: 'cancel' }
        ]);
    };

    const setStatusDB = async (id: string, status: any) => {
        try {
            await ticketService.updateTicketStatus(id, status);
            loadTickets();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-surface-50">
                <ActivityIndicator size="large" color="#1E3A5F" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-surface-50">
            <FlatList
                data={tickets}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        className="bg-white p-5 rounded-xl mb-3 shadow-sm border border-slate-100"
                        onPress={() => updateStatus(item.id)}
                    >
                        <View className="flex-row justify-between mb-2">
                            <Text className="font-bold text-slate-800 text-lg flex-1 mr-2">{item.subject}</Text>
                            <View className={`px-2 py-1 rounded-md self-start ${getStatusColor(item.status).split(' ')[0]}`}>
                                <Text className={`text-xs font-bold ${getStatusColor(item.status).split(' ')[1]}`}>
                                    {getStatusLabel(item.status)}
                                </Text>
                            </View>
                        </View>
                        <Text className="text-slate-600 mb-3" numberOfLines={2}>{item.description}</Text>
                        <View className="flex-row justify-between pt-3 border-t border-slate-50 items-center">
                            <Text className="text-xs font-medium text-slate-500">
                                Por: {item.profiles?.full_name || 'Usuario Anónimo'}
                            </Text>
                            <Text className="text-primary-600 text-xs font-bold">Cambiar Estado</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
