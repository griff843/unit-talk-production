const fs = require('fs');
const path = require('path');

(function () {
  const results = {
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    overall: true,
    packages: {}
  };

  const packagesToTest = ['@unit-talk/database', '@unit-talk/shared-utils'];

  for (const packageName of packagesToTest) {
    const result = {
      success: false,
      message: '',
      resolvedPath: '',
    };

    try {
      const resolved = require.resolve(packageName);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(packageName);
      result.success = !!mod;
      result.message = 'ok';
      result.resolvedPath = resolved;
    } catch (err) {
      result.success = false;
      result.message = err && err.message ? err.message : String(err);
      results.overall = false;
    }

    results.packages[packageName] = result;
    console.log(`[verify-api-module] ${packageName}: ${result.success ? 'ok' : 'fail'}: ${result.message} -> ${result.resolvedPath}`);
  }

  const outDir = path.join('out', 'ops');
  const outFile = path.join(outDir, 'verify-api-module.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`[verify-api-module] Overall: ${results.overall ? 'PASS' : 'FAIL'}`);
})();

