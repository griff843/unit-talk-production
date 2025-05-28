// /types/shared.ts

export interface SystemEvent {
    event_id: string
    agent: string
    timestamp: string
    type: string
    payload: any
  }
  
  export interface TaskLog {
    task_id: string
    agent: string
    status: string
    message: string
    timestamp: string
  }
  
  export type HealthLevel = 'ok' | 'warn' | 'error'
  