import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleDot, ChevronRight, Lock } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { Card, CardContent } from '../../src/components/ui/Card';

const CLUBS = [
    { id: 'huelen', name: 'Huelén', functional: true, icon: 'soccer-ball' },
    { id: 'tabancura', name: 'Tabancura', functional: true, icon: 'soccer-ball' },
    { id: 'saint-george', name: 'Saint George', functional: false, icon: 'soccer-ball' },
    { id: 'verbo-divino', name: 'Verbo Divino', functional: false, icon: 'soccer-ball' },
    { id: 'everest', name: 'Everest', functional: false, icon: 'soccer-ball' },
    { id: 'cordillera', name: 'Cordillera', functional: false, icon: 'soccer-ball' },
    { id: 'sscc-manquehue', name: 'SSCC Manquehue', functional: false, icon: 'soccer-ball' },
];

export default function FieldsScreen() {
    const router = useRouter();
    const { role, user } = useAuth();

    // De momento, el usuario "Javier Aravena" tiene acceso a todo. 
    // Como no podemos obtener su nombre directo aquí sin consultar el perfil, 
    // asumimos que el Admin tiene acceso total y el resto de momento solo a Huelén y Tabancura.
    // En el futuro, esto consultará la tabla field_access.

    const hasAccess = (clubId: string) => {
        if (role === 'ADMIN') return true;
        // Javier Aravena mock check (or general logic)
        if (clubId === 'huelen' || clubId === 'tabancura') return true;
        return false;
    };

    const handlePress = (club: typeof CLUBS[0]) => {
        if (!club.functional) return;

        if (hasAccess(club.id)) {
            // Navegar a la búsqueda filtrada por esta cancha
            // Nota: Aquí pasaríamos el ID de la cancha real de la DB en el futuro.
            router.push({
                pathname: '/(tabs)/search',
                params: { fieldName: club.name }
            });
        }
    };

    const renderItem = ({ item }: { item: typeof CLUBS[0] }) => {
        const accessible = hasAccess(item.id);
        const canClick = item.functional && accessible;

        return (
            <TouchableOpacity
                style={[styles.clubCardContainer, !canClick && styles.disabledCard]}
                onPress={() => handlePress(item)}
                disabled={!canClick}
            >
                <Card style={styles.clubCard}>
                    <CardContent style={styles.cardContent}>
                        <View style={styles.iconContainer}>
                            <CircleDot color={accessible ? "#10b981" : "#9ca3af"} size={40} />
                        </View>
                        <Text style={styles.clubName} numberOfLines={2}>{item.name}</Text>
                        <View style={styles.footer}>
                            {item.functional ? (
                                accessible ? (
                                    <View style={styles.statusRow}>
                                        <Text style={styles.statusText}>Disponible</Text>
                                        <ChevronRight size={16} color="#10b981" />
                                    </View>
                                ) : (
                                    <View style={styles.statusRow}>
                                        <Lock size={14} color="#f59e0b" />
                                        <Text style={[styles.statusText, { color: '#f59e0b' }]}>Sin permiso</Text>
                                    </View>
                                )
                            ) : (
                                <Text style={styles.unavailableText}>Próximamente</Text>
                            )}
                        </View>
                    </CardContent>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Selecciona tu Club</Text>
                <Text style={styles.subtitle}>Escoge donde quieres jugar hoy</Text>
            </View>

            <FlatList
                data={CLUBS}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.columnWrapper}
            />
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
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 4,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    clubCardContainer: {
        width: (Dimensions.get('window').width / 2) - 20,
    },
    clubCard: {
        height: 180,
        justifyContent: 'space-between',
    },
    cardContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    clubName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
        textAlign: 'center',
        marginBottom: 8,
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10b981',
    },
    unavailableText: {
        fontSize: 11,
        color: '#9ca3af',
        fontStyle: 'italic',
    },
    disabledCard: {
        opacity: 0.7,
    },
});
