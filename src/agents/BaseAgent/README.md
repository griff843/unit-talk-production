# BaseAgent

The BaseAgent is the foundation for all agents in the Unit Talk platform. It provides core functionality for agent lifecycle management, error handling, health monitoring, and metrics collection.

## Features

- Lifecycle management (initialize, process, cleanup)
- Error handling with configurable retry logic
- Health monitoring
- Metrics collection
- Event emission for monitoring
- Type-safe configuration validation

## Usage

Extend the BaseAgent class to create a new agent:

```typescript
import { BaseAgent } from '../BaseAgent';
import { YourAgentConfig } from './types';

export class YourAgent extends BaseAgent {
  constructor(
    config: YourAgentConfig,
    supabase: SupabaseClient,
    errorConfig: ErrorHandlerConfig
  ) {
    super(config, supabase, errorConfig);
  }

  protected async initialize(): Promise<void> {
    // Initialize your agent
  }

  protected async process(): Promise<void> {
    // Main processing logic
  }

  protected async cleanup(): Promise<void> {
    // Cleanup resources
  }

  protected async healthCheck(): Promise<HealthStatus> {
    // Implement health checks
    return {
      status: 'ok',
      details: {
        // Your health metrics
      }
    };
  }
}
```

## Configuration

The BaseAgent accepts the following configuration:

```typescript
interface BaseAgentConfig {
  agentName: string;
  enabled: boolean;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
}
```

## Error Handling

The BaseAgent implements exponential backoff retry logic:

```typescript
interface ErrorHandlerConfig {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  shouldRetry: (error: Error) => boolean;
}
```

## Metrics

Basic metrics collected for all agents:

```typescript
interface BaseMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  lastRunAt?: Date;
  processingTimeMs: number;
  memoryUsageMb: number;
}
```

## Events

The BaseAgent emits the following events:
- 'health': Health check results
- 'error': Error events
- 'metrics': Metrics updates

## Best Practices

1. Always call super() in your agent's constructor
2. Implement proper cleanup in the cleanup() method
3. Use the provided error handling mechanisms
4. Emit appropriate events for monitoring
5. Implement comprehensive health checks
6. Use type-safe configurations 