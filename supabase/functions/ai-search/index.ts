import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { query } = await req.json()
    if (!query) return new Response(JSON.stringify({ error: 'No query' }), { status: 400 })

    if (!OPENAI_API_KEY) {
        // Fallback if no key is configured (mock response for testing if needed, or error)
        return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        })
    }

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
            content: `You are a search assistant for a home-cooked food delivery app. 
            Extract search parameters from the user query.
            Return JSON only: { "keywords": string, "cuisine": string | null, "max_price": number | null, "sort": "price_asc" | "price_desc" | "rating" | null }.
            "keywords" should be the core food terms cleaned of stopwords.
            If user mentions specific cuisine (e.g. "Italian"), extract it.
            If user mentions price limit (e.g. "under $20", "cheap"), extract max_price.
            If user mentions sort (e.g. "cheapest", "best"), extract sort.`
          },
          { role: 'user', content: query }
        ],
        temperature: 0,
      }),
    })

    const data = await completion.json()
    let result = { keywords: query }
    try {
        if (data.choices && data.choices[0]) {
            result = JSON.parse(data.choices[0].message.content)
        }
    } catch (e) {
        console.error("Failed to parse LLM response", e)
    }

    return new Response(JSON.stringify(result), { 
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        } 
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        }
    })
  }
})

