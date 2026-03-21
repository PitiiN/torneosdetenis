import React from "react";
import { Alert, Modal, ScrollView, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { AppText } from "./AppText";
import { Card } from "./Card";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type WizardProps = {
    visible: boolean;
    step: WizardStep;
    tournamentType: "single" | "with_categories";
    tournamentName: string;
    categoryType: "singles" | "doubles";
    categoryLevel: string;
    format: "RR" | "ELIM";
    groupCount: string;
    playersPerGroup: string;
    topK: string;
    drawSize: string;
    seedCount: string;

    setTournamentType: (v: "single" | "with_categories") => void;
    setTournamentName: (v: string) => void;
    setCategoryType: (v: "singles" | "doubles") => void;
    setCategoryLevel: (v: string) => void;
    setFormat: (v: "RR" | "ELIM") => void;
    setGroupCount: (v: string) => void;
    setPlayersPerGroup: (v: string) => void;
    setTopK: (v: string) => void;
    setDrawSize: (v: string) => void;
    setSeedCount: (v: string) => void;

    onCancel: () => void;
    onBack: () => void;
    onNext: () => void;
    onFinish: () => void;
};

const categoryLevelOptions = [
    "Escalafon",
    "Honor",
    "Primera",
    "Segunda",
    "Tercera",
    "Cuarta",
    "Inicial",
];

export function TournamentWizard({
    visible,
    step,
    tournamentType,
    tournamentName,
    categoryType,
    categoryLevel,
    format,
    groupCount,
    playersPerGroup,
    topK,
    drawSize,
    seedCount,
    setTournamentType,
    setTournamentName,
    setCategoryType,
    setCategoryLevel,
    setFormat,
    setGroupCount,
    setPlayersPerGroup,
    setTopK,
    setDrawSize,
    setSeedCount,
    onCancel,
    onBack,
    onNext,
    onFinish,
}: WizardProps) {
    return (
        <Modal visible={visible} animationType="slide">
            <View style={{ flex: 1, backgroundColor: "#050B2A", paddingTop: 40, paddingHorizontal: 16 }}>
                <AppText variant="title" style={{ marginBottom: 16, textAlign: "center" }}>
                    Nuevo Campeonato (Paso {step}/7)
                </AppText>
                <ScrollView style={{ flex: 1 }}>
                    {step === 1 && (
                        <Card>
                            <AppText variant="title">Tipo Campeonato</AppText>
                            <View style={{ marginTop: 16, gap: 12 }}>
                                <AppButton
                                    title="Unico (Torneo = Categoria)"
                                    variant={tournamentType === "single" ? "primary" : "ghost"}
                                    onPress={() => setTournamentType("single")}
                                />
                                <AppButton
                                    title="Compuesto (Multiples Categorias)"
                                    variant={tournamentType === "with_categories" ? "primary" : "ghost"}
                                    onPress={() => {
                                        setTournamentType("with_categories");
                                        Alert.alert("Aviso", "Logica de UI extra requerida, por defecto 'Unico'");
                                    }}
                                    disabled
                                />
                            </View>
                        </Card>
                    )}

                    {step === 2 && (
                        <Card>
                            <AppText variant="title">Nombre Campeonato</AppText>
                            <AppInput value={tournamentName} onChangeText={setTournamentName} placeholder="Ej: Abierto Verano 2026" />
                        </Card>
                    )}

                    {step === 3 && (
                        <Card>
                            <AppText variant="title">Singles o Dobles</AppText>
                            <View style={{ marginTop: 16, gap: 12 }}>
                                <AppButton
                                    title="Singles"
                                    variant={categoryType === "singles" ? "primary" : "ghost"}
                                    onPress={() => setCategoryType("singles")}
                                />
                                <AppButton
                                    title="Dobles"
                                    variant={categoryType === "doubles" ? "primary" : "ghost"}
                                    onPress={() => setCategoryType("doubles")}
                                />
                            </View>
                        </Card>
                    )}

                    {step === 4 && (
                        <Card>
                            <AppText variant="title">Categoria</AppText>
                            <View style={{ borderRadius: 8, overflow: "hidden", marginTop: 8, backgroundColor: "#0F173A" }}>
                                <Picker
                                    selectedValue={categoryLevel}
                                    onValueChange={(v) => setCategoryLevel(v)}
                                    style={{ color: "#FFF" }}
                                    dropdownIconColor="#FFF"
                                >
                                    {categoryLevelOptions.map((level) => (
                                        <Picker.Item key={level} label={level} value={level} />
                                    ))}
                                </Picker>
                            </View>
                        </Card>
                    )}

                    {step === 5 && (
                        <Card>
                            <AppText variant="title">Formato</AppText>
                            <View style={{ marginTop: 16, gap: 12 }}>
                                <AppButton
                                    title="Grupos (Round Robin)"
                                    variant={format === "RR" ? "primary" : "ghost"}
                                    onPress={() => setFormat("RR")}
                                />
                                <AppButton
                                    title="Eliminacion Directa"
                                    variant={format === "ELIM" ? "primary" : "ghost"}
                                    onPress={() => setFormat("ELIM")}
                                />
                            </View>
                        </Card>
                    )}

                    {step === 6 && (
                        <Card>
                            <AppText variant="title">Estructura</AppText>
                            {format === "RR" ? (
                                <>
                                    <AppInput label="N de grupos" value={groupCount} onChangeText={setGroupCount} keyboardType="numeric" />
                                    <AppInput label="Jugadores por grupo" value={playersPerGroup} onChangeText={setPlayersPerGroup} keyboardType="numeric" />
                                    <AppInput label="Clasifican por grupo (Top K)" value={topK} onChangeText={setTopK} keyboardType="numeric" />
                                </>
                            ) : (
                                <>
                                    <AppInput label="Tamano de llave (ej: 8, 16, 32)" value={drawSize} onChangeText={setDrawSize} keyboardType="numeric" />
                                    <AppInput label="N de cabezas de serie" value={seedCount} onChangeText={setSeedCount} keyboardType="numeric" />
                                </>
                            )}
                        </Card>
                    )}

                    {step === 7 && (
                        <Card>
                            <AppText variant="title">Confirmacion</AppText>
                            <AppText style={{ marginTop: 8 }}>{`Nombre: ${tournamentName}`}</AppText>
                            <AppText>{`Categoria: ${categoryLevel} ${categoryType}`}</AppText>
                            <AppText>{`Formato: ${format === "RR" ? "Round Robin" : "Eliminacion"}`}</AppText>
                        </Card>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>

                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                    <AppButton title="Cancelar" variant="ghost" onPress={onCancel} />
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <AppButton title="Atras" variant="secondary" onPress={onBack} disabled={step === 1} />
                        {step < 7 ? (
                            <AppButton title="Siguiente" variant="primary" onPress={onNext} />
                        ) : (
                            <AppButton title="Generar" variant="primary" onPress={onFinish} />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
