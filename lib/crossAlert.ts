import { Alert, Platform } from 'react-native';

export type CrossAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Cross-platform replacement for Alert.alert.
 *
 * React Native Web does not implement Alert - Alert.alert is a silent no-op in
 * browsers, which makes confirmation dialogs (and all success/error feedback)
 * invisible on web. On web this falls back to window.alert / window.confirm;
 * on native it delegates to Alert.alert unchanged.
 */
export function crossAlert(title: string, message?: string, buttons?: CrossAlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as any);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length === 0) {
    if (typeof window !== 'undefined') window.alert(text);
    return;
  }

  if (buttons.length === 1) {
    if (typeof window !== 'undefined') window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  // Two or more buttons: treat as a confirm dialog. OK maps to the first
  // non-cancel button, Cancel maps to the cancel button (if any).
  const confirmButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmed = typeof window !== 'undefined' ? window.confirm(text) : false;
  if (confirmed) {
    confirmButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
