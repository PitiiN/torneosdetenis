import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreMenuScreen from '../screens/user/MoreScreen';
import SolicitudesScreen from '../screens/user/SolicitudesScreen';
import NeighborhoodMapScreen from '../screens/user/NeighborhoodMapScreen';
import DocumentsScreen from '../screens/user/DocumentsScreen';
import DuesScreen from '../screens/user/DuesScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import AccessibilityScreen from '../screens/user/AccessibilityScreen';

const Stack = createNativeStackNavigator();

export default function MoreStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
            <Stack.Screen name="Solicitudes" component={SolicitudesScreen} />
            <Stack.Screen name="NeighborhoodMap" component={NeighborhoodMapScreen} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Dues" component={DuesScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
        </Stack.Navigator>
    );
}
