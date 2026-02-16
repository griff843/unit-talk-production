/**
 * featureRegistry.ts — Declarative Feature Registry for Scoring V2
 *
 * Every scored feature is declared here with:
 * - name, group, weightKey (matching CoreScoringWeights)
 * - inputRange, normalize (raw → 0-100)
 * - fallbackPolicy + fallbackValue (when input is missing)
 * - extract (pulls raw value from GradingFeatureSet)
 *
 * Created: 2026-01-29 (Tranche 3, Stage 3 — Scoring Rebuild)
 */

/* eslint-disable complexity */
import type { GradingFeatureSet } from '../../../types/GradingFeatureSet';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeatureGroup = 'core' | 'market' | 'capper' | 'context' | 'risk' | 'ml';
export type FallbackPolicy = 'neutral' | 'excluded';

export interface FeatureRegistryEntry {
  /** Feature name — must match a key in CoreScoringWeights */
  name: string;
  /** Logical grouping for audit/reporting */
  group: FeatureGroup;
  /** Key in CoreScoringWeights for weight lookup */
  weightKey: string;
  /** [min, max] of the raw input domain */
  inputRange: [number, number];
  /** What to do when the raw value is missing */
  fallbackPolicy: FallbackPolicy;
  /** Default value on the RAW scale when missing (only for policy=neutral) */
  fallbackValue: number;
  /** Normalize raw value to 0-100 canonical scale. Higher = better for the pick. */
  normalize: (raw: number) => number;
  /** Extract raw value from GradingFeatureSet. Returns undefined if not present. */
  extract: (features: GradingFeatureSet) => number | undefined;
}

