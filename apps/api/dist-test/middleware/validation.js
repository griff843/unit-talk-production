"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUploadValidation = exports.xssProtection = exports.sqlInjectionProtection = exports.validateRequest = exports.sanitizeInput = exports.querySchema = exports.gradingSchema = exports.userProfileSchema = exports.pickSubmissionSchema = exports.commonSchemas = void 0;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const sanitizeHtml = (input) => {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};
// Common validation schemas
exports.commonSchemas = {
    id: zod_1.z.string().uuid('Invalid ID format'),
    discordId: zod_1.z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID'),
    email: zod_1.z.string().email('Invalid email format'),
    url: zod_1.z.string().url('Invalid URL format'),
    dateString: zod_1.z.string().datetime('Invalid date format'),
    positiveNumber: zod_1.z.number().positive('Must be a positive number'),
    nonEmptyString: zod_1.z.string().min(1, 'Cannot be empty'),
    tier: zod_1.z.enum(['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner']),
    sport: zod_1.z.enum(['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF']),
    pickType: zod_1.z.enum(['spread', 'moneyline', 'total', 'prop']),
    betResult: zod_1.z.enum(['win', 'loss', 'push', 'pending']),
};
// Pick submission validation
exports.pickSubmissionSchema = zod_1.z.object({
    body: zod_1.z.object({
        sport: exports.commonSchemas.sport,
        league: zod_1.z.string().min(1),
        game: zod_1.z.string().min(1),
        pick_type: exports.commonSchemas.pickType,
        selection: zod_1.z.string().min(1),
        odds: zod_1.z.string().optional(),
        units: zod_1.z.number().min(0.1).max(10).optional(),
        confidence: zod_1.z.number().min(1).max(10).optional(),
        reasoning: zod_1.z.string().max(1000).optional(),
    }),
    params: zod_1.z.object({
        userId: exports.commonSchemas.discordId.optional(),
    }).optional(),
});
// User profile validation
exports.userProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        username: zod_1.z.string().min(1).max(50),
        tier: exports.commonSchemas.tier.optional(),
        settings: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    }),
    params: zod_1.z.object({
        discordId: exports.commonSchemas.discordId,
    }),
});
// Grading validation
exports.gradingSchema = zod_1.z.object({
    body: zod_1.z.object({
        result: exports.commonSchemas.betResult,
        actual_value: zod_1.z.number().optional(),
        notes: zod_1.z.string().max(500).optional(),
    }),
    params: zod_1.z.object({
        pickId: exports.commonSchemas.id,
    }),
});
// Query parameter validation
exports.querySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
        sort: zod_1.z.string().optional(),
        filter: zod_1.z.string().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
    }),
});
// Input sanitization
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return sanitizeHtml(input).trim();
    }
    if (Array.isArray(input)) {
        return input.map(exports.sanitizeInput);
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[(0, exports.sanitizeInput)(key)] = (0, exports.sanitizeInput)(value);
        }
        return sanitized;
    }
    return input;
};
exports.sanitizeInput = sanitizeInput;
// Main validation middleware
const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            // Sanitize inputs first
            req.body = (0, exports.sanitizeInput)(req.body);
            req.query = (0, exports.sanitizeInput)(req.query);
            req.params = (0, exports.sanitizeInput)(req.params);
            // Validate against schema
            const result = await schema.safeParseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            if (!result.success) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: result.error.issues.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code,
                    })),
                });
                return;
            }
            // Store validated data
            req.validatedData = result.data;
            next();
        }
        catch (error) {
            logger_1.logger.error('Validation middleware err:', error);
            res.status(500).json({
                err: 'Internal validation error',
                message: 'Please try again later'
            });
        }
    };
};
exports.validateRequest = validateRequest;
// SQL injection protection
const sqlInjectionProtection = (req, res, next) => {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
        /(--|\/\*|\*\/|;)/g,
        /(\b(WAITFOR|DELAY)\b)/gi,
        /(\bxp_\w+)/gi,
    ];
    const checkForSQLInjection = (obj) => {
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
        res.status(400).json({
            error: 'Request contains potentially malicious SQL patterns',
            code: 'SQL_INJECTION_DETECTED'
        });
        return;
    }
    next();
};
exports.sqlInjectionProtection = sqlInjectionProtection;
// XSS protection
const xssProtection = (req, res, next) => {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /onmouseover\s*=/gi,
    ];
    const checkForXSS = (obj) => {
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
        res.status(400).json({
            error: 'Request contains potentially malicious XSS patterns',
            code: 'XSS_DETECTED'
        });
        return;
    }
    next();
};
exports.xssProtection = xssProtection;
// File upload validation
const fileUploadValidation = (options) => {
    return (req, res, next) => {
        // Note: This middleware requires multer to be configured first
        // It will add the 'files' property to the request object
        // Skip validation if no file upload middleware is configured
        if (!('files' in req)) {
            return next();
        }
        const { maxSize = 5 * 1024 * 1024, allowedTypes = [], maxFiles = 1 } = options;
        const files = req.files;
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
        return next();
    };
};
exports.fileUploadValidation = fileUploadValidation;
exports.default = {
    validateRequest: exports.validateRequest,
    sanitizeInput: exports.sanitizeInput,
    sqlInjectionProtection: exports.sqlInjectionProtection,
    xssProtection: exports.xssProtection,
    fileUploadValidation: exports.fileUploadValidation,
    commonSchemas: exports.commonSchemas,
    pickSubmissionSchema: exports.pickSubmissionSchema,
    userProfileSchema: exports.userProfileSchema,
    gradingSchema: exports.gradingSchema,
    querySchema: exports.querySchema,
};
