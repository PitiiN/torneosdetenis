import { Alert, AlertButton, AlertOptions } from 'react-native';
import { alertManager } from './alertManager';

// Guardamos la función de alerta original del sistema
const originalAlert = Alert.alert;

// Sobrescribimos de manera global
Alert.alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void => {
  if (alertManager.isRegistered()) {
    alertManager.showAlert({ title, message, buttons, options });
  } else {
    // Si el gestor global no está montado, llamamos a la alerta original nativa
    originalAlert(title, message, buttons, options);
  }
};
