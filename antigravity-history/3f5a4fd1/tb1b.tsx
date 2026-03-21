import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";

export type AssignablePlayer = {
    userId: string;
    label: string;
};

export type PlayerAssignModalProps = {
    visible: boolean;
    search: string;
    setSearch: (text: string) => void;
    assignablePlayers: AssignablePlayer[];
    onAssignPlayer: (payload: { userId: string | null; manualName: string | null }) => void;
    onClose: () => void;
};

export function PlayerAssignModal({
    visible,
    search,
    setSearch,
    assignablePlayers,
    onAssignPlayer,
    onClose,
}: PlayerAssignModalProps) {
    const [manualNameName, setManualNameName] = React.useState("");

    React.useEffect(() => {
        if (!visible) setManualNameName("");
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <AppText variant="title" style={styles.title}>
                        Asignar jugador
                    </AppText>
                    <AppInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar jugador inscrito..."
                        style={{ marginBottom: 12 }}
                    />

                    <ScrollView style={styles.scrollArea}>
                        <Pressable style={styles.assignOption} onPress={() => onAssignPlayer({ userId: null, manualName: null })}>
                            <AppText tone="muted">BYE / vacio</AppText>
                        </Pressable>

                        {assignablePlayers.map((p) => (
                            <Pressable
                                key={`assign-opt-${p.userId}`}
                                style={styles.assignOption}
                                onPress={() => onAssignPlayer({ userId: p.userId, manualName: null })}
                            >
                                <AppText>{p.label}</AppText>
                            </Pressable>
                        ))}

                        {assignablePlayers.length === 0 ? (
                            <AppText tone="muted" style={{ textAlign: "center", marginTop: 12 }}>
                                Sin resultados.
                            </AppText>
                        ) : null}
                    </ScrollView>

                    <View style={styles.manualEntry}>
                        <AppText style={{ marginBottom: 6 }} tone="muted">O escribe un nombre (Jugador no inscrito):</AppText>
                        <AppInput
                            value={manualNameName}
                            onChangeText={setManualNameName}
                            placeholder="Nombre del jugador..."
                            style={{ marginBottom: 12 }}
                        />
                        <AppButton
                            title="Asignar nombre escrito"
                            variant="primary"
                            disabled={!manualNameName.trim()}
                            onPress={() => onAssignPlayer({ userId: null, manualName: manualNameName.trim() })}
                        />
                    </View>

                    <View style={styles.actions}>
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
        maxHeight: "80%",
    },
    title: {
        marginBottom: 12,
    },
    scrollArea: {
        maxHeight: 300,
        marginBottom: 16,
    },
    assignOption: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 10,
        backgroundColor: "#050B2A",
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    manualEntry: {
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.10)",
        paddingTop: 12,
        marginBottom: 16,
    },
    actions: {
        marginTop: 8,
    },
});
