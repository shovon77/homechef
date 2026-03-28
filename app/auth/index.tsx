'use client';

import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

/** Legacy `/auth` → `/login`; preserves e.g. `?mode=reset` for email links. */
export default function AuthIndexRedirect() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const href = useMemo(() => {
    if (mode != null && String(mode).length > 0) {
      return `/login?mode=${encodeURIComponent(String(mode))}`;
    }
    return '/login';
  }, [mode]);
  return <Redirect href={href} />;
}
