// /types/pick.ts

export type PickTier = 'S+' | 'S' | 'A+' | 'A' | 'B' | 'C'
export type PickStatus = 'pending' | 'won' | 'lost' | 'void' | 'push'
export type TicketType = 'single' | 'parlay' | 'rr' | 'contest'

export interface PickMeta {
  capper: string
  tier: PickTier
  status: PickStatus
  odds: number
  stake: number
  result?: number // Net units, if resolved
  postedAt: string
  settledAt?: string
}

export interface Pick {
  pick_id: string
  player?: string
  team?: string
  statType?: string
  direction?: 'over' | 'under' | 'ml' | 'spread'
  line?: number
  odds: number
  ticketType: TicketType
  meta: PickMeta
}
