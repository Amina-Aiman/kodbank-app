/**
 * AI Chat – Hugging Face integration (tutor flow).
 * Option A – Space (recommended): Create a Space → Deploy chat model → set HUGGINGFACE_SPACE=username/space-name in .env.
 * Option B – Router API: Set HUGGINGFACE_API_KEY (and optional HUGGINGFACE_MODEL) in backend/.env.
 * Token: https://huggingface.co/settings/tokens (enable "Make calls to Inference Providers").
 */
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');

function readEnvValue(key) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const line = content.split('\n').find((l) => l.startsWith(key + '='));
    if (!line) return '';
    const value = line.slice(key.length + 1).trim().replace(/\r/g, '');
    return value.startsWith('"') ? value.slice(1, -1) : value;
  } catch {
    return '';
  }
}

function getApiKey() {
  const raw = process.env.HUGGINGFACE_API_KEY || readEnvValue('HUGGINGFACE_API_KEY') || '';
  return raw.replace(/\uFEFF/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '').trim();
}

function getModel() {
  const model = process.env.HUGGINGFACE_MODEL || readEnvValue('HUGGINGFACE_MODEL') || 'Qwen/Qwen2.5-7B-Instruct';
  return model.trim().replace(/\r/g, '');
}

function getSpace() {
  return (process.env.HUGGINGFACE_SPACE || readEnvValue('HUGGINGFACE_SPACE') || '').trim().replace(/\r/g, '');
}

