import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  body, html { margin: 0; padding: 0; height: 100%; }
  #map { width: 100%; height: 100%; }
</style>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([-33.4920, -70.6610], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  L.marker([-33.4920, -70.6610]).addTo(map).bindPopup('<b>Sede Vecinal UV 22</b><br>Unidad Vecinal Nº 22, San Miguel').openPopup();
  L.marker([-33.4905, -70.6625]).addTo(map).bindPopup('<b>Plaza del Barrio</b><br>Espacio recreativo');
  L.marker([-33.4940, -70.6590]).addTo(map).bindPopup('<b>Consultorio</b><br>Centro de salud cercano');
</script>
</body>
</html>
`;

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
            <WebView
                style={s.map}
                originWhitelist={['*']}
                source={{ html: MAP_HTML }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
            />
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
