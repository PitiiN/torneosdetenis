import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';
import ManageMembersScreen from '../screens/admin/ManageMembersScreen';

const Stack = createNativeStackNavigator();

export default function AdminMoreStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AdminMenu" component={AdminMoreScreen} />
            <Stack.Screen name="ManageMembers" component={ManageMembersScreen} />
        </Stack.Navigator>
    );
}
