import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { supabase } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { TournamentsScreen } from "./src/screens/TournamentsScreen";
import { AdminScreen } from "./src/screens/AdminScreen";

type ProfileRole = "player" | "admin" | "organizer" | "referee" | null;

type RootTabParamList = {
  Home: undefined;
  Torneos: undefined;
  Perfil: undefined;
  Admin: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function AppTabs() {
  const [role, setRole] = useState<ProfileRole>(null);

  useEffect(() => {
    async function loadRole() {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setRole(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error) {
        setRole(null);
        return;
      }

      setRole((data?.role as ProfileRole) ?? null);
    }

    loadRole();
  }, []);

  const canViewAdmin = role === "admin" || role === "organizer";

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerTitleAlign: "center" }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Torneos" component={TournamentsScreen} />
        <Tab.Screen name="Perfil" component={ProfileScreen} />
        {canViewAdmin ? <Tab.Screen name="Admin" component={AdminScreen} /> : null}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return session ? <AppTabs /> : <LoginScreen />;
}
