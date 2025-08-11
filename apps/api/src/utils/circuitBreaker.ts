interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

interface CircuitState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

export class CircuitBreaker {
  private states: Map<string, CircuitState>;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 60000
    };
    this.states = new Map();
  }

  private getOrCreateState(activityName: string): CircuitState {
    if (!this.states.has(activityName)) {
      this.states.set(activityName, {
        failures: 0,
        lastFailure: null,
        isOpen: false
      });
    }
    return this.states.get(activityName)!;
  }

  public isOpen(activityName: string): boolean {
    const state = this.getOrCreateState(activityName);
    
    if (!state.isOpen) {
      return false;
    }

    // Check if enough time has passed to attempt reset
    if (state.lastFailure && Date.now() - state.lastFailure >= this.config.resetTimeout) {
      state.isOpen = false;
      state.failures = 0;
      state.lastFailure = null;
      return false;
    }

    return true;
  }

  public recordSuccess(activityName: string): void {
    const state = this.getOrCreateState(activityName);
    state.failures = 0;
    state.lastFailure = null;
    state.isOpen = false;
  }

  public recordFailure(activityName: string): void {
    const state = this.getOrCreateState(activityName);
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.config.failureThreshold) {
      state.isOpen = true;
    }
  }

  public reset(activityName: string): void {
    this.states.set(activityName, {
      failures: 0,
      lastFailure: null,
      isOpen: false
    });
  }

  public getState(activityName: string): CircuitState {
    return { ...this.getOrCreateState(activityName) };
  }
} 