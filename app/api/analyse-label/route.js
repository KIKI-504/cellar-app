export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const { imageBase64, mediaType } = await request.json()

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `You are reading a wine bottle label. Extract the following information and respond ONLY with a JSON object, no other text, no markdown:
{
  "producer": "producer or domaine name",
  "wine_name": "the wine or appellation name",
  "vintage": "4-digit year as string",
  "region": "region if visible"
}
If you cannot determine a field, use null. Be precise — extract exactly what is on the label.`
            }
          ]
        }]
      })
    })

    // Log raw response for debugging
    const rawText = await anthropicResponse.text()
    console.log('Anthropic raw response:', rawText.substring(0, 500))

    if (!anthropicResponse.ok) {
      throw new Error(`Anthropic API error ${anthropicResponse.status}: ${rawText.substring(0, 200)}`)
    }

    const data = JSON.parse(rawText)
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    return Response.json({ success: true, data: extracted })
  } catch (err) {
    console.error('Label analysis error:', err.message)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
