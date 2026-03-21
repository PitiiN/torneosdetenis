import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { eventService } from '../../services/eventService';

export default function EventsScreen() {
    const { organizationId, user } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [myRegistrations, setMyRegistrations] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (organizationId && user) {
            loadData();
        }
    }, [organizationId, user]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [eventsData, regsData] = await Promise.all([
                eventService.getEvents(organizationId!),
                eventService.getMyRegistrations(user!.id)
            ]);
            setEvents(eventsData);
            setMyRegistrations(regsData);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo cargar la agenda');
        } finally {
            setLoading(false);
        }
    };

    const toggleRegistration = async (eventId: string, isRegistered: boolean) => {
        try {
            if (isRegistered) {
                await eventService.unregisterFromEvent(eventId, user!.id);
                setMyRegistrations(prev => prev.filter(id => id !== eventId));
            } else {
                await eventService.registerForEvent(eventId, user!.id);
                setMyRegistrations(prev => [...prev, eventId]);
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo actualizar la inscripción');
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isRegistered = myRegistrations.includes(item.id);
        const startDate = new Date(item.starts_at);

        return (
            <View className="bg-white p-5 rounded-2xl mb-4 shadow-sm border border-slate-100 flex-row">
                <View className="bg-primary-50 rounded-xl p-3 items-center justify-center w-20 mr-4 border border-primary-100">
                    <Text className="text-primary-700 font-bold text-xs uppercase">
                        {startDate.toLocaleString('es-CL', { month: 'short' })}
                    </Text>
                    <Text className="text-primary-900 font-bold text-3xl">
                        {startDate.getDate()}
                    </Text>
                    <Text className="text-primary-600 font-medium text-xs">
                        {startDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>

                <View className="flex-1 justify-center">
                    <Text className="font-bold text-lg text-slate-800 mb-1">{item.title}</Text>
                    {item.location_name && (
                        <Text className="text-slate-500 mb-2">📍 {item.location_name}</Text>
                    )}

                    <TouchableOpacity
                        className={`py-2 px-4 rounded-lg self-start mt-2 ${isRegistered ? 'bg-red-50 border border-red-200' : 'bg-primary-500'
                            }`}
                        onPress={() => toggleRegistration(item.id, isRegistered)}
                    >
                        <Text className={`font-bold ${isRegistered ? 'text-red-600' : 'text-white'}`}>
                            {isRegistered ? 'Bajarme' : 'Inscribirme'}
                        </Text>
                    </TouchableOpacity>
                </View>
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
        <View className="flex-1 bg-surface-50">
            <FlatList
                data={events}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                    <Text className="text-center text-lg text-slate-500 mt-10">
                        No hay eventos próximos en la agenda.
                    </Text>
                }
            />
        </View>
    );
}
