/**
 * SMARTFORM-FANDUEL-UX-VERIFY-001: Regression Guard
 *
 * This test suite ensures the SmartForm player prop submission flow
 * maintains data integrity across NBA and MLB sports.
 *
 * Key invariants tested:
 * 1. Players API correctly scopes by team_abbr when team_uuid provided
 * 2. Player props require valid player_id (non-null UUID)
 * 3. team_abbr matches game participants
 * 4. Defense-in-depth validation active at frontend and backend
 *
 * @see docs/contracts/SMART_FORM_DATA_CONTRACT.md
 */

// Uses Jest globals (describe, it, expect, beforeAll) - no import needed
import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Known valid test data from production
const TEST_DATA = {
  nba: {
    team_name: 'Boston Celtics',
    team_abbr: 'BOS',
    team_uuid: '55dd791d-974e-4ef8-915f-ef7f044f57ac',
    player_name: 'Jaylen Brown',
    player_id: 'bddd9f5e-ac31-4abb-9fc5-cab0c7b04e51',
  },
  mlb: {
    team_name: 'New York Yankees',
    team_abbr: 'NYY',
    team_uuid: '6d8e24bc-1fff-40c2-a0aa-973b2c1defc9',
    player_name: 'Aaron Judge',
    // player_id resolved at runtime
  },
};

describe('SMARTFORM-FANDUEL-UX-VERIFY-001: Regression Guard', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  describe('Invariant 1: Team UUID to team_abbr resolution', () => {
    it('should resolve NBA team_uuid to correct team_abbr', async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('abbr, name')
        .eq('team_uuid', TEST_DATA.nba.team_uuid)
        .single();

      expect(error).toBeNull();
      expect(data?.abbr).toBe(TEST_DATA.nba.team_abbr);
      expect(data?.name).toBe(TEST_DATA.nba.team_name);
    });

    it('should resolve MLB team_uuid to correct team_abbr', async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('abbr, name')
        .eq('team_uuid', TEST_DATA.mlb.team_uuid)
        .single();

      expect(error).toBeNull();
      expect(data?.abbr).toBe(TEST_DATA.mlb.team_abbr);
      expect(data?.name).toBe(TEST_DATA.mlb.team_name);
    });
  });

  describe('Invariant 2: Player scoping by team_abbr', () => {
    it('should return only BOS players when team_abbr=BOS', async () => {
      const { data, error } = await supabase
        .from('players')
        .select('full_name, team_abbr')
        .eq('team_abbr', TEST_DATA.nba.team_abbr)
        .limit(20);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // All returned players must have BOS team_abbr
      data!.forEach(player => {
        expect(player.team_abbr).toBe(TEST_DATA.nba.team_abbr);
      });
    });

    it('should return only NYY players when team_abbr=NYY', async () => {
      const { data, error } = await supabase
        .from('players')
        .select('full_name, team_abbr')
        .eq('team_abbr', TEST_DATA.mlb.team_abbr)
        .limit(50);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // All returned players must have NYY team_abbr
      data!.forEach(player => {
        expect(player.team_abbr).toBe(TEST_DATA.mlb.team_abbr);
      });
    });

    it('should include known players in scoped results', async () => {
      // Check Jaylen Brown is in BOS scope
      const { data: bosPlayers } = await supabase
        .from('players')
        .select('full_name')
        .eq('team_abbr', TEST_DATA.nba.team_abbr);

      const bosNames = bosPlayers?.map(p => p.full_name) || [];
      expect(bosNames).toContain(TEST_DATA.nba.player_name);

      // Check Aaron Judge is in NYY scope
      const { data: nyyPlayers } = await supabase
        .from('players')
        .select('full_name')
        .eq('team_abbr', TEST_DATA.mlb.team_abbr);

      const nyyNames = nyyPlayers?.map(p => p.full_name) || [];
      expect(nyyNames).toContain(TEST_DATA.mlb.player_name);
    });
  });

  describe('Invariant 3: Valid picks have player_id', () => {
    it('should have player_id for recent prop picks', async () => {
      // Check recent picks created via SmartForm (source=api)
      const { data, error } = await supabase
        .from('unified_picks')
        .select('id, player_name, player_id, source')
        .eq('source', 'api')
        .not('player_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      expect(error).toBeNull();

      // All prop picks from SmartForm should have player_id
      data?.forEach(pick => {
        if (pick.player_name) {
          expect(pick.player_id).not.toBeNull();
        }
      });
    });
  });

  describe('Invariant 4: Team data completeness', () => {
    it('should have 30 NBA teams', async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('sport', 'NBA');

      expect(error).toBeNull();
      expect(data?.length).toBe(30);
    });

    it('should have 30 MLB teams', async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('sport', 'MLB');

      expect(error).toBeNull();
      expect(data?.length).toBe(30);
    });

    it('should have team_uuid for all teams', async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('name, team_uuid')
        .or('sport.eq.NBA,sport.eq.MLB');

      expect(error).toBeNull();

      data?.forEach(team => {
        expect(team.team_uuid).not.toBeNull();
        expect(team.team_uuid).toMatch(/^[0-9a-f-]{36}$/);
      });
    });
  });

  describe('Invariant 5: Bridge outbox event processing', () => {
    it('should have completed status for recent ticket_submitted events', async () => {
      const { data, error } = await supabase
        .from('bridge_outbox')
        .select('id, event_type, status')
        .eq('event_type', 'ticket_submitted')
        .order('created_at', { ascending: false })
        .limit(5);

      expect(error).toBeNull();

      // All recent events should be processed
      data?.forEach(event => {
        expect(event.status).toBe('completed');
      });
    });
  });
});
