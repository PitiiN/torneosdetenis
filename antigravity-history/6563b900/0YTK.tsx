import React from "react";
import { Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { Match, MatchSet, Court } from "../../types/admin";

export type MatchEditModalProps = {
    visible: boolean;
    match: Match | null;
    profileNameById: Map<string, string>;
    editingWinnerId: string;
    setEditingWinnerId: (id: string) => void;
    editingSets: MatchSet[];
    setEditingSets: React.Dispatch<React.SetStateAction<MatchSet[]>>;
    courts: Court[];
    scheduleCourtId: string;
    setScheduleCourtId: (id: string) => void;
    scheduleStartAt: string;
    setScheduleStartAt: (val: string) => void;
    scheduleStatus: "SCHEDULED" | "IN_PLAY" | "DELAYED" | "DONE";
    setScheduleStatus: (val: any) => void;
    onSave: () => void;
    onClose: () => void;
};

export function MatchEditModal({
    visible,
    match,
    profileNameById,
    editingWinnerId,
    setEditingWinnerId,
    editingSets,
    setEditingSets,
    courts,
    scheduleCourtId,
    setScheduleCourtId,
    scheduleStartAt,
    setScheduleStartAt,
    scheduleStatus,
    setScheduleStatus,
    onSave,
    onClose,
}: MatchEditModalProps) {
    if (!match) return null;

    const p1Name = match.player1_id ? profileNameById.get(match.player1_id) : match.player1_manual_name || "BYE";
    const p2Name = match.player2_id ? profileNameById.get(match.player2_id) : match.player2_manual_name || "BYE";

    // For manual names, we can use the manual name string as the "winnerId" payload to distinguish,
    // or just pass it to the DB. However, the schema expects a UUID for `winner_id`.
    // Wait, the DB `winner_id` is a UUID. Can we store text in `winner_id`? 
    // Usually no. If the user is unregistered, they don't have a UUID. 
    // Does the schema allow text for winner_id? It's typically a UUID foreign key.
    // If we want manual players to "win" a match and advance, we might need a `winner_manual_name` column.
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <ScrollView style={{ maxHeight: "90%" }} contentContainerStyle={{ paddingBottom: 24 }}>
                        <AppText variant="title" style={styles.blockTitle}>
                            Editar Partido
                        </AppText>
                        <AppText tone="muted" style={styles.mb}>
                            {p1Name} vs {p2Name}
                        </AppText>

                        {/* --- SCHEDULE SECTION --- */}
                        <AppText style={styles.label}>Cancha</AppText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                style={styles.pickerText}
                                dropdownIconColor="#B8E600"
                                selectedValue={scheduleCourtId}
                                onValueChange={setScheduleCourtId}
                            >
                                <Picker.Item label="Sin cancha..." value="" />
                                {courts.map((c) => (
                                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                                ))}
                            </Picker>
                        </View>

                        <AppText style={styles.label}>Horario</AppText>
                        <AppInput
                            value={scheduleStartAt}
                            onChangeText={setScheduleStartAt}
                            placeholder="Ej: Sábado 10:00 AM"
                            style={{ marginBottom: 12 }}
                        />

                        <AppText style={styles.label}>Estado del Partido</AppText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                style={styles.pickerText}
                                dropdownIconColor="#B8E600"
                                selectedValue={scheduleStatus}
                                onValueChange={(v) => setScheduleStatus(v as any)}
                            >
                                <Picker.Item label="Programado" value="SCHEDULED" />
                                <Picker.Item label="En Juego" value="IN_PLAY" />
                                <Picker.Item label="Retrasado" value="DELAYED" />
                                <Picker.Item label="Terminado" value="DONE" />
                            </Picker>
                        </View>

                        {/* --- SCORE SECTION --- */}
                        <AppText style={styles.label}>Ganador</AppText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                style={styles.pickerText}
                                dropdownIconColor="#B8E600"
                                selectedValue={editingWinnerId}
                                onValueChange={setEditingWinnerId}
                            >
                                <Picker.Item label="Selecciona ganador" value="" />
                                {match.player1_id || match.player1_manual_name ? (
                                    <Picker.Item
                                        label={p1Name ?? ""}
                                        value={match.player1_id ?? match.player1_manual_name ?? ""}
                                    />
                                ) : null}
                                {match.player2_id || match.player2_manual_name ? (
                                    <Picker.Item
                                        label={p2Name ?? ""}
                                        value={match.player2_id ?? match.player2_manual_name ?? ""}
                                    />
                                ) : null}
                            </Picker>
                        </View>

                        <AppText style={styles.label}>Resultado (Sets)</AppText>
                        <View style={{ marginBottom: 16 }}>
                            {editingSets.map((set, idx) => (
                                <View key={`set-${idx}`} style={styles.setRow}>
                                    <AppText style={{ width: 45, fontSize: 13, color: "#B6C0D4" }}>Set {idx + 1}</AppText>
                                    <TextInput
                                        style={styles.setInput}
                                        placeholderTextColor="#B6C0D4"
                                        keyboardType="numeric"
                                        placeholder="P1"
                                        value={set.p1Games === null ? "" : String(set.p1Games)}
                                        onChangeText={(v) =>
                                            setEditingSets((prev) =>
                                                prev.map((s, i) => (i === idx ? { ...s, p1Games: v === "" ? null : Number(v) } : s)),
                                            )
                                        }
                                    />
                                    <TextInput
                                        style={styles.setInput}
                                        placeholderTextColor="#B6C0D4"
                                        keyboardType="numeric"
                                        placeholder="P2"
                                        value={set.p2Games === null ? "" : String(set.p2Games)}
                                        onChangeText={(v) =>
                                            setEditingSets((prev) =>
                                                prev.map((s, i) => (i === idx ? { ...s, p2Games: v === "" ? null : Number(v) } : s)),
                                            )
                                        }
                                    />
                                    <TextInput
                                        style={styles.setInput}
                                        placeholderTextColor="#B6C0D4"
                                        keyboardType="numeric"
                                        placeholder="TB1"
                                        value={set.tbP1 === null || set.tbP1 === undefined ? "" : String(set.tbP1)}
                                        onChangeText={(v) =>
                                            setEditingSets((prev) =>
                                                prev.map((s, i) => (i === idx ? { ...s, tbP1: v === "" ? null : Number(v) } : s)),
                                            )
                                        }
                                    />
                                    <TextInput
                                        style={styles.setInput}
                                        placeholderTextColor="#B6C0D4"
                                        keyboardType="numeric"
                                        placeholder="TB2"
                                        value={set.tbP2 === null || set.tbP2 === undefined ? "" : String(set.tbP2)}
                                        onChangeText={(v) =>
                                            setEditingSets((prev) =>
                                                prev.map((s, i) => (i === idx ? { ...s, tbP2: v === "" ? null : Number(v) } : s)),
                                            )
                                        }
                                    />
                                </View>
                            ))}
                        </View>

                        <View style={styles.actions}>
                            <AppButton title="Guardar Cambios" variant="primary" onPress={onSave} />
                            <AppButton title="Cancelar" variant="secondary" onPress={onClose} />
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        padding: 16,
    },
    modalCard: {
        backgroundColor: "#030614",
        borderRadius: 14,
        padding: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        maxHeight: "90%",
    },
    blockTitle: {
        marginBottom: 8,
        color: "#B8E600"
    },
    mb: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 6,
        color: "#B6C0D4",
        fontSize: 14,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 14,
        marginBottom: 16,
        overflow: "hidden",
        backgroundColor: "#050B2A",
    },
    pickerText: {
        color: "#FFFFFF",
    },
    setRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        gap: 6,
    },
    setInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 8,
        padding: 8,
        color: "#FFFFFF",
        backgroundColor: "#050B2A",
        textAlign: "center",
    },
    actions: {
        gap: 8,
        marginTop: 8,
    },
});
