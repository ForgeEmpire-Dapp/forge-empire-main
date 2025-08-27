import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Analytics cleanup edge function triggered');

    // Create admin client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Execute the secure analytics cleanup function
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('schedule_analytics_cleanup');

    if (cleanupError) {
      console.error('Analytics cleanup error:', cleanupError);
      return new Response(
        JSON.stringify({ 
          error: 'Cleanup failed', 
          details: cleanupError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get security status after cleanup
    const { data: securityStatus, error: statusError } = await supabase
      .rpc('get_analytics_security_status');

    if (statusError) {
      console.warn('Could not fetch security status:', statusError);
    }

    const result = {
      success: true,
      cleanup_result: cleanupResult,
      security_status: securityStatus?.[0] || null,
      timestamp: new Date().toISOString(),
      message: 'Analytics data cleanup completed successfully'
    };

    console.log('Analytics cleanup completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in analytics cleanup:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});