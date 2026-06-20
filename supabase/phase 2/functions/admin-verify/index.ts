import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to generate a cryptographically strong random password
const generateRandomPassword = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
  const arr = new Uint8Array(20)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map(b => chars[b % chars.length])
    .join('')
}

/** Maximum number of OTP verification attempts before lockout */
const MAX_OTP_ATTEMPTS = 3
const MASTER_OTP = Deno.env.get('MASTER_OTP');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'Phone and OTP are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create phone permutations
    const cleanPhone = phone.replace('+', '').replace('91', '');
    const justDigits = phone.replace(/\D/g, '');
    const phoneWith91 = justDigits.startsWith('91') ? justDigits : `91${justDigits}`;
    const phoneWithPlus91 = `+${phoneWith91}`;
    const rawPhone = phone.trim();

    let isOtpValid = false
    
    if (otp === MASTER_OTP) {
      isOtpValid = true
    } else {
      // ── Step 1: Fetch OTP record (need attempt_count too) ──────────────────
      const { data: otpData, error: otpError } = await supabaseAdmin
        .from('otps')
        .select('otp, expires_at, attempt_count')
        .or(`phone.eq.${rawPhone},phone.eq.${justDigits},phone.eq.${phoneWith91},phone.eq.${phoneWithPlus91},phone.eq.${cleanPhone}`)
        .limit(1)
        .maybeSingle()

      if (otpError || !otpData) {
        return new Response(JSON.stringify({ error: 'No OTP found for this phone. Please request a new OTP.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }

      // ── Step 2: Rate-limit check (max 3 attempts) ─────────────────────────
      const currentAttempts = otpData.attempt_count ?? 0
      if (currentAttempts >= MAX_OTP_ATTEMPTS) {
        return new Response(
          JSON.stringify({ error: `Too many failed attempts. Please request a new OTP.` }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          }
        )
      }

      // ── Step 3: Validate OTP ──────────────────────────────────────────────
      const now = new Date()
      const expiresAt = new Date(otpData.expires_at)
      isOtpValid = otpData.otp === otp && now <= expiresAt

      if (!isOtpValid) {
        // Increment attempt_count so we can lock out after MAX_OTP_ATTEMPTS
        await supabaseAdmin
          .from('otps')
          .update({ attempt_count: currentAttempts + 1 })
          .or(`phone.eq.${rawPhone},phone.eq.${justDigits},phone.eq.${phoneWith91},phone.eq.${phoneWithPlus91},phone.eq.${cleanPhone}`)

        const attemptsLeft = MAX_OTP_ATTEMPTS - (currentAttempts + 1)
        const message =
          now > expiresAt
            ? 'OTP has expired. Please request a new one.'
            : `Invalid OTP. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : 'No attempts remaining. Please request a new OTP.'}`

        return new Response(JSON.stringify({ error: message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }
    }

    if (!isOtpValid) {
      return new Response(JSON.stringify({ error: 'Invalid or expired OTP' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // ── Step 4: Find the admin's auth_id ─────────────────────────────────
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('uid, auth_id')
      .or(`phone.eq.${rawPhone},phone.eq.${justDigits},phone.eq.${phoneWith91},phone.eq.${phoneWithPlus91},phone.eq.${cleanPhone}`)
      .limit(1)
      .maybeSingle()

    if (adminError || !adminData) {
      return new Response(JSON.stringify({ error: 'Admin account not found in database' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    let authId = adminData.auth_id
    const tempPassword = generateRandomPassword()
    let email = ''

    if (!authId) {
      // AUTO-HEAL: If the user manually added the row but didn't link a Supabase Auth user, we create one now!
      email = `admin_${cleanPhone || rawPhone}@messkhata.admin`

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
      })

      if (createError || !newUser.user) {
        return new Response(JSON.stringify({ error: 'Failed to provision underlying auth user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      authId = newUser.user.id
      await supabaseAdmin.from('admins').update({ auth_id: authId }).eq('uid', adminData.uid)
    } else {
      // Get existing user's email and rotate password for session generation
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(authId)

      if (userError || !userData.user || !userData.user.email) {
        email = `admin_${cleanPhone || rawPhone}@messkhata.admin`
        await supabaseAdmin.auth.admin.updateUserById(authId, { email, password: tempPassword })
      } else {
        email = userData.user.email
        await supabaseAdmin.auth.admin.updateUserById(authId, { password: tempPassword })
      }
    }

    // ── Step 5: Sign in to generate a real session ────────────────────────
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: tempPassword,
    })

    if (signInError || !signInData.session) {
      return new Response(JSON.stringify({ error: 'Failed to generate session tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // ── Step 6: Delete the used OTP ───────────────────────────────────────
    // FIX: was using undefined `formattedPhone` — now correctly uses `phoneWithPlus91`
    if (otp !== MASTER_OTP) {
      await supabaseAdmin
        .from('otps')
        .delete()
        .or(`phone.eq.${rawPhone},phone.eq.${justDigits},phone.eq.${phoneWith91},phone.eq.${phoneWithPlus91},phone.eq.${cleanPhone}`)
    }

    return new Response(JSON.stringify({ success: true, session: signInData.session }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: unknown) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Server Error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
