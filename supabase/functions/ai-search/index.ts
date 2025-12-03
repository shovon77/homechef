import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Common food vocabulary for typo correction
const VOCABULARY = [
  "chicken", "mutton", "beef", "pork", "fish", "shrimp", "prawn", "egg", "eggplant", "paneer",
  "biryani", "burger", "pizza", "pasta", "noodle", "noodles", "rice", "curry", "soup", "salad", "sandwich", "steak",
  "bread", "roti", "nan", "naan", "paratha", "dosa", "idli",
  "indian", "italian", "chinese", "mexican", "thai", "japanese", "korean", "american", "bengali",
  "spicy", "sweet", "sour", "salty", "hot", "mild",
  "vegan", "vegetarian", "veg", "halal", "gluten",
  "breakfast", "lunch", "dinner", "snack", "dessert",
  "cake", "cookie", "pie", "ice cream", "chocolate", "brownie",
  "samosa", "pakora", "kebab", "tikka", "grill", "fried", "fry", "roast", "tandoori",
  "butter", "masala", "korma", "vindaloo", "alfredo", "carbonara"
];

function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function correctTypos(text: string): string {
  const words = text.split(/\s+/);
  const correctedWords = words.map(word => {
    // Skip short words or numbers
    if (word.length < 4 || /\d/.test(word)) return word;
    
    // Check if word is already in vocab (exact match)
    if (VOCABULARY.includes(word)) return word;

    // Find closest match
    let bestMatch = word;
    let minDist = Infinity;

    for (const term of VOCABULARY) {
      const dist = getLevenshteinDistance(word, term);
      // Threshold: 1 typo for length 4-6, 2 typos for length 7+
      const threshold = word.length > 6 ? 2 : 1;
      
      if (dist <= threshold && dist < minDist) {
        minDist = dist;
        bestMatch = term;
      }
    }
    return bestMatch;
  });
  return correctedWords.join(" ");
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

    // 4. Typo Correction
    let cleanText = text.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    let correctedText = correctTypos(cleanText);
    
    console.log(`Original: "${cleanText}" -> Corrected: "${correctedText}"`);

    const result = { 
        keywords: correctedText || query, // Fallback to original if empty
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
