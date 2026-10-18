import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Indian mobile number: 10 digits starting with 6-9 */
const INDIA_MOBILE_REGEX = /^[6-9]\d{9}$/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { full_name, mobile, customer_code } = await req.json()

    if (!full_name || !mobile || !customer_code) {
      return new Response(
        JSON.stringify({ error: 'Name, Mobile number, and customer code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawMobileTrimmed = mobile.trim()
    if (rawMobileTrimmed.length > 15 || !/^\+?[0-9]{7,15}$/.test(rawMobileTrimmed)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mobile number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cap name length and strip SQL LIKE wildcards (%, _) from full_name.
    // An attacker could craft a name like '%' to match ALL rows in the ilike() query,
    // bypassing the identity check before the customer_code filter is applied.
    if (full_name.trim().length > 100) {
      return new Response(
        JSON.stringify({ error: 'Name is too long (max 100 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const safeName = full_name.trim().replace(/[%_]/g, '')

    // Validate mobile number format
    const cleanMobile = mobile.replace('+91', '').replace(/\D/g, '')
    if (!INDIA_MOBILE_REGEX.test(cleanMobile)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mobile number. Please enter a valid 10-digit Indian mobile number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
      .ilike('full_name', safeName)
      .in('mobile', [mobile, cleanMobile, `+91${cleanMobile}`])

    if (error || !enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid name or mobile number' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Verify Identity - Check if ANY of the enrollments match the provided customer_code
    const isValid = enrollments.some(e => e.customer_code === customer_code.trim())

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid customer code' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Fetch Mess Names, Admin Phone, and Admin Name from admins table
    const adminIds = [...new Set(enrollments.map(e => e.admin_id))]

    const { data: adminProfiles } = await supabaseAdmin
      .from('admins')
      .select('auth_id, mess_name, phone, name, menu_data, menu_last_updated')
      .in('auth_id', adminIds)

    // Step 4: Merge details into the enrollments
    const enrollmentsWithDetails = enrollments.map(e => {
      const profile = adminProfiles?.find(p => p.auth_id === e.admin_id)
      return {
        ...e,
        mess_name: profile?.mess_name || 'Unknown Mess',
        admin_phone: profile?.phone || '',
        admin_name: profile?.name || '',
        menu_data: profile?.menu_data || { morning: [], evening: [] },
        menu_last_updated: profile?.menu_last_updated || null,
      }
    })

    // Return the array of all valid enrollments
    return new Response(
      JSON.stringify({ enrollments: enrollmentsWithDetails }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    console.error('[student-login] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
