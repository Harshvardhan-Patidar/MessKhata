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
    const { full_name, mobile, customer_code } = await req.json()

    if (!full_name || !mobile || !customer_code) {
      return new Response(
        JSON.stringify({ error: 'Name, Mobile number, and customer code are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const cleanMobile = mobile.replace('+91', '')

    // Step 1: Fetch ALL enrollments for this mobile number and name
    const { data: enrollments, error } = await supabaseAdmin
      .from('customers')
      .select(`
        id,
        full_name,
        mobile,
        photo_url,
        current_plan_type,
        total_plates,
        remaining_plates,
        plan_expiry_date,
        status,
        last_visit_at,
        customer_code,
        admin_id
      `)
      .ilike('full_name', full_name.trim())
      .or(`mobile.eq.${mobile},mobile.eq.${cleanMobile},mobile.eq.+91${cleanMobile}`)

    if (error || !enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid name or mobile number' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Verify Identity - Check if ANY of the enrollments match the provided customer_code
    const isValid = enrollments.some(e => e.customer_code === customer_code.trim())

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid customer code' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Fetch Mess Names and Admin Phone from Profiles table
    const adminIds = [...new Set(enrollments.map(e => e.admin_id))]
    
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('admin_id, mess_name, phone')
      .in('admin_id', adminIds)

    // Step 4: Merge mess_name and admin_phone into the enrollments
    const enrollmentsWithDetails = enrollments.map(e => {
      const profile = profiles?.find(p => p.admin_id === e.admin_id)
      return {
        ...e,
        mess_name: profile?.mess_name || 'Unknown Mess',
        admin_phone: profile?.phone || ''
      }
    })

    // Return the array of all valid enrollments
    return new Response(
      JSON.stringify({ enrollments: enrollmentsWithDetails }),
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
