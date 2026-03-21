import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAppStore, MapPin } from '../../lib/store';
import { useAuth } from '../../context/AuthContext';

export default function NeighborhoodMapScreen({ navigation }: any) {
    const { isAdmin, user } = useAuth();
    const mapPins = useAppStore(s => s.mapPins);
    const addMapPin = useAppStore(s => s.addMapPin);
    const removeMapPin = useAppStore(s => s.removeMapPin);
    const addSolicitud = useAppStore(s => s.addSolicitud);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [pinTitle, setPinTitle] = useState('');
    const [pinDesc, setPinDesc] = useState('');
    const [pinCategory, setPinCategory] = useState<'servicio' | 'punto_interes'>('servicio');
    const [pinEmoji, setPinEmoji] = useState('📍');
    const [tappedLat, setTappedLat] = useState<number | null>(null);
    const [tappedLng, setTappedLng] = useState<number | null>(null);

    // Generate map HTML with dynamic pins + tap handler
    const markersJS = mapPins.map(p => {
        const escapedTitle = p.title.replace(/'/g, "\\'");
        const escapedDesc = p.description.replace(/'/g, "\\'").replace(/\n/g, '<br>');
        const typeLabel = p.category === 'servicio' ? 'Servicio/Oficio' : 'Punto de Interés';
        return `L.marker([${p.lat}, ${p.lng}]).addTo(map).bindPopup('<b>${escapedTitle}</b><br>${escapedDesc}<br><small>${typeLabel}</small>');`;
    }).join('\n');

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
  ${markersJS}
  
  var tempMarker = null;
  map.on('click', function(e) {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map)
      .bindPopup('📍 Ubicación seleccionada').openPopup();
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng }));
  });
