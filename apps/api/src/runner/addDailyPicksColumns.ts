import { supabase } from '../services/supabaseClient';

async function main() {
  try {
    // Add confidence column
    const { error: confidenceError } = await supabase.rpc('exec', {
      query: 'ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS confidence DECIMAL DEFAULT 0;'
    });

    if (confidenceError) {
      console.error('Error adding confidence column:', confidenceError);
      return;
    }

    // Add grade column
    const { error: gradeError } = await supabase.rpc('exec', {
      query: "ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS grade TEXT CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'F')) DEFAULT 'C';"
    });

    if (gradeError) {
      console.error('Error adding grade column:', gradeError);
      return;
    }

    // Add metadata column
    const { error: metadataError } = await supabase.rpc('exec', {
      query: "ALTER TABLE daily_picks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';"
    });

    if (metadataError) {
      console.error('Error adding metadata column:', metadataError);
      return;
    }

    console.log('Successfully added columns to daily_picks table');

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 