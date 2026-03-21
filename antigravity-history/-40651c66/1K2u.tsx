import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/theme';

export default function SplashScreen() {
    const router = useRouter();
    const { session } = useAuthStore();
    const [videoFinished, setVideoFinished] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVideoFinished(true);
        }, 3000); // 3 seconds duration exactly
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (videoFinished) {
            if (session) {
                router.replace('/selection');
            } else {
                router.replace('/(auth)/login');
            }
        }
    }, [videoFinished, session, router]);

    return (
        <View style={styles.container}>
            <Video
                source={require('../LOGO_OBAT_BOTE.mp4')}
                style={styles.video}
                shouldPlay
                isLooping={false}
                resizeMode={ResizeMode.CONTAIN}
            />
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
});
