import React, { useState, useEffect } from "react";
import { Modal, View, StyleSheet, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { Court, Schedule } from "../../types/admin";

export type ScheduleModalProps = {
    visible: boolean;
    matchId: string;
    existingSchedule?: Schedule | null;
    courts: Court[];
    onSave: (payload: { courtId: string; startAt: string; status: "SCHEDULED" | "IN_PLAY" | "DELAYED" | "DONE" }) => void;
    onClose: () => void;
};

export function ScheduleModal({
    visible,
    matchId,
    existingSchedule,
    courts,
    onSave,
    onClose,
}: ScheduleModalProps) {
    const [courtId, setCourtId] = useState("");
    const [startAt, setStartAt] = useState("");
    const [status, setStatus] = useState<"SCHEDULED" | "IN_PLAY" | "DELAYED" | "DONE">("SCHEDULED");

    useEffect(() => {
        if (visible) {
            setCourtId(existingSchedule?.court_id ?? (courts[0]?.id ?? ""));
            setStartAt(existingSchedule?.start_at ?? "");
            setStatus(existingSchedule?.status ?? "SCHEDULED");
        }
    }, [visible, existingSchedule, courts]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <AppText variant="title" style={styles.title}>
                        Programar Partido
                    </AppText>

                    <ScrollView style={styles.scrollArea}>
                        <AppText style={styles.label}>Cancha</AppText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                style={styles.picker}
                                dropdownIconColor="#B8E600"
                                selectedValue={courtId}
                                onValueChange={setCourtId}
                            >
                                {courts.map((c) => (
                                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                                ))}
                            </Picker>
                        </View>

                        <AppText style={styles.label}>Horario (ISO o texto claro)</AppText>
                        <AppInput
                            value={startAt}
                            onChangeText={setStartAt}
                            placeholder="Ej: 2026-10-01T10:00:00Z"
                            style={{ marginBottom: 12 }}
                        />

                        <AppText style={styles.label}>Estado de la Programación</AppText>
                        <View style={styles.pickerContainer}>
                            <Picker
                                style={styles.picker}
                                dropdownIconColor="#B8E600"
                                selectedValue={status}
                                onValueChange={(v) => setStatus(v as any)}
                            >
                                <Picker.Item label="Programado (SCHEDULED)" value="SCHEDULED" />
                                <Picker.Item label="En Juego (IN_PLAY)" value="IN_PLAY" />
                                <Picker.Item label="Retrasado (DELAYED)" value="DELAYED" />
                                <Picker.Item label="Terminado (DONE)" value="DONE" />
                            </Picker>
                        </View>
                    </ScrollView>

                    <View style={styles.actions}>
                        <AppButton
                            title="Guardar Programación"
                            variant="primary"
                            disabled={!courtId || !startAt.trim()}
                            onPress={() => onSave({ courtId, startAt: startAt.trim(), status })}
                        />
                        <View style={{ height: 8 }} />
                        <AppButton title="Cancelar" variant="secondary" onPress={onClose} />
                    </View>
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
        alignItems: "center",
        padding: 16,
    },
    modalCard: {
        backgroundColor: "#030614",
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        width: "100%",
        maxWidth: 400,
        maxHeight: "80%",
    },
    title: {
        marginBottom: 16,
        textAlign: "center",
        color: "#B8E600",
    },
    scrollArea: {
        flexGrow: 0,
        marginBottom: 16,
    },
    label: {
        marginBottom: 6,
        color: "#B6C0D4",
    },
    pickerContainer: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        marginBottom: 12,
        overflow: "hidden",
    },
    picker: {
        color: "white",
        height: 50,
    },
    actions: {
        marginTop: 8,
    },
});
