import { Request, Response, NextFunction } from 'express';

// Simple rate limiting implementation without external dependencies
class SimpleRateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number,
    private maxRequests: number,
    private message: string | object = 'Too many requests'
  ) {}

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Get existing requests for this key
      let requests = this.requests.get(key) || [];

      // Filter out old requests
      requests = requests.filter(time => time > windowStart);

      // Check if limit exceeded
      if (requests.length >= this.maxRequests) {
        res.status(429).json({
          error: this.message,
          retryAfter: Math.ceil(this.windowMs / 1000)
        });
        return;
      }

      // Add current request
      requests.push(now);
      this.requests.set(key, requests);

      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance
        this.cleanup();
      }

      next();
    };
  }

  private getKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > now - this.windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

// General API rate limiting
export const apiLimiter = new SimpleRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // max requests
  {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  }
).middleware();

// Strict rate limiting for sensitive endpoints
export const strictLimiter = new SimpleRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // max requests
  {
    error: 'Rate limit exceeded for sensitive operation',
    retryAfter: '15 minutes'
  }
).middleware();

// Pick submission rate limiting
export const pickSubmissionLimiter = new SimpleRateLimiter(
  60 * 60 * 1000, // 1 hour
  50, // max requests
  {
    error: 'Too many pick submissions. Please wait before submitting more.',
    retryAfter: '1 hour'
  }
).middleware();

// API abuse protection middleware
export const abuseProtection = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /script/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /eval\(/i,
    /expression\(/i,
  ];

  const checkForSuspiciousContent = (obj: unknown): boolean => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSuspiciousContent(value));
    }

    return false;
  };

  // Check request body, query, and params for suspicious content
  const requestData = {
    ...req.body,
    ...req.query,
    ...req.params,
  };

  if (checkForSuspiciousContent(requestData)) {
    res.status(400).json({
      error: 'Request contains potentially malicious content',
      code: 'SUSPICIOUS_CONTENT'
    });
    return;
  }

  next();
};

// Request size limiting
export const requestSizeLimit = (maxSize: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);

    if (contentLength > maxSize) {
      res.status(413).json({
        error: 'Request entity too large',
        maxSize: `${maxSize} bytes`
      });
      return;
    }

    next();
  };
};

// IP whitelist/blacklist middleware
export const ipFilter = (options: {
  whitelist?: string[];
  blacklist?: string[];
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.socket.remoteAddress;

    if (!clientIP) {
      res.status(400).json({ error: 'Unable to determine client IP' });
      return;
    }

    // Check blacklist first
    if (options.blacklist && options.blacklist.includes(clientIP)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check whitelist if provided
    if (options.whitelist && !options.whitelist.includes(clientIP)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  };
};

export default {
  apiLimiter,
  strictLimiter,
  pickSubmissionLimiter,
  abuseProtection,
  requestSizeLimit,
  ipFilter,
};