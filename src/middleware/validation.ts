import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errorHandling';
import { logger } from '../utils/logger';

export function validateSchema<T extends z.ZodType>(
  schema: T,
  location: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[location]);
      req[location] = data;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation failed:', {
          path: req.path,
          location,
          errors: error.errors,
        });
        
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      } else {
        next(error);
      }
    }
  };
}

export function validateMessage<T extends z.ZodType>(schema: T) {
  return async (message: unknown) => {
    try {
      return schema.parse(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError(`Message validation failed: ${JSON.stringify(errorDetails)}`);
      }
      throw error;
    }
  };
}

export function validateConfig<T extends z.ZodType>(schema: T) {
  return (config: unknown) => {
    try {
      return schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError(`Configuration validation failed: ${JSON.stringify(errorDetails)}`);
      }
      throw error;
    }
  };
}

export function validateEvent<T extends z.ZodType>(schema: T) {
  return async (event: unknown) => {
    try {
      return schema.parse(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError(`Event validation failed: ${JSON.stringify(errorDetails)}`);
      }
      throw error;
    }
  };
}

export function validateResponse<T extends z.ZodType>(schema: T) {
  return async (data: unknown) => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Response validation failed:', {
          errors: error.errors,
          data,
        });
        const errorDetails = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError(`Response validation failed: ${JSON.stringify(errorDetails)}`);
      }
      throw error;
    }
  };
} 