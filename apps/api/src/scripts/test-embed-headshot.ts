// test-embed-headshot.ts - Test embed generation with headshot
import { createClient } from '@supabase/supabase-js';
import { buildPickPresentation } from '../services/pickPresentationBuilder';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find a recent LeBron James pick
  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('player_name', 'LeBron James')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (pickError || !pick) {
    console.log('Error finding pick:', pickError?.message);
    return;
  }

  console.log('Found pick:', pick.id);
  console.log('Player:', pick.player_name);
  console.log('Player ID:', pick.player_id);
  console.log('Sport:', pick.sport);
  console.log('Stat Type:', pick.stat_type);
  console.log('');

  // Check player headshot
  if (pick.player_id) {
    const { data: player } = await supabase
      .from('players')
      .select('full_name, headshot_url')
      .eq('id', pick.player_id)
      .single();

    console.log('Player in DB:', player?.full_name);
    console.log('Headshot URL:', player?.headshot_url || 'NONE');
    console.log('');
  }

  // Build presentation
  console.log('Building presentation...');
  try {
    const presentation = await buildPickPresentation(pick);
    console.log('Presentation built successfully!');
    console.log('');
    console.log('=== PRESENTATION OUTPUT ===');
    console.log(JSON.stringify(presentation, null, 2));
    console.log('');
    console.log('=== KEY FIELDS ===');
    console.log('Thumbnail URL:', presentation.thumbnail_url);
    console.log('Title:', presentation.title);
    console.log('Market Label:', presentation.market_label);
    console.log('Context Line:', presentation.context_line);
    console.log('Tier:', presentation.tier);
    console.log('Capper:', presentation.capper_name);
  } catch (err) {
    console.error('Error building presentation:', err);
  }
}

main().catch(console.error);
