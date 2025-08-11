// Test parlay odds calculation

function calculateParlayOdds(odds: number[]): number {
  console.log('\nCalculating parlay odds for:', odds);

  // Convert American odds to decimal
  const decimalOdds = odds.map(o => {
    let decimal;
    if (o > 0) {
      decimal = o / 100 + 1;
    } else {
      decimal = 100 / Math.abs(o) + 1;
    }
    console.log(`  ${o} → ${decimal.toFixed(4)} decimal`);
    return decimal;
  });

  // Multiply all decimal odds
  const totalDecimal = decimalOdds.reduce((acc, o) => acc * o, 1);
  console.log(`  Total decimal: ${totalDecimal.toFixed(4)}`);

  // Convert back to American odds
  let americanOdds;
  if (totalDecimal >= 2) {
    americanOdds = Math.round((totalDecimal - 1) * 100);
  } else {
    americanOdds = Math.round(-100 / (totalDecimal - 1));
  }

  console.log(`  American odds: ${americanOdds > 0 ? '+' : ''}${americanOdds}`);
  return americanOdds;
}

// Test the examples from the parlays
console.log('PARLAY 1: MLB 3-leg parlay');
console.log('Legs: -120, +180, +150');
const parlay1 = calculateParlayOdds([-120, 180, 150]);
console.log(`Result: ${parlay1 > 0 ? '+' : ''}${parlay1}`);

console.log('\nPARLAY 2: Mixed MLB/NBA 2-leg');
console.log('Legs: +110, -110');
const parlay2 = calculateParlayOdds([110, -110]);
console.log(`Result: ${parlay2 > 0 ? '+' : ''}${parlay2}`);

// Verify with manual calculation
console.log('\n--- MANUAL VERIFICATION ---');
console.log('Parlay 1 (-120, +180, +150):');
console.log('  -120 = 1.8333 decimal');
console.log('  +180 = 2.8000 decimal');
console.log('  +150 = 2.5000 decimal');
console.log('  Total = 1.8333 × 2.8000 × 2.5000 = 12.8333');
console.log('  American = (12.8333 - 1) × 100 = +1183');

console.log('\nParlay 2 (+110, -110):');
console.log('  +110 = 2.1000 decimal');
console.log('  -110 = 1.9091 decimal');
console.log('  Total = 2.1000 × 1.9091 = 4.0091');
console.log('  American = (4.0091 - 1) × 100 = +301');
