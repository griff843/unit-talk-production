// Database schema types based on Unit Talk v3.0.0 schema
// These types match the production database structure after the major transformation

export interface Database {
  public: {
    Tables: {
      // Core SaaS Tables
      users: {
        Row: {
          id: string;
          discord_id: string | null;
          username: string;
          email: string | null;
          tier: 'Free' | 'Premium' | 'VIP' | 'VIP+' | 'Black Label';
          status: 'active' | 'inactive' | 'banned' | 'suspended';
          created_at: string;
          updated_at: string;
          last_active: string | null;
          total_picks: number;
          win_rate: number;
          revenue: number;
        };
        Insert: Omit<
          Database['public']['Tables']['users']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };

      unified_picks: {
        Row: {
          id: string;
          user_id: string;
          prop_id: string | null;
          sport: string;
          pick_type: string;
          prediction: string;
          confidence: number;
          status: 'pending' | 'approved' | 'denied' | 'settled';
          result: 'win' | 'loss' | 'push' | 'pending' | null;
          created_at: string;
          updated_at: string;
          approved_by: string | null;
          approved_at: string | null;
          denied_by: string | null;
          denied_at: string | null;
          denial_reason: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['unified_picks']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['unified_picks']['Insert']>;
      };

      daily_picks: {
        Row: {
          id: string;
          prop_id: string;
          prediction: 'over' | 'under';
          confidence: number;
          status: 'pending' | 'approved' | 'denied';
          result: 'win' | 'loss' | 'push' | 'pending' | null;
          actual_value: number | null;
          created_at: string;
          updated_at: string;
          approved_by: string | null;
          approved_at: string | null;
          denied_by: string | null;
          denied_at: string | null;
          denial_reason: string | null;
          settled_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['daily_picks']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['daily_picks']['Insert']>;
      };

      raw_props: {
        Row: {
          id: string;
          game_id: string | null;
          player_id: string | null;
          player_name: string;
          team: string;
          opponent: string;
          position: string | null;
          prop_type: string;
          line: number;
          over_odds: number;
          under_odds: number;
          game_date: string;
          game_time: string | null;
          created_at: string;
          updated_at: string;
          // Scoring columns
          trend_confidence: number | null;
          edge_score: number | null;
          matchup_quality: number | null;
          expected_value: number | null;
          sharp_money: number | null;
          line_movement: number | null;
          player_form: number | null;
          injury_impact: number | null;
          weather_impact: number | null;
          market_intelligence: number | null;
        };
        Insert: Omit<
          Database['public']['Tables']['raw_props']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['raw_props']['Insert']>;
      };

      games: {
        Row: {
          id: string;
          league: string;
          home_team: string;
          away_team: string;
          game_date: string;
          start_time: string | null;
          status: string | null;
          home_score: number | null;
          away_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['games']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['games']['Insert']>;
      };

      players: {
        Row: {
          id: string;
          name: string;
          team: string | null;
          position: string | null;
          sport: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['players']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['players']['Insert']>;
      };

      agents: {
        Row: {
          id: string;
          name: string;
          type: string;
          status: 'healthy' | 'warning' | 'error' | 'inactive';
          last_run: string;
          success_rate: number;
          avg_response_time: number;
          total_operations: number;
          configuration: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['agents']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['agents']['Insert']>;
      };

      agent_health: {
        Row: {
          id: string;
          agent: string;
          status: 'healthy' | 'degraded' | 'unhealthy';
          details: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['agent_health']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['agent_health']['Insert']>;
      };

      agent_metrics: {
        Row: {
          id: string;
          agent: string;
          agent_name: string | null;
          metrics: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['agent_metrics']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['agent_metrics']['Insert']>;
      };

      agent_logs: {
        Row: {
          id: string;
          agent: string;
          level: 'info' | 'warning' | 'error' | 'debug';
          message: string;
          metadata: Record<string, any> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['agent_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['agent_logs']['Insert']>;
      };

      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource: string;
          resource_id: string | null;
          metadata: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };

      security_events: {
        Row: {
          id: string;
          type: 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity';
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          ip_address: string;
          user_id: string | null;
          metadata: Record<string, any>;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['security_events']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['security_events']['Insert']>;
      };

      contests: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          sport: string | null;
          status: 'active' | 'completed' | 'cancelled';
          prize_pool: number | null;
          entry_fee: number | null;
          max_participants: number | null;
          start_date: string;
          end_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['contests']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['contests']['Insert']>;
      };

      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string | null;
          referral_code: string;
          status: 'pending' | 'completed' | 'expired';
          reward_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['referrals']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['referrals']['Insert']>;
      };
    };
    Views: {
      // Views for backward compatibility
    };
    Functions: {
      // Database functions
    };
    Enums: {
      // Custom enums
    };
  };
}

// Export type helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Convenience types
export type User = Tables<'users'>;
export type Pick = Tables<'unified_picks'>;
export type DailyPick = Tables<'daily_picks'>;
export type RawProp = Tables<'raw_props'>;
export type Game = Tables<'games'>;
export type Player = Tables<'players'>;
export type Agent = Tables<'agents'>;
export type AgentHealth = Tables<'agent_health'>;
export type AgentMetrics = Tables<'agent_metrics'>;
export type AgentLog = Tables<'agent_logs'>;
export type AuditLog = Tables<'audit_logs'>;
export type SecurityEvent = Tables<'security_events'>;
export type Contest = Tables<'contests'>;
export type Referral = Tables<'referrals'>;
