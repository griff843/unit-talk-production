import { requireSupabase } from '../utils/supabaseUtils';

async function main() {
  try {
    // Add confidence column
    const supabaseClient = requireSupabase();
      const { error } = await supabaseClient.rpc('exec', {
      query: 'ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS confidence DECIMAL DEFAULT 0;'
    });

    if (error) {
      console.error('Error adding confidence column:', error);
      return;
    }

    console.log('Successfully added confidence column to daily_picks table');

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 