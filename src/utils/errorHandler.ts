import { logger } from '../services/logging';

export function handleError(error: unknown, context = '') {
  logger.error({ error, context }, `Error: ${context}`);
}
