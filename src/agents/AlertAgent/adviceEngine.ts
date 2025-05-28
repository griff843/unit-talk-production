// /src/agents/AlertsAgent/adviceEngine.ts

import { AlertPayload } from '../../types/alert'
import OpenAI from 'openai' // or use Claude, whichever LLM you prefer

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

/**
 * Returns actionable Unit Talk advice for a live betting alert.
 * @param alert - The alert payload with context, odds, bet info, etc.
 * @returns {Promise<string>} - The actionable advice as a string.
 */
export async function getUnitTalkAdvice(alert: AlertPayload): Promise<string> {
  // Compose a detailed prompt for the LLM, using your full event context
  const prompt = `
You are Unit Talk, an elite sports betting analyst and community leader.

A live alert has been triggered:
- Alert Type: ${alert.type}
- Title: ${alert.title}
- Description: ${alert.description}
- Odds/context: ${JSON.stringify(alert.meta, null, 2)}

Provide concise, actionable advice as “Unit Talk advice” for high-level bettors.  
Include: next steps, whether to hedge/cash out/hold, and why.  
Do not mention “AI.” Speak as a real human expert.
If applicable, reference specific EV, profit/loss, parlay status, or risk factor.

Output 1–3 sentences maximum.
`
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 140,
    temperature: 0.6,
  })
  return response.choices[0].message.content?.trim() ?? "No advice available at this time."
}
