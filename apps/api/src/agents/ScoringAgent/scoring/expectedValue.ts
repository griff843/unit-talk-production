interface BettingSideAnalysis {
  side: 'over' | 'under';
  odds: number;
  expectedValue: number;
  impliedProbability: number;
  projectedProbability: number;
  edge: number;
}

export function calculateExpectedValue(prop: any): number {
  // CRITICAL FIX: Analyze both OVER and UNDER sides
  const analysis = analyzeBothSides(prop);

  if (!analysis) {
    return 0; // No positive EV found on either side
  }

  // Store the recommended side and analysis in the prop for later use
  prop.recommended_side = analysis.side;
  prop.recommended_odds = analysis.odds;
  prop.projected_probability = analysis.projectedProbability;
  prop.implied_probability = analysis.impliedProbability;
  prop.edge = analysis.edge;

  return Math.round(analysis.expectedValue * 100); // Return as percentage
}

export function analyzeBothSides(prop: any): BettingSideAnalysis | null {
  const overOdds = prop.over_odds;
  const underOdds = prop.under_odds;

  // Must have both sides to analyze
  if (!overOdds || !underOdds) {
    return null;
  }

  // Calculate implied probabilities
  const overImplied = oddsToImpliedProbability(overOdds);
  const underImplied = oddsToImpliedProbability(underOdds);

  // Deviggest the odds by removing the vig
  const totalImplied = overImplied + underImplied;
  const vigAmount = totalImplied - 1.0;

  const overTrueProb = overImplied / totalImplied;
  const underTrueProb = underImplied / totalImplied;

  // Get projected probability from our model (placeholder for now)
  // TODO: Replace with actual ML model prediction
  const projectedOverProb = prop.projected_over_prob ?? estimateProjectedProbability(prop, 'over');
  const projectedUnderProb = 1 - projectedOverProb;

  // Calculate expected value for both sides
  const overEV = calculateSideEV(projectedOverProb, overOdds);
  const underEV = calculateSideEV(projectedUnderProb, underOdds);

  // Calculate edges
  const overEdge = projectedOverProb - overTrueProb;
  const underEdge = projectedUnderProb - underTrueProb;

  // Choose the side with the highest positive EV
  if (overEV > 0 && overEV >= underEV) {
    return {
      side: 'over',
      odds: overOdds,
      expectedValue: overEV,
      impliedProbability: overTrueProb,
      projectedProbability: projectedOverProb,
      edge: overEdge
    };
  } else if (underEV > 0) {
    return {
      side: 'under',
      odds: underOdds,
      expectedValue: underEV,
      impliedProbability: underTrueProb,
      projectedProbability: projectedUnderProb,
      edge: underEdge
    };
  }

  // No positive EV found on either side
  return null;
}

function oddsToImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

function calculateSideEV(winProb: number, odds: number): number {
  const payout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
  return (winProb * payout) - (1 - winProb);
}

function estimateProjectedProbability(prop: any, side: 'over' | 'under'): number {
  // Placeholder: This should be replaced with actual ML model predictions
  // For now, use a simple heuristic based on the line and historical performance

  // Base probability around 50%
  let projectedProb = 0.5;

  // Adjust based on professional features if available
  if (prop.steam_detected) {
    projectedProb += side === 'over' ? 0.05 : -0.05;
  }

  if (prop.sharp_money) {
    projectedProb += side === 'over' ? 0.03 : -0.03;
  }

  if (prop.closing_line_value > 0) {
    projectedProb += side === 'over' ? 0.02 : -0.02;
  }

  // Ensure probability stays within valid bounds
  return Math.max(0.1, Math.min(0.9, projectedProb));
}
