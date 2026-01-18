/**
 * Agent Instrumentation
 *
 * Provides metrics collection and instrumentation for agents.
 * Tracks processing cycles, latencies, and success/failure rates.
 *
 * @module AgentInstrumentation
 */

export interface CycleMetrics {
  startTime: number;
  endTime?: number;
  eventsProcessed: number;
  eventsFailed: number;
  latencyMs?: number;
}

export interface AggregatedMetrics {
  runCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  backlogSize: number;
  eventsProcessed: number;
  memoryUsageMb: number;
}

/**
 * Rolling window for latency percentile calculations
 */
class LatencyWindow {
  private latencies: number[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  add(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxSize) {
      this.latencies.shift();
    }
  }

  getAverage(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  getPercentile(percentile: number): number {
    if (this.latencies.length === 0) return 0;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  clear(): void {
    this.latencies = [];
  }
}

/**
 * Agent Instrumentation Service
 *
 * Provides metrics collection for agent observability.
 */
export class AgentInstrumentation {
  private agentId: string;
  private runCount: number = 0;
  private successCount: number = 0;
  private failureCount: number = 0;
  private eventsProcessed: number = 0;
  private eventsFailed: number = 0;
  private backlogSize: number = 0;
  private latencyWindow: LatencyWindow;
  private currentCycle: CycleMetrics | null = null;

  constructor(agentId: string, windowSize: number = 100) {
    this.agentId = agentId;
    this.latencyWindow = new LatencyWindow(windowSize);
  }

  /**
   * Start tracking a new processing cycle
   */
  startCycle(): CycleMetrics {
    this.currentCycle = {
      startTime: Date.now(),
      eventsProcessed: 0,
      eventsFailed: 0,
    };
    return this.currentCycle;
  }

  /**
   * End the current processing cycle
   */
  endCycle(success: boolean = true): CycleMetrics | null {
    if (!this.currentCycle) {
      return null;
    }

    this.currentCycle.endTime = Date.now();
    this.currentCycle.latencyMs = this.currentCycle.endTime - this.currentCycle.startTime;

    // Update aggregated metrics
    this.runCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }

    // Track latency
    this.latencyWindow.add(this.currentCycle.latencyMs);

    // Aggregate events
    this.eventsProcessed += this.currentCycle.eventsProcessed;
    this.eventsFailed += this.currentCycle.eventsFailed;

    const completedCycle = this.currentCycle;
    this.currentCycle = null;
    return completedCycle;
  }

  /**
   * Record events processed in current cycle
   */
  recordEventsProcessed(count: number): void {
    if (this.currentCycle) {
      this.currentCycle.eventsProcessed += count;
    }
  }

  /**
   * Record events failed in current cycle
   */
  recordEventsFailed(count: number): void {
    if (this.currentCycle) {
      this.currentCycle.eventsFailed += count;
    }
  }

  /**
   * Update backlog size
   */
  setBacklogSize(size: number): void {
    this.backlogSize = size;
  }

  /**
   * Get aggregated metrics for heartbeat reporting
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      runCount: this.runCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      avgLatencyMs: this.latencyWindow.getAverage(),
      p95LatencyMs: this.latencyWindow.getPercentile(95),
      backlogSize: this.backlogSize,
      eventsProcessed: this.eventsProcessed,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  /**
   * Get current cycle metrics (in-progress)
   */
  getCurrentCycleMetrics(): CycleMetrics | null {
    return this.currentCycle;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.runCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.eventsProcessed = 0;
    this.eventsFailed = 0;
    this.backlogSize = 0;
    this.latencyWindow.clear();
    this.currentCycle = null;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get run count
   */
  getRunCount(): number {
    return this.runCount;
  }

  /**
   * Get success count
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Factory function to create AgentInstrumentation instance
 */
export function createAgentInstrumentation(
  agentId: string,
  windowSize?: number
): AgentInstrumentation {
  return new AgentInstrumentation(agentId, windowSize);
}