</script>
</body>
</html>`;

    const handleWebViewMessage = useCallback((event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.lat !== undefined && data.lng !== undefined) {
                setTappedLat(data.lat);
                setTappedLng(data.lng);
                setShowAddModal(true);
            }
        } catch (e) { }
    }, []);

    const handleAddPin = () => {
        if (!pinTitle.trim()) { Alert.alert('Error', 'Ingresa un nombre para el pin.'); return; }
        if (tappedLat === null || tappedLng === null) { Alert.alert('Error', 'Selecciona una ubicación tocando el mapa.'); return; }

        if (isAdmin) {
            // Admin: add directly to map
            addMapPin({ title: pinTitle.trim(), description: pinDesc.trim() || pinTitle.trim(), category: pinCategory, lat: tappedLat, lng: tappedLng, emoji: pinEmoji });
            Alert.alert('✅ Pin agregado', `"${pinTitle.trim()}" ha sido agregado al mapa.`);
        } else {
            // User: submit as solicitud for admin approval
            addSolicitud({
                title: `📍 Pin: ${pinTitle.trim()}`,
                description: `Solicitud de nuevo pin en el mapa.\n\nNombre: ${pinTitle.trim()}\nDescripción: ${pinDesc.trim() || 'Sin descripción'}\nTipo: ${pinCategory === 'servicio' ? 'Servicio/Oficio' : 'Punto de Interés'}\nUbicación: ${tappedLat.toFixed(6)}, ${tappedLng.toFixed(6)}\nEmoji: ${pinEmoji}`,
                category: 'Nuevo Servicio/Oficio/Emprendimiento',
                user: user?.user_metadata?.full_name || 'Vecino',
                userEmail: user?.email || '',
                hasImage: false,
            });
            Alert.alert('📨 Solicitud enviada', 'Tu solicitud de Pin ha sido enviada al administrador para su aprobación. Podrás ver el estado en "Mis Solicitudes".');
        }
        setPinTitle(''); setPinDesc(''); setPinEmoji('📍');
        setTappedLat(null); setTappedLng(null);
        setShowAddModal(false);
    };

    const handleRemovePin = (pin: MapPin) => {
        Alert.alert('¿Eliminar pin?', `"${pin.title}" será eliminado del mapa.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => removeMapPin(pin.id) },
        ]);
    };

    const EMOJIS = ['📍', '🔧', '✂️', '🧵', '🍞', '🏪', '💇', '🔑', '🛠️', '🏫', '⛪', '🏥'];

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>🗺️ Mapa del Barrio</Text>
                <Text style={s.subtitle}>Toca el mapa para seleccionar ubicación • {mapPins.length} puntos</Text>
                {isAdmin && (
                    <View style={s.adminBtns}>
                        <TouchableOpacity style={s.managePinBtn} onPress={() => setShowManageModal(true)}>
                            <Text style={s.managePinText}>📋 Gestionar Pins</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            <WebView
                key={mapPins.length}
                style={s.map}
                originWhitelist={['*']}
                source={{ html: MAP_HTML }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onMessage={handleWebViewMessage}
            />

            {/* Add/Request Pin Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => { setShowAddModal(false); setTappedLat(null); setTappedLng(null); }}>
                    <View style={s.modalContent} onStartShouldSetResponder={() => true}>
                        <Text style={s.modalTitle}>{isAdmin ? '📍 Nuevo Pin' : '📨 Solicitar Pin'}</Text>
                        {!isAdmin && <Text style={s.requestNote}>Tu solicitud será revisada por el administrador antes de aparecer en el mapa.</Text>}
                        {tappedLat !== null && (
                            <Text style={s.locationLabel}>📍 Ubicación: {tappedLat.toFixed(4)}, {tappedLng?.toFixed(4)}</Text>
                        )}
                        <View style={s.catRow}>
                            <TouchableOpacity style={[s.catBtn, pinCategory === 'servicio' && s.catBtnActive]} onPress={() => setPinCategory('servicio')}>
                                <Text style={[s.catBtnText, pinCategory === 'servicio' && { color: '#FFF' }]}>🔧 Servicio</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.catBtn, pinCategory === 'punto_interes' && s.catBtnActive2]} onPress={() => setPinCategory('punto_interes')}>
                                <Text style={[s.catBtnText, pinCategory === 'punto_interes' && { color: '#FFF' }]}>📍 Punto de Interés</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput style={s.input} placeholder="Nombre (ej: Vecina Loreto Costurera)" placeholderTextColor="#94A3B8" value={pinTitle} onChangeText={setPinTitle} />
                        <TextInput style={[s.input, { minHeight: 80 }]} placeholder="Descripción (opcional)" placeholderTextColor="#94A3B8" value={pinDesc} onChangeText={setPinDesc} multiline textAlignVertical="top" />
                        <Text style={s.emojiLabel}>Icono:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiScroll}>
                            {EMOJIS.map((e, i) => (
                                <TouchableOpacity key={i} style={[s.emojiBtn, pinEmoji === e && s.emojiBtnActive]} onPress={() => setPinEmoji(e)}>
                                    <Text style={s.emojiText}>{e}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={s.confirmBtn} onPress={handleAddPin}>
                            <Text style={s.confirmText}>{isAdmin ? '✅ Agregar al Mapa' : '📨 Enviar Solicitud'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setShowAddModal(false); setTappedLat(null); setTappedLng(null); }} style={s.cancelBtn}>
                            <Text style={s.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Manage Pins Modal — Admin only */}
            <Modal visible={showManageModal} transparent animationType="fade">
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowManageModal(false)}>
                    <View style={s.modalContent} onStartShouldSetResponder={() => true}>
                        <Text style={s.modalTitle}>📋 Pins del Mapa ({mapPins.length})</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {mapPins.map(p => (
                                <View key={p.id} style={s.pinRow}>
                                    <Text style={s.pinEmoji}>{p.emoji}</Text>
                                    <View style={s.pinInfo}>
                                        <Text style={s.pinName}>{p.title}</Text>
                                        <Text style={s.pinCat}>{p.category === 'servicio' ? '🔧 Servicio' : '📍 Punto de interés'}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemovePin(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Text style={s.pinDelete}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {mapPins.length === 0 && <Text style={s.emptyPins}>No hay pins en el mapa</Text>}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowManageModal(false)} style={s.cancelBtn}>
                            <Text style={s.cancelText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    adminBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
    managePinBtn: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    managePinText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
    map: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 12, textAlign: 'center' },
    requestNote: { fontSize: 13, color: '#F59E0B', textAlign: 'center', marginBottom: 12, backgroundColor: '#FFFBEB', padding: 10, borderRadius: 8 },
    locationLabel: { fontSize: 13, color: '#2563EB', marginBottom: 10, fontWeight: '500' },
    catRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    catBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    catBtnActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
    catBtnActive2: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    catBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    emojiLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    emojiScroll: { marginBottom: 12 },
    emojiBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 6, borderWidth: 2, borderColor: 'transparent' },
    emojiBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    emojiText: { fontSize: 22 },
    confirmBtn: { backgroundColor: '#22C55E', borderRadius: 12, padding: 14, alignItems: 'center' },
    confirmText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    cancelBtn: { marginTop: 12, alignItems: 'center' },
    cancelText: { color: '#94A3B8', fontSize: 14 },
    pinRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    pinEmoji: { fontSize: 24, marginRight: 10 },
    pinInfo: { flex: 1 },
    pinName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    pinCat: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    pinDelete: { fontSize: 20 },
    emptyPins: { padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 14 },
});
