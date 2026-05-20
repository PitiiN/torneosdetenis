export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

type AlertListener = (config: AlertConfig) => void;
type DismissListener = () => void;

class AlertManager {
  private showListener: AlertListener | null = null;
  private dismissListener: DismissListener | null = null;

  register(onShow: AlertListener, onDismiss: DismissListener) {
    this.showListener = onShow;
    this.dismissListener = onDismiss;
  }

  unregister() {
    this.showListener = null;
    this.dismissListener = null;
  }

  showAlert(config: AlertConfig) {
    if (this.showListener) {
      this.showListener(config);
    } else {
      console.warn('[AlertManager] GlobalAlert component is not yet registered to handle custom alerts.');
    }
  }

  dismissAlert() {
    if (this.dismissListener) {
      this.dismissListener();
    }
  }

  isRegistered(): boolean {
    return this.showListener !== null;
  }
}

export const alertManager = new AlertManager();
