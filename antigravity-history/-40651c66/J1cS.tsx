import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { colors, spacing, borderRadius } from '@/theme';

export default function SplashScreen() {
    const router = useRouter();
    const { session } = useAuthStore();
    const [videoFinished, setVideoFinished] = useState(false);

    const skip = () => {
        setVideoFinished(true);
    };

    useEffect(() => {
        if (videoFinished) {
            if (session) {
                router.replace('/(tabs)');
            } else {
                router.replace('/(auth)/login');
            }
        }
    }, [videoFinished, session, router]);

    return (
        <View style={styles.container}>
            <Video
                source={require('../LOGO_OBAT.mp4')}
                style={styles.video}
                shouldPlay
                isLooping={false}
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={(status: any) => {
                    if (status.didJustFinish) {
                        setVideoFinished(true);
                    }
                }}
            />
            <TouchableOpacity style={styles.skipButton} onPress={skip}>
                <Text style={styles.skipText}>Saltar</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    video: {
        flex: 1,
    },
    skipButton: {
        position: 'absolute',
        bottom: 40,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    skipText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
});
