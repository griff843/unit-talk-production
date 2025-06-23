import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Extend Request interface to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      user?: {
        id: string;
        tier: string;
        permissions: string[];
      };
    }
  }
}

// Common validation schemas
export const commonSchemas = {
  id: z.string().uuid('Invalid ID format'),
  discordId: z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID'),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  dateString: z.string().datetime('Invalid date format'),
  positiveNumber: z.number().positive('Must be a positive number'),
  nonEmptyString: z.string().min(1, 'Cannot be empty'),
  tier: z.enum(['member', 'vip', 'vip_plus', 'staff', 'admin', 'owner']),
  sport: z.enum(['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF']),
  pickType: z.enum(['spread', 'moneyline', 'total', 'prop']),
  betResult: z.enum(['win', 'loss', 'push', 'pending']),
};

// Pick submission validation
export const pickSubmissionSchema = z.object({
  body: z.object({
    sport: commonSchemas.sport,
    league: z.string().min(1),
    game: z.string().min(1),
    pick_type: commonSchemas.pickType,
    selection: z.string().min(1),
    odds: z.string().optional(),
    units: z.number().min(0.1).max(10).optional(),
    confidence: z.number().min(1).max(10).optional(),
    reasoning: z.string().max(1000).optional(),
  }),
  params: z.object({
    userId: commonSchemas.discordId.optional(),
  }).optional(),
});

// User profile validation
export const userProfileSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(50),
    tier: commonSchemas.tier.optional(),
    settings: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  params: z.object({
    discordId: commonSchemas.discordId,
  }),
});

// Grading validation
export const gradingSchema = z.object({
  body: z.object({
    result: commonSchemas.betResult,
    actual_value: z.number().optional(),
    notes: z.string().max(500).optional(),
  }),
  params: z.object({
    pickId: commonSchemas.id,
  }),
});

// Query parameter validation
export const querySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sort: z.string().optional(),
    filter: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// Input sanitization
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return sanitizeHtml(input).trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

// Main validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize inputs first
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query);
      req.params = sanitizeInput(req.params);

      // Validate against schema
      const result = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
      }

      // Store validated data
      req.validatedData = result.data;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({ 
        error: 'Internal validation error',
        message: 'Please try again later'
      });
    }
  };
};

// SQL injection protection
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\b(WAITFOR|DELAY)\b)/gi,
    /(\bxp_\w+)/gi,
  ];

  const checkForSQLInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSQLInjection(value));
    }
    
    return false;
  };

  const requestData = {
    ...req.body,
    ...req.query,
    ...req.params,
  };

  if (checkForSQLInjection(requestData)) {
    return res.status(400).json({
      error: 'Request contains potentially malicious SQL patterns',
      code: 'SQL_INJECTION_DETECTED'
    });
  }

  next();
};

// XSS protection
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
  ];

  const checkForXSS = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return xssPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForXSS(value));
    }
    
    return false;
  };

  const requestData = {
    ...req.body,
    ...req.query,
    ...req.params,
  };

  if (checkForXSS(requestData)) {
    return res.status(400).json({
      error: 'Request contains potentially malicious XSS patterns',
      code: 'XSS_DETECTED'
    });
  }

  next();
};

// File upload validation
export const fileUploadValidation = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Note: This middleware requires multer to be configured first
    // It will add the 'files' property to the request object

    // Skip validation if no file upload middleware is configured
    if (!('files' in req)) {
      return next();
    }

    const { maxSize = 5 * 1024 * 1024, allowedTypes = [], maxFiles = 1 } = options;
    const files = (req as any).files;

    if (!files || Object.keys(files).length === 0) {
      return next();
    }

    const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

    if (fileArray.length > maxFiles) {
      return res.status(400).json({
        error: `Too many files. Maximum allowed: ${maxFiles}`,
      });
    }

    for (const file of fileArray) {
      if (file.size > maxSize) {
        return res.status(400).json({
          error: `File too large. Maximum size: ${maxSize} bytes`,
        });
      }

      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        });
      }
    }

    next();
  };
};

export default {
  validateRequest,
  sanitizeInput,
  sqlInjectionProtection,
  xssProtection,
  fileUploadValidation,
  commonSchemas,
  pickSubmissionSchema,
  userProfileSchema,
  gradingSchema,
  querySchema,
};