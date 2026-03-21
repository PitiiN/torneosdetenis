import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useAppStore, formatCLP } from '../../lib/store';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function AdminFinanceScreen({ navigation }: any) {
    const { finances, memberDues, members, addFinanceEntry, updateFinanceEntry, removeFinanceEntry, updateMemberDue } = useAppStore();
    const [tab, setTab] = useState<'movimientos' | 'cuotas'>('movimientos');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const totalIncome = finances.filter(f => f.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalExpense = finances.filter(f => f.type === 'expense').reduce((a, b) => a + b.amount, 0);

    const filteredMembers = searchQuery.length >= 3
        ? members.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : members;

    const startEdit = (f: any) => {
        setEditId(f.id); setType(f.type); setCategory(f.category); setDescription(f.description); setAmount(f.amount.toString()); setShowForm(true);
    };

    const handleSave = () => {
        if (!category || !description || !amount) { Alert.alert('Error', 'Completa todos los campos.'); return; }
        if (editId) {
            updateFinanceEntry(editId, { type, category, description, amount: parseInt(amount) });
            Alert.alert('✅ Registro actualizado');
        } else {
            addFinanceEntry({ type, category, description, amount: parseInt(amount), date: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) });
            Alert.alert('✅ Registro guardado');
        }
        setShowForm(false); setEditId(null); setCategory(''); setDescription(''); setAmount('');
    };

    const handleDelete = (id: string) => {
        Alert.alert('¿Eliminar?', 'Este registro será eliminado.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => removeFinanceEntry(id) },
        ]);
    };

    const handleMarkPaid = (due: any) => {
        Alert.alert('Marcar como pagada', `¿Registrar pago de ${MONTHS[due.month - 1]} ${due.year} para ${due.memberName}?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Confirmar', onPress: () => updateMemberDue(due.id, 'paid', new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })) },
        ]);
    };

    const exportExcel = async (reportType: 'finance' | 'dues') => {
        try {
            const wb = XLSX.utils.book_new();

            if (reportType === 'finance') {
                const incomeData = finances.filter(f => f.type === 'income').map(f => ({
                    'Fecha': f.date, 'Categoría': f.category, 'Descripción': f.description, 'Monto': f.amount,
                }));
                const expenseData = finances.filter(f => f.type === 'expense').map(f => ({
                    'Fecha': f.date, 'Categoría': f.category, 'Descripción': f.description, 'Monto': f.amount,
                }));
                const wsIncome = XLSX.utils.json_to_sheet(incomeData);
                const wsExpense = XLSX.utils.json_to_sheet(expenseData);
                XLSX.utils.book_append_sheet(wb, wsIncome, 'Ingresos');
                XLSX.utils.book_append_sheet(wb, wsExpense, 'Egresos');
            } else {
                const duesData = memberDues.map(d => ({
                    'Socio': d.memberName, 'Mes': MONTHS[d.month - 1], 'Año': d.year,
                    'Monto': d.amount, 'Estado': d.status === 'paid' ? 'Pagada' : d.status === 'overdue' ? 'Atrasada' : 'Pendiente',
                    'Fecha Pago': d.paidDate || '-',
                }));
                const ws = XLSX.utils.json_to_sheet(duesData);
                XLSX.utils.book_append_sheet(wb, ws, 'Cuotas Socios');
            }

            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const fileName = reportType === 'finance' ? 'Informe_Financiero_JJVV.xlsx' : 'Cuotas_Socios_JJVV.xlsx';
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Descargar ' + fileName });
            } else {
                Alert.alert('Archivo guardado', `El archivo se guardó en: ${fileUri}`);
            }
        } catch (e) {
            Alert.alert('Error', 'No se pudo generar el archivo Excel.');
            console.error(e);
        }
    };

    const cancelForm = () => { setShowForm(false); setEditId(null); setCategory(''); setDescription(''); setAmount(''); };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>← Volver</Text></TouchableOpacity>
                <Text style={s.title}>💰 Gestión Financiera</Text>

                <View style={s.summary}>
                    <View style={[s.sumCard, { backgroundColor: '#F0FDF4' }]}><Text style={s.sumLabel}>Ingresos</Text><Text style={[s.sumValue, { color: '#22C55E' }]}>{formatCLP(totalIncome)}</Text></View>
                    <View style={[s.sumCard, { backgroundColor: '#FEF2F2' }]}><Text style={s.sumLabel}>Egresos</Text><Text style={[s.sumValue, { color: '#EF4444' }]}>{formatCLP(totalExpense)}</Text></View>
                </View>
                <View style={s.balanceCard}>
                    <Text style={s.balLabel}>Balance Total</Text>
                    <Text style={[s.balValue, { color: totalIncome - totalExpense >= 0 ? '#22C55E' : '#EF4444' }]}>{formatCLP(totalIncome - totalExpense)}</Text>
                </View>

                <View style={s.exportRow}>
                    <TouchableOpacity style={[s.exportBtn, { backgroundColor: '#7C3AED' }]} onPress={() => exportExcel('finance')}><Text style={s.exportText}>📊 Excel Ingresos/Egresos</Text></TouchableOpacity>
                    <TouchableOpacity style={[s.exportBtn, { backgroundColor: '#2563EB' }]} onPress={() => exportExcel('dues')}><Text style={s.exportText}>👥 Excel Cuotas</Text></TouchableOpacity>
                </View>

                <View style={s.tabs}>
                    <TouchableOpacity style={[s.tab, tab === 'movimientos' && s.tabActive]} onPress={() => setTab('movimientos')}><Text style={[s.tabText, tab === 'movimientos' && s.tabTextActive]}>Movimientos</Text></TouchableOpacity>
                    <TouchableOpacity style={[s.tab, tab === 'cuotas' && s.tabActive]} onPress={() => setTab('cuotas')}><Text style={[s.tabText, tab === 'cuotas' && s.tabTextActive]}>Cuotas Socios</Text></TouchableOpacity>
                </View>

                {tab === 'movimientos' && (<>
                    <TouchableOpacity style={s.newBtn} onPress={() => showForm ? cancelForm() : setShowForm(true)}>
                        <Text style={s.newBtnText}>{showForm ? '✕ Cancelar' : '+ Nuevo Registro'}</Text>
                    </TouchableOpacity>
                    {showForm && (
                        <View style={s.form}>
                            <Text style={s.formTitle}>{editId ? '✏️ Editar' : '📝 Nuevo Registro'}</Text>
                            <View style={s.typeRow}>
                                <TouchableOpacity style={[s.typeBtn, type === 'income' && s.typeIncome]} onPress={() => setType('income')}><Text style={[s.typeText, type === 'income' && { color: '#FFF' }]}>📥 Ingreso</Text></TouchableOpacity>
                                <TouchableOpacity style={[s.typeBtn, type === 'expense' && s.typeExpense]} onPress={() => setType('expense')}><Text style={[s.typeText, type === 'expense' && { color: '#FFF' }]}>📤 Egreso</Text></TouchableOpacity>
                            </View>
                            <TextInput style={s.input} placeholder="Categoría" placeholderTextColor="#94A3B8" value={category} onChangeText={setCategory} />
                            <TextInput style={s.input} placeholder="Descripción" placeholderTextColor="#94A3B8" value={description} onChangeText={setDescription} />
                            <TextInput style={s.input} placeholder="Monto ($)" placeholderTextColor="#94A3B8" value={amount} onChangeText={setAmount} keyboardType="numeric" />
                            <TouchableOpacity style={s.submitBtn} onPress={handleSave}><Text style={s.submitText}>{editId ? '💾 Guardar' : '✅ Registrar'}</Text></TouchableOpacity>
                        </View>
                    )}
                    {finances.map(f => (
                        <TouchableOpacity key={f.id} style={s.entry} onPress={() => startEdit(f)} onLongPress={() => handleDelete(f.id)}>
                            <Text style={s.entryIcon}>{f.type === 'income' ? '📥' : '📤'}</Text>
                            <View style={s.entryInfo}><Text style={s.entryDesc}>{f.description}</Text><Text style={s.entryMeta}>{f.category} • {f.date}</Text></View>
                            <Text style={[s.entryAmount, { color: f.type === 'income' ? '#22C55E' : '#EF4444' }]}>{f.type === 'income' ? '+' : '-'}{formatCLP(f.amount)}</Text>
                        </TouchableOpacity>
                    ))}
                    <Text style={s.hint}>💡 Toca para editar, mantén presionado para eliminar</Text>
                </>)}

                {tab === 'cuotas' && (<>
                    <TextInput style={s.searchInput} placeholder="🔍 Buscar socio (mín. 3 letras)..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />

                    {filteredMembers.map(m => {
                        const dues = memberDues.filter(d => d.memberId === m.id).sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
                        const paid = dues.filter(d => d.status === 'paid').length;
                        const pending = dues.filter(d => d.status !== 'paid').length;
                        return (
                            <View key={m.id}>
                                <View style={s.memberHeader}>
                                    <View style={s.memberAvatar}><Text style={s.memberAvatarText}>{m.name[0]}</Text></View>
                                    <View><Text style={s.memberName}>{m.name}</Text><Text style={s.memberStats}>✅ {paid} pagadas • ⏳ {pending} pendientes</Text></View>
                                </View>
                                {dues.map(d => (
                                    <TouchableOpacity key={d.id} style={[s.dueRow, { borderLeftColor: d.status === 'paid' ? '#22C55E' : d.status === 'overdue' ? '#EF4444' : '#F59E0B' }]}
                                        onPress={() => d.status !== 'paid' && handleMarkPaid(d)} disabled={d.status === 'paid'}>
                                        <Text style={s.dueMonth}>{MONTHS[d.month - 1]} {d.year}</Text>
                                        <Text style={s.dueAmount}>{formatCLP(d.amount)}</Text>
                                        <View style={[s.dueBadge, { backgroundColor: d.status === 'paid' ? '#F0FDF4' : d.status === 'overdue' ? '#FEF2F2' : '#FFFBEB' }]}>
                                            <Text style={{ color: d.status === 'paid' ? '#22C55E' : d.status === 'overdue' ? '#EF4444' : '#F59E0B', fontSize: 11, fontWeight: '600' }}>
                                                {d.status === 'paid' ? '✅ Pagada' : d.status === 'overdue' ? '⚠️ Atrasada' : '⏳ Pendiente'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        );
                    })}
                    {searchQuery.length > 0 && searchQuery.length < 3 && (
                        <Text style={s.hint}>Escribe al menos 3 letras para buscar</Text>
                    )}
                    {searchQuery.length >= 3 && filteredMembers.length === 0 && (
                        <Text style={s.hint}>No se encontraron socios con ese nombre</Text>
                    )}
                    <Text style={s.hint}>💡 Toca una cuota pendiente para marcarla como pagada</Text>
                </>)}
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
    sumLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 }, sumValue: { fontSize: 16, fontWeight: 'bold' },
    balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 2 },
    balLabel: { fontSize: 14, color: '#64748B', marginBottom: 4 }, balValue: { fontSize: 28, fontWeight: 'bold' },
    exportRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    exportBtn: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
    exportText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
    tabs: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 10, marginBottom: 16, padding: 3 },
    tab: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
    tabActive: { backgroundColor: '#FFFFFF', elevation: 1 },
    tabText: { color: '#64748B', fontWeight: '600', fontSize: 14 }, tabTextActive: { color: '#1E3A5F' },
    searchInput: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
    newBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
    newBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
    form: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 16, elevation: 2 },
    formTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 8 },
    typeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    typeBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    typeIncome: { backgroundColor: '#22C55E', borderColor: '#22C55E' }, typeExpense: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    typeText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    input: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, fontSize: 14, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
    submitBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
    submitText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
    entry: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    entryIcon: { fontSize: 18, marginRight: 10 }, entryInfo: { flex: 1 },
    entryDesc: { fontSize: 14, fontWeight: '600', color: '#0F172A' }, entryMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    entryAmount: { fontSize: 14, fontWeight: 'bold' },
    memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 12 },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E3A5F', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    memberAvatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    memberName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
    memberStats: { fontSize: 12, color: '#64748B', marginTop: 2 },
    dueRow: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, elevation: 1 },
    dueMonth: { fontSize: 14, fontWeight: '600', color: '#0F172A', flex: 1 },
    dueAmount: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginRight: 8 },
    dueBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    hint: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12, marginBottom: 20 },
});
