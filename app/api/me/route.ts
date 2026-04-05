import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ loggedIn: false, isPaid: false, plan: null, email: null, firstName: null, avatarType: null })
  }

  const { data: subscriber } = await supabaseAdmin
    .from('subscribers')
    .select('plan, active, first_name, avatar_type')
    .eq('user_id', session.user.id)
    .order('active', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isPaid = !!(subscriber?.active && subscriber?.plan)

  return NextResponse.json({
    loggedIn: true,
    isPaid,
    plan: isPaid ? (subscriber?.plan ?? null) : null,
    email: session.user.email ?? null,
    firstName: subscriber?.first_name ?? null,
    avatarType: subscriber?.avatar_type ?? null,
  })
}