export interface FeatureVectorEntry {
  entry: FeatureRegistryEntry;
  raw: number;
  normalized: number;
  present: boolean;
  fallbackUsed: boolean;
  excluded: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear scale from [inMin, inMax] → [0, 100] */
function linearScale(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 50;
  return clamp(((value - inMin) / (inMax - inMin)) * 100, 0, 100);
}

/** Inverted linear scale: higher raw → lower normalized (for risk/negative factors) */
function invertedScale(value: number, inMin: number, inMax: number): number {
  return 100 - linearScale(value, inMin, inMax);
}

// ─── Registry: 30 features matching CoreScoringWeights ──────────────────────

export const FEATURE_REGISTRY: FeatureRegistryEntry[] = [
  // ── Core (6) ──────────────────────────────────────────────────────────────

  {
    name: 'expectedValue',
    group: 'core',
    weightKey: 'expectedValue',
    inputRange: [-50, 50],
    fallbackPolicy: 'neutral',
    fallbackValue: 0,
    normalize: (raw) => linearScale(raw, -50, 50),
    extract: (f) => (typeof f.expectedValue === 'number' ? f.expectedValue : undefined),
  },
  {
    name: 'lineMovement',
    group: 'core',
    weightKey: 'lineMovement',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 0,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => (typeof f.lineMovement === 'number' ? f.lineMovement : undefined),
  },
  {
    name: 'matchupRating',
    group: 'core',
    weightKey: 'matchupRating',
    inputRange: [0, 100],
    fallbackPolicy: 'neutral',
    fallbackValue: 50,
    normalize: (raw) => clamp(raw, 0, 100),
    extract: (f) => (typeof f.matchupRating === 'number' ? f.matchupRating : undefined),
  },
  {
    name: 'playerForm',
    group: 'core',
    weightKey: 'playerForm',
    inputRange: [0, 100],
    fallbackPolicy: 'neutral',
    fallbackValue: 50,
    normalize: (raw) => clamp(raw, 0, 100),
    extract: (f) => (typeof f.playerForm === 'number' ? f.playerForm : undefined),
  },
  {
    name: 'injuryImpact',
    group: 'core',
    weightKey: 'injuryImpact',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 0,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => (typeof f.injuryImpact === 'number' ? f.injuryImpact : undefined),
  },
  {
    name: 'weatherImpact',
    group: 'core',
    weightKey: 'weatherImpact',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 0,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => (typeof f.weatherImpact === 'number' ? f.weatherImpact : undefined),
  },

  // ── Market Intelligence (4) ───────────────────────────────────────────────

  {
    name: 'marketIntelligence',
    group: 'market',
    weightKey: 'marketIntelligence',
    inputRange: [0, 100],
    fallbackPolicy: 'neutral',
    fallbackValue: 50,
    normalize: (raw) => clamp(raw, 0, 100),
    extract: (f) => (typeof f.marketIntelligence === 'number' ? f.marketIntelligence : undefined),
  },
  {
    name: 'sharpMoney',
    group: 'market',
    weightKey: 'sharpMoney',
    inputRange: [0, 100],
    fallbackPolicy: 'neutral',
    fallbackValue: 50,
    normalize: (raw) => clamp(raw, 0, 100),
    extract: (f) => (typeof f.sharpMoney === 'number' ? f.sharpMoney : undefined),
  },
  {
    name: 'volumeProfile',
    group: 'market',
    weightKey: 'volumeProfile',
    inputRange: [0, 100],
    fallbackPolicy: 'neutral',
    fallbackValue: 50,
    normalize: (raw) => clamp(raw, 0, 100),
    extract: (f) => (typeof f.volumeProfile === 'number' ? f.volumeProfile : undefined),
  },
  {
    name: 'closingLineValue',
    group: 'market',
    weightKey: 'closingLineValue',
    inputRange: [-20, 20],
    fallbackPolicy: 'neutral',
    fallbackValue: 0,
    normalize: (raw) => linearScale(raw, -20, 20),
    extract: (f) => (typeof f.closingLineValue === 'number' ? f.closingLineValue : undefined),
  },

  // ── Professional Capper Features (8) ──────────────────────────────────────

  {
    name: 'steamDetection',
    group: 'capper',
    weightKey: 'steamDetection',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      if (f.steamMoveData?.detected !== undefined) {
        return clamp(f.steamMoveData.confidence * 10, 0, 10);
      }
      if (f.lineMovementHistory && f.lineMovementHistory.length >= 2) {
        const last = f.lineMovementHistory[f.lineMovementHistory.length - 1];
        const prev = f.lineMovementHistory[f.lineMovementHistory.length - 2];
        return clamp(Math.abs(last.line - prev.line) * 5, 0, 10);
      }
      return undefined;
    },
  },
  {
    name: 'closingLinePrediction',
    group: 'capper',
    weightKey: 'closingLinePrediction',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      // Proxy from closingLineValue when available
      if (typeof f.closingLineValue === 'number' && f.closingLineValue !== 0) {
        return clamp(5 + f.closingLineValue, 0, 10);
      }
      return undefined;
    },
  },
  {
    name: 'optimalTiming',
    group: 'capper',
    weightKey: 'optimalTiming',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      const hours = f.hoursToGame;
      if (typeof hours !== 'number') return undefined;
      if (hours >= 24) return 8;
      if (hours >= 8) return 6;
      if (hours >= 2) return 4;
      return 2;
    },
  },
  {
    name: 'lineShoppingEdge',
    group: 'capper',
    weightKey: 'lineShoppingEdge',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      if (!f.multiBookLines || f.multiBookLines.length < 2) return undefined;
      const odds = f.multiBookLines.map((b) => b.odds);
      const spread = Math.abs(Math.max(...odds) - Math.min(...odds));
      return clamp(spread / 5, 0, 10);
    },
  },
  {
    name: 'publicVsSharpSplit',
    group: 'capper',
    weightKey: 'publicVsSharpSplit',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      if (!f.bettingPercentages) return undefined;
      const pub = f.bettingPercentages.public;
      if (pub > 70) return 8; // Strong contrarian
      if (pub > 60) return 6;
      if (pub < 30) return 3; // Going with public
      return 5;
    },
  },
  {
    name: 'marketTimingAdvantage',
    group: 'capper',
    weightKey: 'marketTimingAdvantage',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      if (typeof f.marketTimingScore === 'number') {
        return clamp(f.marketTimingScore, 0, 10);
      }
      const hours = f.hoursToGame;
      if (typeof hours !== 'number') return undefined;
      if (hours >= 24) return 9;
      if (hours >= 8) return 6;
      if (hours >= 2) return 3;
      return 1;
    },
  },
  {
    name: 'injuryTimingEdge',
    group: 'capper',
    weightKey: 'injuryTimingEdge',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      if (!f.injuryNewsTimeline || f.injuryNewsTimeline.length === 0) return undefined;
      const latest = f.injuryNewsTimeline[f.injuryNewsTimeline.length - 1];
      const severity = latest.severity;
      const hours = f.hoursToGame ?? 12;
      if (severity > 3 && hours > 12) return 8;
      if (severity > 3 && hours > 4) return 6;
      if (severity > 3) return 3;
      return 2;
    },
  },
  {
    name: 'crossMarketDiscrepancy',
    group: 'capper',
    weightKey: 'crossMarketDiscrepancy',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => linearScale(raw, 0, 10),
    extract: (f) => {
      if (!f.crossMarketProps || f.crossMarketProps.length === 0) return undefined;
      const maxCorr = Math.max(...f.crossMarketProps.map((p) => p.correlation));
      if (maxCorr > 0.7) return 7;
      if (maxCorr > 0.5) return 5;
      return 3;
    },
  },

  // ── Game Context (5) ──────────────────────────────────────────────────────

  {
    name: 'playerFatigue',
    group: 'context',
    weightKey: 'playerFatigue',
    inputRange: [0, 100],
    fallbackPolicy: 'neutral',
    fallbackValue: 50,
    normalize: (raw) => clamp(raw, 0, 100),
    extract: (f) => (typeof f.playerFatigue === 'number' ? f.playerFatigue : undefined),
  },
  {
    name: 'venueAdvantage',
    group: 'context',
    weightKey: 'venueAdvantage',
    inputRange: [0, 20],
    fallbackPolicy: 'neutral',
    fallbackValue: 10,
    normalize: (raw) => linearScale(raw, 0, 20),
    extract: (f) => (typeof f.venueAdvantage === 'number' ? f.venueAdvantage : undefined),
  },
  {
    name: 'refereeImpact',
    group: 'context',
    weightKey: 'refereeImpact',
    inputRange: [-10, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 0,
    normalize: (raw) => linearScale(raw, -10, 10),
    extract: (f) => (typeof f.refereeImpact === 'number' ? f.refereeImpact : undefined),
  },
  {
    name: 'paceImpact',
    group: 'context',
    weightKey: 'paceImpact',
    inputRange: [0, 20],
    fallbackPolicy: 'neutral',
    fallbackValue: 10,
    normalize: (raw) => linearScale(raw, 0, 20),
    extract: (f) => (typeof f.paceImpact === 'number' ? f.paceImpact : undefined),
  },
  {
    name: 'motivationalFactors',
    group: 'context',
    weightKey: 'motivationalFactors',
    inputRange: [0, 30],
    fallbackPolicy: 'neutral',
    fallbackValue: 15,
    normalize: (raw) => linearScale(raw, 0, 30),
    extract: (f) => (typeof f.motivationalFactors === 'number' ? f.motivationalFactors : undefined),
  },

  // ── Risk (3) — inverted: higher raw = worse ──────────────────────────────

  {
    name: 'correlationRisk',
    group: 'risk',
    weightKey: 'correlationRisk',
    inputRange: [0, 1],
    fallbackPolicy: 'neutral',
    fallbackValue: 0.2,
    normalize: (raw) => invertedScale(raw, 0, 1),
    extract: (f) => (typeof f.correlationRisk === 'number' ? f.correlationRisk : undefined),
  },
  {
    name: 'volatility',
    group: 'risk',
    weightKey: 'volatility',
    inputRange: [0, 10],
    fallbackPolicy: 'neutral',
    fallbackValue: 5,
    normalize: (raw) => invertedScale(raw, 0, 10),
    extract: (f) => (typeof f.volatility === 'number' ? f.volatility : undefined),
  },
  {
    name: 'portfolioImpact',
    group: 'risk',
    weightKey: 'portfolioImpact',
    inputRange: [0, 1],
    fallbackPolicy: 'neutral',
    fallbackValue: 0.1,
    normalize: (raw) => invertedScale(raw, 0, 1),
    extract: (f) => (typeof f.portfolioImpact === 'number' ? f.portfolioImpact : undefined),
  },

  // ── ML Ensemble (4) — excluded: no ML models in V2, weight redistributed ─

  {
    name: 'neuralNetwork',
    group: 'ml',
    weightKey: 'neuralNetwork',
    inputRange: [0, 1],
    fallbackPolicy: 'excluded',
    fallbackValue: 0,
    normalize: (raw) => raw * 100,
    extract: () => undefined,
  },
  {
    name: 'gradientBoosting',
    group: 'ml',
    weightKey: 'gradientBoosting',
    inputRange: [0, 1],
    fallbackPolicy: 'excluded',
    fallbackValue: 0,
    normalize: (raw) => raw * 100,
    extract: () => undefined,
  },
  {
    name: 'randomForest',
    group: 'ml',
    weightKey: 'randomForest',
    inputRange: [0, 1],
    fallbackPolicy: 'excluded',
    fallbackValue: 0,
    normalize: (raw) => raw * 100,
    extract: () => undefined,
  },
  {
    name: 'ensemble',
    group: 'ml',
    weightKey: 'ensemble',
    inputRange: [0, 1],
    fallbackPolicy: 'excluded',
    fallbackValue: 0,
    normalize: (raw) => raw * 100,
    extract: () => undefined,
  },
];

