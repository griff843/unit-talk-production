// src/types/rawProp.ts

export interface RawProp {
  id: string; // uuid
  external_id?: string;
  player_name: string;
  team?: string;
  opponent?: string;
  stat_type: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  market?: string;
  provider?: string;
  game_time?: string;
  scraped_at?: string;
  promoted?: boolean;
  is_valid?: boolean;
  [key: string]: any; // For flexibility (extra fields as needed)
}
