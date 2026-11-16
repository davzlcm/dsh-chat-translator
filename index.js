/**
 * Host half of the trade-reply translator.
 *
 * Exposes one small same-origin JSON API under `/chat-translator` for the
 * floating window in the Web UI. Translation runs on the profile's current
 * default model unless the window names another provider/model pair from the
 * catalog this plugin advertises, with a short business-reply system prompt in
 * either direction of the selected language pair.
 */

const PREFIX = '/chat-translator'
const VERSION = 4
const MAX_INPUT_CHARS = 4000
const MAX_BODY_BYTES = 128 * 1024
const REQUEST_TIMEOUT_MS = 90_000
/** How long the advertised model catalog is reused before asking the adapters again. */
const MODEL_CACHE_MS = 30_000
const MAX_PROVIDER_ID_CHARS = 80
const MAX_MODEL_ID_CHARS = 120

const DEFAULT_SOURCE = 'Simplified Chinese'
const DEFAULT_TARGET = 'English'

/** One sentence per rule, checked against the live model before shipping. */
function buildPrompt(source, target) {
  const lines = [
    'You are a foreign-trade sales assistant for a Chinese supplier who sells on 1688 and WeChat.',
    `Translate the seller's ${source} message into a short, natural, polite business ${target} reply that the seller can send straight to an overseas customer.`,
    'Rules:',
    `- Output only the ${target} text. No quotes, no labels, no explanation, no preamble.`,
    `- Write in ${target}. Never mix in another language unless the original already contains it.`,
    '- Match the length and intent of the original. A greeting stays a short greeting. Never add a follow-up question, offer or sentence the seller did not write.',
    '- One or two short sentences at most. Keep it under 25 words whenever the meaning allows.',
    '- Sound like a real person in a chat, not like machine translation. Plain and friendly.',
    '- Keep product names, prices, quantities, sizes, colours and dates exactly as written. Never invent facts, stock levels, discounts or delivery promises.',
    '- If the original is a question for the customer, keep it a question.',
    '- If the original lists several points, keep the same order as short lines.',
  ]
  if (target === 'English') {
    lines.push('- Use plain, natural trade English, not literary or formal English.')
  }
  if (target === 'Simplified Chinese') {
    lines.push('- Use natural Simplified Chinese, the way a supplier writes on WeChat.')
  }
  if (source === 'Simplified Chinese' && target === 'English') {
    lines.push('- For example, "你好" becomes "Hello".')
  }
  return lines.join('\n')
}

/** GET /chat-translator/health and POST /chat-translator/translate. */
export const inject = ['webServer']

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  res.end(body)
}

function failure(res, status, code, message, extra) {
  sendJson(res, status, { ok: false, code, message, ...(extra || {}) })
}

function originAllowed(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size <= MAX_BODY_BYTES) chunks.push(chunk)
    })
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large'), { code: 'BODY_TOO_LARGE' }))
        return
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (raw.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(Object.assign(new Error('Request body is not valid JSON'), { code: 'BAD_JSON' }))
      }
    })
    req.on('error', reject)
  })
}

/** A display language name, kept short and free of control characters. */
function languageName(value, fallback) {
  if (typeof value !== 'string') return fallback
  const name = value.trim().replace(/[\r\n\t]+/g, ' ').slice(0, 60)
  return name.length > 0 ? name : fallback
}

/** Strip the wrappers a model sometimes adds around a single reply. */
function cleanReply(text) {
  let value = String(text || '').trim()
  value = value.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim()
  value = value.replace(/^(english|en|reply|translation|translated text)\s*[:：]\s*/i, '').trim()
  if (value.length > 1) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === '“' && last === '”')) {
      value = value.slice(1, -1).trim()
    }
  }
  return value
}