/** Build Gradio app URL from Space id "username/space-name". */
function spaceBaseUrl(spaceId) {
  const slug = spaceId.replace(/\//g, '-').toLowerCase();
  return `https://${slug}.hf.space`;
}

/**
 * Call a Gradio Space (e.g. chat): POST /call/chat then GET result by event_id.
 * Returns the reply text or throws.
 */
async function callGradioSpace(baseUrl, apiName, payload, hfToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

  const postRes = await fetch(`${baseUrl}/call/${apiName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!postRes.ok) {
    const t = await postRes.text();
    throw new Error(`Space POST failed: ${postRes.status} ${t}`);
  }
  const postData = await postRes.json();
  const eventId = postData.event_id;
  if (!eventId) throw new Error('Space did not return event_id');

  const getRes = await fetch(`${baseUrl}/call/${apiName}/${eventId}`, {
    headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : {},
  });
  if (!getRes.ok) throw new Error(`Space GET failed: ${getRes.status}`);

  const text = await getRes.text();
  let lastData = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) {
      try {
        lastData = JSON.parse(line.slice(5).trim());
      } catch (_) {}
    }
  }
  if (lastData == null) throw new Error('Space returned no data');
  return lastData;
}

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function extractReplyFromRouter(data) {
  if (data.output_text != null && String(data.output_text).trim()) return String(data.output_text).trim();
  if (data.generated_text != null && String(data.generated_text).trim()) return String(data.generated_text).trim();
  if (data.response != null && String(data.response).trim()) return String(data.response).trim();
  const c = data.choices && data.choices[0];
  if (c && c.message && typeof c.message.content === 'string' && c.message.content.trim()) return c.message.content.trim();
  if (c && typeof c.text === 'string' && c.text.trim()) return c.text.trim();
  // Responses API: output[] -> content[] -> type "output_text" -> text
  const out = data.output && data.output[0];
  if (out && Array.isArray(out.content)) {
    for (const block of out.content) {
      if (block && block.type === 'output_text' && typeof block.text === 'string' && block.text.trim()) return block.text.trim();
    }
  }
  if (out && out.content && Array.isArray(out.content) && out.content[0] && typeof out.content[0].text === 'string') return out.content[0].text.trim();
  return '';
}

/** From Gradio chat response (array of messages or single value), get the assistant reply text. */
function extractReplyFromSpace(data) {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (Array.isArray(data)) {
    const last = data[data.length - 1];
    if (last && typeof last === 'object' && last.role === 'assistant' && typeof last.content === 'string') return last.content.trim();
    if (last && typeof last === 'object' && typeof last.message === 'string') return last.message.trim();
    if (typeof last === 'string' && last.trim()) return last.trim();
  }
  return '';
}

const SYSTEM_PROMPT = `You are KODBANK Smart Assistant. You help users with banking questions, financial explanations, and app navigation. Be polite, concise, professional, and clear.

Rules:
- Keep replies focused and not overly long (2-4 short paragraphs max unless the user asks for detail).
- If the user's question is vague or unclear, ask one short clarifying question instead of guessing.
- Avoid generic or repetitive answers; tailor your response to what the user actually asked.
- For balance, transfers, or transactions, direct them to the app's Check Balance, Transfer Money, or Transaction history pages as needed.
- You can use simple markdown (e.g. **bold**) when it helps.`;

router.post('/chat', requireAuth, async (req, res) => {
  const { message, history } = req.body;
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  const rawHistory = Array.isArray(history) ? history : [];
  const conversationHistory = rawHistory.slice(-20);

  const HF_SPACE = getSpace();
  const HF_API_KEY = getApiKey();

  if (HF_SPACE) {
    const baseUrl = spaceBaseUrl(HF_SPACE);
    const sessionHash = `kodbank-${req.user?.id ?? 'anon'}-${Date.now().toString(36)}`;
    try {
      const payload = { data: [text], session_hash: sessionHash };
      const data = await callGradioSpace(baseUrl, 'chat', payload, HF_API_KEY || undefined);
      const raw = Array.isArray(data) ? data : (data && data.data) || data;
      let reply = extractReplyFromSpace(raw);
      if (!reply && raw && raw.length) {
        const last = raw[raw.length - 1];
        reply = (typeof last === 'string' && last.trim()) || (last && last.content && String(last.content).trim()) || (last && last.message && String(last.message).trim()) || '';
      }
      res.json({ reply: reply || "I'm not sure how to respond. Try rephrasing." });
    } catch (err) {
      if (err.message && err.message.includes('POST failed: 404')) {
        try {
          const dataPredict = await callGradioSpace(baseUrl, 'predict', { data: [text] }, HF_API_KEY || undefined);
          const reply = extractReplyFromSpace(Array.isArray(dataPredict) ? dataPredict : (dataPredict && dataPredict.data) || dataPredict);
          return res.json({ reply: reply || "I'm not sure how to respond. Try rephrasing." });
        } catch (_) {}
      }
      console.error('AI Space error:', err.message || err);
      res.status(500).json({
        error: 'Could not reach your AI Space. Check HUGGINGFACE_SPACE and that the Space is running.',
      });
    }
    return;
  }

  if (!HF_API_KEY) {
    return res.status(503).json({
      error: 'AI chat is not configured. Add HUGGINGFACE_API_KEY to backend/.env, or set HUGGINGFACE_SPACE=username/space-name (create a Space on Hugging Face → Spaces → deploy chat model → use its API).',
    });
  }

  const HF_MODEL = getModel();
  // Use router API (api-inference.huggingface.co is deprecated). Token needs "Make calls to Inference Providers".
  const routerUrl = 'https://router.huggingface.co/v1/chat/completions';

  try {
    const response = await fetch(routerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HF_API_KEY}`,
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...conversationHistory.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : String(m.content || ''),
          })),
          { role: 'user', content: text },
        ],
        max_tokens: 320,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error || (typeof data === 'string' ? data : null) || data.message || response.statusText;
      if (response.status === 401) {
        return res.status(401).json({
          error: 'Your Hugging Face API key is invalid or missing permission. Create a token at https://huggingface.co/settings/tokens with "Make calls to Inference Providers" enabled, then set HUGGINGFACE_API_KEY in backend/.env and restart the server.',
        });
      }
      if (response.status === 503) {
        const loading = (errMsg && String(errMsg).toLowerCase().includes('loading')) || (data.estimated_time != null);
        return res.status(503).json({
          error: loading ? 'Model is loading. Please try again in 20–30 seconds.' : (errMsg || 'Model unavailable. Try again later.'),
        });
      }
      return res.status(response.status).json({
        error: errMsg || 'AI request failed.',
      });
    }

    const reply = extractReplyFromRouter(data);
    res.json({ reply: reply || "I'm not sure how to respond. Try rephrasing." });
  } catch (err) {
    console.error('AI chat error:', err.message || err);
    res.status(500).json({
      error: 'Could not reach the AI. Check your connection and try again.',
    });
  }
});

module.exports = router;
