// ── LLM ROUTING ───────────────────────────────────────────────────────────────
// Provider priority: user Anthropic key → user Gemini key → app Groq (env GROQ_API_KEY)
// If a user key returns a billing/quota error (400/401/402/403/429) we automatically
// fall back to Groq and fire llmKeys.onKeyWarning(msg) so the UI can surface it.
// The app no longer maintains a fallback ANTHROPIC_API_KEY — Groq is the base tier.

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'

// Status codes that indicate a key problem (billing, quota, invalid) — worth retrying with Groq
const KEY_ERROR_CODES = new Set([400, 401, 402, 403, 429])

function resolveProvider({ anthropicKey, geminiKey } = {}) {
  if (anthropicKey) return { provider: 'anthropic', key: anthropicKey }
  if (geminiKey)    return { provider: 'gemini',    key: geminiKey }
  if (process.env.GROQ_API_KEY) return { provider: 'groq', key: process.env.GROQ_API_KEY }
  throw new Error('No LLM provider configured. Add GROQ_API_KEY to your environment, or connect a Gemini or Claude key in Settings.')
}

// Map Claude model names → provider equivalent
function resolveModel(provider, claudeModel) {
  if (provider === 'anthropic') return claudeModel || 'claude-sonnet-4-5'
  if (provider === 'gemini')    return 'gemini-2.0-flash'
  if (provider === 'groq')      return 'llama-3.3-70b-versatile'
  return claudeModel || 'claude-sonnet-4-5'
}

// ── Non-streaming call helpers ─────────────────────────────────────────────────

async function callAnthropic(prompt, systemPrompt, maxTokens, model, key) {
  const res = await fetch(ANTHROPIC_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const errText = await res.text()
    const err = new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`)
    err.statusCode = res.status
    throw err
  }
  const data = await res.json()
  return data.content?.map(c => c.text || '').join('') || ''
}

async function callGemini(prompt, systemPrompt, maxTokens, model, key) {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
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
    const err = new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
    err.statusCode = res.status
    throw err
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callGroq(prompt, systemPrompt, maxTokens, model) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not configured')
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      // No response_format: json_object — Groq's json_object mode only allows objects,
      // not arrays. Some coo.js functions return arrays (parseDoneList). Rely on prompt
      // instructions + parseJSON's fence-stripping instead.
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Groq API ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Streaming call helpers ─────────────────────────────────────────────────────

async function* streamAnthropic(prompt, systemPrompt, maxTokens, model, key) {
  const res = await fetch(ANTHROPIC_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system: systemPrompt, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const errText = await res.text()
    const err = new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`)
    err.statusCode = res.status
    throw err
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n'); buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') yield event.delta.text
      } catch {}
    }
  }
}

async function* streamGemini(prompt, systemPrompt, maxTokens, model, key) {
  const res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
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
    const err = new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
    err.statusCode = res.status
    throw err
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n'); buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(line.slice(6))
        const text = ev.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {}
    }
  }
}

async function* streamGroq(prompt, systemPrompt, maxTokens, model) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not configured')
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, stream: true,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
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
    const lines = buffer.split('\n'); buffer = lines.pop() || ''
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

// ── Public API ─────────────────────────────────────────────────────────────────

export async function callLLM(prompt, systemPrompt, maxTokens = 1500, model = 'claude-sonnet-4-5', llmKeys = {}) {
  const { onKeyWarning } = llmKeys
  const { provider, key } = resolveProvider(llmKeys)
  const resolvedModel = resolveModel(provider, model)
  const isUserKey = provider === 'anthropic' || provider === 'gemini'

  const callPrimary = () => {
    if (provider === 'anthropic') return callAnthropic(prompt, systemPrompt, maxTokens, resolvedModel, key)
    if (provider === 'gemini')    return callGemini(prompt, systemPrompt, maxTokens, resolvedModel, key)
    return callGroq(prompt, systemPrompt, maxTokens, resolveModel('groq', model))
  }

  try {
    return await callPrimary()
  } catch (err) {
    const code = err.statusCode || parseInt(err.message?.match(/\b(4\d\d)\b/)?.[1])
    if (isUserKey && KEY_ERROR_CODES.has(code) && process.env.GROQ_API_KEY) {
      const providerName = provider === 'anthropic' ? 'Claude' : 'Gemini'
      console.warn(`[LLM] ${providerName} key error ${code} — falling back to Groq`)
      onKeyWarning?.(`Your ${providerName} key failed (${code}) — switched to Groq. Check billing or quota in Settings.`)
      return await callGroq(prompt, systemPrompt, maxTokens, resolveModel('groq', model))
    }
    throw err
  }
}

export async function* streamLLM(prompt, systemPrompt, maxTokens = 1500, model = 'claude-sonnet-4-5', llmKeys = {}) {
  const { onKeyWarning } = llmKeys
  const { provider, key } = resolveProvider(llmKeys)
  const resolvedModel = resolveModel(provider, model)
  const isUserKey = provider === 'anthropic' || provider === 'gemini'

  const streamPrimary = () => {
    if (provider === 'anthropic') return streamAnthropic(prompt, systemPrompt, maxTokens, resolvedModel, key)
    if (provider === 'gemini')    return streamGemini(prompt, systemPrompt, maxTokens, resolvedModel, key)
    return streamGroq(prompt, systemPrompt, maxTokens, resolveModel('groq', model))
  }

  try {
    yield* streamPrimary()
  } catch (err) {
    const code = err.statusCode || parseInt(err.message?.match(/\b(4\d\d)\b/)?.[1])
    if (isUserKey && KEY_ERROR_CODES.has(code) && process.env.GROQ_API_KEY) {
      const providerName = provider === 'anthropic' ? 'Claude' : 'Gemini'
      console.warn(`[LLM] ${providerName} key error ${code} — falling back to Groq (stream)`)
      onKeyWarning?.(`Your ${providerName} key failed (${code}) — switched to Groq. Check billing or quota in Settings.`)
      yield* streamGroq(prompt, systemPrompt, maxTokens, resolveModel('groq', model))
      return
    }
    throw err
  }
}
