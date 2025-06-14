// src/logic/config/edgeConfig.ts

export const EDGE_CONFIG = {
  market: {
    Points: 2,
    Rebounds: 2,
    Assists: 2,
    '3PM': 2,
    Hits: 2,
    'Total Bases': 2,
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
  max: 25
};