import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAppStore, MapPin } from '../../lib/store';
import { useAuth } from '../../context/AuthContext';

const SERVICE_SUBCATEGORIES = ['Salud', 'Deporte', 'Servicios para el hogar', 'Comida', 'Otro'];

export default function NeighborhoodMapScreen({ navigation }: any) {
    const { isAdmin, viewMode, user } = useAuth();
    const mapPins = useAppStore(s => s.mapPins);
    const addMapPin = useAppStore(s => s.addMapPin);
    const removeMapPin = useAppStore(s => s.removeMapPin);
    const updateMapPin = useAppStore(s => s.updateMapPin);
    const addMapPinReview = useAppStore(s => s.addMapPinReview);
    const addSolicitud = useAppStore(s => s.addSolicitud);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewingPin, setReviewingPin] = useState<MapPin | null>(null);
    const [reviewRating, setReviewRating] = useState(3);
    const [reviewComment, setReviewComment] = useState('');
    const [pinTitle, setPinTitle] = useState('');
    const [pinDesc, setPinDesc] = useState('');
    const [pinCategory, setPinCategory] = useState<'servicio' | 'punto_interes'>('servicio');
    const [pinEmoji, setPinEmoji] = useState('📍');
    const [pinSubcategory, setPinSubcategory] = useState('Otro');
    const [pinWhatsapp, setPinWhatsapp] = useState('');
    const [pinInstagram, setPinInstagram] = useState('');
    const [pinFacebook, setPinFacebook] = useState('');
    const [tappedLat, setTappedLat] = useState<number | null>(null);
    const [tappedLng, setTappedLng] = useState<number | null>(null);
    const [editingPinId, setEditingPinId] = useState<string | null>(null);
    const webViewRef = useRef<WebView>(null);

    const isActualAdmin = isAdmin && viewMode === 'admin';

    const markersJS = mapPins.map(p => {
        const escapedTitle = p.title.replace(/'/g, "\\'");
        const escapedDesc = p.description.replace(/'/g, "\\'").replace(/\n/g, '<br>');
        const typeLabel = p.category === 'servicio' ? `Servicio${p.subcategory ? ` - ${p.subcategory}` : ''}` : 'Punto de Interés';
        const avgRating = (p.reviews && p.reviews.length > 0) ? (p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length).toFixed(1) : null;
        const ratingHtml = avgRating ? `<br>⭐ ${avgRating}/5 (${p.reviews!.length} reseña${p.reviews!.length > 1 ? 's' : ''})` : '';
        const viewBtn = `<br><br><button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({action: 'view_pin', id: '${p.id}'}))" style="background:#3B82F6;color:white;border:none;padding:8px 10px;border-radius:6px;width:100%;margin-bottom:4px;">📋 Ver detalles</button>`;
        const adminHtml = isActualAdmin
            ? `<button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({action: 'edit_pin', id: '${p.id}'}))" style="background:#F59E0B;color:white;border:none;padding:8px 10px;border-radius:6px;width:100%;margin-bottom:4px;">✏️ Editar</button><button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({action: 'delete_pin', id: '${p.id}'}))" style="background:#EF4444;color:white;border:none;padding:8px 10px;border-radius:6px;width:100%">🗑️ Eliminar</button>`
            : '';
        return `L.marker([${p.lat}, ${p.lng}]).addTo(map).bindPopup('<b>${p.emoji} ${escapedTitle}</b><br>${escapedDesc}<br><small>${typeLabel}</small>${ratingHtml}${viewBtn}${adminHtml}');`;
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
            if (data.action === 'delete_pin') {
                const pin = mapPins.find(p => p.id === data.id);
                if (pin) handleRemovePin(pin);
            } else if (data.action === 'edit_pin') {
                const pin = mapPins.find(p => p.id === data.id);
                if (pin) {
                    setPinTitle(pin.title);
                    setPinDesc(pin.description);
                    setPinCategory(pin.category as any);
                    setPinEmoji(pin.emoji);
                    setPinSubcategory(pin.subcategory || 'Otro');
                    setPinWhatsapp(pin.contactWhatsapp || '');
                    setPinInstagram(pin.socialInstagram || '');
                    setPinFacebook(pin.socialFacebook || '');
                    setTappedLat(pin.lat);
                    setTappedLng(pin.lng);
                    setEditingPinId(pin.id);
                    setShowAddModal(true);
                }
            } else if (data.action === 'view_pin') {
                const pin = mapPins.find(p => p.id === data.id);
                if (pin) { setReviewingPin(pin); setShowReviewModal(true); }
            } else if (data.lat !== undefined && data.lng !== undefined) {
                setTappedLat(data.lat);
                setTappedLng(data.lng);
                setShowAddModal(true);
            }
        } catch (e) { }
    }, [mapPins]);

    const handleAddPin = () => {
        if (!pinTitle.trim()) { Alert.alert('Error', 'Ingresa un nombre para el pin.'); return; }
        if (tappedLat === null || tappedLng === null) { Alert.alert('Error', 'Selecciona una ubicación tocando el mapa.'); return; }

        const pinData: any = {
            title: pinTitle.trim(),
            description: pinDesc.trim() || pinTitle.trim(),
            category: pinCategory,
            lat: tappedLat, lng: tappedLng, emoji: pinEmoji,
        };
        if (pinCategory === 'servicio') {
            pinData.subcategory = pinSubcategory;
            pinData.contactWhatsapp = pinWhatsapp;
            pinData.socialInstagram = pinInstagram;
            pinData.socialFacebook = pinFacebook;
        }

        if (isActualAdmin) {
            if (editingPinId) {
                updateMapPin(editingPinId, pinData);
                Alert.alert('✅ Pin actualizado', `"${pinTitle.trim()}" ha sido actualizado.`);
            } else {
                addMapPin(pinData);
                Alert.alert('✅ Pin agregado', `"${pinTitle.trim()}" ha sido agregado al mapa.`);
            }
        } else {
            addSolicitud({
                title: `📍 Pin: ${pinTitle.trim()}`,
                description: `Solicitud de nuevo pin.\n\nNombre: ${pinTitle.trim()}\nDescripción: ${pinDesc.trim() || 'Sin descripción'}\nTipo: ${pinCategory === 'servicio' ? 'Servicio' : 'Punto de Interés'}${pinCategory === 'servicio' ? `\nCategoría: ${pinSubcategory}\nWhatsApp: ${pinWhatsapp || 'N/A'}\nInstagram: ${pinInstagram || 'N/A'}\nFacebook: ${pinFacebook || 'N/A'}` : ''}\nUbicación: ${tappedLat.toFixed(6)}, ${tappedLng.toFixed(6)}`,
                category: 'Nuevo Servicio/Oficio/Emprendimiento',
                user: user?.user_metadata?.full_name || 'Vecino',
                userEmail: user?.email || '',
                hasImage: false,
            });
            Alert.alert('📨 Solicitud enviada', 'Tu solicitud de Pin ha sido enviada al administrador.');
        }
        resetPinForm();
    };

    const resetPinForm = () => {
        setPinTitle(''); setPinDesc(''); setPinEmoji('📍'); setPinSubcategory('Otro');
        setPinWhatsapp(''); setPinInstagram(''); setPinFacebook('');
        setTappedLat(null); setTappedLng(null); setEditingPinId(null);
        setShowAddModal(false);
    };

    const handleRemovePin = (pin: MapPin) => {
        Alert.alert('¿Eliminar pin?', `"${pin.title}" será eliminado del mapa.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => { removeMapPin(pin.id); setShowManageModal(false); } },
        ]);
    };

    const handleCancelPin = () => {
        if (!editingPinId) {
            webViewRef.current?.injectJavaScript('if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; } true;');
        }
        resetPinForm();
    };

    const handleSubmitReview = () => {
        if (!reviewingPin) return;
        if (!reviewComment.trim()) { Alert.alert('Error', 'Escribe un comentario.'); return; }
        addMapPinReview(reviewingPin.id, {
            userId: user?.id || 'anon',
            userName: user?.user_metadata?.full_name || 'Vecino',
            rating: reviewRating,
            comment: reviewComment.trim()
        });
        Alert.alert('✅ Reseña enviada');
        setReviewComment(''); setReviewRating(3);
        // Refresh the pin data
        const updated = mapPins.find(p => p.id === reviewingPin.id);
        if (updated) setReviewingPin({ ...updated });
    };

    const EMOJIS = ['📍', '🔧', '✂️', '🧵', '🍞', '🏪', '💇', '🔑', '🛠️', '🏫', '⛪', '🏥'];

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>🗺️ Mapa del Barrio</Text>
                <Text style={s.subtitle}>
                    {isActualAdmin ? `Toca el mapa para seleccionar ubicación • ${mapPins.length} puntos` : "Toca el mapa para agregar un servicio o punto de interés"}
                </Text>
                {isActualAdmin && (
                    <View style={s.adminBtns}>
                        <TouchableOpacity style={s.managePinBtn} onPress={() => setShowManageModal(true)}>
                            <Text style={s.managePinText}>📋 Gestionar Pins</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            <WebView
                ref={webViewRef}
                key={`${mapPins.length}-${mapPins.map(p => (p.reviews || []).length).join(',')}`}
                style={s.map}
                originWhitelist={['*']}
                source={{ html: MAP_HTML }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onMessage={handleWebViewMessage}
            />

            {/* Add/Edit Pin Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={handleCancelPin}>
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                        <View style={s.modalContent} onStartShouldSetResponder={() => true}>
                            <Text style={s.modalTitle}>{isActualAdmin ? (editingPinId ? '✏️ Editar Pin' : '📍 Nuevo Pin') : '📨 Solicitar Pin'}</Text>
                            {!isActualAdmin && <Text style={s.requestNote}>Tu solicitud será revisada por el administrador.</Text>}
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
                            <TextInput style={s.input} placeholder="Nombre" placeholderTextColor="#94A3B8" value={pinTitle} onChangeText={setPinTitle} />
                            {pinCategory === 'punto_interes' ? (
                                <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Descripción" placeholderTextColor="#94A3B8" value={pinDesc} onChangeText={setPinDesc} multiline textAlignVertical="top" />
                            ) : (
                                <>
                                    <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Descripción del servicio" placeholderTextColor="#94A3B8" value={pinDesc} onChangeText={setPinDesc} multiline textAlignVertical="top" />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 }}>Categoría</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                        {SERVICE_SUBCATEGORIES.map((cat, i) => (
                                            <TouchableOpacity key={i} style={[s.subCatBtn, pinSubcategory === cat && s.subCatBtnActive]} onPress={() => setPinSubcategory(cat)}>
                                                <Text style={[s.subCatText, pinSubcategory === cat && { color: '#FFF' }]}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <TextInput style={s.input} placeholder="Contacto WhatsApp" placeholderTextColor="#94A3B8" value={pinWhatsapp} onChangeText={setPinWhatsapp} keyboardType="phone-pad" />
                                    <TextInput style={s.input} placeholder="Instagram (ej: @cuenta)" placeholderTextColor="#94A3B8" value={pinInstagram} onChangeText={setPinInstagram} />
                                    <TextInput style={s.input} placeholder="Facebook (URL o nombre)" placeholderTextColor="#94A3B8" value={pinFacebook} onChangeText={setPinFacebook} />
                                </>
                            )}
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 }}>Icono:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiScroll}>
                                {EMOJIS.map((e, i) => (
                                    <TouchableOpacity key={i} style={[s.emojiBtn, pinEmoji === e && s.emojiBtnActive]} onPress={() => setPinEmoji(e)}>
                                        <Text style={s.emojiText}>{e}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity style={s.confirmBtn} onPress={handleAddPin}>
                                <Text style={s.confirmText}>{isActualAdmin ? (editingPinId ? '💾 Guardar' : '✅ Agregar') : '📨 Enviar Solicitud'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCancelPin} style={s.cancelBtn}>
                                <Text style={s.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </TouchableOpacity>
            </Modal>

            {/* Manage Pins Modal */}
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
                                        <Text style={s.pinCat}>{p.category === 'servicio' ? `🔧 ${p.subcategory || 'Servicio'}` : '📍 Punto de interés'}</Text>
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

            {/* Review/Detail Pin Modal */}
            <Modal visible={showReviewModal} transparent animationType="fade">
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => { setShowReviewModal(false); setReviewingPin(null); }}>
                    <View style={[s.modalContent, { maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
                        {reviewingPin && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={{ fontSize: 36, textAlign: 'center' }}>{reviewingPin.emoji}</Text>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1E3A5F', textAlign: 'center', marginBottom: 4 }}>{reviewingPin.title}</Text>
                                <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 8 }}>{reviewingPin.description}</Text>
                                <Text style={{ fontSize: 12, color: '#2563EB', textAlign: 'center', marginBottom: 4 }}>
                                    {reviewingPin.category === 'servicio' ? `🔧 Servicio - ${reviewingPin.subcategory || 'General'}` : '📍 Punto de Interés'}
                                </Text>
                                {reviewingPin.category === 'servicio' && (
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                                        {reviewingPin.contactWhatsapp ? <Text style={{ fontSize: 13, color: '#334155', marginBottom: 2 }}>📱 WhatsApp: {reviewingPin.contactWhatsapp}</Text> : null}
                                        {reviewingPin.socialInstagram ? <Text style={{ fontSize: 13, color: '#334155', marginBottom: 2 }}>📸 Instagram: {reviewingPin.socialInstagram}</Text> : null}
                                        {reviewingPin.socialFacebook ? <Text style={{ fontSize: 13, color: '#334155' }}>📘 Facebook: {reviewingPin.socialFacebook}</Text> : null}
                                        {!reviewingPin.contactWhatsapp && !reviewingPin.socialInstagram && !reviewingPin.socialFacebook && <Text style={{ fontSize: 13, color: '#94A3B8' }}>Sin información de contacto</Text>}
                                    </View>
                                )}

                                {/* Reviews */}
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E3A5F', marginTop: 12, marginBottom: 8 }}>⭐ Reseñas</Text>
                                {(reviewingPin.reviews && reviewingPin.reviews.length > 0) ? (
                                    reviewingPin.reviews.map(r => (
                                        <View key={r.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ fontWeight: '600', color: '#0F172A', fontSize: 13 }}>{r.userName}</Text>
                                                <Text style={{ color: '#F59E0B', fontSize: 13 }}>{'⭐'.repeat(r.rating)}</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#64748B' }}>{r.comment}</Text>
                                            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{r.date}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 8 }}>No hay reseñas aún</Text>
                                )}

                                {/* Add review form */}
                                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 8 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E3A5F', marginBottom: 6 }}>Dejar reseña</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={{ padding: 4 }}>
                                                <Text style={{ fontSize: 24 }}>{star <= reviewRating ? '⭐' : '☆'}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TextInput
                                        style={[s.input, { marginBottom: 8 }]}
                                        placeholder="Tu comentario..."
                                        placeholderTextColor="#94A3B8"
                                        value={reviewComment}
                                        onChangeText={setReviewComment}
                                        multiline
                                    />
                                    <TouchableOpacity style={s.confirmBtn} onPress={handleSubmitReview}>
                                        <Text style={s.confirmText}>📤 Enviar Reseña</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                        <TouchableOpacity onPress={() => { setShowReviewModal(false); setReviewingPin(null); }} style={[s.cancelBtn, { marginTop: 12 }]}>
                            <Text style={s.cancelText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },
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
    catBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E2E8F0' },
    catBtnActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
    catBtnActive2: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    catBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    input: { backgroundColor: 'transparent', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    subCatBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    subCatBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    subCatText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    emojiScroll: { marginBottom: 12 },
    emojiBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 6, borderWidth: 2, borderColor: 'transparent' },
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
