import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ loggedIn: false, isPaid: false, plan: null, email: null })
  }

  const { data: plans } = await supabaseAdmin
    .from('subscribers')
    .select('plan')
    .eq('user_id', session.user.id)
    .eq('active', true)
    .limit(1)

  const activePlan = plans?.[0] ?? null

  return NextResponse.json({
    loggedIn: true,
    isPaid: !!activePlan,
    plan: activePlan?.plan ?? null,
    email: session.user.email ?? null,
  })
}
