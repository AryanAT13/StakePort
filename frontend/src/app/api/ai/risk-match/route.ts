import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serverEnv } from '@/lib/env.server';
import { normalizeAddress } from '@/lib/assetMetadata';

/**
 * Risk-match: an LLM judges whether a given asset fits the user's stated
 * risk appetite (conservative / moderate / aggressive — set during
 * onboarding). The asset detail page surfaces this as a discreet badge
 * next to the trade panel.
 *
 * We call Gemini's REST API directly here (instead of routing through the
 * Python ai-engine like the other AI endpoints) for two reasons:
 *   1. It's a single text-only call. Nothing else to compose with.
 *   2. Avoids forcing the user to touch ai-engine/main.py just to ship
 *      this feature. The endpoint reuses the same API key the Python
 *      service uses.
 *
 * The prompt is constrained to JSON output and capped at a one-sentence
 * reason so the response is predictable and the badge stays compact.
 */

const RISK_GUIDANCE: Record<string, string> = {
  conservative:
    'prefers capital preservation, low volatility, established and verifiable assets',
  moderate:
    'comfortable with mid-tier volatility, prefers a balanced mix of stable and speculative assets',
  aggressive:
    'high volatility tolerance, prefers speculative or rapidly-appreciating bets, comfortable with downside risk',
};

type ReqBody = { address?: string; riskProfile?: string };
type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ReqBody | null;
  if (!body?.address || !body?.riskProfile) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!['conservative', 'moderate', 'aggressive'].includes(body.riskProfile)) {
    return NextResponse.json({ error: 'Invalid riskProfile' }, { status: 400 });
  }

  const address = normalizeAddress(body.address);
  if (!address) return NextResponse.json({ error: 'Invalid address' }, { status: 400 });

  const meta = await prisma.assetMetadata.findUnique({
    where: { contractAddress: address.toLowerCase() },
  });

  // We need at least the prospectus before we can judge fit. The asset
  // detail page calls /api/ai/prospectus first, so by the time the risk
  // badge fires, this should be populated. 425 = "Too Early".
  if (!meta?.prospectus) {
    return NextResponse.json({ error: 'Awaiting prospectus' }, { status: 425 });
  }

  const profile = body.riskProfile as keyof typeof RISK_GUIDANCE;
  const guidance = RISK_GUIDANCE[profile];

  const prompt = `A trader with a ${profile.toUpperCase()} appetite (${guidance}) is considering this listed asset.

ASSET: ${meta.name}
${meta.symbol ? `TICKER: ${meta.symbol}\n` : ''}CATEGORY: ${meta.fairValueCategory ?? 'unknown'}
${meta.fairValue ? `ORACLE FAIR VALUE: $${Math.round(meta.fairValue).toLocaleString()}\n` : ''}
PROSPECTUS:
${meta.prospectus.slice(0, 1600)}

Return ONLY a JSON object (no markdown, no commentary) with exactly two keys:
- "match": one of "good" | "caution" | "mismatch"
- "reason": one sentence under 22 words explaining the assessment from the trader's perspective.

Use "good" when the asset cleanly fits the appetite, "caution" when the asset is adjacent but has notable friction, and "mismatch" when the asset is clearly outside the appetite.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${serverEnv.geminiApiKey}`;
    const aiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('[risk-match] gemini', aiRes.status, detail.slice(0, 200));
      return NextResponse.json({ error: 'Gemini call failed' }, { status: 502 });
    }

    const data = (await aiRes.json()) as GeminiResponse;
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    // Strip markdown fences if the model added them despite the constraint.
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    }

    let parsed: { match?: string; reason?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('[risk-match] non-JSON response:', text.slice(0, 200));
      return NextResponse.json({ error: 'Malformed response' }, { status: 502 });
    }

    const match = ['good', 'caution', 'mismatch'].includes(parsed.match ?? '')
      ? (parsed.match as 'good' | 'caution' | 'mismatch')
      : 'caution';
    const reason = (parsed.reason ?? '').slice(0, 240);

    return NextResponse.json({ match, reason, profile });
  } catch (e) {
    console.error('[risk-match]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
