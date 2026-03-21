import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';
import ManageMembersScreen from '../screens/admin/ManageMembersScreen';
import AdminFinanceScreen from '../screens/admin/AdminFinanceScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import NeighborhoodMapScreen from '../screens/user/NeighborhoodMapScreen';

const Stack = createNativeStackNavigator();

export default function AdminMoreStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminMenu" component={AdminMoreScreen} />
            <Stack.Screen name="ManageMembers" component={ManageMembersScreen} />
            <Stack.Screen name="AdminFinance" component={AdminFinanceScreen} />
            <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
            <Stack.Screen name="MapaAdmin" component={NeighborhoodMapScreen} />
        </Stack.Navigator>
    );
}
