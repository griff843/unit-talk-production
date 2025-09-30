/**
 * Temporal discovery script
 * Discovers Temporal server address and namespace configuration
 */
import * as fs from 'fs';
import * as path from 'path';

interface TemporalDiscovery {
  address: string;
  namespace: string;
  healthUrl: string | null;
  files: string[];
}

function discoverTemporalConfig(): TemporalDiscovery {
  console.log('🔍 Discovering Temporal configuration...\n');

  const files: string[] = [];

  // From codebase analysis, we found these patterns:
  // - TEMPORAL_SERVER_URL in env.ts defaults to 'localhost:7233'
  // - TEMPORAL_NAMESPACE in config/index.ts defaults to 'default'
  // - Worker uses env.TEMPORAL_SERVER_URL for connection

  files.push(
    'apps/api/src/config/env.ts',
    'apps/api/src/config/index.ts',
    'apps/api/src/worker.ts',
    'apps/api/src/routes/settlement.ts'
  );

  // Get values from environment or use discovered defaults
  const address = process.env.TEMPORAL_ADDRESS ||
                  process.env.TEMPORAL_SERVER_URL ||
                  'localhost:7233';

  const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

  // For health checks, Temporal UI is typically on port 8088
  // but the actual health endpoint varies by setup
  const temporalHealthUrl = process.env.TEMPORAL_HEALTH_URL || null;

  console.log('📊 Temporal Configuration Found:');
  console.log(`  Address: ${address}`);
  console.log(`  Namespace: ${namespace}`);
  console.log(`  Health URL: ${temporalHealthUrl || 'Not configured (use address+namespace)'}`);
  console.log(`  Config files: ${files.length} files`);

  return {
    address,
    namespace,
    healthUrl: temporalHealthUrl,
    files
  };
}

function main(): void {
  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'out', 'ops');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Discover Temporal configuration
  const discovery = discoverTemporalConfig();

  // Write discovery file
  const outputPath = path.join(outputDir, 'temporal.discovery.json');
  fs.writeFileSync(outputPath, JSON.stringify(discovery, null, 2));

  console.log(`\n✅ Temporal discovery complete!`);
  console.log(`  Output saved to: ${outputPath}`);

  // Print instructions for setting environment variables
  console.log('\n📝 To set Temporal configuration:');
  console.log('  Add these to your environment:');
  console.log(`    TEMPORAL_ADDRESS=${discovery.address}`);
  console.log(`    TEMPORAL_NAMESPACE=${discovery.namespace}`);
  if (!discovery.healthUrl) {
    console.log(`    # TEMPORAL_HEALTH_URL=<optional, for HTTP health checks>`);
  }
}

main();