import pino from 'pino';

// SPRINT-SCHEMA-ENV-GATES-002: Lazy logger initialization
let _logger: pino.Logger | null = null;
function getLogger(): pino.Logger {
  if (!_logger) {
    const isDev = process.env['NODE_ENV'] !== 'production';
    _logger = isDev
      ? pino({
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        })
      : pino();
  }
  return _logger;
}

// Export a getter that returns the actual pino.Logger for proper typing
export const logger: pino.Logger = new Proxy({} as pino.Logger, {
  get(_target, prop: keyof pino.Logger) {
    return (getLogger() as any)[prop];
  },
});

export function logAgentEvent(agent: string, msg: string, meta?: Record<string, unknown>) {
  logger.info({ agent, ...meta }, msg);
}

export function logAgentError(agent: string, err: Error | unknown, meta?: Record<string, unknown>) {
  logger.error({ agent, error: err, ...meta }, 'Agent error');
}
