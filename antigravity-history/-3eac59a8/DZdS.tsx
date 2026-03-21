import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../../context/AuthContext';

export default function EmergencyScreen() {
    const { organizationId } = useAuth(); // In a real app, config would come from DB

    const handleCall = (number: string, serviceName: string) => {
        Alert.alert(
            `Llamar a ${serviceName}`,
            `¿Deseas llamar al ${number}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Llamar', onPress: () => Linking.openURL(`tel:${number}`) }
            ]
        );
    };

    const emergencyContacts = [
        { title: 'Carabineros', number: '133', icon: '👮', color: 'bg-green-600', textColor: 'text-white' },
        { title: 'Bomberos', number: '132', icon: '🚒', color: 'bg-red-600', textColor: 'text-white' },
        { title: 'Ambulancia (SAMU)', number: '131', icon: '🚑', color: 'bg-blue-600', textColor: 'text-white' },
        { title: 'Seguridad Municipal', number: '*4114', icon: '🚨', color: 'bg-primary-800', textColor: 'text-white' }, // Example default
        { title: 'PDI', number: '134', icon: '🕵️', color: 'bg-slate-800', textColor: 'text-white' },
    ];

    return (
        <ScrollView className="flex-1 bg-surface-50 p-6">
            <View className="mb-8 items-center mt-4">
                <Text className="text-5xl mb-4">🆘</Text>
                <Text className="text-2xl font-bold text-slate-800 text-center mb-2">
                    Contactos de Emergencia
                </Text>
                <Text className="text-lg text-slate-600 text-center">
                    Toca cualquier botón para llamar inmediatamente.
                </Text>
            </View>

            <View className="gap-5">
                {emergencyContacts.map((contact, index) => (
                    <TouchableOpacity
                        key={index}
                        className={`${contact.color} p-6 rounded-2xl flex-row items-center justify-between shadow-md`}
                        onPress={() => handleCall(contact.number, contact.title)}
                        accessibilityRole="button"
                        accessibilityLabel={`Llamar a ${contact.title} al ${contact.number}`}
                    >
                        <View className="flex-row items-center flex-1">
                            <Text className="text-3xl mr-4">{contact.icon}</Text>
                            <View>
                                <Text className={`${contact.textColor} text-2xl font-bold`}>{contact.title}</Text>
                                <Text className={`${contact.textColor} text-xl opacity-80 mt-1`}>{contact.number}</Text>
                            </View>
                        </View>
                        <Text className="text-3xl">📞</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View className="h-10" />
        </ScrollView>
    );
}
