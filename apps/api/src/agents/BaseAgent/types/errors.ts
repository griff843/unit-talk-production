export interface BaseAgentErrorData {
  message: string;
  agentName: string;
  context?: Record<string, unknown>;
  isRetryable: boolean;
}

export class BaseAgentError extends Error {
  public readonly agentName: string;
  public readonly context?: Record<string, unknown>;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    agentName: string,
    context?: Record<string, unknown>,
    isRetryable = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.agentName = agentName;
    this.context = context;
    this.isRetryable = isRetryable;
  }
}
