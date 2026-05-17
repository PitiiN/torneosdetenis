declare module 'expo-sharing' {
  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(
    url: string,
    options?: {
      mimeType?: string;
      dialogTitle?: string;
      UTI?: string;
    }
  ): Promise<void>;
}

declare module 'react-native-view-shot' {
  import * as React from 'react';

  const ViewShot: React.ComponentType<any>;
  export default ViewShot;
}
