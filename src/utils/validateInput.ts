// /utils/validateInput.ts

import type { AgentTaskInput } from '../types/agent'

export function validateInput(input: unknown): input is AgentTaskInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as Record<string, unknown>).task_id === 'string' &&
    typeof (input as Record<string, unknown>).agent === 'string' &&
    'data' in input
  )
}