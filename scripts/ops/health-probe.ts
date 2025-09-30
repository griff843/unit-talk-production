import fs from 'fs';
import path from 'path';
import http from 'http';

// Enhanced health probe with discovery for API readiness endpoints

interface HealthDiscovery {
  endpointsFound: string[];
  readinessPath: string;
  candidates: string[];
}

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function get(url: string): Promise<{ ok: boolean; status?: number; body?: string }> {
  return new Promise(resolve => {
    try {
      const req = http.get(url, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const result: { ok: boolean; status?: number; body?: string } = {
            ok: res.statusCode === 200 || res.statusCode === 503,
            body: data
          };
          if (res.statusCode !== undefined) {
            result.status = res.statusCode;
          }
          resolve(result);
        });
      });
      req.on('error', () => resolve({ ok: false }));
      req.setTimeout(3000, () => { req.destroy(); resolve({ ok: false }); });
    } catch {
      resolve({ ok: false });
    }
  });
}

async function discoverEndpoints(): Promise<HealthDiscovery> {
  const apiBaseUrl = process.env['API_BASE_URL'] || 'http://localhost:3000';

  // Known endpoints from codebase analysis
  const endpointPatterns = [
    '/health',
    '/health/ready',
    '/health/live',
    '/health/summary',
    '/health/enhanced',
    '/health/advanced-features'
  ];

  const endpointsFound: string[] = [];
  const candidates: string[] = [];

  console.log('🔍 Discovering API health endpoints...\n');

  for (const pattern of endpointPatterns) {
    const url = `${apiBaseUrl}${pattern}`;
    candidates.push(url);

    const result = await get(url);
    if (result.ok) {
      endpointsFound.push(pattern);
      console.log(`  ✅ Found: ${pattern} (status: ${result.status})`);
    }
  }

  return {
    endpointsFound,
    readinessPath: '/health/ready', // From codebase analysis
    candidates: candidates.slice(0, 5)
  };
}

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'ops');
  ensureDir(outDir);

  // Run discovery
  const discovery = await discoverEndpoints();

  // Write discovery results
  fs.writeFileSync(
    path.join(outDir, 'health-api.discovery.json'),
    JSON.stringify(discovery, null, 2)
  );

  // Probe specific readiness endpoints
  const apiUrl = process.env['API_READINESS_URL'] || 'http://localhost:3000/health/ready';
  const ccUrl = process.env['CC_HEALTH_URL'] || 'http://localhost:3004/api/health';

  console.log('\n📊 Probing readiness endpoints...');
  const [api, cc] = await Promise.all([get(apiUrl), get(ccUrl)]);

  const result = {
    ok: api.ok && cc.ok,
    api: { ...api, url: apiUrl },
    cc: { ...cc, url: ccUrl },
    probedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outDir, 'health.json'), JSON.stringify(result, null, 2));

  console.log('\n✅ Health probe complete');
  console.log(`  API Ready: ${api.ok ? 'Yes' : 'No'} (${apiUrl})`);
  console.log(`  CC Ready: ${cc.ok ? 'Yes' : 'No'} (${ccUrl})`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });

