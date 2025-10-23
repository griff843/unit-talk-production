import type { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                role: string;
            };
        }
    }
}
/**
 * Minimal ops auth middleware used by routes/probes.ts
 * Accepts Authorization: Bearer admin-... header or x-e2e-test=true for local testing
 */
export declare function requireOpsKey(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
/**
 * Basic authentication middleware for operator dashboard
 * In production, this would integrate with your actual auth system
 */
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Role-based authorization middleware
 */
export declare const requireRole: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Optional authentication middleware (doesn't fail if no auth provided)
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    requireOpsKey: typeof requireOpsKey;
    requireAuth: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    requireRole: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map