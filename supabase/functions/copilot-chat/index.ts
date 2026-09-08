// AP CoPilot — live AI backend.
//
// This is the only place the AI provider's API key exists. It never
// reaches the browser: copilot.js on the site calls this function's
// URL, and this function calls Anthropic's API server-side using a
// Supabase secret. Deploy + secret setup are one-time manual steps
// (see README.md in this folder) — nothing here runs by itself until
// that's done, and the site's static knowledge-base answers keep
// working as a fallback if this call fails or isn't deployed yet.
//
// Cost/abuse guardrail: only a signed-in AP Workspace user (a real
// Supabase auth session) can call this — not the open internet. The
// site's login page is public, but this endpoint requires the same
// session every calculator page already requires.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const SYSTEM_PROMPT =
  'You are AP CoPilot, an auxiliary technical AI assistant built for AP WORKSPACE (app.anjanpatel.ca). ' +
  'Your role is strictly limited to helping users navigate the platform, explaining standard engineering ' +
  'formulas (e.g., ASME PCC-1 target torque, ASME B16.5 flange ratings, tubing pressure derating), and ' +
  'providing quick reference lookups. YOU ARE NOT A CERTIFIED PROFESSIONAL ENGINEER (P.E. / P.Eng.). Never ' +
  'issue stamped engineering advice, final torque sign-offs, or safety overrides. Always instruct users to ' +
  'independently verify all calculations with a licensed Professional Engineer prior to field execution. ' +
  'Keep answers short and practical — this renders in a narrow chat drawer, not a document.';

const ALLOWED_ORIGIN = 'https://app.anjanpatel.ca';
const MAX_MESSAGE_LEN = 500;
const MAX_HISTORY_TURNS = 6;
const MODEL = 'claude-haiku-4-5-20251001';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders();

  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // Require a real signed-in session — bounds who can spend the API budget.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), { status: 401, headers });
  }

  let body: { message?: string; history?: { role?: string; content?: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers });
  }

  const message = (body.message || '').trim().slice(0, MAX_MESSAGE_LEN);
  if (!message) {
    return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400, headers });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role as string, content: (m.content as string).slice(0, MAX_MESSAGE_LEN) }))
    : [];

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 503, headers });
  }

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [...history, { role: 'user', content: message }]
      })
    });
  } catch (e) {
    console.error('Anthropic fetch failed', e);
    return new Response(JSON.stringify({ error: 'AI request failed' }), { status: 502, headers });
  }

  if (!anthropicRes.ok) {
    console.error('Anthropic API error', anthropicRes.status, await anthropicRes.text().catch(() => ''));
    return new Response(JSON.stringify({ error: 'AI request failed' }), { status: 502, headers });
  }

  const data = await anthropicRes.json();
  const reply = (data.content || [])
    .map((block: { text?: string }) => block.text || '')
    .join('')
    .trim() || 'No response generated.';

  return new Response(JSON.stringify({ reply }), {
    headers: { ...headers, 'content-type': 'application/json' }
  });
});
