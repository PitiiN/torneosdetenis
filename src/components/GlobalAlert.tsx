import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useTheme } from '@/theme';
import { alertManager, AlertConfig, AlertButton } from '@/utils/alertManager';

export const GlobalAlert: React.FC = () => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    alertManager.register(
      (newConfig) => {
        setConfig(newConfig);
        setVisible(true);
      },
      () => {
        setVisible(false);
        setConfig(null);
      }
    );

    return () => {
      alertManager.unregister();
    };
  }, []);

  if (!visible || !config) return null;

  const { title, message, buttons, options } = config;
  const cancelable = options?.cancelable ?? true;

  const handleDismiss = () => {
    if (cancelable) {
      alertManager.dismissAlert();
      options?.onDismiss?.();
    }
  };

  const handleButtonPress = (btn: AlertButton) => {
    alertManager.dismissAlert();
    if (btn.onPress) {
      btn.onPress();
    }
  };

  // Si no se especifican botones, proporcionamos un botón "Aceptar" por defecto
  const activeButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'Aceptar' }];

  const renderButtons = () => {
    const isHorizontal = activeButtons.length === 2;

    if (isHorizontal) {
      return (
        <View style={styles.row}>
          {activeButtons.map((btn, index) => {
            const textLower = (btn.text || '').toLowerCase();
            const isCancel = btn.style === 'cancel' || textLower === 'cancelar' || textLower === 'cancel';
            const isDestructive = btn.style === 'destructive' || textLower.includes('eliminar') || textLower.includes('borrar');

            let btnBgColor = colors.primary[500];
            let btnTextColor = '#ffffff';

            if (isCancel) {
              btnBgColor = colors.surfaceSecondary;
              btnTextColor = colors.textSecondary;
            } else if (isDestructive) {
              btnBgColor = colors.error;
              btnTextColor = '#ffffff';
            }

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.85}
                style={[styles.button, styles.flexButton, { backgroundColor: btnBgColor }]}
                onPress={() => handleButtonPress(btn)}
              >
                <Text style={[styles.buttonText, { color: btnTextColor }]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Stack vertical para 1 botón o más de 2 botones
    return (
      <View style={styles.column}>
        {activeButtons.map((btn, index) => {
          const textLower = (btn.text || '').toLowerCase();
          const isCancel = btn.style === 'cancel' || textLower === 'cancelar' || textLower === 'cancel';
          const isDestructive = btn.style === 'destructive' || textLower.includes('eliminar') || textLower.includes('borrar');

          let btnBgColor = colors.primary[500];
          let btnTextColor = '#ffffff';

          if (isCancel) {
            btnBgColor = colors.surfaceSecondary;
            btnTextColor = colors.textSecondary;
          } else if (isDestructive) {
            btnBgColor = colors.error;
            btnTextColor = '#ffffff';
          }

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.85}
              style={[
                styles.button,
                {
                  backgroundColor: btnBgColor,
                  marginBottom: index < activeButtons.length - 1 ? 8 : 0,
                },
              ]}
              onPress={() => handleButtonPress(btn)}
            >
              <Text style={[styles.buttonText, { color: btnTextColor }]}>
                {btn.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: colors.background }]}>
              {title ? (
                <Text style={[styles.title, { color: colors.text }]}>
                  {title}
                </Text>
              ) : null}

              {message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {message}
                </Text>
              ) : null}

              <View style={styles.actionsContainer}>
                {renderButtons()}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  actionsContainer: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  column: {
    width: '100%',
  },
  button: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  flexButton: {
    flex: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
export default GlobalAlert;
