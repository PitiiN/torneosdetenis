import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../lib/store';

export default function AdminFinanceScreen({ navigation }: any) {
    const { finances, addFinanceEntry } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    const totalIncome = finances.filter(f => f.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalExpense = finances.filter(f => f.type === 'expense').reduce((a, b) => a + b.amount, 0);

    const handleSubmit = () => {
        if (!category || !description || !amount) { Alert.alert('Error', 'Completa todos los campos.'); return; }
        addFinanceEntry({ type, category, description, amount: parseInt(amount), date: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) });
        Alert.alert('✅ Registro guardado');
        setShowForm(false); setCategory(''); setDescription(''); setAmount('');
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>← Volver</Text></TouchableOpacity>
                <Text style={s.title}>💰 Gestión Financiera</Text>

                <View style={s.summary}>
                    <View style={[s.sumCard, { backgroundColor: '#F0FDF4' }]}><Text style={s.sumLabel}>Ingresos</Text><Text style={[s.sumValue, { color: '#22C55E' }]}>+${totalIncome.toLocaleString('es-CL')}</Text></View>
                    <View style={[s.sumCard, { backgroundColor: '#FEF2F2' }]}><Text style={s.sumLabel}>Egresos</Text><Text style={[s.sumValue, { color: '#EF4444' }]}>-${totalExpense.toLocaleString('es-CL')}</Text></View>
                </View>
                <View style={s.balanceCard}>
                    <Text style={s.balLabel}>Balance Total</Text>
                    <Text style={[s.balValue, { color: totalIncome - totalExpense >= 0 ? '#22C55E' : '#EF4444' }]}>${(totalIncome - totalExpense).toLocaleString('es-CL')}</Text>
                </View>

                <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(!showForm)}>
                    <Text style={s.newBtnText}>{showForm ? '✕ Cancelar' : '+ Nuevo Registro'}</Text>
                </TouchableOpacity>

                {showForm && (
                    <View style={s.form}>
                        <Text style={s.label}>Tipo</Text>
                        <View style={s.typeRow}>
                            <TouchableOpacity style={[s.typeBtn, type === 'income' && s.typeIncome]} onPress={() => setType('income')}>
                                <Text style={[s.typeText, type === 'income' && { color: '#FFFFFF' }]}>📥 Ingreso</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.typeBtn, type === 'expense' && s.typeExpense]} onPress={() => setType('expense')}>
                                <Text style={[s.typeText, type === 'expense' && { color: '#FFFFFF' }]}>📤 Egreso</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={s.label}>Categoría</Text>
                        <TextInput style={s.input} placeholder="Ej: Cuotas, Mantenimiento..." placeholderTextColor="#94A3B8" value={category} onChangeText={setCategory} />
                        <Text style={s.label}>Descripción</Text>
                        <TextInput style={s.input} placeholder="Detalle del movimiento" placeholderTextColor="#94A3B8" value={description} onChangeText={setDescription} />
                        <Text style={s.label}>Monto ($)</Text>
                        <TextInput style={s.input} placeholder="50000" placeholderTextColor="#94A3B8" value={amount} onChangeText={setAmount} keyboardType="numeric" />
                        <TouchableOpacity style={s.submitBtn} onPress={handleSubmit}><Text style={s.submitText}>Guardar Registro</Text></TouchableOpacity>
                    </View>
                )}

                <Text style={s.section}>Últimos movimientos</Text>
                {finances.map(f => (
                    <View key={f.id} style={s.entry}>
                        <Text style={s.entryIcon}>{f.type === 'income' ? '📥' : '📤'}</Text>
                        <View style={s.entryInfo}>
                            <Text style={s.entryDesc}>{f.description}</Text>
                            <Text style={s.entryMeta}>{f.category} • {f.date}</Text>
                        </View>
                        <Text style={[s.entryAmount, { color: f.type === 'income' ? '#22C55E' : '#EF4444' }]}>
                            {f.type === 'income' ? '+' : '-'}${f.amount.toLocaleString('es-CL')}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' }, scroll: { padding: 20 },
    back: { marginBottom: 16 }, backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    summary: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    sumCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 1 },
    sumLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
    sumValue: { fontSize: 18, fontWeight: 'bold' },
    balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, elevation: 2 },
    balLabel: { fontSize: 14, color: '#64748B', marginBottom: 4 },
    balValue: { fontSize: 28, fontWeight: 'bold' },
    newBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
    newBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    typeIncome: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
    typeExpense: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    typeText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    submitBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    submitText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    section: { fontSize: 16, fontWeight: 'bold', color: '#64748B', marginBottom: 10, marginTop: 8 },
    entry: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    entryIcon: { fontSize: 20, marginRight: 12 },
    entryInfo: { flex: 1 },
    entryDesc: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    entryMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    entryAmount: { fontSize: 16, fontWeight: 'bold' },
});
