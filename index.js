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
const VERSION = 5
/**
 * A news article or a pasted chat log fits here; longer input is split into
 * chunks below, so this only guards the request body.
 */
const MAX_INPUT_CHARS = 20000
const MAX_BODY_BYTES = 256 * 1024
/** Long input is translated chunk by chunk so no single reply hits an output cap. */
const CHUNK_CHARS = 1200
/** Above this length the model translates in full instead of writing a short chat line. */
const LONG_TEXT_CHARS = 200
/** Per-chunk model timeout: a full chunk can take a while to generate. */
const CHUNK_TIMEOUT_MS = 120_000
/** How long the advertised model catalog is reused before asking the adapters again. */
const MODEL_CACHE_MS = 30_000
const MAX_PROVIDER_ID_CHARS = 80
const MAX_MODEL_ID_CHARS = 120

const DEFAULT_SOURCE = 'Simplified Chinese'
const DEFAULT_TARGET = 'English'

/** How many reply tokens one chunk may use: enough for a full translation, never absurd. */
function replyTokens(chunk) {
  return Math.min(4096, Math.max(600, Math.ceil(chunk.length * 2.2)))
}

/**
 * Split long input on paragraph and sentence boundaries so every model call stays
 * small and its reply is never cut short by an output token cap.
 */
function splitText(text, limit) {
  const normalised = text.replace(/\r\n?/g, '\n').trim()
  if (normalised.length <= limit) return [normalised]
  const blocks = []
  for (const paragraph of normalised.split(/\n{2,}/)) {
    const value = paragraph.trim()
    if (value.length === 0) continue
    if (value.length <= limit) {
      blocks.push(value)
      continue
    }
    let buffer = ''
    for (const sentence of value.match(/[^。！？!?.\n]+[。！？!?.\n]?/g) || [value]) {
      let piece = sentence
      while (piece.length > limit) {
        blocks.push(piece.slice(0, limit))
        piece = piece.slice(limit)
      }
      if (buffer.length > 0 && buffer.length + piece.length > limit) {
        blocks.push(buffer.trim())
        buffer = ''
      }
      buffer += piece
    }
    if (buffer.trim().length > 0) blocks.push(buffer.trim())
  }
  const chunks = []
  let current = ''
  for (const block of blocks) {
    if (current.length === 0) current = block
    else if (current.length + 2 + block.length <= limit) current += '\n\n' + block
    else {
      chunks.push(current)
      current = block
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim())
  return chunks.length > 0 ? chunks : [normalised]
}

/**
 * A pasted transcript, a list or a paragraph is translated in full: the short-reply
 * prompt only makes sense for one brief chat message.
 */
function wantsFullTranslation(text, chunks) {
  if (chunks.length > 1) return true
  if (text.length > LONG_TEXT_CHARS) return true
  return text.split('\n').filter(line => line.trim().length > 0).length >= 2
}

/** Last-resort instruction: no persona, no tone rules, just the translation. */
function buildPlainPrompt(target) {
  return [
    `Translate the user's message into ${target}.`,
    `Output only the ${target} translation. Keep every sentence, paragraph and line break.`,
    'Never answer with an empty message.',
  ].join('\n')
}

/** One sentence per rule, checked against the live model before shipping. */
function buildPrompt(source, target, full) {
  const lines = full
    ? [
      'You are a professional translator working for a Chinese foreign-trade supplier.',
      `Translate the ${source} text below into ${target}.`,
      'Rules:',
      `- Output only the ${target} translation. No quotes, no labels, no explanation, no preamble.`,
      '- Translate every sentence in the original order. Never summarise, shorten, merge or skip anything.',
      '- Keep the paragraph breaks and list structure of the original: a blank line in the original stays a blank line.',
      '- If the original is a dialogue or chat log, keep each speaker line on its own line.',
      '- Keep product names, prices, quantities, sizes, colours, dates, addresses and proper nouns exactly as written. Never invent facts.',
      `- Write natural, professional ${target} that an overseas customer can read directly.`,
    ]
    : [
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

  /** One model call for one chunk; throws the same codes the endpoint reports. */
  async function translateOne(llm, selection, system, chunk) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('Translation timed out')), CHUNK_TIMEOUT_MS)
    let output = ''
    let failureInfo
    let finishKind = 'stop'
    try {
      const stream = llm.stream({
        provider: selection.provider,
        model: selection.model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: chunk }] }],
        temperature: 0.3,
        maxTokens: replyTokens(chunk),
        signal: controller.signal,
      })
      for await (const part of stream) {
        if (part.type === 'text-delta') output += part.text
        else if (part.type === 'finish') {
          if (part.reason.kind === 'error' || part.reason.kind === 'aborted') failureInfo = part.reason.failure
          else finishKind = part.reason.kind
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
    return { reply, finish: finishKind }
  }

  /** Translate every chunk in order and glue the segments back together. */
  async function runChunks(llm, selection, system, chunks) {
    const parts = []
    const finishes = []
    for (const chunk of chunks) {
      const part = await translateOne(llm, selection, system, chunk)
      parts.push(part.reply)
      finishes.push(part.finish)
    }
    return { reply: parts.join('\n\n'), finishes }
  }

  async function translate(text, source, target, requested) {
    const llm = ctx.get('llm')
    if (llm === undefined || typeof llm.stream !== 'function') {
      throw Object.assign(new Error('The model service is not available in this profile'), { code: 'LLM_UNAVAILABLE' })
    }
    const selection = requested || currentModel()
    assertRoutable(selection)
    const chunks = splitText(text, CHUNK_CHARS)
    let full = wantsFullTranslation(text, chunks)
    let baked
    try {
      baked = await runChunks(llm, selection, buildPrompt(source, target, full), chunks)
    } catch (error) {
      // Some models answer an empty message to the trade prompt; a plain
      // translator instruction usually gets a real reply out of them.
      if (!error || error.code !== 'EMPTY_RESULT') throw error
      full = true
      baked = await runChunks(llm, selection, buildPlainPrompt(target), chunks)
    }
    return {
      reply: baked.reply,
      finishes: baked.finishes,
      provider: selection.provider,
      model: selection.model,
      segments: chunks.length,
      mode: full ? 'full' : 'short',
    }
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
        chunkChars: CHUNK_CHARS,
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
        segments: result.segments,
        mode: result.mode,
        finishes: result.finishes,
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
