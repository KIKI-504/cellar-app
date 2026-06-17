export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://unteoesmedxvwrmnhlkz.supabase.co'
const ALLOWED_FIELDS = ['buyer_note', 'producer_note', 'women_note']
const ADMIN_PIN = '2025'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { id, field, value, pin } = body || {}

    if (pin !== ADMIN_PIN) {
      return json({ error: 'Not authorised' }, 401)
    }
    if (!id || !ALLOWED_FIELDS.includes(field)) {
      return json({ error: 'Bad request' }, 400)
    }

    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) {
      return json({ error: 'Server not configured (missing service role key)' }, 500)
    }

    // Empty / whitespace clears the note (stored as null so the buyer view hides it)
    const clean = (typeof value === 'string' && value.trim() !== '') ? value : null

    const res = await fetch(`${SUPABASE_URL}/rest/v1/wines?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ [field]: clean }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return json({ error: 'Update failed', detail }, 500)
    }

    return json({ ok: true, value: clean }, 200)
  } catch (e) {
    return json({ error: 'Server error', detail: String(e) }, 500)
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
