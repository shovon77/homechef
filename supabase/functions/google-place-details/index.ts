// supabase/functions/google-place-details/index.ts
import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Max-Age': '86400', // 24 hours
};

function j(status: number, data: unknown) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight - return immediately
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return j(405, { error: 'Method not allowed' });
  }

  try {
    const body = await req.json().catch((e) => {
      console.error('[google-place-details] JSON parse error:', e);
      return null;
    });

    if (!body || typeof body.place_id !== 'string') {
      return j(400, { error: 'Missing or invalid "place_id" parameter' });
    }

    const { place_id } = body;

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('[google-place-details] Missing GOOGLE_PLACES_API_KEY');
      return j(500, { error: 'Google Places API key not configured' });
    }

    // Call Google Places Details API - request address_components to get postal code
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=address_components,formatted_address&key=${GOOGLE_PLACES_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[google-place-details] Google API error:', response.status, response.statusText);
      return j(502, { error: `Google Places API error: ${response.statusText}` });
    }

    const data = await response.json();
    
    // Return the result
    return j(200, {
      result: data.result || null,
      status: data.status || 'OK',
    });
  } catch (e: any) {
    console.error('[google-place-details] Error:', e);
    return j(500, { error: e?.message || 'Internal server error' });
  }
});

