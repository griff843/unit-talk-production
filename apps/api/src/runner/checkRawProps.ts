import { requireSupabase } from '../utils/supabaseUtils';

async function main() {
  // Get props with edge scores
  const supabaseClient = requireSupabase();
      const { data: props, error } = await supabase
    .from('sports_game_odds')
    .select('*')
    .order('edge_score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching props:', error);
    return;
  }

  if (!props?.length) {
    console.log('No props found.');
    return;
  }

  console.log(`Found ${props.length} props. Top props by edge score:`);
  props.forEach((prop, i) => {
    console.log(`\n${i + 1}. ${prop.player_name} - ${prop.stat_type}`);
    console.log(`   Edge Score: ${prop.edge_score}`);
    console.log(`   Tier: ${prop.tier}`);
    console.log(`   Auto Approved: ${prop.auto_approved}`);
    console.log(`   Line: ${prop.line}`);
    console.log(`   Sport: ${prop.sport}`);
    console.log(`   Game: ${prop.matchup}`);
  });
}

main().catch(console.error); 