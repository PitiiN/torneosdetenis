 import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type Category = {
  id: string;
  tournament_id: string;
  name: string;
  type: "singles" | "doubles";
  level: "Cuarta" | "Tercera" | "Honor";
  price_amount: number | null;
  currency: string;
};

type Registration = {
  id: string;
  category_id: string;
  status: "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED";
};

type PaymentProof = {
  id: string;
  registration_id: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "NEEDS_INFO";
  reference: string;
  notes: string | null;
  created_at: string;
};

export function TournamentsScreen() {
  const [loading, setLoading] = useState(true);
  const [submittingCategoryId, setSubmittingCategoryId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);

  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [proofReference, setProofReference] = useState("");
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [sendingProof, setSendingProof] = useState(false);

  function formatPrice(priceAmount: number | null, currency: string): string {
    if (priceAmount === null) return "Sin precio";
    return `$${priceAmount.toLocaleString("es-CL")} ${currency.toUpperCase()}`;
  }

  async function loadData() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const currentUserId = userRes.user?.id ?? null;
    setUserId(currentUserId);

    const tournamentsRes = await supabase
      .from("tournaments")
      .select("id, name, start_date, end_date, status")
      .order("start_date", { ascending: true });

    if (tournamentsRes.error) {
      setLoading(false);
      return Alert.alert("Error", tournamentsRes.error.message);
    }

    const categoriesRes = await supabase
      .from("categories")
      .select("id, tournament_id, name, type, level, price_amount, currency")
      .order("created_at", { ascending: true });

    if (categoriesRes.error) {
      setLoading(false);
      return Alert.alert("Error", categoriesRes.error.message);
    }

    let registrationsData: Registration[] = [];
    let proofsData: PaymentProof[] = [];

    if (currentUserId) {
      const registrationsRes = await supabase
        .from("registrations")
        .select("id, category_id, status")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (registrationsRes.error) {
        setLoading(false);
        return Alert.alert("Error", registrationsRes.error.message);
      }

      const proofsRes = await supabase
        .from("payment_proofs")
        .select("id, registration_id, status, reference, notes, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (proofsRes.error) {
        setLoading(false);
        return Alert.alert("Error", proofsRes.error.message);
      }

      registrationsData = (registrationsRes.data as Registration[]) ?? [];
      proofsData = (proofsRes.data as PaymentProof[]) ?? [];
    }

    setTournaments((tournamentsRes.data as Tournament[]) ?? []);
    setCategories((categoriesRes.data as Category[]) ?? []);
    setRegistrations(registrationsData);
    setProofs(proofsData);
    setLoading(false);
  }

  async function registerInCategory(categoryId: string) {
    if (!userId) {
      return Alert.alert("Error", "Debes iniciar sesion.");
    }

    setSubmittingCategoryId(categoryId);
    const { error } = await supabase.from("registrations").insert({
      category_id: categoryId,
      user_id: userId,
      status: "PENDING_PAYMENT",
    });
    setSubmittingCategoryId(null);

    if (error) {
      if (error.code === "23505") {
        return Alert.alert("Info", "Ya estabas inscrito en esta categoria.");
      }

      return Alert.alert("Error", error.message);
    }

    Alert.alert("Listo", "Inscripcion creada con estado PENDING_PAYMENT.");
    loadData();
  }

  function openProofModal(registration: Registration, category: Category) {
    setSelectedRegistration(registration);
    setSelectedCategory(category);
    setProofReference("");
    setProofImageUri(null);
    setProofModalVisible(true);
  }

  async function pickProofImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert("Permiso requerido", "Debes autorizar acceso a la galeria.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setProofImageUri(result.assets[0].uri);
  }

  async function submitProof() {
    if (!userId || !selectedRegistration || !selectedCategory) {
      return Alert.alert("Error", "No se pudo identificar la inscripcion.");
    }

    if (!proofReference.trim()) {
      return Alert.alert("Validacion", "Ingresa una referencia de transferencia.");
    }

    if (!proofImageUri) {
      return Alert.alert("Validacion", "Selecciona una imagen del comprobante.");
    }

    if (selectedCategory.price_amount === null) {
      return Alert.alert("Validacion", "Esta categoria no tiene precio configurado.");
    }

    setSendingProof(true);

    const extension = proofImageUri.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
    const storagePath = `${userId}/${selectedRegistration.id}/${Date.now()}.${safeExtension}`;

const base64 = await FileSystem.readAsStringAsync(proofImageUri, {
  encoding: "base64",
});

const arrayBuffer = decode(base64);

const contentType =
  safeExtension === "png"
    ? "image/png"
    : safeExtension === "webp"
    ? "image/webp"
    : "image/jpeg";

const uploadRes = await supabase.storage
  .from("payment-proofs")
  .upload(storagePath, arrayBuffer, {
    contentType,
    upsert: false,
  });

    if (uploadRes.error) {
      setSendingProof(false);
      return Alert.alert("Error", uploadRes.error.message);
    }

    const proofRes = await supabase.from("payment_proofs").insert({
      registration_id: selectedRegistration.id,
      user_id: userId,
      amount: selectedCategory.price_amount,
      currency: selectedCategory.currency.toLowerCase(),
      method: "bank_transfer",
      reference: proofReference.trim(),
      storage_path: storagePath,
      status: "SUBMITTED",
    });

    setSendingProof(false);

    if (proofRes.error) {
      return Alert.alert("Error", proofRes.error.message);
    }

    setProofModalVisible(false);
    Alert.alert("Listo", "Comprobante enviado.");
    loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  const registrationByCategoryId = useMemo(() => {
    return new Map(registrations.map((registration) => [registration.category_id, registration]));
  }, [registrations]);

  const latestProofByRegistrationId = useMemo(() => {
    return new Map(proofs.map((proof) => [proof.registration_id, proof]));
  }, [proofs]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Cargando torneos...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Torneos</Text>

        {tournaments.length === 0 ? <Text style={styles.empty}>No hay torneos disponibles.</Text> : null}

        {tournaments.map((tournament) => {
          const isOpen = selectedTournamentId === tournament.id;
          const tournamentCategories = categories.filter(
            (category) => category.tournament_id === tournament.id,
          );

          return (
            <View key={tournament.id} style={styles.card}>
              <Text style={styles.cardTitle}>{tournament.name}</Text>
              <Text style={styles.meta}>
                {tournament.start_date} - {tournament.end_date}
              </Text>
              <Text style={styles.meta}>Estado: {tournament.status}</Text>

              <View style={{ height: 10 }} />
              <Button
                title={isOpen ? "Ocultar categorias" : "Ver categorias"}
                onPress={() => setSelectedTournamentId(isOpen ? null : tournament.id)}
              />

              {isOpen ? (
                <View style={styles.categoriesBox}>
                  {tournamentCategories.length === 0 ? (
                    <Text style={styles.empty}>Sin categorias aun.</Text>
                  ) : null}

                  {tournamentCategories.map((category) => {
                    const myRegistration = registrationByCategoryId.get(category.id);
                    const canRegister = !myRegistration;
                    const latestProof = myRegistration
                      ? latestProofByRegistrationId.get(myRegistration.id)
                      : undefined;

                    return (
                      <View key={category.id} style={styles.categoryCard}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.meta}>
                          {category.type} - {category.level}
                        </Text>
                        <Text style={styles.meta}>
                          Precio: {formatPrice(category.price_amount, category.currency)}
                        </Text>
                        <Text style={styles.meta}>
                          Estado inscripcion: {myRegistration?.status ?? "NO_INSCRITO"}
                        </Text>
                        {latestProof ? (
                          <Text style={styles.meta}>
                            Comprobante: {latestProof.status} ({latestProof.reference})
                          </Text>
                        ) : null}
                        {latestProof?.notes ? (
                          <Text style={styles.meta}>Notas admin: {latestProof.notes}</Text>
                        ) : null}

                        <View style={{ height: 8 }} />
                        <Button
                          title={
                            canRegister
                              ? submittingCategoryId === category.id
                                ? "Inscribiendo..."
                                : "Inscribirme"
                              : "Ya inscrito"
                          }
                          disabled={!canRegister || submittingCategoryId === category.id}
                          onPress={() => registerInCategory(category.id)}
                        />

                        {myRegistration?.status === "PENDING_PAYMENT" ? (
                          <>
                            <View style={{ height: 8 }} />
                            <Button
                              title={latestProof ? "Reenviar comprobante" : "Subir comprobante"}
                              onPress={() => openProofModal(myRegistration, category)}
                            />
                          </>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={proofModalVisible} animationType="slide" onRequestClose={() => setProofModalVisible(false)}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Subir comprobante</Text>
          <Text style={styles.meta}>
            Categoria: {selectedCategory?.name ?? "-"} | Precio:{" "}
            {selectedCategory ? formatPrice(selectedCategory.price_amount, selectedCategory.currency) : "-"}
          </Text>
          <View style={{ height: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="Referencia de transferencia"
            value={proofReference}
            onChangeText={setProofReference}
          />
          <Button title="Seleccionar imagen" onPress={pickProofImage} />
          {proofImageUri ? (
            <Image source={{ uri: proofImageUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <Text style={styles.meta}>No hay imagen seleccionada.</Text>
          )}
          <View style={{ height: 12 }} />
          <Button
            title={sendingProof ? "Enviando..." : "Enviar comprobante"}
            disabled={sendingProof}
            onPress={submitProof}
          />
          <View style={{ height: 8 }} />
          <Button title="Cerrar" onPress={() => setProofModalVisible(false)} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardTitle: { fontSize: 17, fontWeight: "600", marginBottom: 4 },
  meta: { fontSize: 13, color: "#555", marginBottom: 4 },
  categoriesBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 10 },
  categoryCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  categoryName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  empty: { color: "#666" },
  modalContent: { padding: 16, paddingBottom: 30 },
  modalTitle: { fontSize: 22, fontWeight: "600", marginBottom: 12, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 10,
  },
});
