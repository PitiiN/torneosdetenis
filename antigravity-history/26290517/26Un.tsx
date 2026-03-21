import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ManageMembersScreen() {
    const { organizationId } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMembers();
    }, [organizationId]);

    const loadMembers = async () => {
        if (!organizationId) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('memberships')
                .select(`
          id,
          role,
          is_active,
          joined_at,
          profiles:user_id (full_name, rut, phone)
        `)
                .eq('organization_id', organizationId)
                .order('role', { ascending: true }); // Simplistic sorting

            if (!error && data) {
                setMembers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'president': return 'bg-purple-100 text-purple-800';
            case 'secretary':
            case 'treasurer': return 'bg-blue-100 text-blue-800';
            case 'moderator': return 'bg-orange-100 text-orange-800';
            case 'member': return 'bg-green-100 text-green-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const getRoleLabel = (role: string) => {
        const roles: Record<string, string> = {
            'president': 'Presidente',
            'secretary': 'Secretario',
            'treasurer': 'Tesorero',
            'moderator': 'Moderador',
            'member': 'Socio',
            'resident': 'Residente',
            'superadmin': 'Super Admin'
        };
        return roles[role] || role;
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
            <View className="p-4 bg-white border-b border-slate-200 shadow-sm z-10">
                <Text className="text-slate-500 font-medium">Mostrando {members.length} vecinos registrados en la organización.</Text>
            </View>
            <FlatList
                data={members}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-slate-100 flex-row items-center">
                        <View className="w-12 h-12 bg-slate-100 rounded-full items-center justify-center mr-4">
                            <Text className="text-xl">👤</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-slate-800 text-lg mb-0.5">
                                {item.profiles?.full_name || 'Sin Nombre'}
                            </Text>
                            <Text className="text-slate-500 text-sm mb-2 font-medium">
                                RUT: {item.profiles?.rut || 'N/A'} • Cel: {item.profiles?.phone || 'N/A'}
                            </Text>
                            <View className="flex-row items-center">
                                <View className={`px-2 py-1 rounded-md mr-2 ${getRoleBadge(item.role).split(' ')[0]}`}>
                                    <Text className={`text-xs font-bold uppercase ${getRoleBadge(item.role).split(' ')[1]}`}>
                                        {getRoleLabel(item.role)}
                                    </Text>
                                </View>
                                {!item.is_active && (
                                    <View className="px-2 py-1 rounded-md bg-red-50">
                                        <Text className="text-xs font-bold uppercase text-red-600">Inactivo</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity className="p-2">
                            <Text className="text-2xl text-slate-400">⋮</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />
        </View>
    );
}
