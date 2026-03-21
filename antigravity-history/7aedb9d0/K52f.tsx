import { View, Text, Button, StyleSheet } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function DashboardScreen() {
    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bienvenido al Dashboard</Text>
            <Text style={styles.subtitle}>¡Has iniciado sesión correctamente!</Text>
            <Button title="Cerrar Sesión" onPress={handleLogout} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
});
