'use client';
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { getSupabase } from "../../lib/safeSupabaseClient";

export default function ChefLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getSupabase().auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return router.replace('/auth');
      const { data: prof } = await getSupabase().from('profiles').select('role').single();
      if (prof?.role !== 'chef') return router.replace('/auth');
      setReady(true);
    })();
  }, [router]);

  if (!ready) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Chef Dashboard' }} />
    </Stack>
  );
}
