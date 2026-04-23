const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const CONFIDENCE_THRESHOLD = 70;

// Google AI Studio keys all start with "AIza" and use URL-safe base64 chars.
// We intentionally don't enforce a strict length — Google hasn't officially
// documented it and could change the format. The prefix + charset check catches
// the actual bug class we care about: pasted keys with whitespace / newlines /
// control characters that would otherwise surface as a confusing
// "TypeError: Failed to fetch" at the HTTP header validation layer.
// Real key validity (revoked / wrong project / etc.) is left to Gemini's
// own 401/403 response.
const API_KEY_PATTERN = /^AIza[A-Za-z0-9_-]{20,}$/;

export function isValidApiKeyFormat(key) {
  return typeof key === 'string' && API_KEY_PATTERN.test(key.trim());
}

const OCR_PROMPT = `You are a highly accurate OCR text extractor specializing in reading difficult documents including scanned papers, faxes, receipts, and low-quality images.

Respond with ONLY a JSON object (no markdown, no code fences).

Always include a "confidence" field (0-100):
- 90-100: Perfectly clear, fully readable
- 70-89: Readable, minor unclear parts
- 40-69: Partially readable, guessing required
- 0-39: Mostly unreadable or no text

Response format:
{"status":"ok","text":"extracted text here","confidence":85}
{"status":"fail","reason":"no_text|blurry|too_small|low_contrast|partial","confidence":15}

Rules:
1. Extract text exactly as it appears, preserving line breaks and layout.
2. For blurry or low-quality scanned documents, try your best to read the text even if slightly unclear. Use context clues (surrounding words, document structure) to infer ambiguous characters.
3. For mixed-language text (e.g. Japanese + English + numbers), extract all languages accurately.
4. Numbers, dates, and codes are critical — extract them precisely (e.g. invoice numbers, phone numbers, amounts).
5. If the image has NO text, set reason to "no_text".
6. If text is genuinely unreadable despite best effort, set reason to "blurry".
7. If only fragments are readable, set reason to "partial" and include what you could read in "text".`;

// OCR: extract all text from image
export async function geminiOcr(imageBase64, config) {
  const { apiKey, model } = config;
  if (!apiKey) throw new Error('error.noApiKey');
  // Fail fast on malformed keys — otherwise bad header chars produce
  // a confusing "Failed to fetch" that users can't distinguish from real network issues.
  if (!isValidApiKeyFormat(apiKey)) throw new Error('error.invalidApiKey');

  const url = `${API_BASE}/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        { text: OCR_PROMPT },
      ]
    }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = err?.error?.message || response.status;

        // Quota exceeded — no point retrying, throw immediately with clear message.
        // Google returns varied phrasings: "Quota exceeded...", "Resource has been exhausted..."
        if (response.status === 429 && /quota|exhausted|RESOURCE_EXHAUSTED/i.test(String(detail))) {
          throw new Error('error.quotaExceeded');
        }

        // Invalid / revoked / wrong-API key — Gemini returns 400/401/403 with "API key" in the detail.
        // Route to the fully localized error.invalidApiKey so users don't see raw English mixed with the UI language.
        if ([400, 401, 403].includes(response.status) && /api.?key/i.test(String(detail))) {
          throw new Error('error.invalidApiKey');
        }

        // Server-side failure — localized, but still retryable
        if ([500, 502, 503, 504].includes(response.status) && attempt < 2) {
          lastError = new Error('error.serverError');
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        if ([500, 502, 503, 504].includes(response.status)) {
          throw new Error('error.serverError');
        }

        // Generic 429 without quota keyword — usually rate limit, retry then give up
        if (response.status === 429 && attempt < 2) {
          lastError = new Error('error.rateLimited');
          const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
          await new Promise(r => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt)));
          continue;
        }
        if (response.status === 429) throw new Error('error.rateLimited');

        throw new Error(`error.apiError::${detail}`);
      }

      const data = await response.json();

      // Safety / policy block at the prompt level — fully localized
      if (data?.promptFeedback?.blockReason) throw new Error('error.blocked');

      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason && !['STOP', 'MAX_TOKENS'].includes(finishReason)) {
        // SAFETY / RECITATION / OTHER — all route to error.blocked for a consistent localized message
        throw new Error('error.blocked');
      }

      const rawText = candidate?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('error.emptyResponse');

      // Parse structured JSON response
      const result = parseOcrResponse(rawText);

      // Extract token usage
      const usage = data?.usageMetadata || {};

      return {
        ...result,
        model: data?.modelVersion || 'unknown',
        tokenUsage: {
          input: usage.promptTokenCount || 0,
          output: usage.candidatesTokenCount || 0,
          total: usage.totalTokenCount || 0,
        },
      };
    } catch (err) {
      // Network-level failure (DNS, offline, SW restart mid-fetch, firewall) — retry
      const isNetwork = err instanceof TypeError && err.message.includes('fetch');
      if (isNetwork) {
        lastError = new Error('error.network');
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw lastError;
      }
      if (err.message.startsWith('error.')) throw err;
      lastError = err;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastError || new Error('error.unknown');
}

// Parse the structured OCR response from Gemini
function parseOcrResponse(raw) {
  const trimmed = raw.trim();

  // Try JSON parse
  const json = tryParseJson(trimmed);
  if (json) {
    const confidence = json.confidence ?? 0;

    if (json.status === 'fail') {
      return { status: 'fail', reason: json.reason || 'no_text', confidence, formatted: null };
    }

    if (json.status === 'ok' && confidence < CONFIDENCE_THRESHOLD) {
      const reason = json.reason || (confidence < 40 ? 'blurry' : 'partial');
      return { status: 'fail', reason, confidence, formatted: null };
    }

    if (json.status === 'ok' && json.text) {
      return { status: 'ok', formatted: json.text, confidence };
    }

    // status=ok but text is empty/missing
    if (json.status === 'ok') {
      return { status: 'fail', reason: 'no_text', confidence, formatted: null };
    }
  }

  // JSON parse failed — try to extract text from malformed JSON
  const extracted = extractTextFromBrokenJson(trimmed);
  if (extracted) {
    return { status: 'ok', formatted: extracted };
  }

  // Fallback: if model returned plain text instead of JSON
  if (isEmptyResponse(trimmed)) {
    return { status: 'fail', reason: 'no_text', formatted: null };
  }

  // Last resort: if it looks like JSON but we couldn't parse, don't return raw JSON to user
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { status: 'fail', reason: 'partial', formatted: null };
  }

  return { status: 'ok', formatted: trimmed };
}

function tryParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// Extract "text" field from malformed JSON via regex
function extractTextFromBrokenJson(str) {
  const match = str.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (match?.[1]) {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return null;
}

// Fallback detection for non-JSON refusal responses
function isEmptyResponse(text) {
  const lower = text.toLowerCase();
  const patterns = [
    'i cannot read', 'i can\'t read', 'no visible text', 'no readable text',
    'no text found', 'no text in', 'does not contain any text',
    'image is completely', 'image is blank', 'i\'m sorry', 'i am sorry',
    'there is no text', 'テキストが見つかりません', '読み取れ',
  ];
  return patterns.some(p => lower.includes(p));
}

export function resolveModel(preferredModel) {
  return preferredModel || 'gemini-2.5-flash-lite';
}
