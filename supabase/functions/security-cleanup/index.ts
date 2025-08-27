import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CleanupResult {
  expired_deleted: number
  anonymized_count: number
  old_verified_deleted: number
  cleanup_timestamp: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authorization - only authenticated users can access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Bearer token required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Execute secure cleanup of wallet verification data
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('secure_cleanup_wallet_verifications')

    if (cleanupError) {
      console.error('Security cleanup failed:', cleanupError)
      return new Response(JSON.stringify({ 
        error: 'Cleanup failed', 
        details: cleanupError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const result = cleanupResult as CleanupResult
    
    // Log cleanup results for monitoring
    console.log('Security cleanup completed:', {
      expired_deleted: result.expired_deleted,
      anonymized_count: result.anonymized_count,
      old_verified_deleted: result.old_verified_deleted,
      timestamp: result.cleanup_timestamp
    })

    // Get security statistics for monitoring
    const { data: stats, error: statsError } = await supabase
      .rpc('get_verification_security_stats')

    if (statsError) {
      console.warn('Failed to get security stats:', statsError)
    } else {
      console.log('Current security status:', stats[0])
    }

    return new Response(JSON.stringify({
      success: true,
      cleanup_result: result,
      security_stats: stats?.[0] || null,
      message: 'Security cleanup completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Security cleanup error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.toString() 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})