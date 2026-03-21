import React from "react";
import { View } from "react-native";
import { AppButton, AppHeader, AppText, Card, Screen } from "../ui/components";

type Props = {
  orgName: string;
  onGoToTournaments: () => void;
  onGoToPayments: () => void;
  onGoToNotifications: () => void;
};

export function AdminHomeScreen({ orgName, onGoToTournaments, onGoToPayments, onGoToNotifications }: Props) {
  return (
    <Screen scroll>
      <AppHeader title="Home Admin" subtitle={orgName || "Club sin nombre"} />
      <Card>
        <AppText variant="title">Gestion de Torneos</AppText>
        <AppButton title="Nuevo Campeonato" variant="primary" style={{ marginTop: 12 }} onPress={onGoToTournaments} />
      </Card>
      <View style={{ position: "absolute", bottom: 20, right: 20 }}>
        <AppButton title="+ Nuevo Campeonato" variant="primary" onPress={onGoToTournaments} />
      </View>
    </Screen>
  );
}
