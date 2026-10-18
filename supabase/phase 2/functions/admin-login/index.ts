import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, phone } = await req.json()

    if (!name || !phone) {
      return new Response(JSON.stringify({ error: 'Name and phone are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // A 100 KB name string would generate an extremely expensive LIKE query.
    if (name.trim().length > 100) {
      return new Response(JSON.stringify({ error: 'Name is too long (max 100 characters)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Reject anything that could craft malformed .or() filter strings in the query below.
    const rawPhoneTrimmed = phone.trim()
    if (rawPhoneTrimmed.length > 15 || !/^\+?[0-9]{7,15}$/.test(rawPhoneTrimmed)) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create phone permutations to ensure we match regardless of how they typed it in DB
    const cleanPhone = phone.replace('+', '').replace('91', ''); // Strip + and 91 if present at start
    const justDigits = phone.replace(/\D/g, '');
    const phoneWith91 = justDigits.startsWith('91') ? justDigits : `91${justDigits}`;
    const phoneWithPlus91 = `+${phoneWith91}`;
    const rawPhone = phone.trim();

    // 1. Verify admin exists in admins table
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('uid, auth_id')
      .ilike('name', name.trim()) 
      .or(`phone.eq.${rawPhone},phone.eq.${justDigits},phone.eq.${phoneWith91},phone.eq.${phoneWithPlus91},phone.eq.${cleanPhone}`)

    if (adminError || !admins || admins.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid name or phone number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 2. Generate cryptographically secure 6-digit OTP
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    const otp = (100000 + (arr[0] % 900000)).toString()

    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // 3. Save OTP — reset attempt_count to 0 on new OTP request
    const { error: otpError } = await supabaseAdmin
      .from('otps')
      .upsert(
        { phone: phoneWithPlus91, otp, expires_at: expiresAt, attempt_count: 0 },
        { onConflict: 'phone' }
      )

    if (otpError) {
      throw new Error('Failed to generate OTP')
    }

    // 4. Send Fast2SMS (if API key is configured)
    const fast2smsKey = Deno.env.get('FAST2SMS_API_KEY')
    if (fast2smsKey) {
      const message = `Your MessKhata Admin login OTP is ${otp}. It is valid for 10 minutes. Do not share this with anyone.`
      const phoneWithoutPlus = phoneWithPlus91.replace('+', '')

      try {
        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message,
            flash: 0,
            numbers: phoneWithoutPlus,
          }),
        })
        const smsData = await smsRes.json()
        console.log('Fast2SMS response:', smsData)
      } catch (smsErr) {
        console.error('Failed to send SMS via Fast2SMS', smsErr)
      }
    } else {
      console.warn('FAST2SMS_API_KEY is not set. OTP was generated but not sent via SMS.')
    }

    return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: unknown) {
    console.error('[admin-login] Unhandled error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
