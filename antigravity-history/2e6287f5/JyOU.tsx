import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { TouchableOpacity } from 'react-native';

const UV22_CENTER = { latitude: -33.4920, longitude: -70.6610 };

export default function NeighborhoodMapScreen({ navigation }: any) {
    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>🗺️ Mapa del Barrio</Text>
                <Text style={s.subtitle}>Unidad Vecinal Nº 22 • San Miguel</Text>
            </View>
            <MapView
                style={s.map}
                initialRegion={{
                    ...UV22_CENTER,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                }}
                showsUserLocation={true}
                showsMyLocationButton={true}
            >
                <Marker
                    coordinate={UV22_CENTER}
                    title="Sede Vecinal UV 22"
                    description="Unidad Vecinal Nº 22, San Miguel"
                />
                <Marker
                    coordinate={{ latitude: -33.4905, longitude: -70.6625 }}
                    title="Plaza del Barrio"
                    description="Espacio recreativo"
                    pinColor="#22C55E"
                />
                <Marker
                    coordinate={{ latitude: -33.4940, longitude: -70.6590 }}
                    title="Consultorio"
                    description="Centro de salud cercano"
                    pinColor="#EF4444"
                />
            </MapView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 16, paddingBottom: 8 },
    back: { marginBottom: 8 },
    backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1E3A5F' },
    subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
    map: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
});
