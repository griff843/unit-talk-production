#!/bin/bash

mkdir -p src/agents/PromotionAgent/scoring

touch src/agents/PromotionAgent/scoring/applyScoringLogic.ts
touch src/agents/PromotionAgent/scoring/trendScore.ts
touch src/agents/PromotionAgent/scoring/matchupScore.ts
touch src/agents/PromotionAgent/scoring/expectedValue.ts
touch src/agents/PromotionAgent/scoring/confidenceScore.ts
touch src/agents/PromotionAgent/scoring/lineValueScore.ts
touch src/agents/PromotionAgent/scoring/roleStabilityScore.ts
touch src/agents/PromotionAgent/scoring/determineTier.ts

echo "All scoring files created in src/agents/PromotionAgent/scoring/"
