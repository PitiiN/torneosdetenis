import React from "react";
import { Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { Match, MatchSet } from "../../domain/scoring";

export type MatchEditModalProps = {
    visible: boolean;
    match: Match | null;
    profileNameById: Map<string, string>;
    editingWinnerId: string;
    setEditingWinnerId: (id: string) => void;
    editingSets: MatchSet[];
    setEditingSets: React.Dispatch<React.SetStateAction<MatchSet[]>>;
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
    onSave,
    onClose,
}: MatchEditModalProps) {
    if (!match) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <AppText variant="title" style={styles.blockTitle}>
                        Editar match
                    </AppText>
                    <AppText tone="muted" style={styles.mb}>
                        {profileNameById.get(match.player1_id ?? "") ?? "TBD"} vs{" "}
                        {profileNameById.get(match.player2_id ?? "") ?? "TBD"}
                    </AppText>

                    <View style={styles.pickerContainer}>
                        <Picker
                            style={styles.pickerText}
                            dropdownIconColor="#B8E600"
                            selectedValue={editingWinnerId}
                            onValueChange={setEditingWinnerId}
                        >
                            <Picker.Item label="Selecciona ganador" value="" />
                            {match.player1_id ? (
                                <Picker.Item
                                    label={profileNameById.get(match.player1_id) ?? match.player1_id}
                                    value={match.player1_id}
                                />
                            ) : null}
                            {match.player2_id ? (
                                <Picker.Item
                                    label={profileNameById.get(match.player2_id) ?? match.player2_id}
                                    value={match.player2_id}
                                />
                            ) : null}
                        </Picker>
                    </View>

                    <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
                        {editingSets.map((set, idx) => (
                            <View key={`set-${idx}`} style={styles.setRow}>
                                <AppText style={{ width: 45 }}>Set {idx + 1}</AppText>
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
                    </ScrollView>

                    <View style={styles.actions}>
                        <AppButton title="Guardar resultado" variant="primary" onPress={onSave} />
                        <AppButton title="Cerrar" variant="secondary" onPress={onClose} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 16,
    },
    modalCard: {
        backgroundColor: "#0F173A",
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    blockTitle: {
        marginBottom: 8,
    },
    mb: {
        marginBottom: 16,
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
