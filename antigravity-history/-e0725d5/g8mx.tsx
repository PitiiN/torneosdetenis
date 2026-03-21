import React, { useEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './src/context/AccessibilityContext';
import RootNavigator from './src/navigation/RootNavigator';

// Global mutable refs for the Text monkey-patch
let _fontScale = 1;
let _highContrast = false;

// Monkey-patch Text.render ONCE at module level to apply global font scaling + contrast
const origTextRender = (Text as any).render;
if (origTextRender) {
  (Text as any).render = function (props: any, ref: any) {
    let newProps = props;

    if (_fontScale !== 1 || _highContrast) {
      const flat = StyleSheet.flatten(props.style) || {};
      const overrides: any = {};

      // Scale font size
      if (_fontScale !== 1 && flat.fontSize) {
        overrides.fontSize = flat.fontSize * _fontScale;
      } else if (_fontScale !== 1 && !flat.fontSize) {
        overrides.fontSize = 14 * _fontScale;
      }

      // High contrast: force white text on dark bg (only for non-white text)
      if (_highContrast && !flat.color) {
        overrides.color = '#FFFFFF';
      }

      if (Object.keys(overrides).length > 0) {
        newProps = { ...props, style: [props.style, overrides] };
      }
    }

    return origTextRender.call(this, newProps, ref);
  };
}

// Syncs accessibility context values to global mutable refs
function AccessibilitySyncer({ children }: { children: React.ReactNode }) {
  const { fontScale, highContrast } = useAccessibility();

  useEffect(() => {
    _fontScale = fontScale;
    _highContrast = highContrast;
  }, [fontScale, highContrast]);

  // Wrap in a View that applies the high contrast background
  return (
    <View style={{ flex: 1, backgroundColor: highContrast ? '#000000' : 'transparent' }}>
      {children}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AccessibilityProvider>
            <AccessibilitySyncer>
              <RootNavigator />
              <StatusBar style="light" />
            </AccessibilitySyncer>
          </AccessibilityProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
