import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  await supabase.from('wines').select('id').limit(1)
  return Response.json({ ok: true, time: new Date().toISOString() })
}
