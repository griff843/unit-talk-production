import { capperThreadResolver } from '../services/CapperThreadResolver';

async function main() {
  const discordId = process.argv[2];
  const capperHandle = process.argv[3];
  if (!discordId) {
    console.error('Usage: tsx src/scripts/test-capper-resolver.ts <discord_id> [capper_handle]');
    process.exit(1);
  }
  const result = await capperThreadResolver.ensure({
    discordId,
    capperHandle,
    require: ['picks'],
    correlationId: `test-${Date.now()}`,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error('Error:', e?.message || e);
  process.exit(1);
});
