export interface CapperProfile {
  id: string;
  name: string;
  discord_id: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface CapperStats {
  total_picks: number;
  win_rate: number;
  roi: number;
  streak: number;
}