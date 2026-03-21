import React, { useEffect, useState } from 'react';
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

// Monkey-patch Text.render to apply font scaling
const origTextRender = (Text as any).render;
if (origTextRender) {
  (Text as any).render = function (props: any, ref: any) {
    let newProps = props;
    if (_fontScale !== 1 || _highContrast) {
      const flat = StyleSheet.flatten(props.style) || {};
      const overrides: any = {};
      if (_fontScale !== 1) {
        overrides.fontSize = (flat.fontSize || 14) * _fontScale;
      }
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

// Syncs accessibility context values to global refs and forces remount
function AccessibilitySyncer({ children }: { children: React.ReactNode }) {
  const { fontScale, highContrast } = useAccessibility();
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    const changed = _fontScale !== fontScale || _highContrast !== highContrast;
    _fontScale = fontScale;
    _highContrast = highContrast;
    if (changed) {
      // Force complete remount of all children so they pick up new values
      setRenderKey(k => k + 1);
    }
  }, [fontScale, highContrast]);

  return (
    <View key={renderKey} style={{ flex: 1, backgroundColor: highContrast ? '#000000' : 'transparent' }}>
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
