import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { User, Mail, Phone, LogOut, ChevronRight, Settings, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                setProfile(data);
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            Alert.alert("Error", error.message);
        } else {
            router.replace('/login');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <User size={40} color="#10b981" />
                </View>
                <Text style={styles.userName}>{profile?.full_name || 'Cargando...'}</Text>
                <Text style={styles.userEmail}>{profile?.email || '...'}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cuenta</Text>
                <Card>
                    <CardContent style={styles.noPadding}>
                        <TouchableOpacity style={styles.menuItem}>
                            <Mail size={20} color="#6b7280" />
                            <Text style={styles.menuItemText}>Email: {profile?.email}</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        <TouchableOpacity style={styles.menuItem}>
                            <Phone size={20} color="#6b7280" />
                            <Text style={styles.menuItemText}>Teléfono: {profile?.phone || 'No registrado'}</Text>
                        </TouchableOpacity>
                    </CardContent>
                </Card>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferencias</Text>
                <Card>
                    <CardContent style={styles.noPadding}>
                        <TouchableOpacity style={styles.menuItem}>
                            <Settings size={20} color="#6b7280" />
                            <Text style={styles.menuItemText}>Notificaciones</Text>
                            <ChevronRight size={20} color="#d1d5db" />
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        <TouchableOpacity style={styles.menuItem}>
                            <Shield size={20} color="#6b7280" />
                            <Text style={styles.menuItemText}>Privacidad y Seguridad</Text>
                            <ChevronRight size={20} color="#d1d5db" />
                        </TouchableOpacity>
                    </CardContent>
                </Card>
            </View>

            <Button
                title="Cerrar Sesión"
                onPress={handleLogout}
                variant="outline"
                style={styles.logoutButton}
            />

            <Text style={styles.version}>Versión 1.0.0 (Native)</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 80,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#10b981',
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    userEmail: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    noPadding: {
        padding: 0,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    menuItemText: {
        flex: 1,
        fontSize: 15,
        color: '#374151',
    },
    separator: {
        height: 1,
        backgroundColor: '#f3f4f6',
        marginLeft: 16,
    },
    logoutButton: {
        marginTop: 10,
        borderColor: '#ef4444',
    },
    version: {
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 32,
    },
});
