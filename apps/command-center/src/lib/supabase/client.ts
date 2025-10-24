import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Type-safe database helpers
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      picks: {
        Row: {
          id: string;
          created_at: string;
          capper_id: string;
          sport: string;
          market_type: string;
          tier: string;
          ev_score: number;
          confidence: number;
          odds: number;
          outcome: string | null;
          roi: number | null;
          status: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          capper_id: string;
          sport: string;
          market_type: string;
          tier: string;
          ev_score: number;
          confidence: number;
          odds: number;
          outcome?: string | null;
          roi?: number | null;
          status?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          capper_id?: string;
          sport?: string;
          market_type?: string;
          tier?: string;
          ev_score?: number;
          confidence?: number;
          odds?: number;
          outcome?: string | null;
          roi?: number | null;
          status?: string;
        };
      };
      players: {
        Row: {
          id: string;
          name: string;
          team: string;
          position: string;
          league: string;
          player_id: string;
        };
      };
      raw_props: {
        Row: {
          id: string;
          created_at: string;
          sport: string;
          league: string;
          game_id: string;
          player_name: string;
          market_type: string;
          line: number;
          odds: number;
          book: string;
          ev_score: number | null;
          tier_tag: string | null;
          confidence: number | null;
        };
      };
      agent_logs: {
        Row: {
          id: string;
          created_at: string;
          agent_name: string;
          level: string;
          message: string;
          correlation_id: string | null;
          metadata: Json | null;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          created_at: string;
          discord_id: string;
          username: string;
          tier: string;
          status: string;
          roi: number | null;
        };
      };
    };
  };
}
