import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    if (!OPENAI_API_KEY) {
        console.error("Missing OPENAI_API_KEY");
        return new Response(JSON.stringify({ error: 'Server misconfiguration: Missing API Key' }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    console.log(`Processing query: "${query}"`);

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a search assistant for a food delivery app. 
            Extract search parameters from the user query.
            Return JSON only: { "keywords": string, "cuisine": string | null, "max_price": number | null, "sort": "price_asc" | "price_desc" | "rating" | null }.
            "keywords" should be the core food terms cleaned of conversational phrases.
            Example: "I want cheap indian food" -> {"keywords": "indian", "cuisine": "Indian", "max_price": 15, "sort": "price_asc"}`
          },
          { role: 'user', content: query }
        ],
        temperature: 0,
      }),
    })

    const data = await completion.json()
    
    if (data.error) {
        console.error('OpenAI API Error:', data.error);
        return new Response(JSON.stringify({ error: `OpenAI Error: ${data.error.message}` }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    let result = { keywords: query }
    try {
        if (data.choices && data.choices[0]) {
            const content = data.choices[0].message.content;
            console.log("OpenAI Response:", content);
            result = JSON.parse(content)
        }
    } catch (e) {
        console.error("Failed to parse LLM response", e)
        // Fallback to original query if parsing fails
    }

    return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
