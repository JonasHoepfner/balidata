import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({
      loggedIn: false, isPaid: false, isAdmin: false, plan: null,
      email: null, firstName: null, lastName: null, avatarType: null, country: null, planCreatedAt: null,
    })
  }

  const { data: subscriber } = await supabaseAdmin
    .from('subscribers')
    .select('plan, active, first_name, last_name, avatar_type, country, is_admin, created_at')
    .eq('user_id', session.user.id)
    .order('active', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isPaid = !!(subscriber?.active && subscriber?.plan)
  const isAdmin = !!(subscriber?.is_admin)

  return NextResponse.json({
    loggedIn: true,
    isPaid: isPaid || isAdmin,
    isAdmin,
    plan: isPaid ? (subscriber?.plan ?? null) : null,
    email: session.user.email ?? null,
    firstName: subscriber?.first_name ?? null,
    lastName: subscriber?.last_name ?? null,
    avatarType: subscriber?.avatar_type ?? null,
    country: subscriber?.country ?? null,
    planCreatedAt: isPaid ? (subscriber?.created_at ?? null) : null,
  })
}
