import { AlertPayload } from '../../../types/alert'

export async function sendNotionAlert(_alert: AlertPayload, _advice: string) {
  // Use Notion API or n8n to push alert as a new page/entry
  // Log the advice in a Unit Talk Advice field
  // Example code will depend on your integration, but core logic:
  // - Add row to Notion DB with all alert fields + advice
  return { status: 'sent' }
}
