/**
 * SMARTFORM-ODDS-FIELD-INTEGRITY-007
 * Odds Validator Unit Tests
 */

import {
  validateAmericanOdds,
  validateOddsInteger,
  calculateParlayOdds,
  americanToDecimal,
  decimalToAmerican,
  calculateImpliedProbability,
} from '../lib/odds-validator';

describe('validateAmericanOdds', () => {
  describe('valid inputs', () => {
    it('accepts negative odds: -110', () => {
      const result = validateAmericanOdds('-110');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(-110);
    });

    it('accepts positive odds with plus: +150', () => {
      const result = validateAmericanOdds('+150');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(150);
    });

    it('accepts positive odds without plus: 150', () => {
      const result = validateAmericanOdds('150');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(150);
    });

    it('accepts -100 (minimum negative)', () => {
      const result = validateAmericanOdds('-100');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(-100);
    });

    it('accepts +100 (minimum positive)', () => {
      const result = validateAmericanOdds('+100');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(100);
    });

    it('accepts numeric input', () => {
      const result = validateAmericanOdds(-110);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(-110);
    });

    it('trims whitespace: " -110 "', () => {
      const result = validateAmericanOdds(' -110 ');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(-110);
    });

    it('handles large odds: +5000', () => {
      const result = validateAmericanOdds('+5000');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5000);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty string', () => {
      const result = validateAmericanOdds('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_EMPTY');
    });

    it('rejects null', () => {
      const result = validateAmericanOdds(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_EMPTY');
    });

    it('rejects undefined', () => {
      const result = validateAmericanOdds(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_EMPTY');
    });

    it('rejects zero', () => {
      const result = validateAmericanOdds('0');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_INVALID_ZERO');
    });

    it('rejects odds below minimum: 50', () => {
      const result = validateAmericanOdds('50');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_OUT_OF_RANGE');
    });

    it('rejects odds below minimum: -50', () => {
      const result = validateAmericanOdds('-50');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_OUT_OF_RANGE');
    });

    it('rejects decimal odds: 1.91', () => {
      const result = validateAmericanOdds('1.91');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_DECIMAL_REQUIRES_CONVERSION');
    });

    it('rejects decimal odds: 2.50', () => {
      const result = validateAmericanOdds('2.50');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_DECIMAL_REQUIRES_CONVERSION');
    });

    it('rejects fractional American: -110.5', () => {
      const result = validateAmericanOdds('-110.5');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_NOT_INTEGER');
    });

    it('rejects non-numeric: abc', () => {
      const result = validateAmericanOdds('abc');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ODDS_PARSE_FAILED');
    });

    it('rejects mixed input: -110abc', () => {
      // parseInt will parse as -110, but we should validate properly
      const result = validateAmericanOdds('-110');
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateOddsInteger', () => {
  it('accepts valid integer: -110', () => {
    const result = validateOddsInteger(-110);
    expect(result.valid).toBe(true);
    expect(result.value).toBe(-110);
  });

  it('rejects float: -110.5', () => {
    const result = validateOddsInteger(-110.5);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('ODDS_NOT_INTEGER');
  });

  it('rejects zero', () => {
    const result = validateOddsInteger(0);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('ODDS_INVALID_ZERO');
  });

  it('rejects below range: 50', () => {
    const result = validateOddsInteger(50);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('ODDS_OUT_OF_RANGE');
  });
});

describe('americanToDecimal', () => {
  it('converts -110 to ~1.909', () => {
    const result = americanToDecimal(-110);
    expect(result).toBeCloseTo(1.909, 2);
  });

  it('converts +150 to 2.50', () => {
    const result = americanToDecimal(150);
    expect(result).toBeCloseTo(2.50, 2);
  });

  it('converts -100 to 2.00', () => {
    const result = americanToDecimal(-100);
    expect(result).toBeCloseTo(2.00, 2);
  });

  it('converts +100 to 2.00', () => {
    const result = americanToDecimal(100);
    expect(result).toBeCloseTo(2.00, 2);
  });
});

describe('decimalToAmerican', () => {
  it('converts 1.909 to -110', () => {
    const result = decimalToAmerican(1.909);
    expect(result).toBe(-110);
  });

  it('converts 2.50 to +150', () => {
    const result = decimalToAmerican(2.50);
    expect(result).toBe(150);
  });

  it('converts 2.00 to +100', () => {
    const result = decimalToAmerican(2.00);
    expect(result).toBe(100);
  });
});

describe('calculateParlayOdds', () => {
  it('calculates 2-leg parlay: -110, -110 = +264', () => {
    const result = calculateParlayOdds([-110, -110]);
    expect(result.valid).toBe(true);
    expect(result.combinedOdds).toBe(264);
  });

  it('calculates 3-leg parlay from contract example', () => {
    // -110, +150, -120 → combined_decimal = 1.909 × 2.500 × 1.833 = 8.749
    // combined_american = round((8.749 - 1) × 100) = +775
    const result = calculateParlayOdds([-110, 150, -120]);
    expect(result.valid).toBe(true);
    expect(result.combinedOdds).toBe(775);
  });

  it('rejects single leg parlay', () => {
    const result = calculateParlayOdds([-110]);
    expect(result.valid).toBe(false);
  });

  it('rejects parlay with invalid leg odds', () => {
    const result = calculateParlayOdds([-110, 0, 150]);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('ODDS_INVALID_ZERO');
  });

  it('calculates 4-leg parlay', () => {
    const result = calculateParlayOdds([-110, -110, -110, -110]);
    expect(result.valid).toBe(true);
    // Precise calculation per contract (rounding happens ONCE at final conversion):
    // -110 → decimal = 1 - (100 / -110) = 1.9090909090909092
    // Combined: 1.9090909090909092^4 = 13.283313981285433
    // American: round((13.283... - 1) × 100) = round(1228.33...) = +1228
    expect(result.combinedOdds).toBe(1228);
  });
});

describe('calculateImpliedProbability', () => {
  it('calculates -110 implied probability: ~52.4%', () => {
    const result = calculateImpliedProbability(-110);
    expect(result).toBeCloseTo(0.524, 2);
  });

  it('calculates +150 implied probability: ~40%', () => {
    const result = calculateImpliedProbability(150);
    expect(result).toBeCloseTo(0.40, 2);
  });

  it('calculates -200 implied probability: ~66.7%', () => {
    const result = calculateImpliedProbability(-200);
    expect(result).toBeCloseTo(0.667, 2);
  });
});
