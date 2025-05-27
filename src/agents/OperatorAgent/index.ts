import { supabase } from '../../services/supabaseClient'
import { openai } from '../../services/openaiClient'
import { sendDiscordAlert, sendNotionLog, createNotionSOP, createNotionKPI } from '../../services/operatorHelpers'
import { startOfDay, subDays } from 'date-fns'

type AgentTask = {
  type: string,
  agent: string,
  details: string,
  priority: string,
  status?: string,
  created_at?: string,
  retries?: number,
  due_date?: string,
  [key: string]: any
}

type SystemEvent = {
  event_type: string,
  agent: string,
  message: string,
  status: string,
  escalation: boolean,
  action_required: boolean,
  meta: any,
  timestamp?: string
}

export class OperatorAgent {
  // ... (all previous methods: monitorAgents, prioritizeTasks, logEvent, handleIncident, createTask, controlAgent, generateSummary, learnAndEvolve) ...

  // -- Insert all previous methods from the last version here, unchanged --

  /** Conversational command handler for Retool or other interfaces */
  static async handleCommand(command: string, user: string = 'system') {
    let response = ''
    let summary = ''
    command = command.toLowerCase()
    // Recognize some common system commands natively, else fallback to OpenAI
    if (command.includes('status')) {
      // Give agent health, current open tasks, priorities
      const prioritized = await this.monitorAgents()
      response = `System status checked. Open prioritized tasks:\n` +
        prioritized.map(t =>
          `• ${t.agent}: ${t.type} (${t.priority}, urgency: ${t.urgency})`
        ).join('\n')
    } else if (command.startsWith('create sop')) {
      // E.g. "create sop onboarding process"
      const sopTitle = command.replace('create sop', '').trim() || 'New SOP'
      await createNotionSOP({ title: sopTitle, content: 'Draft SOP. Please edit and expand as needed.' })
      response = `SOP "${sopTitle}" created in Notion.`
    } else if (command.startsWith('create kpi')) {
      const kpiTitle = command.replace('create kpi', '').trim() || 'New KPI'
      await createNotionKPI({ title: kpiTitle, content: 'Draft KPI. Please edit and expand as needed.' })
      response = `KPI "${kpiTitle}" created in Notion.`
    } else if (command.startsWith('summary')) {
      summary = await this.generateSummary('daily')
      response = `Summary generated: ${summary.substring(0, 400)}`
    } else if (command.startsWith('learn')) {
      const learn = await this.learnAndEvolve()
      response = `Learning/evolution run complete. Output: ${learn.substring(0, 400)}`
    } else {
      // Fallback: Use OpenAI to interpret/route the command
      const ai = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are the OperatorAgent for a Fortune 100 sports automation system. Answer as a helpful assistant, and call system methods if needed.' },
          { role: 'user', content: command }
        ]
      })
      response = ai.choices[0].message.content?.trim() || ''
    }
    await this.logEvent({
      event_type: 'user_command',
      agent: 'Operator',
      message: `Command from ${user}: ${command} => ${response}`,
      status: 'ok',
      escalation: false,
      action_required: false,
      meta: { command, response }
    })
    return response
  }
}

// (Include the extractSection helper here as before)
function extractSection(text: string, tag: string) {
  const idx = text.indexOf(tag)
  if (idx === -1) return { title: '', content: '' }
  const nextTag = ['SOP:', 'KPI:', 'DOC:'].filter(t => t !== tag).map(t => text.indexOf(t)).filter(i => i > idx).sort((a, b) => a - b)[0]
  const section = text.substring(idx + tag.length, nextTag || undefined).trim()
  const lines = section.split('\n').filter(Boolean)
  const title = lines[0] || ''
  const content = lines.slice(1).join('\n')
  return { title, content }
}
