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

      const { data: plans } = await supabaseAdmin
        .from('subscribers')
        .select('plan')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1)

      const hasPlan = !!(plans && plans.length > 0)

      return NextResponse.redirect(`${origin}${hasPlan ? '/dashboard' : '/pricing'}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
