import React from 'react';
import { Text, TextProps } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './src/context/AccessibilityContext';
import RootNavigator from './src/navigation/RootNavigator';

// Global text scaling component
function AccessibilityWrapper({ children }: { children: React.ReactNode }) {
  const { fontScale, highContrast } = useAccessibility();

  // Apply global font scale and contrast to all Text components
  React.useEffect(() => {
    const originalRender = (Text as any).render;
    if (!originalRender) {
      // For newer RN: override defaultProps
      const defaultProps = (Text as any).defaultProps || {};
      (Text as any).defaultProps = {
        ...defaultProps,
        allowFontScaling: false, // We handle scaling ourselves
        style: [
          defaultProps.style,
          {
            fontSize: undefined, // don't override explicit sizes
          },
        ],
      };
    }
  }, [fontScale, highContrast]);

  return <>{children}</>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AccessibilityProvider>
            <AccessibilityWrapper>
              <RootNavigator />
              <StatusBar style="light" />
            </AccessibilityWrapper>
          </AccessibilityProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
