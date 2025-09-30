import { requireSupabase } from '../utils/supabaseUtils';

async function main() {
  try {
    // Get high-scoring props that are auto-approved
    const supabaseClient = requireSupabase();
      const { data: propsToPromote, error: selectError } = await supabase
      .from('sports_game_odds')
      .select('*')
      .gte('edge_score', 20)
      .eq('auto_approved', true);

    if (selectError) {
      console.error('Error selecting props:', selectError);
      return;
    }

    if (!propsToPromote?.length) {
      console.log('No props to promote');
      return;
    }

    console.log(`Found ${propsToPromote.length} props to promote`);

    // Convert raw_props to unified_picks format
    const unifiedPicks = propsToPromote.map(prop => ({
      id: prop.id,
      raw_prop_id: prop.id,
      user_id: prop.capper_id || 'system',
      sport: prop.sport,
      status: 'approved',
      prediction: prop.prediction || 'over',
      confidence: prop.confidence || 0.8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert into unified_picks
    const supabaseClient = requireSupabase();
      const { error: insertError } = await supabase
      .from('unified_picks')
      .insert(unifiedPicks);

    if (insertError) {
      console.error('Error inserting picks:', insertError);
      return;
    }

    console.log(`Successfully promoted ${unifiedPicks.length} props to unified_picks`);

    // Update raw_props to mark them as promoted
    for (const prop of propsToPromote) {
      const supabaseClient = requireSupabase();
      const { error: updateError } = await supabase
        .from('sports_game_odds')
        .update({ promoted: true, promoted_at: new Date().toISOString() })
        .eq('id', prop.id);

      if (updateError) {
        console.error(`Error updating raw_prop ${prop.id}:`, updateError);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
