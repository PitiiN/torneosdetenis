import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SplashScreen() {
    const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
    const video = useRef<Video>(null);
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const insets = useSafeAreaInsets();

    const [debugInfo, setDebugInfo] = useState('Iniciando...');

    const onFinish = () => {
        setDebugInfo('Intentando navegar a canchas...');
        if (!isLoading) {
            // Añadimos un pequeño delay para que no sea instantáneo si el video falla
            setTimeout(() => {
                if (user) {
                    router.replace('/(tabs)/fields');
                } else {
                    router.replace('/(auth)/login');
                }
            }, 500);
        }
    };

    const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
            onFinish();
        }
        setStatus(status);
    };

    return (
        <View style={styles.container}>
            <Video
                ref={video}
                style={styles.video}
                source={require('../assets/logoF2Club.mp4')}
                useNativeControls={false}
                resizeMode={ResizeMode.COVER}
                shouldPlay={true}
                isLooping={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onError={(e) => {
                    console.error('Video Error:', e);
                    onFinish(); // Saltamos si falla el video
                }}
            />

            <TouchableOpacity
                style={[styles.skipButton, { bottom: 40 + insets.bottom, right: 20 + insets.right }]}
                onPress={onFinish}
            >
                <Text style={styles.skipText}>Saltar</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    video: {
        flex: 1,
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    skipButton: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    skipText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
