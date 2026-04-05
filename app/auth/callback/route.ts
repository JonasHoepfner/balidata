import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      const userId = data.session.user.id

      const { data: subscriber } = await supabaseAdmin
        .from('subscribers')
        .select('plan, active, first_name')
        .eq('user_id', userId)
        .order('active', { ascending: false })
        .limit(1)
        .maybeSingle()

      const hasProfile = !!(subscriber?.first_name)
      const hasPlan = !!(subscriber?.active && subscriber?.plan)

      if (!hasProfile) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
      return NextResponse.redirect(`${origin}${hasPlan ? '/dashboard' : '/pricing'}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
