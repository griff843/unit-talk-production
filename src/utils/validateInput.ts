// /utils/validateInput.ts

import type { AgentTaskInput } from '../types/agent'

export function validateInput(input: any): input is AgentTaskInput {
  return (
    typeof input === 'object' &&
    typeof input.task_id === 'string' &&
    typeof input.agent === 'string' &&
    'data' in input
  )
}
