import fs from 'fs';
import path from 'path';

(async () => {
  const result = {
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    success: false as boolean,
    message: '' as string,
    resolution: '' as string,
  };

  try {
    // Attempt to resolve and require the database workspace package
    const resolved = require.resolve('@unit-talk/database');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@unit-talk/database');
    result.success = !!mod;
    result.message = `Resolved to ${resolved}`;
    result.resolution = 'ok';
  } catch (err: any) {
    result.success = false;
    result.message = err?.message || String(err);
    result.resolution = 'fail';
  }

  const outDir = path.join('out', 'ops');
  const outFile = path.join(outDir, 'verify-api-module.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`[verify-api-module] ${result.resolution}: ${result.message}`);
})();

