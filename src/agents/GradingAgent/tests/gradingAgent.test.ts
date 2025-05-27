import { gradeAndPromoteFinalPicks } from '../gradeForFinalPicks';
import { supabase } from '../../../services/supabaseClient';

describe('GradingAgent', () => {
  beforeAll(async () => {
    // Clean up any existing test picks
    await supabase.from('daily_picks').delete().neq('id', '');
    await supabase.from('final_picks').delete().neq('id', '');
  });

  it('should grade and promote eligible single picks', async () => {
    await supabase.from('daily_picks').insert([{
      player_name: 'LeBron James',
      stat_type: 'PTS',
      league: 'NBA',
      line: 29.5,
      odds: -110,
      bet_type: 'player_prop',
      is_valid: true,
      promoted_to_final: false,
    }]);
    await gradeAndPromoteFinalPicks();

    const { data: finals } = await supabase.from('final_picks').select('*');
    expect((finals ?? []).some(fp => fp.player_name === 'LeBron James')).toBe(true);
  });

  it('should grade and promote eligible parlays', async () => {
    await supabase.from('daily_picks').insert([{
      bet_type: 'parlay',
      is_parlay: true,
      is_valid: true,
      promoted_to_final: false,
      legs: [
        {
          player_name: 'LeBron James',
          stat_type: 'PTS',
          league: 'NBA',
          line: 29.5,
          odds: -110,
          bet_type: 'player_prop',
          is_valid: true,
        },
        {
          player_name: 'Jayson Tatum',
          stat_type: 'REB',
          league: 'NBA',
          line: 8.5,
          odds: -110,
          bet_type: 'player_prop',
          is_valid: true,
        }
      ]
    }]);
    await gradeAndPromoteFinalPicks();

    const { data: finals } = await supabase.from('final_picks').select('*');
    expect((finals ?? []).some(fp => fp.bet_type === 'parlay')).toBe(true);
  });
});
