// /utils/validateInput.ts

import type { AgentTaskInput } from '../types/agent'

interface InputCandidate {
  task_id?: unknown;
  agent?: unknown;
  data?: unknown;
}

export function validateInput(input: unknown): input is AgentTaskInput {
  const candidate = input as InputCandidate;
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof candidate.task_id === 'string' &&
    typeof candidate.agent === 'string' &&
    'data' in input
  )
}