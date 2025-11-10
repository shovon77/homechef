import { supabase } from './supabase';

export async function callFn<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
  });

  if (error) {
    throw new Error(error.message || 'Request failed');
  }

  return data as T;
}
