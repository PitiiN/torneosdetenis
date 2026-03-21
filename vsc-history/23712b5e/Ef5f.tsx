import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;

  return (
    <View style={styles.container}>
      <Text>Supabase URL loaded:</Text>
      <Text selectable>{url ? "✅ YES" : "❌ NO"}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});