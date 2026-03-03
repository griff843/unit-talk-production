// SPRINT-LLM-PROVIDER-INTEGRATION-008: LLM client for report summarization
// Supports OpenAI and Anthropic via raw fetch. 10-second timeout.
// Does NOT log API keys or prompt bodies.

import { ReportSummarySchema } from './summary-schema.js';

import type { ReportSummary } from './llm-summarizer.js';
import type { RealityReport } from '../adapters/types.js';

export type LLMProvider = 'openai' | 'anthropic';

const LLM_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = `You are an operations analyst. Given a JSON reality report, produce a structured summary.
Return ONLY valid JSON matching this exact schema:
{
  "summary": "string — 2-3 sentence overview",
  "risks": ["string — each identified risk"],
  "suggestedActions": ["string — each recommended action"],
  "priorityItems": ["string — highest priority items to address first"]
}
Be concise. Focus on actionable insights. Do not include markdown or code fences.`;

/**
 * Call an LLM provider to generate a structured summary from a RealityReport.
 * Validates the response against ReportSummarySchema.
 * @throws on timeout, HTTP error, or schema validation failure.
 */
export async function generateSummaryFromLLM(report: RealityReport): Promise<ReportSummary> {
  const provider = getProvider();
  const model = getModel(provider);
  const reportJson = JSON.stringify(report);

  const raw = await callProvider(provider, model, reportJson);
  const parsed = parseJsonResponse(raw);
  const validated = ReportSummarySchema.parse(parsed);

  return validated;
}

/**
 * Resolve the configured LLM provider.
 * @throws if LLM_PROVIDER is not set or invalid.
 */
function getProvider(): LLMProvider {
  const value = process.env.LLM_PROVIDER;
  if (value === 'openai' || value === 'anthropic') {
    return value;
  }
  throw new Error(`LLM_PROVIDER must be "openai" or "anthropic", got: "${value ?? ''}"`);
}

function getModel(provider: LLMProvider): string {
  const envModel = process.env.LLM_MODEL;
  if (envModel) return envModel;
  return provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001';
}

async function callProvider(
  provider: LLMProvider,
  model: string,
  reportJson: string
): Promise<string> {
  if (provider === 'openai') {
    return callOpenAI(model, reportJson);
  }
  return callAnthropic(model, reportJson);
}

// --- OpenAI ---

async function callOpenAI(model: string, reportJson: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: reportJson },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const status = res.status;
      throw new Error(`OpenAI API HTTP ${status}`);
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Anthropic ---

async function callAnthropic(model: string, reportJson: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: reportJson }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const status = res.status;
      throw new Error(`Anthropic API HTTP ${status}`);
    }

    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const textBlock = body.content?.find(b => b.type === 'text');
    if (!textBlock?.text) throw new Error('Anthropic returned empty content');
    return textBlock.text;
  } finally {
    clearTimeout(timeout);
  }
}

// --- JSON Parsing ---

function parseJsonResponse(raw: string): unknown {
  // Strip markdown code fences if the LLM wraps the response
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${cleaned.slice(0, 100)}...`);
  }
}
