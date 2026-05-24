import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

const DEFAULT_LEAVE_MESSAGE =
  'Changes you made may not be saved. Leave without saving?';

export function confirmDiscardChanges(
  onDiscard: () => void,
  message: string = DEFAULT_LEAVE_MESSAGE,
): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (window.confirm(message)) onDiscard();
    return;
  }
  Alert.alert('Unsaved changes', message, [
    { text: 'Stay', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: onDiscard },
  ]);
}

/** Warn on in-app navigation away and on browser refresh/close when `isDirty`. */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  options?: { enabled?: boolean; message?: string },
): void {
  const navigation = useNavigation();
  const enabled = options?.enabled !== false;
  const message = options?.message ?? DEFAULT_LEAVE_MESSAGE;

  usePreventRemove(enabled && isDirty, ({ data }) => {
    confirmDiscardChanges(() => navigation.dispatch(data.action), message);
  });

  useEffect(() => {
    if (!enabled || !isDirty || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled, isDirty]);
}
