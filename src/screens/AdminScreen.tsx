import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../lib/supabase";

type ProfileRole = "player" | "admin" | "organizer" | "referee" | null;

type TournamentStatus = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
type CategoryType = "singles" | "doubles";
type CategoryLevel = "Cuarta" | "Tercera" | "Honor";
type PaymentProofStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "NEEDS_INFO";

type Tournament = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: TournamentStatus;
};

type Category = {
  id: string;
  tournament_id: string;
  name: string;
  type: CategoryType;
  level: CategoryLevel;
  price_amount: number | null;
  currency: string;
};

type Registration = {
  id: string;
  category_id: string;
  user_id: string;
  status: "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED";
};

type SimpleProfile = {
  id: string;
  full_name: string | null;
};

type PaymentProof = {
  id: string;
  registration_id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: "bank_transfer";
  reference: string;
  storage_path: string;
  status: PaymentProofStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

export function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [savingTournament, setSavingTournament] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingCategoryPriceId, setSavingCategoryPriceId] = useState<string | null>(null);
  const [reviewingProofId, setReviewingProofId] = useState<string | null>(null);
  const [role, setRole] = useState<ProfileRole>(null);

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentStartDate, setTournamentStartDate] = useState("");
  const [tournamentEndDate, setTournamentEndDate] = useState("");
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>("DRAFT");

  const [categoryTournamentId, setCategoryTournamentId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("singles");
  const [categoryLevel, setCategoryLevel] = useState<CategoryLevel>("Cuarta");
  const [categoryPriceAmount, setCategoryPriceAmount] = useState("");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<SimpleProfile[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [categoryPriceInputs, setCategoryPriceInputs] = useState<Record<string, string>>({});
  const [proofNoteInputs, setProofNoteInputs] = useState<Record<string, string>>({});
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  function parsePriceInput(value: string): number | null {
    if (value.trim() === "") return null;
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0) return NaN;
    return numeric;
  }

  function formatPrice(priceAmount: number | null, currency: string): string {
    if (priceAmount === null) return "Sin precio";
    return `$${priceAmount.toLocaleString("es-CL")} ${currency.toUpperCase()}`;
  }

  async function loadData() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const profileRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileRes.error) {
      setRole(null);
      setLoading(false);
      return Alert.alert("Error", profileRes.error.message);
    }

    const currentRole = (profileRes.data?.role as ProfileRole) ?? null;
    setRole(currentRole);

    if (currentRole !== "admin" && currentRole !== "organizer") {
      setLoading(false);
      return;
    }

    const tournamentsRes = await supabase
      .from("tournaments")
      .select("id, name, start_date, end_date, status")
      .order("created_at", { ascending: false });
    if (tournamentsRes.error) {
      setLoading(false);
      return Alert.alert("Error", tournamentsRes.error.message);
    }

    const categoriesRes = await supabase
      .from("categories")
      .select("id, tournament_id, name, type, level, price_amount, currency")
      .order("created_at", { ascending: false });
    if (categoriesRes.error) {
      setLoading(false);
      return Alert.alert("Error", categoriesRes.error.message);
    }

    const registrationsRes = await supabase
      .from("registrations")
      .select("id, category_id, user_id, status")
      .order("created_at", { ascending: false });
    if (registrationsRes.error) {
      setLoading(false);
      return Alert.alert("Error", registrationsRes.error.message);
    }

    const proofsRes = await supabase
      .from("payment_proofs")
      .select(
        "id, registration_id, user_id, amount, currency, method, reference, storage_path, status, reviewed_by, reviewed_at, notes, created_at",
      )
      .order("created_at", { ascending: false });
    if (proofsRes.error) {
      setLoading(false);
      return Alert.alert("Error", proofsRes.error.message);
    }

    const registrationsData = (registrationsRes.data as Registration[]) ?? [];
    const proofsData = (proofsRes.data as PaymentProof[]) ?? [];
    const uniqueUserIds = [...new Set(registrationsData.map((item) => item.user_id))];
    let profileRows: SimpleProfile[] = [];

    if (uniqueUserIds.length > 0) {
      const profilesRes = await supabase.from("profiles").select("id, full_name").in("id", uniqueUserIds);
      if (profilesRes.error) {
        setLoading(false);
        return Alert.alert("Error", profilesRes.error.message);
      }
      profileRows = (profilesRes.data as SimpleProfile[]) ?? [];
    }

    const tournamentsData = (tournamentsRes.data as Tournament[]) ?? [];
    const categoriesData = (categoriesRes.data as Category[]) ?? [];

    setTournaments(tournamentsData);
    setCategories(categoriesData);
    setRegistrations(registrationsData);
    setProfiles(profileRows);
    setProofs(proofsData);
    setCategoryPriceInputs(
      categoriesData.reduce<Record<string, string>>((acc, category) => {
        acc[category.id] = category.price_amount === null ? "" : String(category.price_amount);
        return acc;
      }, {}),
    );
    setProofNoteInputs(
      proofsData.reduce<Record<string, string>>((acc, proof) => {
        acc[proof.id] = proof.notes ?? "";
        return acc;
      }, {}),
    );

    const signedEntries = await Promise.all(
      proofsData.map(async (proof) => {
        const res = await supabase.storage.from("payment-proofs").createSignedUrl(proof.storage_path, 3600);
        return [proof.id, res.data?.signedUrl ?? ""] as const;
      }),
    );
    setProofUrls(
      signedEntries.reduce<Record<string, string>>((acc, [proofId, url]) => {
        if (url) acc[proofId] = url;
        return acc;
      }, {}),
    );

    if (!categoryTournamentId && tournamentsData.length > 0) {
      setCategoryTournamentId(tournamentsData[0].id);
    }

    setLoading(false);
  }

  async function createTournament() {
    if (!tournamentName || !tournamentStartDate || !tournamentEndDate) {
      return Alert.alert("Validacion", "Completa nombre, fecha inicio y fecha termino.");
    }

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      return Alert.alert("Error", "Sesion no valida.");
    }

    setSavingTournament(true);
    const { error } = await supabase.from("tournaments").insert({
      name: tournamentName,
      start_date: tournamentStartDate,
      end_date: tournamentEndDate,
      status: tournamentStatus,
      created_by: user.id,
    });
    setSavingTournament(false);
    if (error) return Alert.alert("Error", error.message);

    setTournamentName("");
    setTournamentStartDate("");
    setTournamentEndDate("");
    setTournamentStatus("DRAFT");
    Alert.alert("Listo", "Torneo creado.");
    loadData();
  }

  async function createCategory() {
    if (!categoryTournamentId || !categoryName) {
      return Alert.alert("Validacion", "Selecciona torneo e ingresa nombre de categoria.");
    }

    const parsedPrice = parsePriceInput(categoryPriceAmount);
    if (Number.isNaN(parsedPrice)) {
      return Alert.alert("Validacion", "El precio debe ser entero >= 0 en CLP.");
    }

    setSavingCategory(true);
    const { error } = await supabase.from("categories").insert({
      tournament_id: categoryTournamentId,
      name: categoryName,
      type: categoryType,
      level: categoryLevel,
      price_amount: parsedPrice,
      currency: "clp",
    });
    setSavingCategory(false);
    if (error) return Alert.alert("Error", error.message);

    setCategoryName("");
    setCategoryType("singles");
    setCategoryLevel("Cuarta");
    setCategoryPriceAmount("");
    Alert.alert("Listo", "Categoria creada.");
    loadData();
  }

  async function updateCategoryPrice(categoryId: string) {
    const raw = categoryPriceInputs[categoryId] ?? "";
    const parsedPrice = parsePriceInput(raw);
    if (Number.isNaN(parsedPrice)) {
      return Alert.alert("Validacion", "El precio debe ser entero >= 0 en CLP.");
    }

    setSavingCategoryPriceId(categoryId);
    const { error } = await supabase
      .from("categories")
      .update({ price_amount: parsedPrice, currency: "clp" })
      .eq("id", categoryId);
    setSavingCategoryPriceId(null);
    if (error) return Alert.alert("Error", error.message);

    Alert.alert("Listo", "Precio actualizado.");
    loadData();
  }

  async function reviewProof(proofId: string, status: "APPROVED" | "REJECTED" | "NEEDS_INFO") {
    setReviewingProofId(proofId);
    const { error } = await supabase.rpc("review_payment_proof", {
      p_proof_id: proofId,
      p_status: status,
      p_notes: proofNoteInputs[proofId] ?? null,
    });
    setReviewingProofId(null);

    if (error) return Alert.alert("Error", error.message);

    Alert.alert("Listo", `Comprobante marcado como ${status}.`);
    loadData();
  }

  async function openProof(proofId: string) {
    const url = proofUrls[proofId];
    if (!url) {
      return Alert.alert("Info", "No se pudo generar URL firmada para este comprobante.");
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      return Alert.alert("Error", "No se pudo abrir la URL del comprobante.");
    }
    await Linking.openURL(url);
  }

  useEffect(() => {
    loadData();
  }, []);

  const profileNameById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile.full_name ?? "Sin nombre"]));
  }, [profiles]);

  const categoriesByTournament = useMemo(() => {
    const grouped = new Map<string, Category[]>();
    categories.forEach((category) => {
      const current = grouped.get(category.tournament_id) ?? [];
      grouped.set(category.tournament_id, [...current, category]);
    });
    return grouped;
  }, [categories]);

  const registrationsByCategory = useMemo(() => {
    const grouped = new Map<string, Registration[]>();
    registrations.forEach((registration) => {
      const current = grouped.get(registration.category_id) ?? [];
      grouped.set(registration.category_id, [...current, registration]);
    });
    return grouped;
  }, [registrations]);

  const registrationById = useMemo(() => {
    return new Map(registrations.map((registration) => [registration.id, registration]));
  }, [registrations]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const tournamentById = useMemo(() => {
    return new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  }, [tournaments]);

  const proofsByStatus = useMemo(() => {
    const grouped = new Map<PaymentProofStatus, PaymentProof[]>();
    proofs.forEach((proof) => {
      const current = grouped.get(proof.status) ?? [];
      grouped.set(proof.status, [...current, proof]);
    });
    return grouped;
  }, [proofs]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Cargando panel admin...</Text>
      </View>
    );
  }

  if (role !== "admin" && role !== "organizer") {
    return (
      <View style={styles.centered}>
        <Text>No tienes permisos para esta pantalla.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin</Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Crear torneo</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre del torneo"
          value={tournamentName}
          onChangeText={setTournamentName}
        />
        <TextInput
          style={styles.input}
          placeholder="Fecha inicio (YYYY-MM-DD)"
          value={tournamentStartDate}
          onChangeText={setTournamentStartDate}
        />
        <TextInput
          style={styles.input}
          placeholder="Fecha termino (YYYY-MM-DD)"
          value={tournamentEndDate}
          onChangeText={setTournamentEndDate}
        />
        <View style={styles.pickerBox}>
          <Picker selectedValue={tournamentStatus} onValueChange={(value) => setTournamentStatus(value)}>
            <Picker.Item label="DRAFT" value="DRAFT" />
            <Picker.Item label="PUBLISHED" value="PUBLISHED" />
            <Picker.Item label="IN_PROGRESS" value="IN_PROGRESS" />
            <Picker.Item label="FINISHED" value="FINISHED" />
            <Picker.Item label="CANCELLED" value="CANCELLED" />
          </Picker>
        </View>
        <Button
          title={savingTournament ? "Creando..." : "Crear torneo"}
          disabled={savingTournament}
          onPress={createTournament}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Crear categoria</Text>
        <View style={styles.pickerBox}>
          <Picker selectedValue={categoryTournamentId} onValueChange={(value) => setCategoryTournamentId(value)}>
            {tournaments.length === 0 ? (
              <Picker.Item label="No hay torneos" value="" />
            ) : (
              tournaments.map((tournament) => (
                <Picker.Item
                  key={tournament.id}
                  label={`${tournament.name} (${tournament.status})`}
                  value={tournament.id}
                />
              ))
            )}
          </Picker>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Nombre categoria (ej: Singles Honor)"
          value={categoryName}
          onChangeText={setCategoryName}
        />
        <View style={styles.pickerBox}>
          <Picker selectedValue={categoryType} onValueChange={(value) => setCategoryType(value)}>
            <Picker.Item label="singles" value="singles" />
            <Picker.Item label="doubles" value="doubles" />
          </Picker>
        </View>
        <View style={styles.pickerBox}>
          <Picker selectedValue={categoryLevel} onValueChange={(value) => setCategoryLevel(value)}>
            <Picker.Item label="Cuarta" value="Cuarta" />
            <Picker.Item label="Tercera" value="Tercera" />
            <Picker.Item label="Honor" value="Honor" />
          </Picker>
        </View>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Precio en CLP (ej: 18000)"
          value={categoryPriceAmount}
          onChangeText={setCategoryPriceAmount}
        />
        <Button
          title={savingCategory ? "Creando..." : "Crear categoria"}
          disabled={savingCategory || tournaments.length === 0}
          onPress={createCategory}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Inscritos y precio por categoria</Text>
        {tournaments.map((tournament) => {
          const tournamentCategories = categoriesByTournament.get(tournament.id) ?? [];
          return (
            <View key={tournament.id} style={styles.tournamentBox}>
              <Text style={styles.tournamentTitle}>{tournament.name}</Text>
              {tournamentCategories.length === 0 ? <Text style={styles.meta}>Sin categorias.</Text> : null}
              {tournamentCategories.map((category) => {
                const categoryRegistrations = registrationsByCategory.get(category.id) ?? [];
                return (
                  <View key={category.id} style={styles.categoryBox}>
                    <Text style={styles.categoryTitle}>
                      {category.name} ({category.type} - {category.level})
                    </Text>
                    <Text style={styles.meta}>
                      Precio actual: {formatPrice(category.price_amount, category.currency)}
                    </Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="Nuevo precio en CLP"
                      value={categoryPriceInputs[category.id] ?? ""}
                      onChangeText={(value) =>
                        setCategoryPriceInputs((prev) => ({
                          ...prev,
                          [category.id]: value,
                        }))
                      }
                    />
                    <Button
                      title={
                        savingCategoryPriceId === category.id ? "Guardando..." : "Guardar precio categoria"
                      }
                      disabled={savingCategoryPriceId === category.id}
                      onPress={() => updateCategoryPrice(category.id)}
                    />
                    <View style={{ height: 8 }} />
                    {categoryRegistrations.length === 0 ? <Text style={styles.meta}>Sin inscritos.</Text> : null}
                    {categoryRegistrations.map((registration) => (
                      <Text key={registration.id} style={styles.meta}>
                        {profileNameById.get(registration.user_id) ?? registration.user_id} -{" "}
                        {registration.status}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Pagos (comprobantes)</Text>
        {(["SUBMITTED", "NEEDS_INFO", "APPROVED", "REJECTED"] as PaymentProofStatus[]).map((status) => {
          const items = proofsByStatus.get(status) ?? [];
          return (
            <View key={status} style={styles.tournamentBox}>
              <Text style={styles.tournamentTitle}>
                {status} ({items.length})
              </Text>
              {items.length === 0 ? <Text style={styles.meta}>Sin comprobantes.</Text> : null}
              {items.map((proof) => {
                const registration = registrationById.get(proof.registration_id);
                const category = registration ? categoryById.get(registration.category_id) : null;
                const tournament = category ? tournamentById.get(category.tournament_id) : null;
                return (
                  <View key={proof.id} style={styles.categoryBox}>
                    <Text style={styles.categoryTitle}>{tournament?.name ?? "Torneo no encontrado"}</Text>
                    <Text style={styles.meta}>
                      Categoria: {category?.name ?? "N/A"} | Registro: {registration?.status ?? "N/A"}
                    </Text>
                    <Text style={styles.meta}>
                      Jugador: {profileNameById.get(proof.user_id) ?? proof.user_id}
                    </Text>
                    <Text style={styles.meta}>
                      Monto: {formatPrice(proof.amount, proof.currency)} | Ref: {proof.reference}
                    </Text>
                    <Text style={styles.meta}>Metodo: {proof.method}</Text>
                    <Text style={styles.meta}>Enviado: {proof.created_at}</Text>
                    {proof.reviewed_at ? <Text style={styles.meta}>Revisado: {proof.reviewed_at}</Text> : null}
                    <Button title="Ver comprobante" onPress={() => openProof(proof.id)} />
                    <View style={{ height: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="Notas de revision"
                      value={proofNoteInputs[proof.id] ?? ""}
                      onChangeText={(value) =>
                        setProofNoteInputs((prev) => ({
                          ...prev,
                          [proof.id]: value,
                        }))
                      }
                    />
                    <View style={styles.inlineButtons}>
                      <Button
                        title="Aprobar"
                        disabled={reviewingProofId === proof.id}
                        onPress={() => reviewProof(proof.id, "APPROVED")}
                      />
                      <Button
                        title="Rechazar"
                        disabled={reviewingProofId === proof.id}
                        onPress={() => reviewProof(proof.id, "REJECTED")}
                      />
                    </View>
                    <View style={{ height: 8 }} />
                    <Button
                      title={reviewingProofId === proof.id ? "Guardando..." : "Pedir info"}
                      disabled={reviewingProofId === proof.id}
                      onPress={() => reviewProof(proof.id, "NEEDS_INFO")}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  block: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  blockTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
  },
  tournamentBox: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
    marginTop: 10,
  },
  tournamentTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  categoryBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  categoryTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  meta: { fontSize: 13, color: "#555", marginBottom: 4 },
  inlineButtons: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
});
