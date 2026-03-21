import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { TournamentsScreen } from "./src/screens/TournamentsScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { ensureProfile, isAdminLike, normalizeRole } from "./src/lib/profiles";
import { AppButton, AppText, Screen } from "./src/ui/components";
import { useTheme } from "./src/ui/theme";
import { OrgSelectorScreen } from "./src/screens/OrgSelectorScreen";
import { clearStoredOrgSelection, OrgSelection, setStoredOrgSelection } from "./src/lib/orgSelection";
import { PlayerConfigScreen } from "./src/screens/PlayerConfigScreen";
import { RankingScreen } from "./src/screens/RankingScreen";
import { AdminConfigScreen } from "./src/screens/AdminConfigScreen";
import { AdminPaymentsScreen } from "./src/screens/AdminPaymentsScreen";
import { AdminHomeScreen } from "./src/screens/AdminHomeScreen";
import { AdminScreen } from "./src/screens/AdminScreen";

type ProfileRole = "player" | "admin" | "organizer" | "referee" | null;
type ProfileContext = {
  role: ProfileRole;
  orgId: string | null;
  orgName: string;
};

type PlayerTabParamList = {
  Home: undefined;
  Torneos: undefined;
  Ranking: undefined;
  Notificaciones: undefined;
  Config: undefined;
};

type AdminTabParamList = {
  Home: undefined;
  Torneos: undefined;
  Solicitudes: undefined;
  Notificaciones: undefined;
  Config: undefined;
};

const PlayerTab = createBottomTabNavigator<PlayerTabParamList>();
const AdminTab = createBottomTabNavigator<AdminTabParamList>();
const BOOTSTRAP_TIMEOUT_MS = 12000;

function isMissingRelationError(error: unknown, relation: string): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    message.toLowerCase().includes(relation.toLowerCase()) ||
    message.toLowerCase().includes("schema cache") ||
    message.toLowerCase().includes("does not exist") ||
    code === "PGRST205" ||
    code === "42703" ||
    code === "42P01"
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

function tabIconForRoute(name: string): keyof typeof Ionicons.glyphMap {
  if (name === "Home") return "home-outline";
  if (name === "Torneos") return "tennisball-outline";
  if (name === "Ranking") return "stats-chart-outline";
  if (name === "Solicitudes") return "card-outline";
  if (name === "Notificaciones") return "notifications-outline";
  return "settings-outline";
}

function PlayerTabs({
  orgSelection,
  onChangeOrganization,
}: {
  orgSelection: OrgSelection;
  onChangeOrganization: () => Promise<void>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <NavigationContainer>
      <PlayerTab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: t.colors.deepNavy },
          headerTintColor: t.colors.textOnDark,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
          tabBarStyle: {
            backgroundColor: t.colors.surfaceDark,
            borderTopColor: t.colors.borderDark,
            height: 64 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 6,
          },
          tabBarActiveTintColor: t.colors.neonLime,
          tabBarInactiveTintColor: t.colors.muted,
          tabBarLabelStyle: { fontWeight: "700", fontSize: 12 },
          tabBarIcon: ({ color, size }) => <Ionicons name={tabIconForRoute(route.name)} size={size} color={color} />,
          sceneStyle: { backgroundColor: t.colors.deepNavy },
          headerTitleAlign: "center",
          lazy: true,
          freezeOnBlur: true,
        })}
      >
        <PlayerTab.Screen name="Home">
          {() => <HomeScreen orgSelection={orgSelection} />}
        </PlayerTab.Screen>
        <PlayerTab.Screen name="Torneos">
          {() => <TournamentsScreen mode="player" orgSelection={orgSelection} />}
        </PlayerTab.Screen>
        <PlayerTab.Screen name="Ranking">
          {() => <RankingScreen orgSelection={orgSelection} />}
        </PlayerTab.Screen>
        <PlayerTab.Screen name="Notificaciones">
          {() => (
            <NotificationsScreen mode="player" orgId={orgSelection.type === "real" ? orgSelection.orgId : null} />
          )}
        </PlayerTab.Screen>
        <PlayerTab.Screen name="Config">
          {() => <PlayerConfigScreen orgSelection={orgSelection} onChangeOrganization={onChangeOrganization} />}
        </PlayerTab.Screen>
      </PlayerTab.Navigator>
    </NavigationContainer>
  );
}

