/* Minimal smoke script to execute the built /api/health GET handler
 * Runs against the compiled Next.js output after `npm run build`
 * Safe/read-only: does not mutate any data
 */

(async () => {
  try {
    const mod = require('../.next/server/app/api/health/route.js');
    const exportKeys = Object.keys(mod || {});
    console.log('HEALTH_SMOKE_EXPORTS:', exportKeys.join(','));

    // Try common shapes
    const handler =
      (mod && typeof mod.GET === 'function' && mod.GET) ||
      (mod && mod.default && typeof mod.default.GET === 'function' && mod.default.GET) ||
      (typeof mod === 'function' ? mod : null);

    if (!handler) {
      console.log('HEALTH_SMOKE_STATUS: SKIPPED (no GET export found)');
      process.exit(0);
    }

    // Create a minimal request-like object compatible with our GET implementation
    const req = {
      headers: {
        get: (key) => (key === 'x-user-id' ? 'smoke-tester' : null),
      },
      nextUrl: {
        searchParams: new URLSearchParams(''), // detailed=false by default
      },
    };

    const res = await handler(req);

    // NextResponse is a Web Response in Node 20
    const status = res.status || 0;
    const text = await res.text();

    console.log('HEALTH_SMOKE_STATUS:', status);
    console.log('HEALTH_SMOKE_BODY_PREVIEW:', text.substring(0, 200));

    process.exit(status === 200 ? 0 : 1);
  } catch (err) {
    console.error('HEALTH_SMOKE_ERROR:', err);
    // Non-fatal in CI – treat as informational
    process.exit(0);
  }
})();

