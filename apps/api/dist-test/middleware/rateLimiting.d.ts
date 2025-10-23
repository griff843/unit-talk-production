import { Request, Response, NextFunction } from 'express';
export declare const apiLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const strictLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const pickSubmissionLimiter: (req: Request, res: Response, next: NextFunction) => void;
export declare const abuseProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestSizeLimit: (maxSize?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const ipFilter: (options: {
    whitelist?: string[];
    blacklist?: string[];
}) => (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    apiLimiter: (req: Request, res: Response, next: NextFunction) => void;
    strictLimiter: (req: Request, res: Response, next: NextFunction) => void;
    pickSubmissionLimiter: (req: Request, res: Response, next: NextFunction) => void;
    abuseProtection: (req: Request, res: Response, next: NextFunction) => void;
    requestSizeLimit: (maxSize?: number) => (req: Request, res: Response, next: NextFunction) => void;
    ipFilter: (options: {
        whitelist?: string[];
        blacklist?: string[];
    }) => (req: Request, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=rateLimiting.d.ts.map