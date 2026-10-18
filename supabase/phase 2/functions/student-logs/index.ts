import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { customer_id, mobile, customer_code } = await req.json()

    if (!customer_id || !mobile || !customer_code) {
      return new Response(
        JSON.stringify({ error: 'Customer ID, Mobile number, and customer code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const cleanMobile = mobile.replace('+91', '')

    // Step 1: Verify Identity — ensure mobile + customer_id match (prevents IDOR)
    const { data: validCustomer, error: validationError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .in('mobile', [mobile, cleanMobile, `+91${cleanMobile}`])
      .single()

    if (validationError || !validCustomer) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid customer ID or mobile' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Verify customer_code belongs to this mobile number
    const { data: codeCheck } = await supabaseAdmin
      .from('customers')
      .select('id')
      .in('mobile', [mobile, cleanMobile, `+91${cleanMobile}`])
      .eq('customer_code', customer_code)
      .limit(1)

    if (!codeCheck || codeCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid customer code' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Fetch logs from past 15 days for the specific customer_id
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('logs')
      .select('id, plates_deducted, note, created_at')
      .eq('customer_id', customer_id)
      .gte('created_at', fifteenDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (logsError) {
      throw logsError
    }

    return new Response(
      JSON.stringify({ logs }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    console.error('[student-logs] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
