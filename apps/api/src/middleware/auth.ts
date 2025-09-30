import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthMiddleware');

// Extend Express Request type to include user
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
export function requireOpsKey(req: Request, res: Response, next: NextFunction) {
  // Allow E2E bypass in non-production
  if (req.headers['x-e2e-test'] === 'true' && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString(),
    });
  }

  return next();
}

/**
 * Basic authentication middleware for operator dashboard
 * In production, this would integrate with your actual auth system
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Allow E2E bypass in non-production
    if (req.headers['x-e2e-test'] === 'true' && process.env.NODE_ENV !== 'production') {
      req.user = {
        id: 'test-user',
        username: 'test',
        role: 'admin'
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Simple token validation (replace with actual JWT validation in production)
    const token = authHeader.substring(7);
    
    // Mock user data based on token (replace with actual token validation)
    if (token.startsWith('operator-')) {
      req.user = {
        id: 'operator-1',
        username: 'operator',
        role: 'operator'
      };
    } else if (token.startsWith('admin-')) {
      req.user = {
        id: 'admin-1',
        username: 'admin',
        role: 'admin'
      };
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication system error'
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization system error'
      });
    }
  };
};

/**
 * Optional authentication middleware (doesn't fail if no auth provided)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Mock user data based on token (replace with actual token validation)
      if (token.startsWith('operator-')) {
        req.user = {
          id: 'operator-1',
          username: 'operator',
          role: 'operator'
        };
      } else if (token.startsWith('admin-')) {
        req.user = {
          id: 'admin-1',
          username: 'admin',
          role: 'admin'
        };
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    // Don't fail the request for optional auth errors
    next();
  }
};

export default { requireOpsKey, requireAuth, requireRole, optionalAuth };

