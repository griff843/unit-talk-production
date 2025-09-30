import { requireSupabase } from '../utils/supabaseUtils';

async function main() {
  try {
    // Get high-scoring picks that haven't been finalized
    const supabaseClient = requireSupabase();
      const { data: picks, error } = await supabase
      .from('unified_picks')
      .select('*')
      .in('tier', ['S', 'A'])
      .eq('status', 'approved')
      .eq('finalized', false)
      .limit(100);

    if (error) {
      console.error('Error fetching picks:', error);
      return;
    }

    if (!picks || picks.length === 0) {
      console.log('No picks to promote');
      return;
    }

    console.log(`Found ${picks.length} picks to promote`);

    for (const pick of picks) {
      try {
        // Update unified_picks to mark as finalized
        const supabaseClient = requireSupabase();
      const { error: updateError } = await supabase
          .from('unified_picks')
          .update({
            finalized: true,
            status: 'finalized',
            finalized_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', pick.id);

        if (updateError) {
          console.error(`Failed to update pick ${pick.id} in unified_picks:`, updateError);
          continue;
        }

        console.log(`Successfully promoted pick ${pick.id} with tier ${pick.tier}`);

      } catch (error) {
        console.error(`Failed to promote pick ${pick.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 