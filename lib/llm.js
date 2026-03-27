// ── LLM ROUTING ───────────────────────────────────────────────────────────────
// Provider priority: user Anthropic key → user Gemini key → app Groq (base tier)
// Gemini 2.0 Flash is the recommended free upgrade; Groq LLaMA is the app-sponsored base.

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'

function resolveProvider({ anthropicKey, geminiKey } = {}) {
  if (anthropicKey) return { provider: 'anthropic', key: anthropicKey }
  if (geminiKey)    return { provider: 'gemini',    key: geminiKey }
  if (process.env.GROQ_API_KEY)     return { provider: 'groq',      key: process.env.GROQ_API_KEY }
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', key: process.env.ANTHROPIC_API_KEY }
  throw new Error('No LLM provider configured. Set GROQ_API_KEY, or connect a Gemini or Claude key in Settings.')
}

// Map Claude model names → provider equivalent (Gemini/Groq ignore model name, always use their best)
function resolveModel(provider, claudeModel) {
  if (provider === 'anthropic') return claudeModel || 'claude-sonnet-4-5'
  if (provider === 'gemini')    return 'gemini-2.0-flash'
  if (provider === 'groq')      return 'llama-3.3-70b-versatile'
  return claudeModel || 'claude-sonnet-4-5'
}

export async function callLLM(prompt, systemPrompt, maxTokens = 1500, model = 'claude-sonnet-4-5', llmKeys = {}) {
  const { provider, key } = resolveProvider(llmKeys)
  const resolvedModel = resolveModel(provider, model)

  if (provider === 'anthropic') {
    const res = await fetch(ANTHROPIC_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error(`Anthropic API error ${res.status}:`, errText)
      throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.content?.map(c => c.text || '').join('') || ''
  }

  if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_BASE}/${resolvedModel}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error(`Gemini API error ${res.status}:`, errText)
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  if (provider === 'groq') {
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error(`Groq API error ${res.status}:`, errText)
      throw new Error(`Groq API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }

  throw new Error(`Unknown provider: ${provider}`)
}

export async function* streamLLM(prompt, systemPrompt, maxTokens = 1500, model = 'claude-sonnet-4-5', llmKeys = {}) {
  const { provider, key } = resolveProvider(llmKeys)
  const resolvedModel = resolveModel(provider, model)

  if (provider === 'anthropic') {
    const res = await fetch(ANTHROPIC_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') yield event.delta.text
        } catch {}
      }
    }
    return
  }

  if (provider === 'gemini') {
    // Gemini streaming — responseMimeType is incompatible with streaming; rely on prompt + parseJSON
    const res = await fetch(`${GEMINI_BASE}/${resolvedModel}:streamGenerateContent?alt=sse&key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const ev = JSON.parse(line.slice(6))
          const text = ev.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) yield text
        } catch {}
      }
    }
    return
  }

  if (provider === 'groq') {
    // Groq streaming — OpenAI-compatible SSE (no response_format for streaming)
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Groq API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const ev = JSON.parse(line.slice(6))
          const text = ev.choices?.[0]?.delta?.content
          if (text) yield text
        } catch {}
      }
    }
  }
}
