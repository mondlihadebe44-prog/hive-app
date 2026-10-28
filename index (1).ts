import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

// True only when the access token belongs to a signed-in user. Supabase Auth checks the token,
// so the request body is never trusted for identity. The public anon key is rejected here.
async function isSignedInUser(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    })
    return res.ok
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Only signed-in Hive users get AI replies. The 401 includes a friendly reply so the app can show it.
  if (!(await isSignedInUser(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized', reply: 'Please sign in to use HiveMind 🐝' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { message, history = [], mode = 'chat', context = {} } = await req.json()
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) throw new Error('OPENAI_API_KEY not set')

    // Build system prompt based on mode
    let systemPrompt = `You are HiveMind, the AI assistant for Hive — a premium South African social media app with black & gold branding. You are helpful, friendly, and speak in a warm modern tone. Keep responses concise.`

    if (mode === 'vibe_radar') {
      systemPrompt = `You are HiveMind's Vibe Radar. Generate personalized post suggestions for a Hive user. 
User context: Name: ${context.name}, Location: ${context.location}, Time: ${context.timeOfDay} on ${context.dayOfWeek}, Recent topics: ${context.recentPosts}, Top hashtags: ${context.topHashtags}, Days since last post: ${context.daysSinceLastPost}.
Respond ONLY with valid JSON in this exact format:
{"personalSuggestions":[{"emoji":"🔥","label":"Topic","confidence":80,"reason":"Short reason this suits the user","post":"Ready-to-post text for Hive, with 1-2 hashtags inside it"}],"missedUser":false}
Generate 3-4 creative, relevant post suggestions. No markdown, no explanation, just the JSON.`
    } else if (mode === 'hive_pulse') {
      systemPrompt = `You are HiveMind's Hive Pulse analyzer for Hive, a South African social app. Using the context (top hashtags: ${context.topHashtags}, recent posts: ${context.trendingTopics}, location: ${context.location}, time: ${context.timeOfDay}), find 3 things people are talking about on Hive right now.
Respond ONLY with valid JSON in this exact format:
{"hivePulse":[{"emoji":"🔥","title":"Short topic name","description":"One or two energetic sentences about what is happening","confidence":75,"postPrompt":"A ready-to-post prompt that invites people to join in, ending with an emoji"}]}
Return exactly 3 items. No markdown, no explanation, just the JSON.`
    }

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10),
      { role: 'user', content: message }
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: mode === 'vibe_radar' ? 800 : 500,
        temperature: 0.8,
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI error: ${err}`)
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || ''

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('HiveMind error:', error)
    return new Response(JSON.stringify({ 
      reply: "I'm having trouble connecting right now. Please try again in a moment. 🐝",
      error: error.message 
    }), {
      status: 200, // Return 200 so app doesn't crash
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
