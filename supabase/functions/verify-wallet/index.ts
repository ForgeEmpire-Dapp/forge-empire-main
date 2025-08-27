import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"
import { ethers } from 'https://esm.sh/ethers@6.7.1'

// Tightened CORS - restrict to allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://lovable.app',
  /^https:\/\/.*\.lovable\.app$/
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  )
  
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': isAllowed ? origin! : 'null'
  }
}

interface VerificationRequest {
  walletAddress: string
}

interface VerificationConfirm {
  walletAddress: string
  signature: string
  nonce: string
}

// Enhanced rate limiting with separate tracking
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const ipCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_USER_PER_MINUTE = 5
const MAX_REQUESTS_PER_IP_PER_MINUTE = 10

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(userId)
  
  if (!record || now > record.resetTime) {
    requestCounts.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= MAX_REQUESTS_PER_USER_PER_MINUTE) {
    return false
  }
  
  record.count++
  return true
}

function checkIPRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = ipCounts.get(ip)
  
  if (!record || now > record.resetTime) {
    ipCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= MAX_REQUESTS_PER_IP_PER_MINUTE) {
    return false
  }
  
  record.count++
  return true
}

async function verifySignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
  try {
    // Use ethers.js for proper signature verification
    const recoveredAddress = ethers.verifyMessage(message, signature)
    
    // Compare addresses (case-insensitive)
    const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
    
    if (!isValid) {
      console.error('Signature verification failed: address mismatch', {
        expected: `${expectedAddress.slice(0, 6)}...${expectedAddress.slice(-4)}`,
        recovered: `${recoveredAddress.slice(0, 6)}...${recoveredAddress.slice(-4)}`
      })
    }
    
    return isValid
  } catch (error) {
    console.error('Signature verification error:', error?.toString())
    return false
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = getCorsHeaders(origin)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }
  
  // Block requests from non-allowed origins
  if (origin && !allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  )) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' }
      })
    }

    // Enhanced security: get client info
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Multi-layer rate limiting
    if (!checkUserRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded for user' }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' }
      })
    }
    
    if (!checkIPRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded for IP' }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    if (req.method === 'POST' && path === 'request') {
      // Generate verification nonce using secure function
      const { walletAddress }: VerificationRequest = await req.json()
      
      if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return new Response(JSON.stringify({ error: 'Invalid wallet address' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Use secure verification creation function
      const { data: verificationData, error: createError } = await supabase
        .rpc('create_secure_verification', {
          p_user_id: user.id,
          p_wallet_address: walletAddress.toLowerCase(),
          p_ip_address: clientIP,
          p_user_agent: userAgent
        })

      if (createError) {
        console.error('Failed to create secure verification:', createError)
        return new Response(JSON.stringify({ 
          error: createError.message || 'Failed to create verification request' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const verification = verificationData[0]

      return new Response(JSON.stringify({ 
        nonce: verification.nonce,
        verificationId: verification.verification_id,
        message: verification.message,
        walletAddress: walletAddress.toLowerCase(),
        expiresAt: verification.expires_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST' && path === 'confirm') {
      // Verify signature and complete wallet linking
      const { walletAddress, signature, nonce }: VerificationConfirm = await req.json()
      
      if (!walletAddress || !signature || !nonce) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Confirming verification for wallet:', `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`)

      // First validate the verification attempt using secure function
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_verification_attempt', {
          p_user_id: user.id,
          p_wallet_address: walletAddress,
          p_nonce: nonce,
          p_ip_address: clientIP
        })

      if (validationError) {
        console.error('Validation error:', validationError)
        return new Response(JSON.stringify({ 
          error: 'Verification validation failed',
          details: validationError.message 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const validation = validationData[0]
      if (!validation?.is_valid) {
        return new Response(JSON.stringify({ 
          error: validation?.error_message || 'Verification request is invalid or expired'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get the verification record to reconstruct the exact message
      const { data: verificationRecord, error: fetchError } = await supabase
        .from('wallet_verifications')
        .select('nonce, wallet_address, user_id, expires_at, created_at')
        .eq('id', validation.verification_id)
        .eq('user_id', user.id)
        .eq('verified', false)
        .single()

      if (fetchError || !verificationRecord) {
        console.error('Failed to fetch verification record:', fetchError)
        return new Response(JSON.stringify({ error: 'Verification record not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Reconstruct the exact message that was created during request
      const timestamp = Math.floor(new Date(verificationRecord.created_at).getTime() / 1000)
      const expectedMessage = `Please sign this message to verify wallet ownership.\nNonce: ${verificationRecord.nonce}\nWallet: ${verificationRecord.wallet_address}\nTimestamp: ${timestamp}`
      
      console.log('Verifying signature for message length:', expectedMessage.length)

      // Verify signature
      const isValidSignature = await verifySignature(expectedMessage, signature, walletAddress.toLowerCase())
      
      if (!isValidSignature) {
        console.error('Invalid signature provided')
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Signature verification passed, completing verification')

      // Complete verification using secure function
      const { data: completionData, error: completionError } = await supabase
        .rpc('complete_wallet_verification', {
          p_verification_id: validation.verification_id,
          p_signature: signature,
          p_ip_address: clientIP
        })

      if (completionError) {
        console.error('Failed to complete verification:', completionError)
        return new Response(JSON.stringify({ 
          error: 'Failed to complete verification',
          details: completionError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const completion = completionData[0]
      if (!completion.success) {
        return new Response(JSON.stringify({ error: completion.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log(`Wallet verification successful`)

      return new Response(JSON.stringify({ 
        success: true, 
        profileId: completion.profile_id,
        message: completion.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Verify wallet error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})