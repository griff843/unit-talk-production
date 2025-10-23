/**
 * Admin endpoint for invalidating Redis cache namespaces
 * Clears cache for raw_props and unified_picks as requested
 */
import { Request, Response } from 'express';
export declare function invalidateCacheEndpoint(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=invalidate-cache.d.ts.map