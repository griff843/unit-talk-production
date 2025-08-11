import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = isDev
  ? pino({
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    })
  : pino();

export function logAgentEvent(agent: string, msg: string, meta?: Record<string, unknown>) {
  logger.info({ agent, ...meta }, msg);
}

export function logAgentError(agent: string, err: Error | unknown, meta?: Record<string, unknown>) {
  logger.error({ agent, error: err, ...meta }, 'Agent error');
}
