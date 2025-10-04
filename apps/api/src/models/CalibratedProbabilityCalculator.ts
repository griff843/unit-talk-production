/**
 * Calibrated Probability Calculator
 *
 * Applies empirical calibration corrections based on backtest results
 * to reduce calibration error from 10.31% to <3%
 */

import { ProbabilityCalculator, ProbabilityInput, ProbabilityOutput } from './ProbabilityCalculator';

export class CalibratedProbabilityCalculator {
  private baseCalculator: ProbabilityCalculator;

  // Calibration corrections from backtest (232 NFL outcomes)
  private calibrationCurve = {
    // Overconfident adjustments: Reduce probabilities that are too high
    defensive: 0.68, // Defense stats: 50% predicted → 34% actual (multiply by 0.68)
    receptions: 0.71, // Receptions: 50% predicted → 35% actual (multiply by 0.71)
    passing: 0.80, // Passing: 47% predicted → 38% actual (multiply by 0.80)
    receiving: 0.90, // Receiving: 44% predicted → 40% actual (multiply by 0.90)
    rushing: 1.04, // Rushing: 48% predicted → 50% actual (multiply by 1.04 - slightly underconfident!)
  };

  constructor() {
    this.baseCalculator = new ProbabilityCalculator();
  }

  async calculateProbability(input: ProbabilityInput): Promise<ProbabilityOutput | null> {
    // Get base probability from historical data
    const baseResult = await this.baseCalculator.calculateProbability(input);

    if (!baseResult) {
      return null;
    }

    // Apply calibration correction based on market type
    let calibrationFactor = 1.0;

    const marketType = input.marketType.toLowerCase();

    if (marketType.includes('defense') || marketType.includes('sack') || marketType.includes('tackle')) {
      calibrationFactor = this.calibrationCurve.defensive;
    } else if (marketType.includes('reception')) {
      calibrationFactor = this.calibrationCurve.receptions;
    } else if (marketType.includes('pass')) {
      calibrationFactor = this.calibrationCurve.passing;
    } else if (marketType.includes('receiv')) {
      calibrationFactor = this.calibrationCurve.receiving;
    } else if (marketType.includes('rush')) {
      calibrationFactor = this.calibrationCurve.rushing;
    }

    // Apply calibration
    const calibratedProb = Math.max(0.01, Math.min(0.99, baseResult.probability * calibrationFactor));

    return {
      probability: calibratedProb,
      method: baseResult.method + '_calibrated',
      dataPoints: baseResult.dataPoints,
      confidence: baseResult.confidence,
      metadata: {
        ...baseResult.metadata,
        baseProbability: baseResult.probability,
        calibrationFactor: calibrationFactor,
        calibrationType: this.getCalibrationType(marketType),
      },
    };
  }

  private getCalibrationType(marketType: string): string {
    if (marketType.includes('defense') || marketType.includes('sack') || marketType.includes('tackle')) {
      return 'defensive';
    } else if (marketType.includes('reception')) {
      return 'receptions';
    } else if (marketType.includes('pass')) {
      return 'passing';
    } else if (marketType.includes('receiv')) {
      return 'receiving';
    } else if (marketType.includes('rush')) {
      return 'rushing';
    }
    return 'none';
  }

  /**
   * Update calibration curve with new backtest results
   */
  async updateCalibration(backtestResults: {
    market: string;
    predicted: number;
    actual: number;
  }[]) {
    // Group by market type
    const marketGroups: Record<string, { predicted: number[]; actual: number[] }> = {};

    for (const result of backtestResults) {
      const market = result.market.toLowerCase();
      let group = 'other';

      if (market.includes('defense') || market.includes('sack') || market.includes('tackle')) {
        group = 'defensive';
      } else if (market.includes('reception')) {
        group = 'receptions';
      } else if (market.includes('pass')) {
        group = 'passing';
      } else if (market.includes('receiv')) {
        group = 'receiving';
      } else if (market.includes('rush')) {
        group = 'rushing';
      }

      if (!marketGroups[group]) {
        marketGroups[group] = { predicted: [], actual: [] };
      }

      marketGroups[group].predicted.push(result.predicted);
      marketGroups[group].actual.push(result.actual);
    }

    // Calculate calibration factors
    for (const [group, data] of Object.entries(marketGroups)) {
      const avgPredicted = data.predicted.reduce((a, b) => a + b, 0) / data.predicted.length;
      const avgActual = data.actual.reduce((a, b) => a + b, 0) / data.actual.length;

      const calibrationFactor = avgActual / avgPredicted;

      // Update curve
      if (group === 'defensive') this.calibrationCurve.defensive = calibrationFactor;
      else if (group === 'receptions') this.calibrationCurve.receptions = calibrationFactor;
      else if (group === 'passing') this.calibrationCurve.passing = calibrationFactor;
      else if (group === 'receiving') this.calibrationCurve.receiving = calibrationFactor;
      else if (group === 'rushing') this.calibrationCurve.rushing = calibrationFactor;
    }

    console.log('✅ Calibration curve updated:', this.calibrationCurve);
  }
}
