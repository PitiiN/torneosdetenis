import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../lib/constants';

import AuthStack from './AuthStack';
import UserTabs from './UserTabs';
import AdminTabs from './AdminTabs';

const prefix = Linking.createURL('/');

export default function RootNavigator() {
    const { session, role, isLoading } = useAuth();
    const [isReady, setIsReady] = useState(false);

    const linking = {
        prefixes: [prefix, 'jjvv://'],
        config: {
            // Define deep link paths here
            screens: {
                UserFlow: {
                    screens: {
                        Mas: {
                            screens: {
                                TicketSub: 'ticket/:id', // Example: jjvv://ticket/123
                            }
                        }
                    }
                },
                AdminFlow: {
                    screens: {
                        TicketsAdmin: 'admin/ticket/:id',
                    }
                }
            },
        },
    };

    useEffect(() => {
        if (!isLoading) {
            setIsReady(true);
        }
    }, [isLoading]);

    if (!isReady || isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' }}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={{ marginTop: 20, color: '#ffffff', fontSize: 18 }}>Cargando JJVV...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer linking={linking}>
            {!session ? (
                <AuthStack />
            ) : isAdminRole(role) ? (
                <AdminTabs />
            ) : (
                <UserTabs />
            )}
        </NavigationContainer>
    );
}
