export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { buildSystemPrompt } from '../../../lib/note-style'

const VALID_FIELDS = ['buyer_note', 'producer_note', 'women_note']

function asOfLabel() {
  return new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// Belt and braces on the house rules, whatever the model returns.
function tidy(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\bprecise\b/gi, 'chiselled')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function POST(request) {
  try {
    const { wine = {}, fields = [], existing = {}, search = true } = await request.json()
    const wanted = fields.filter(f => VALID_FIELDS.includes(f))
    if (!wanted.length) return Response.json({ success: false, error: 'No valid fields requested' }, { status: 400 })
    if (!wine.description) return Response.json({ success: false, error: 'No wine description' }, { status: 400 })

    const asOf = asOfLabel()
    const size = String(wine.bottle_size || wine.bottle_volume || '75')
    const isMagnum = /150|magnum/i.test(size)

    const context = [
      `Wine: ${wine.description}`,
      wine.vintage ? `Vintage: ${wine.vintage}` : null,
      wine.colour ? `Colour: ${wine.colour}` : null,
      wine.region ? `Region: ${wine.region}` : null,
      wine.country ? `Country: ${wine.country}` : null,
      `Format: ${isMagnum ? '150cl magnum' : size.includes('37') ? '37.5cl half' : '75cl bottle'}`,
    ].filter(Boolean).join('\n')

    const already = VALID_FIELDS
      .filter(f => existing[f] && !wanted.includes(f))
      .map(f => `${f} (already written, do not repeat its facts):\n${existing[f]}`)
      .join('\n\n')

    const userText = [
      context,
      already ? `\nEXISTING NOTES\n${already}` : null,
      `\nDraft the following field${wanted.length > 1 ? 's' : ''}: ${wanted.join(', ')}.`,
      `Return JSON with exactly these keys: ${wanted.map(f => `"${f}"`).join(', ')}.`,
    ].filter(Boolean).join('\n')

    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: buildSystemPrompt(asOf),
      messages: [{ role: 'user', content: userText }],
    }
    if (search) {
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }]
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const raw = await res.text()
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${raw.substring(0, 200)}`)

    const data = JSON.parse(raw)
    // With search on, the reply is several blocks; the JSON is in the final text block(s).
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in model reply: ' + text.substring(0, 200))
    const parsed = JSON.parse(match[0].replace(/```json|```/g, ''))

    const notes = {}
    for (const f of wanted) notes[f] = tidy(parsed[f])

    return Response.json({ success: true, notes, asOf, searched: !!search })
  } catch (err) {
    console.error('draft-note error:', err.message)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
