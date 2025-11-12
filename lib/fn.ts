// lib/fn.ts
import { supabase } from '@/lib/supabase';

export async function callFn<T = any>(
  name: string,
  body?: Record<string, unknown>
): Promise<T> {
  // supabase.functions.invoke automatically handles:
  // - Adding Authorization header with session token
  // - Setting Content-Type to application/json
  // - Sending body as JSON
  const invokeOptions: { body?: Record<string, unknown> } = {};
  if (body) {
    invokeOptions.body = body;
  }
  
  const { data, error } = await supabase.functions.invoke(name, invokeOptions);

  if (error) {
    // Surface the function error with context
    console.error(`[functions.invoke] ${name} error`, error);
    // Supabase functions can include details in error.context
    const msg =
      (error as any)?.context?.error ??
      (error as any)?.message ??
      'Edge Function returned a non-2xx status code';
    throw new Error(msg);
  }

  return data as T;
}
