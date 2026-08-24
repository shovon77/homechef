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
    // Log full error details for debugging
    console.error(`[functions.invoke] ${name} error details:`, {
      message: (error as any)?.message,
      context: (error as any)?.context,
      status: (error as any)?.status,
      statusText: (error as any)?.statusText,
    });
    
    // Try to extract detailed error message from various possible locations.
    // For FunctionsHttpError, context is a fetch Response whose JSON body must be awaited.
    let errorContext = (error as any)?.context;
    if (errorContext && typeof errorContext.json === 'function') {
      try {
        errorContext = await errorContext.json();
      } catch {
        errorContext = null;
      }
    }
    let errorMsg = 
      errorContext?.error ??
      errorContext?.message ??
      (errorContext?.details && typeof errorContext.details === 'object' 
        ? JSON.stringify(errorContext.details) 
        : errorContext?.details) ??
      (error as any)?.message ??
      'Edge Function returned a non-2xx status code';
    
    // If we have field errors, include them in the message
    if (errorContext?.fieldErrors && Array.isArray(errorContext.fieldErrors)) {
      const fieldErrorMessages = errorContext.fieldErrors
        .map((fe: any) => `${fe.path}: ${fe.message}`)
        .join(', ');
      errorMsg = `${errorMsg}. Field errors: ${fieldErrorMessages}`;
    }
    
    throw new Error(errorMsg);
  }

  return data as T;
}
