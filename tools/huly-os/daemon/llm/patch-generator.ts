// SPRINT-AUTO-PR-GENERATION-009: LLM-powered patch generator
// Generates file patches from TaskCandidates via LLM.
// Returns null when LLM is not configured — deterministic mode has no patches.

import { z } from 'zod';

import type { TaskCandidate } from './task-generator.js';
import type { PatchFile } from '../adapters/github-pr.js';

export type LLMPatchProvider = 'openai' | 'anthropic';

const LLM_TIMEOUT_MS = 30_000; // patches need more time than summaries

const PATCH_SYSTEM_PROMPT = `You are a code automation assistant. Given a task description, generate minimal file patches.
Return ONLY valid JSON matching this exact schema:
{
  "files": [
    {
      "path": "string — repo-relative path with forward slashes",
      "content": "string — complete file content after changes"
    }
  ],
  "explanation": "string — 1-2 sentence summary of what the patch does"
}
Rules:
- Only modify files within the allowed paths provided.
- Generate the minimum changes necessary.
- If the task cannot be addressed with file changes, return {"files": [], "explanation": "..."}.
- Do not include markdown or code fences in your response.`;

/** Zod schema for validating LLM-generated patches */
export const PatchResponseSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1, 'path must be non-empty'),
      content: z.string(), // empty content is valid (new empty file)
    })
  ),
  explanation: z.string().min(1, 'explanation must be non-empty'),
});

export type PatchResponse = z.infer<typeof PatchResponseSchema>;

export interface PatchGenerationResult {
  candidate: TaskCandidate;
  files: PatchFile[];
  explanation: string;
  provider: LLMPatchProvider;
}

/**
 * Generate patches for a task candidate via LLM.
 * Returns null if LLM_PROVIDER is not set (opt-in only).
 * @throws on LLM timeout, HTTP error, or schema validation failure.
 */
export async function generatePatch(
  candidate: TaskCandidate,
  allowedPaths: string[]
): Promise<PatchGenerationResult | null> {
  const provider = getLLMProvider();
  if (!provider) return null;

  const model = getLLMModel(provider);

  const userPrompt = buildPatchPrompt(candidate, allowedPaths);
  const raw = await callLLM(provider, model, userPrompt);
  const parsed = parseJsonResponse(raw);
  const validated = PatchResponseSchema.parse(parsed);

  return {
    candidate,
    files: validated.files,
    explanation: validated.explanation,
    provider,
  };
}

function getLLMProvider(): LLMPatchProvider | null {
  const value = process.env.LLM_PROVIDER;
  if (value === 'openai' || value === 'anthropic') return value;
  return null;
}

function getLLMModel(provider: LLMPatchProvider): string {
  const envModel = process.env.LLM_MODEL;
  if (envModel) return envModel;
  return provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001';
}

function buildPatchPrompt(candidate: TaskCandidate, allowedPaths: string[]): string {
  return [
    `Task: ${candidate.title}`,
    `Description: ${candidate.body}`,
    `Source: ${candidate.source}`,
    `Allowed paths: ${allowedPaths.join(', ')}`,
    '',
    'Generate the minimal file patches to address this task.',
  ].join('\n');
}

// --- LLM Call (mirrors llm-client.ts pattern) ---

async function callLLM(
  provider: LLMPatchProvider,
  model: string,
  userContent: string
): Promise<string> {
  if (provider === 'openai') return callOpenAI(model, userContent);
  return callAnthropic(model, userContent);
}

async function callOpenAI(model: string, userContent: string): Promise<string> {
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
          { role: 'system', content: PATCH_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`OpenAI API HTTP ${res.status}`);

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(model: string, userContent: string): Promise<string> {
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
        max_tokens: 4096,
        system: PATCH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Anthropic API HTTP ${res.status}`);

    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const textBlock = body.content?.find(b => b.type === 'text');
    if (!textBlock?.text) throw new Error('Anthropic returned empty content');
    return textBlock.text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonResponse(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned invalid JSON for patch: ${cleaned.slice(0, 100)}...`);
  }
}
