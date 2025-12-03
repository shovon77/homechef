import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    if (!query) {
        return new Response(JSON.stringify({ error: 'No query' }), { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    console.log(`Processing query locally: "${query}"`);

    let text = query.toLowerCase();
    let max_price = null;
    let sort = null;
    let cuisine = null;

    // 1. Extract Price: "under 20", "max $30", "below 15"
    const priceMatch = text.match(/(?:under|max|less than|below)\s?\$?(\d+)/);
    if (priceMatch) {
        max_price = parseInt(priceMatch[1]);
        text = text.replace(priceMatch[0], '');
    }

    // 2. Extract Sort Intent
    if (text.includes('cheapest') || text.includes('lowest price')) {
        sort = 'price_asc';
        text = text.replace(/cheapest|lowest price/g, '');
    } else if (text.includes('expensive') || text.includes('highest price')) {
        sort = 'price_desc';
        text = text.replace(/expensive|highest price/g, '');
    } else if (text.includes('best') || text.includes('top rated') || text.includes('popular')) {
        sort = 'rating'; // Client maps this to 'popular'
        text = text.replace(/best|top rated|popular/g, '');
    }

    // 3. Clean up conversational filler
    const stopWords = ["in the mood for", "looking for", "i want", "show me", "search for", "find me", "find", "give me", "meals", "food", "dishes"];
    for (const word of stopWords) {
        if (text.startsWith(word)) {
             text = text.substring(word.length);
        }
        text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    }

    // 4. Final cleanup
    let keywords = text.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    const result = { 
        keywords: keywords || query, // Fallback to original if empty
        max_price, 
        sort,
        cuisine 
    };

    return new Response(JSON.stringify(result), { 
        headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
        } 
    })

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
