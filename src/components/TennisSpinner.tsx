import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { darkTheme, useOptionalTheme } from '@/theme';

type TennisSpinnerProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const TennisSpinner = ({ size = 28, color, style }: TennisSpinnerProps) => {
  const theme = useOptionalTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 950,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: rotation }],
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="tennis-ball"
        size={size}
        color={color || theme?.colors.primary[500] || darkTheme.primary[500]}
      />
    </Animated.View>
  );
};
