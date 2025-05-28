// /types/alert.ts

/** Where the alert is sent. Extend as needed for SMS, Slack, etc. */
export type AlertChannel =
  | 'discord'
  | 'notion'
  | 'retool'
  | 'email'
  | 'sms'
  | 'slack'

/** All supported alert types (add more as needed). */
export type AlertType =
  | 'line_movement'
  | 'injury'
  | 'steam'
  | 'edge'
  | 'recap'
  | 'incident'
  | 'system'
  | 'hedge'
  | 'middling'
  | 'heat_signal'
  | 'parlay_opportunity'
  | 'clv'
  | 'trap_line'
  | 'sgp'
  | 'book_clipping'
  | 'custom' // fallback for future types

/** Alert metadata for context-aware advice, logging, and targeting. */
export interface AlertMeta {
  posted_to_discord?: boolean
  bet_id?: string
  user_id?: string
  ticket_id?: string
  odds_open?: number
  odds_current?: number
  line_open?: number | string
  line_current?: number | string
  market?: string
  capper?: string
  team?: string
  player?: string
  parlay_legs?: number
  resolved_legs?: number
  advice_id?: string // to tie advice/outcome logs
  [key: string]: any // for any future needs
}

/** The full alert object sent to all integrations and logged for audit. */
export interface AlertPayload {
  id: string
  type: AlertType
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  source: string // e.g. "LineMonitorAgent", "RecapAgent"
  createdAt: Date
  meta?: AlertMeta
  channels: AlertChannel[]
}
