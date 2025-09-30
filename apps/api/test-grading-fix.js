// Quick test to validate grading pipeline NaN fix
const { Pool } = require('pg');

async function testGradingFix() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:development_password_2024@localhost:5432/postgres'
  });

  try {
    console.log('🔍 Testing grading pipeline with NaN handling...');
    
    // Get a test prop
    const result = await pool.query(
      'SELECT * FROM raw_props WHERE is_valid = true AND processed_at IS NULL LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No unprocessed props found');
      return;
    }
    
    const prop = result.rows[0];
    console.log('📋 Found test prop:', {
      id: prop.id,
      sport: prop.sport,
      player: prop.player_name,
      line: prop.line
    });
    
    // Simulate the grading calculation with NaN handling
    console.log('🧮 Testing professional scoring calculations...');
    
    // Simulate potential NaN scenarios
    const testScores = [
      67.5,     // Valid score
      NaN,      // NaN from calculation
      Infinity, // Infinity from division by zero
      -Infinity // Negative infinity
    ];
    
    testScores.forEach((score, index) => {
      console.log(`Test ${index + 1}:`, {
        originalScore: score,
        isNaN: isNaN(score),
        safeScore: isNaN(score) || !isFinite(score) ? 0 : score,
        canCallToFixed: !isNaN(score) && isFinite(score)
      });
    });
    
    console.log('✅ NaN handling test completed - ready to implement fix');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testGradingFix();