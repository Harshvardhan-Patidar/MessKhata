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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const cleanMobile = mobile.replace('+91', '')

    // Step 1: Verify Identity - ensure this mobile + customer_code matches the requested customer_id
    // This prevents a student from querying another student's logs!
    const { data: validCustomer, error: validationError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .or(`mobile.eq.${mobile},mobile.eq.${cleanMobile},mobile.eq.+91${cleanMobile}`)
      // Note: Since we implemented multi-mess, we verify they own the mobile, but we ALSO need to make sure 
      // they provided a valid customer code for AT LEAST ONE of their enrollments.
      // We will do a two-step check for maximum security:
      // 1. Check if the customer_id belongs to the mobile number
      // 2. Check if the mobile number is associated with the provided customer_code ANYWHERE.
      .single()

    if (validationError || !validCustomer) {
       return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid customer ID or mobile' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the customer_code actually belongs to this mobile number across any of their enrollments
    const { data: codeCheck } = await supabaseAdmin
      .from('customers')
      .select('id')
      .or(`mobile.eq.${mobile},mobile.eq.${cleanMobile},mobile.eq.+91${cleanMobile}`)
      .eq('customer_code', customer_code)
      .limit(1)

    if (!codeCheck || codeCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid customer code' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Fetch Logs from the past 3 days for the specific customer_id
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('logs')
      .select('id, plates_deducted, note, created_at')
      .eq('customer_id', customer_id)
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (logsError) {
      throw logsError
    }

    return new Response(
      JSON.stringify({ logs }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
