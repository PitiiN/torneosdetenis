import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SearchBar, Alert } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { User, ShieldCheck, CheckSquare, Square, Search } from 'lucide-react-native';
import { TextInput } from 'react-native';

const CLUBS = [
    { id: 'huelen', name: 'Huelén' },
    { id: 'tabancura', name: 'Tabancura' },
    { id: 'saint-george', name: 'Saint George' },
    { id: 'verbo-divino', name: 'Verbo Divino' },
    { id: 'everest', name: 'Everest' },
    { id: 'cordillera', name: 'Cordillera' },
    { id: 'sscc-manquehue', name: 'SSCC Manquehue' },
];

export default function PermissionsScreen() {
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });

        if (data) setUsers(data);
        setLoading(false);
    };

    const handleUserSelect = async (user: any) => {
        setSelectedUser(user);
        // En una implementación real, aquí buscaríamos en la tabla field_access
        // Para este demo, simularemos la carga de permisos.
        // if (user.full_name === 'Javier Aravena') setUserPermissions(CLUBS.map(c => c.id));
        // else setUserPermissions(['huelen', 'tabancura']);

        // Simulación:
        setUserPermissions(['huelen', 'tabancura']);
    };

    const togglePermission = (clubId: string) => {
        if (userPermissions.includes(clubId)) {
            setUserPermissions(userPermissions.filter(id => id !== clubId));
        } else {
            setUserPermissions([...userPermissions, clubId]);
        }
    };

    const savePermissions = () => {
        Alert.alert("Éxito", `Permisos guardados para ${selectedUser.full_name}`);
        setSelectedUser(null);
    };

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (selectedUser) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setSelectedUser(null)}>
                        <Text style={styles.backButton}>← Volver</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Permisos: {selectedUser.full_name}</Text>
                </View>

                <FlatList
                    data={CLUBS}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.permissionItem} onPress={() => togglePermission(item.id)}>
                            <Text style={styles.permissionName}>{item.name}</Text>
                            {userPermissions.includes(item.id) ? (
                                <CheckSquare color="#10b981" size={24} />
                            ) : (
                                <Square color="#d1d5db" size={24} />
                            )}
                        </TouchableOpacity>
                    )}
                />

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveButton} onPress={savePermissions}>
                        <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Gestión de Permisos</Text>
                <Text style={styles.subtitle}>Asigna acceso a canchas por usuario</Text>
            </View>

            <View style={styles.searchContainer}>
                <Search color="#9ca3af" size={20} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar usuario..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.userRow} onPress={() => handleUserSelect(item)}>
                            <View style={styles.userAvatar}>
                                <User color="#6b7280" size={24} />
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{item.full_name || 'Sin nombre'}</Text>
                                <Text style={styles.userEmail}>{item.role || 'USER'}</Text>
                            </View>
                            <ShieldCheck color="#10b981" size={20} />
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        paddingHorizontal: 15,
        borderRadius: 12,
        height: 50,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
    },
    listContent: {
        paddingHorizontal: 20,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    userEmail: {
        fontSize: 13,
        color: '#6b7280',
    },
    backButton: {
        color: '#10b981',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    permissionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 18,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    permissionName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    saveButton: {
        backgroundColor: '#10b981',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
