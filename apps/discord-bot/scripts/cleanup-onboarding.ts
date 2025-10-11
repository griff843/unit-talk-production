import { getCache } from '../src/services/enterpriseCache';

(async () => {
  const cache = getCache();
  // Clear invite intent mappings and metrics (DRY RUN off)
  const clearedInvites = await cache.clear('ut:invites:');
  const clearedMetrics = await cache.mdel([
    'ut:metrics:discord:invite_unknown',
    'ut:metrics:discord:staff_code_fail',
    'ut:metrics:discord:staff_code_success',
  ]);
  // eslint-disable-next-line no-console
  console.log({ clearedInvites, clearedMetrics });
  process.exit(0);
})();