// ─── Registry Accessors ─────────────────────────────────────────────────────

/** Get all registry entries for a specific group */
export function getRegistryByGroup(group: FeatureGroup): FeatureRegistryEntry[] {
  return FEATURE_REGISTRY.filter((e) => e.group === group);
}

/** Get a registry entry by name */
export function getRegistryEntry(name: string): FeatureRegistryEntry | undefined {
  return FEATURE_REGISTRY.find((e) => e.name === name);
}

// ─── Feature Vector Extraction ──────────────────────────────────────────────

/**
 * Build a normalized feature vector from a GradingFeatureSet.
 *
 * For each registry entry:
 * - Calls extract() to get raw value
 * - If present: normalizes to 0-100
 * - If missing + neutral: uses fallbackValue, normalizes, flags fallbackUsed
 * - If missing + excluded: marks excluded, skips scoring
 */
export function extractFeatureVector(
  features: GradingFeatureSet,
  registry: FeatureRegistryEntry[] = FEATURE_REGISTRY
): FeatureVectorEntry[] {
  return registry.map((entry) => {
    const rawValue = entry.extract(features);
    const present = rawValue !== undefined && rawValue !== null;

    if (entry.fallbackPolicy === 'excluded' && !present) {
      return {
        entry,
        raw: 0,
        normalized: 0,
        present: false,
        fallbackUsed: false,
        excluded: true,
      };
    }

    const raw = present ? rawValue : entry.fallbackValue;
    const normalized = entry.normalize(raw);

    return {
      entry,
      raw,
      normalized,
      present,
      fallbackUsed: !present,
      excluded: false,
    };
  });
}
