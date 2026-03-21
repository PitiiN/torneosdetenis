import React, { useState } from 'react';
import { StyleSheet, TextInput, View, Button, Alert } from 'react-native';
import { Text } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert(error.message);
        else router.replace('/(tabs)');
        setLoading(false);
    }

    async function signUpWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) Alert.alert(error.message);
        else Alert.alert('Check your email for the login link!');
        setLoading(false);
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>F2 Sports Management</Text>
            <View style={[styles.verticallySpaced, { marginTop: 20 }]}>
                <TextInput
                    style={styles.input}
                    onChangeText={(text) => setEmail(text)}
                    value={email}
                    placeholder="email@address.com"
                    autoCapitalize="none"
                />
            </View>
            <View style={styles.verticallySpaced}>
                <TextInput
                    style={styles.input}
                    onChangeText={(text) => setPassword(text)}
                    value={password}
                    secureTextEntry
                    placeholder="Password"
                    autoCapitalize="none"
                />
            </View>
            <View style={[styles.verticallySpaced, { marginTop: 20 }]}>
                <Button title="Sign In" disabled={loading} onPress={() => signInWithEmail()} color="#00A3E0" />
            </View>
            <View style={styles.verticallySpaced}>
                <Button title="Sign Up" disabled={loading} onPress={() => signUpWithEmail()} color="#333" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 40, padding: 12, flex: 1, justifyContent: 'center' },
    verticallySpaced: { paddingTop: 4, paddingBottom: 4, alignSelf: 'stretch' },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#00A3E0' },
    input: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        padding: 10,
        borderRadius: 8,
    }
});
