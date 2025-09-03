// src/types/rawProp.ts

export interface RawProp {
  id: string; // uuid - required
  external_id?: string;
  player_name: string | null;
  team?: string | null;
  opponent?: string | null;
  stat_type: string | null;
  line: number;
  over_odds?: number;
  under_odds?: number;
  market?: string;
  provider?: string | null;
  source?: string | null;
  sport?: string | null;
  created_at?: string | Date | null;
  game_time?: string;
  scraped_at?: string;
  promoted?: boolean;
  is_valid?: boolean;
  // Optimal-specific fields
  label?: string;
  abbr?: string;
  bookmaker?: string;
  league?: string;
  outcomes?: any;
  [key: string]: unknown; // For flexibility (extra fields as needed)
}