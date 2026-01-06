// supabase/functions/google-geocode-forward/index.ts
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
      console.error('[google-geocode-forward] JSON parse error:', e);
      return null;
    });

    if (!body || typeof body.address !== 'string') {
      return j(400, { error: 'Missing or invalid "address" parameter' });
    }

    const { address } = body;

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('[google-geocode-forward] Missing GOOGLE_PLACES_API_KEY');
      return j(500, { error: 'Google Places API key not configured' });
    }

    // Call Google Geocoding API for forward geocoding (address to lat/lng)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[google-geocode-forward] Google API error:', response.status, response.statusText);
      return j(502, { error: `Google Geocoding API error: ${response.statusText}` });
    }

    const data = await response.json();
    
    // Extract lat/lng from first result
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return j(200, {
        lat: location.lat,
        lng: location.lng,
        formatted_address: data.results[0].formatted_address,
        status: data.status || 'OK',
      });
    }
    
    return j(200, {
      lat: null,
      lng: null,
      formatted_address: null,
      status: data.status || 'ZERO_RESULTS',
    });
  } catch (e: any) {
    console.error('[google-geocode-forward] Error:', e);
    return j(500, { error: e?.message || 'Internal server error' });
  }
});

