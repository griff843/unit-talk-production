import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { requireOpsKey } from '../middleware/auth';

const router = Router();

/**
 * Execute a health probe script
 */
async function executeProbe(scriptPath: string): Promise<{ ok: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const fullPath = path.resolve(process.cwd(), '../..', scriptPath);
    
    const child = spawn('npx', ['tsx', fullPath], {
      cwd: path.resolve(process.cwd(), '../..'),
      env: { ...process.env },
      shell: true
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        output,
        error: error || undefined
      });
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        output,
        error: 'Probe timed out after 30 seconds'
      });
    }, 30000);
  });
}

/**
 * POST /api/ops/probes/health
 * Run all health probe scripts sequentially
 */
router.post('/health', requireOpsKey, async (req, res) => {
  console.log('[Probes] Starting health probe execution');
  
  const probes = [
    { name: 'Temporal', script: 'scripts/ops/health-temporal.ts' },
    { name: 'API', script: 'scripts/ops/health-api.ts' },
    { name: 'Worker', script: 'scripts/ops/health-worker.ts' },
    { name: 'Database', script: 'scripts/ops/db-preflight.ts' }
  ];

  const results = [];
  
  for (const probe of probes) {
    console.log(`[Probes] Running ${probe.name} probe...`);
    const startTime = Date.now();
    
    try {
      const result = await executeProbe(probe.script);
      const duration = Date.now() - startTime;
      
      results.push({
        name: probe.name,
        ok: result.ok,
        duration,
        output: result.output?.substring(0, 500), // Limit output size
        error: result.error?.substring(0, 500)
      });
      
      console.log(`[Probes] ${probe.name} probe completed in ${duration}ms - ${result.ok ? 'OK' : 'FAILED'}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({
        name: probe.name,
        ok: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.error(`[Probes] ${probe.name} probe failed:`, error);
    }
  }

  const allOk = results.every(r => r.ok);
  
  res.json({
    ok: allOk,
    timestamp: new Date().toISOString(),
    probes: results,
    summary: `${results.filter(r => r.ok).length}/${results.length} probes succeeded`
  });
});

/**
 * POST /api/ops/probes/temporal
 * Run only the Temporal health probe
 */
router.post('/temporal', requireOpsKey, async (req, res) => {
  console.log('[Probes] Running Temporal probe');
  
  try {
    const result = await executeProbe('scripts/ops/health-temporal.ts');
    
    res.json({
      ok: result.ok,
      timestamp: new Date().toISOString(),
      output: result.output,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to run Temporal probe'
    });
  }
});

/**
 * POST /api/ops/probes/database
 * Run only the database preflight probe
 */
router.post('/database', requireOpsKey, async (req, res) => {
  console.log('[Probes] Running database probe');
  
  try {
    const result = await executeProbe('scripts/ops/db-preflight.ts');
    
    res.json({
      ok: result.ok,
      timestamp: new Date().toISOString(),
      output: result.output,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to run database probe'
    });
  }
});

export default router;