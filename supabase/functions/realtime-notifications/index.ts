import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const current = rateLimitMap.get(identifier)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (current.count >= maxRequests) {
    return false
  }
  
  current.count++
  return true
}

function validateNotificationData(data: unknown): { isValid: boolean; error?: string } {
  if (!data.type || typeof data.type !== 'string') {
    return { isValid: false, error: 'Invalid or missing type' }
  }
  
  if (!data.userId || typeof data.userId !== 'string') {
    return { isValid: false, error: 'Invalid or missing userId' }
  }
  
  if (!data.title || typeof data.title !== 'string' || data.title.length > 100) {
    return { isValid: false, error: 'Invalid title (max 100 characters)' }
  }
  
  if (!data.message || typeof data.message !== 'string' || data.message.length > 500) {
    return { isValid: false, error: 'Invalid message (max 500 characters)' }
  }
  
  const allowedTypes = ['quest_completed', 'achievement_unlocked', 'follow', 'like', 'comment', 'system']
  if (!allowedTypes.includes(data.type)) {
    return { isValid: false, error: 'Invalid notification type' }
  }
  
  return { isValid: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const requestData = await req.json()
    
    // Validate input data
    const validation = validateNotificationData(requestData)
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = `${user.id}:${clientIp}`
    
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      )
    }

    const { type, userId, title, message, data } = requestData

    // Authorization check: users can only create notifications for themselves
    // System notifications can only be created by service role
    if (type === 'system' || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: cannot create notifications for other users' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // Create notification in database
    const { data: notification, error } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data: data || {},
      })
      .select()
      .single()

    if (error) throw error

    // No public broadcast - rely on Postgres changes subscription

    return new Response(
      JSON.stringify({ success: true, notification }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})