function AdminTabs({
  context,
  onSwitchToUserView,
}: {
  context: ProfileContext;
  onSwitchToUserView: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <NavigationContainer>
      <AdminTab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: t.colors.deepNavy },
          headerTintColor: t.colors.textOnDark,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
          tabBarStyle: {
            backgroundColor: t.colors.surfaceDark,
            borderTopColor: t.colors.borderDark,
            height: 64 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 6,
          },
          tabBarActiveTintColor: t.colors.neonLime,
          tabBarInactiveTintColor: t.colors.muted,
          tabBarLabelStyle: { fontWeight: "700", fontSize: 12 },
          tabBarIcon: ({ color, size }) => <Ionicons name={tabIconForRoute(route.name)} size={size} color={color} />,
          sceneStyle: { backgroundColor: t.colors.deepNavy },
          headerTitleAlign: "center",
          lazy: true,
          freezeOnBlur: true,
        })}
      >
        <AdminTab.Screen name="Home">
          {({ navigation }) => (
            <AdminHomeScreen
              orgName={context.orgName}
              onGoToTournaments={() => navigation.navigate("Torneos")}
              onGoToPayments={() => navigation.navigate("Solicitudes")}
              onGoToNotifications={() => navigation.navigate("Notificaciones")}
            />
          )}
        </AdminTab.Screen>
        <AdminTab.Screen name="Torneos">
          {() => <AdminScreen />}
        </AdminTab.Screen>
        <AdminTab.Screen name="Solicitudes">
          {() => <AdminPaymentsScreen orgId={context.orgId} />}
        </AdminTab.Screen>
        <AdminTab.Screen name="Notificaciones">
          {() => <NotificationsScreen mode="admin" orgId={context.orgId} />}
        </AdminTab.Screen>
        <AdminTab.Screen name="Config">
          {() => <AdminConfigScreen orgId={context.orgId} onSwitchToUserView={onSwitchToUserView} />}
        </AdminTab.Screen>
      </AdminTab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const t = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<ProfileContext>({ role: null, orgId: null, orgName: "" });
  const [selectedOrg, setSelectedOrg] = useState<OrgSelection | null>(null);
  const [forcePlayerView, setForcePlayerView] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  async function ensureAdminOrganization(userId: string): Promise<{ orgId: string | null; orgName: string }> {
    const profileRes = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    if (profileRes.error) {
      if (isMissingRelationError(profileRes.error, "org_id")) return { orgId: null, orgName: "" };
      return { orgId: null, orgName: "" };
    }

    let orgId = profileRes.data?.org_id ?? null;
    if (!orgId) {
      const orgInsert = await supabase
        .from("organizations")
        .insert({ name: "", owner_profile_id: userId })
        .select("id,name")
        .single();
      if (!orgInsert.error && orgInsert.data) {
        orgId = orgInsert.data.id;
        await supabase.from("profiles").update({ org_id: orgId }).eq("id", userId);
        return { orgId, orgName: orgInsert.data.name ?? "" };
      }
      if (orgInsert.error && isMissingRelationError(orgInsert.error, "organizations")) {
        return { orgId: null, orgName: "" };
      }
      return { orgId: null, orgName: "" };
    }
    const orgRes = await supabase.from("organizations").select("name").eq("id", orgId).single();
    if (orgRes.error && isMissingRelationError(orgRes.error, "organizations")) {
      return { orgId, orgName: "Club sin nombre" };
    }
    return { orgId, orgName: orgRes.data?.name ?? "" };
  }

  async function fetchContext(userId: string): Promise<ProfileContext> {
    const roleOnlyRes = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (roleOnlyRes.error) return { role: null, orgId: null, orgName: "" };
    const role = normalizeRole(roleOnlyRes.data?.role) as ProfileRole;
    if (isAdminLike(role)) {
      const repaired = await ensureAdminOrganization(userId);
      return { role, orgId: repaired.orgId, orgName: repaired.orgName || "Club sin nombre" };
    }
    const orgRes = await supabase.from("profiles").select("org_id").eq("id", userId).single();
    if (orgRes.error && isMissingRelationError(orgRes.error, "org_id")) {
      return { role: role ?? "player", orgId: null, orgName: "" };
    }
    return { role: role ?? "player", orgId: orgRes.data?.org_id ?? null, orgName: "" };
  }

  async function bootstrap() {
    setLoading(true);
    setBootstrapError(null);
    try {
      const res = await withTimeout(
        supabase.auth.getSession(),
        BOOTSTRAP_TIMEOUT_MS,
        "Timeout obteniendo sesion. Revisa conexion e intenta nuevamente.",
      );
      if (res.error) {
        setBootstrapError(res.error.message);
        setLoading(false);
        return;
      }

      setSession(res.data.session);
      if (res.data.session?.user) {
        const profileRes = await withTimeout(
          ensureProfile(res.data.session.user),
          BOOTSTRAP_TIMEOUT_MS,
          "Timeout validando perfil. Intenta reabrir la app.",
        );
        if (profileRes.error) setBootstrapError(profileRes.error.message);
        const ctx = await fetchContext(res.data.session.user.id);
        setContext(ctx);
        setSelectedOrg(null);
      } else {
        setContext({ role: null, orgId: null, orgName: "" });
        setSelectedOrg(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido inicializando la app.";
      setBootstrapError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectOrg(selection: OrgSelection) {
    await setStoredOrgSelection(selection);
    setSelectedOrg(selection);
    setForcePlayerView(false);
  }

  async function resetOrgSelection() {
    await clearStoredOrgSelection();
    setSelectedOrg(null);
    setForcePlayerView(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => setIntroDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bootstrap();
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // Avoid duplicate concurrent fetches on mount. Let bootstrap() handle initial load.
      if (event === "INITIAL_SESSION") return;

      try {
        setSession(newSession);
        if (newSession?.user) {
          await ensureProfile(newSession.user);
          const ctx = await fetchContext(newSession.user.id);
          setContext(ctx);
          setSelectedOrg(null);
        } else {
          setContext({ role: null, orgId: null, orgName: "" });
          setSelectedOrg(null);
        }
      } catch (error) {
        console.error("Error during auth state change:", error);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const adminInSelectedOrg =
    isAdminLike(context.role) &&
    selectedOrg?.type === "real" &&
    context.orgId !== null &&
    selectedOrg.orgId === context.orgId &&
    !forcePlayerView;

  return (
    <SafeAreaProvider>
      {!introDone ? (
        <Screen>
          <View style={styles.splashWrap}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>ðŸŽ¾</Text>
            </View>
            <AppText variant="h2">Torneos de Tenis</AppText>
            <AppText tone="muted">Pantalla de carga</AppText>
            <ActivityIndicator size="large" color={t.colors.neonLime} />
          </View>
        </Screen>
      ) : loading ? (
        <Screen>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: t.spacing.md }}>
            <ActivityIndicator size="large" color={t.colors.neonLime} />
            <AppText tone="muted">Inicializando entorno sport-tech...</AppText>
          </View>
        </Screen>
      ) : bootstrapError ? (
        <Screen>
          <View style={{ flex: 1, justifyContent: "center", gap: t.spacing.md }}>
            <AppText variant="title">No pudimos iniciar la app</AppText>
            <AppText tone="muted">{bootstrapError}</AppText>
            <AppButton title="Reintentar" variant="secondary" onPress={bootstrap} />
          </View>
        </Screen>
      ) : session ? (
        selectedOrg ? (
          adminInSelectedOrg ? (
            <AdminTabs context={context} onSwitchToUserView={() => setForcePlayerView(true)} />
          ) : (
            <PlayerTabs orgSelection={selectedOrg} onChangeOrganization={resetOrgSelection} />
          )
        ) : (
          <OrgSelectorScreen onSelect={handleSelectOrg} />
        )
      ) : (
        <LoginScreen />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(199,234,70,0.18)",
    borderWidth: 2,
    borderColor: "#C7EA46",
  },
  logoEmoji: {
    fontSize: 52,
  },
});


