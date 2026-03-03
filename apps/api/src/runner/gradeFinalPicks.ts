import { supabase } from '../services/supabaseClient';

async function main() {
  try {
    // Get ungraded picks from unified_picks
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('result', 'pending')
      .eq('status', 'approved')
      .limit(100);

    if (error) {
      console.error('Error fetching picks:', error);
      return;
    }

    if (!picks || picks.length === 0) {
      console.log('No picks to grade');
      return;
    }

    console.log(`Found ${picks.length} picks to grade`);

    for (const pick of picks) {
      try {
        // Get the raw prop data for grading context
        const { data: rawProp, error: rawPropError } = await supabase
          .from('raw_props')
          .select('*')
          .eq('id', pick.raw_prop_id)
          .single();

        if (rawPropError) {
          console.error(`Failed to fetch raw prop ${pick.raw_prop_id}:`, rawPropError);
          continue;
        }

        if (!rawProp) {
          console.error(`Raw prop ${pick.raw_prop_id} not found`);
          continue;
        }

        // For now, just randomly assign a result
        const result = Math.random() > 0.5 ? 'win' : 'loss';

        // Update the pick with the result
        const { error: updateError } = await supabase
          .from('unified_picks')
          .update({
            result,
            status: 'settled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pick.id);

        if (updateError) {
          console.error(`Failed to update pick ${pick.id}:`, updateError);
          continue;
        }

        console.log(`Successfully grading_status pick ${pick.id} with result ${result}`);
      } catch (error) {
        console.error(`Failed to grade pick ${pick.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
