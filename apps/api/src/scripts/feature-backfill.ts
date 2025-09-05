import { FeatureStoreService } from '../services/FeatureStoreService';

async function main() {
  const service = new FeatureStoreService();

  // Backfill example: player features
  const now = new Date();
  const asOf = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const samples = [
    { entityType: 'player', entityId: 'player_1', featureName: 'recent_avg_points', value: { avg: 24.3 } },
    { entityType: 'player', entityId: 'player_1', featureName: 'last_5_games_minutes', value: { avg: 31.2 } },
    { entityType: 'player', entityId: 'player_2', featureName: 'recent_avg_points', value: { avg: 28.0 } },
  ];

  for (const s of samples) {
    await service.upsertFeature({ ...s, asOf });
  }

  console.log('✅ Feature backfill done');
}

main().catch(err => {
  console.error('Backfill failed', err);
  process.exit(1);
});

