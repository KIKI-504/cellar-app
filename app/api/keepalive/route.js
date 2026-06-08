import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  await supabase.from('wines').select('id').limit(1)
  return Response.json({ ok: true, time: new Date().toISOString() })
}