export function apply(ctx) {
  function currentModel() {
    try {
      const defaults = ctx.get('agentDefaultModel')
      const selection = defaults && typeof defaults.currentSelection === 'function'
        ? defaults.currentSelection()
        : undefined
      if (selection && typeof selection.provider === 'string' && selection.provider.length > 0
        && typeof selection.model === 'string' && selection.model.length > 0) {
        return { provider: selection.provider, model: selection.model }
      }
    } catch {
      /* fall back to the account default below */
    }
    return { provider: 'deepseek-account', model: 'deepseek-flash' }
  }

  /** The provider/model pair the window asked for, or undefined to follow the profile default. */
  function requestedModel(body) {
    const provider = body && typeof body.provider === 'string' ? body.provider.trim() : ''
    const model = body && typeof body.model === 'string' ? body.model.trim() : ''
    if (provider.length === 0 || model.length === 0) return undefined
    if (provider.length > MAX_PROVIDER_ID_CHARS || model.length > MAX_MODEL_ID_CHARS) {
      throw Object.assign(new Error('That provider or model id is too long'), { code: 'BAD_MODEL' })
    }
    return { provider, model }
  }

  /** Ask every registered adapter for the models it advertises. Never throws for one provider. */
  async function readCatalog() {
    const llm = ctx.get('llm')
    const defaultSelection = currentModel()
    if (llm === undefined || typeof llm.listProviders !== 'function') {
      return { default: defaultSelection, providers: [] }
    }
    const providers = []
    for (const info of llm.listProviders()) {
      const entry = { id: info.id, name: info.name || info.id, models: [] }
      try {
        const models = typeof llm.listModels === 'function' ? await llm.listModels(info.id) : []
        entry.models = (models || []).map(model => ({ id: model.id, name: model.name || model.id }))
      } catch (error) {
        entry.error = error && error.message ? error.message : String(error)
      }
      providers.push(entry)
    }
    return { default: defaultSelection, providers }
  }

  let cache = { at: 0, value: null, pending: null }

  /** Cached model catalog; `refresh` forces one adapter round trip. */
  async function modelCatalog(refresh) {
    const fresh = cache.value !== null && Date.now() - cache.at < MODEL_CACHE_MS
    if (!refresh && fresh) return cache.value
    if (cache.pending) return cache.pending
    cache.pending = readCatalog().then(
      (value) => {
        cache = { at: Date.now(), value, pending: null }
        return value
      },
      (error) => {
        cache.pending = null
        throw error
      },
    )
    return cache.pending
  }

  /**
   * Reject a pair the profile cannot route before the provider I/O starts, so the
   * window can say "that model is gone" instead of surfacing a wire error.
   */
  function assertRoutable(selection) {
    const llm = ctx.get('llm')
    if (llm === undefined || typeof llm.listProviders !== 'function') return
    const providers = llm.listProviders()
    if (providers.length > 0 && !providers.some(provider => provider.id === selection.provider)) {
      throw Object.assign(
        new Error(`The provider "${selection.provider}" is not available in this profile`),
        { code: 'MODEL_UNAVAILABLE' },
      )
    }
    if (cache.value === null) return
    const entry = cache.value.providers.find(provider => provider.id === selection.provider)
    if (entry === undefined || entry.models.length === 0) return
    if (!entry.models.some(model => model.id === selection.model)) {
      throw Object.assign(
        new Error(`The model "${selection.model}" is not available on "${selection.provider}"`),
        { code: 'MODEL_UNAVAILABLE' },
      )
    }
  }

  async function translate(text, source, target, requested) {
    const llm = ctx.get('llm')
    if (llm === undefined || typeof llm.stream !== 'function') {
      throw Object.assign(new Error('The model service is not available in this profile'), { code: 'LLM_UNAVAILABLE' })
    }
    const selection = requested || currentModel()
    assertRoutable(selection)
    const { provider, model } = selection
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('Translation timed out')), REQUEST_TIMEOUT_MS)
    let output = ''
    let failureInfo
    try {
      const stream = llm.stream({
        provider,
        model,
        system: buildPrompt(source, target),
        messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        temperature: 0.3,
        maxTokens: 600,
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') output += chunk.text
        else if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
          failureInfo = chunk.reason.failure
        }
      }
    } finally {
      clearTimeout(timer)
    }
    if (failureInfo) {
      throw Object.assign(new Error(failureInfo.message || 'The model request failed'), {
        code: failureInfo.code || 'LLM_FAILED',
        status: failureInfo.status,
      })
    }
    const reply = cleanReply(output)
    if (reply.length === 0) {
      throw Object.assign(new Error('The model returned an empty reply'), { code: 'EMPTY_RESULT' })
    }
    return { reply, provider, model }
  }

  async function handle(req, res) {
    if (!originAllowed(req)) return failure(res, 403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are not allowed')
    const url = new URL(req.url || PREFIX, 'http://127.0.0.1')
    const op = url.pathname.slice(PREFIX.length).replace(/^\/+/, '').replace(/\/+$/, '')

    if (op === '' || op === 'health' || op === 'ping') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return failure(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint')
      }
      const model = currentModel()
      return sendJson(res, 200, {
        ok: true,
        version: VERSION,
        maxInputChars: MAX_INPUT_CHARS,
        provider: model.provider,
        model: model.model,
        llm: ctx.get('llm') !== undefined,
        models: typeof ctx.get('llm')?.listModels === 'function',
      })
    }

    if (op === 'models') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return failure(res, 405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint')
      }
      const refresh = url.searchParams.get('refresh') === '1'
      try {
        const catalog = await modelCatalog(refresh)
        return sendJson(res, 200, { ok: true, ...catalog })
      } catch (error) {
        const message = error && error.message ? error.message : String(error)
        ctx.logger?.warn?.('[chat-translator] model catalog failed: %s', message)
        return failure(res, 502, 'CATALOG_FAILED', message)
      }
    }

    if (op !== 'translate') {
      return failure(res, 404, 'UNKNOWN_OPERATION', `Unknown operation: ${op}`)
    }
    if (req.method !== 'POST') {
      return failure(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint')
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (error) {
      const code = error && typeof error.code === 'string' ? error.code : 'BAD_REQUEST'
      const message = error && error.message ? error.message : 'Bad request'
      return failure(res, code === 'BODY_TOO_LARGE' ? 413 : 400, code, message)
    }

    const text = body && typeof body.text === 'string' ? body.text.trim() : ''
    if (text.length === 0) return failure(res, 400, 'EMPTY_TEXT', 'There is no text to translate')
    if (text.length > MAX_INPUT_CHARS) {
      return failure(res, 413, 'TEXT_TOO_LONG', `Keep the input under ${MAX_INPUT_CHARS} characters`)
    }
    const source = languageName(body && body.sourceLanguage, DEFAULT_SOURCE)
    const target = languageName(body && body.targetLanguage, DEFAULT_TARGET)

    const startedAt = Date.now()
    try {
      const result = await translate(text, source, target, requestedModel(body))
      return sendJson(res, 200, {
        ok: true,
        translation: result.reply,
        sourceLanguage: source,
        targetLanguage: target,
        provider: result.provider,
        model: result.model,
        ms: Date.now() - startedAt,
      })
    } catch (error) {
      const code = error && typeof error.code === 'string' ? error.code : 'TRANSLATION_FAILED'
      const message = error && error.message ? error.message : String(error)
      ctx.logger?.warn?.('[chat-translator] translation failed: %s', message)
      const status = code === 'MODEL_UNAVAILABLE' || code === 'BAD_MODEL' ? 400 : 502
      return failure(res, status, code, message)
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: handle }))
}
