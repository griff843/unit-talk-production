// src/logic/config/edgeConfig.ts

export const EDGE_CONFIG = {
  market: {
    Points: 2,
    Rebounds: 2,
    Assists: 2,
    '3PM': 2,
    Hits: 2,
    'Total Bases': 2,
    'Home Runs': 2,  // Added HR market type
    default: 1
  } as Record<string, number>,
  odds: {
    threshold: -130,
    high: 2
  },
  trend_score: {
    threshold: 0.7,
    strong: 2
  },
  matchup_score: {
    threshold: 1.5,
    strong: 2
  },
  role_score: {
    threshold: 1.5,
    strong: 2
  },
  source: {
    SGO: 1,
    PropsDotCash: 1
  } as Record<string, number>,
  line_value_score: {
    threshold: 0.5,
    strong: 2
  },
  tags: {
    rocket: 2,
    ladder: 1
  },
  // Zone Threat Rating configuration (INTERNAL ONLY)
  zoneThreat: {
    enabled: true,        // Feature flag for Zone Threat Rating
    hrMarkets: [          // Market types eligible for Zone Threat boost
      'Home Runs',
      'Total Bases',
      'rocket'            // Rocket props are often HR-related
    ],
    boost: 2,            // Points added for EXTREME + favorable conditions
    logDecisions: true   // Whether to log boost decisions internally
  },
  max: 25
};