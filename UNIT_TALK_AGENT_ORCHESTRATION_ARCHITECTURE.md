# Unit Talk Agent Orchestration Architecture
## Comprehensive Agent Coordination & Dependency Management Design

**Author**: Agent Orchestration Designer
**Date**: September 2025
**System**: Unit Talk Betting Intelligence Platform
**Architecture Level**: Fortune 100 Enterprise Grade

---

## 🎯 Executive Summary

This document provides a comprehensive agent orchestration architecture for the Unit Talk betting intelligence system, designed to optimize the Enhanced45Factor scoring pipeline, manage complex dependencies, and ensure sub-second alert delivery for a professional betting platform.

### Key Metrics & SLAs
- **Primary Flow SLA**: FeedAgent → ScoringAgent → Command Center → Discord in <120 seconds
- **Critical Alerts**: Steam detection and S-tier picks in <30 seconds
- **System Uptime**: 99.9% with graceful degradation
- **Throughput**: 1000+ props/day through Enhanced45Factor system

---

## 🏗️ Current System Analysis

### Architecture Overview
```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│  FeedAgent  │───▶│ ScoringAgent │───▶│ Command Center│───▶│ AlertAgent  │
│             │    │              │    │               │    │             │
│ Cache-First │    │Enhanced45    │    │ Approval      │    │ Discord     │
│ Ingestion   │    │Factor (195)  │    │ Workflow      │    │ Posting     │
└─────────────┘    └──────────────┘    └───────────────┘    └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Supabase v3.0.0 Database                           │
│                       unified_picks table                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Identified Orchestration Gaps

1. **Dependency Resolution**: No centralized coordination of agent dependencies
2. **Resource Contention**: Shared services (CacheFirstUnifiedPicksService, Supabase) lack coordination
3. **Priority Management**: No priority-based execution for time-sensitive picks
4. **Race Conditions**: Multiple agents accessing unified_picks simultaneously
5. **Fallback Coordination**: Individual circuit breakers without cross-agent coordination

---

## 🎭 Orchestration Design Patterns

### 1. Master Orchestration Agent

#### OrchestrationAgent Architecture
```typescript
export class OrchestrationAgent extends BaseAgent {
  private priorityQueue: PriorityExecutionEngine;
  private resourceManager: ResourceAllocationManager;
  private dependencyResolver: DependencyResolutionEngine;
  private resilienceCoordinator: ResilienceCoordinator;
  private temporalClient: TemporalClient;
}
```

#### Core Responsibilities
- **Dependency Chain Management**: Coordinate FeedAgent → ScoringAgent → Command Center → Discord flow
- **Priority-Based Execution**: Route S-tier picks through priority lanes
- **Resource Allocation**: Manage access to shared services and external APIs
- **Failure Coordination**: Orchestrate fallbacks and recovery across all agents
- **Performance Monitoring**: Track SLAs and trigger optimization workflows

### 2. Priority-Based Execution Framework

#### Priority Levels
```typescript
enum ExecutionPriority {
  CRITICAL = 0,    // Steam alerts, S-tier picks - <30s SLA
  HIGH = 1,        // A-tier picks, live games starting <2hrs - <60s SLA
  NORMAL = 2,      // B-tier picks, standard processing - <120s SLA
  LOW = 3,         // Analytics, backfill, reporting - no SLA
  BACKGROUND = 4   // Maintenance, optimization - opportunistic
}
```

#### Priority Queue Implementation
```typescript
interface PriorityExecutionEngine {
  enqueue(task: AgentTask, priority: ExecutionPriority): Promise<void>;
  dequeue(): Promise<AgentTask | null>;

  // Resource-aware scheduling
  scheduleWithResources(task: AgentTask, resources: ResourceRequirement[]): Promise<void>;

  // SLA monitoring
  trackSLA(taskId: string, startTime: Date, sla: number): void;
  getSLAViolations(): SLAViolation[];
}
```

### 3. Resource Allocation & Coordination

#### Shared Resource Management
```typescript
interface ResourceAllocationManager {
  // Database connection pooling
  acquireDatabase(priority: ExecutionPriority): Promise<DatabaseConnection>;
  releaseDatabase(connection: DatabaseConnection): void;

  // Cache coordination with distributed locking
  acquireCacheLock(key: string, ttl: number): Promise<CacheLock>;
  releaseCacheLock(lock: CacheLock): Promise<void>;

  // External API quota management
  reserveAPICredits(service: 'odds-api' | 'optimal-api', credits: number): Promise<boolean>;
  consumeAPICredits(service: string, credits: number): void;

  // Discord rate limiting coordination
  acquireDiscordSlot(): Promise<DiscordSlot>;
  releaseDiscordSlot(slot: DiscordSlot): void;
}
```

#### Resource Contention Resolution
- **Database Access**: Row-level locking with priority-based queue
- **Cache Operations**: Distributed locks with Redis coordination
- **API Quotas**: Credit reservation system with rollback on failure
- **Discord Rate Limits**: Token bucket with agent coordination

---

## 🔄 Dependency Resolution Engine

### Agent Dependency Map
```typescript
const AGENT_DEPENDENCIES: DependencyMap = {
  FeedAgent: {
    triggers: ['ScoringAgent'],
    dependencies: ['external-apis', 'cache-service'],
    sla: 90000, // 90 seconds
    priority: ExecutionPriority.HIGH
  },

  ScoringAgent: {
    triggers: ['CommandCenter'],
    dependencies: ['FeedAgent', 'database', 'enhanced45factor-engine'],
    sla: 60000, // 60 seconds
    priority: ExecutionPriority.HIGH
  },

  CommandCenter: {
    triggers: ['AlertAgent'],
    dependencies: ['ScoringAgent', 'approval-workflow'],
    sla: 30000, // 30 seconds
    priority: ExecutionPriority.NORMAL
  },

  AlertAgent: {
    triggers: ['discord-posting'],
    dependencies: ['CommandCenter', 'discord-api'],
    sla: 30000, // 30 seconds
    priority: ExecutionPriority.CRITICAL
  }
};
```

### Dependency Resolution Algorithm
```typescript
interface DependencyResolutionEngine {
  // Topological sorting for execution order
  resolveExecutionOrder(agents: Agent[]): Agent[];

  // Dependency health checking
  checkDependencyHealth(agent: Agent): Promise<HealthStatus>;

  // Automatic trigger coordination
  triggerDownstreamAgents(sourceAgent: Agent, results: AgentResults): Promise<void>;

  // Circular dependency detection
  detectCircularDependencies(): DependencyViolation[];
}
```

---

## 🛡️ Synchronization Patterns

### 1. Database-Level Coordination

#### Optimistic Concurrency Pattern
```sql
-- unified_picks table with version field
ALTER TABLE unified_picks ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE unified_picks
SET
  professional_score = $1,
  updated_at = NOW(),
  version = version + 1
WHERE
  id = $2
  AND version = $3;
```

#### Event-Driven Triggers
```typescript
// Replace polling with Supabase real-time subscriptions
const pickSubscription = supabase
  .channel('unified_picks_changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'unified_picks',
    filter: 'workflow_stage=eq.scored'
  }, (payload) => {
    orchestrationAgent.triggerCommandCenterWorkflow(payload.new);
  })
  .subscribe();
```

### 2. Distributed Cache Coordination

#### Cache Lock Implementation
```typescript
class DistributedCacheLock {
  async acquireLock(key: string, ttl: number): Promise<CacheLock> {
    const lockKey = `lock:${key}`;
    const lockValue = randomUUID();

    const acquired = await redis.set(
      lockKey,
      lockValue,
      'PX', ttl,
      'NX'
    );

    if (!acquired) {
      throw new LockAcquisitionError('Cache lock already held');
    }

    return new CacheLock(lockKey, lockValue, ttl);
  }

  async releaseLock(lock: CacheLock): Promise<void> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    await redis.eval(script, 1, lock.key, lock.value);
  }
}
```

### 3. Workflow State Synchronization

#### Temporal Signals for Agent Communication
```typescript
@temporalWorkflow
export async function masterOrchestrationWorkflow(params: OrchestrationParams): Promise<void> {
  // Initialize workflow state
  const state = await initializeWorkflowState(params);

  // Execute dependency chain with signals
  const feedResult = await executeWithSignal(feedActivities.processFeed, state.feedParams);

  const scoringSignal = await sendSignal('scoring-ready', {
    picks: feedResult.picks,
    priority: determinePriority(feedResult.picks)
  });

  const scoringResult = await executeWithSignal(
    gradingActivities.scorePicksBatch,
    { ...state.scoringParams, signal: scoringSignal }
  );

  // Continue chain...
}
```

---

## ⚡ Error Handling & Retry Orchestration

### 1. Cascading Failure Prevention

#### Circuit Breaker Coordination
```typescript
interface ResilienceCoordinator {
  // Cross-service circuit breaker monitoring
  monitorCircuitBreakerStates(): Promise<CircuitBreakerStatus[]>;

  // Coordinated fallback activation
  activateFallbackChain(failedService: string): Promise<FallbackResult>;

  // Service dependency impact analysis
  analyzeFailureImpact(failedService: string): Promise<ImpactAnalysis>;

  // Recovery coordination
  coordinateServiceRecovery(service: string): Promise<RecoveryResult>;
}
```

#### Service Degradation Levels
```typescript
enum DegradationLevel {
  NONE = 0,           // Full functionality
  GRACEFUL = 1,       // Skip non-critical features, use cache
  FALLBACK = 2,       // Use backup services, basic functionality
  EMERGENCY = 3,      // Essential operations only
  MAINTENANCE = 4     // Queue operations for later processing
}

class DegradationManager {
  async applyDegradation(level: DegradationLevel): Promise<void> {
    switch(level) {
      case DegradationLevel.GRACEFUL:
        await this.disableNonCriticalFeatures();
        await this.increaseCacheUsage();
        break;

      case DegradationLevel.FALLBACK:
        await this.activateBackupServices();
        await this.simplifyProcessing();
        break;

      case DegradationLevel.EMERGENCY:
        await this.essentialOperationsOnly();
        await this.queueNonEssentialWork();
        break;
    }
  }
}
```

### 2. Retry Strategies with Backoff

#### Temporal-Coordinated Retries
```typescript
const RETRY_POLICIES: Record<Agent, RetryPolicy> = {
  FeedAgent: {
    initialInterval: '5 seconds',
    maximumInterval: '2 minutes',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    nonRetryableErrorTypes: ['QuotaExceededError']
  },

  ScoringAgent: {
    initialInterval: '2 seconds',
    maximumInterval: '30 seconds',
    backoffCoefficient: 1.5,
    maximumAttempts: 5,
    nonRetryableErrorTypes: ['InvalidPickDataError']
  },

  AlertAgent: {
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 10, // Critical for Discord delivery
    nonRetryableErrorTypes: []
  }
};
```

### 3. Idempotency Patterns

#### Idempotent Operation Design
```typescript
interface IdempotentOperation {
  operationId: string;
  idempotencyKey: string;
  retryCount: number;
  lastAttempt: Date;
  result?: OperationResult;
}

class IdempotencyManager {
  async executeIdempotent<T>(
    operation: () => Promise<T>,
    idempotencyKey: string
  ): Promise<T> {
    // Check if operation already completed
    const existing = await this.getOperation(idempotencyKey);
    if (existing?.result) {
      return existing.result as T;
    }

    // Execute with deduplication
    const operationId = randomUUID();
    await this.recordOperationStart(operationId, idempotencyKey);

    try {
      const result = await operation();
      await this.recordOperationSuccess(operationId, result);
      return result;
    } catch (error) {
      await this.recordOperationFailure(operationId, error);
      throw error;
    }
  }
}
```

---

## 🕐 Timing & Synchronization Windows

### 1. Critical Path Optimization

#### SLA-Based Scheduling
```typescript
interface TimingCoordinator {
  // Calculate critical path through agent dependency chain
  calculateCriticalPath(picks: Pick[]): Promise<CriticalPath>;

  // Schedule execution to meet SLAs
  scheduleForSLA(tasks: AgentTask[], targetSLA: number): Promise<Schedule>;

  // Monitor timing violations and adjust
  monitorSLACompliance(): Promise<SLAMetrics>;

  // Dynamic scheduling based on system load
  adaptiveScheduling(systemLoad: SystemLoad): Promise<void>;
}
```

#### Timing Windows by Priority
```typescript
const TIMING_WINDOWS: Record<ExecutionPriority, TimingWindow> = {
  [ExecutionPriority.CRITICAL]: {
    maxLatency: 30000,      // 30 seconds end-to-end
    agentTimeouts: {
      FeedAgent: 10000,     // 10 seconds
      ScoringAgent: 8000,   // 8 seconds
      CommandCenter: 5000,  // 5 seconds
      AlertAgent: 7000      // 7 seconds
    }
  },

  [ExecutionPriority.HIGH]: {
    maxLatency: 60000,      // 1 minute end-to-end
    agentTimeouts: {
      FeedAgent: 20000,     // 20 seconds
      ScoringAgent: 15000,  // 15 seconds
      CommandCenter: 10000, // 10 seconds
      AlertAgent: 15000     // 15 seconds
    }
  },

  [ExecutionPriority.NORMAL]: {
    maxLatency: 120000,     // 2 minutes end-to-end
    agentTimeouts: {
      FeedAgent: 45000,     // 45 seconds
      ScoringAgent: 30000,  // 30 seconds
      CommandCenter: 20000, // 20 seconds
      AlertAgent: 25000     // 25 seconds
    }
  }
};
```

### 2. Temporal Workflow Coordination

#### Master Orchestration Workflow
```typescript
@temporalWorkflow
export async function unitTalkOrchestrationWorkflow(
  params: OrchestrationWorkflowParams
): Promise<OrchestrationResult> {

  const { picks, priority } = params;
  const timingWindow = TIMING_WINDOWS[priority];

  // Phase 1: Feed Ingestion (with timeout)
  const feedResult = await Promise.race([
    feedActivities.processFeed({ picks }),
    sleep(timingWindow.agentTimeouts.FeedAgent).then(() => {
      throw new TimeoutError('FeedAgent exceeded SLA');
    })
  ]);

  // Phase 2: Enhanced45Factor Scoring (parallel batches)
  const scoringBatches = chunkArray(feedResult.picks, 100);
  const scoringResults = await Promise.all(
    scoringBatches.map(batch =>
      Promise.race([
        gradingActivities.scorePicksBatch({ picks: batch }),
        sleep(timingWindow.agentTimeouts.ScoringAgent).then(() => {
          throw new TimeoutError('ScoringAgent exceeded SLA');
        })
      ])
    )
  );

  // Phase 3: Command Center Approval (conditional)
  const approvalTasks = scoringResults
    .flat()
    .filter(pick => pick.tier === 'S' || pick.tier === 'A')
    .map(pick =>
      Promise.race([
        approvalActivities.processApproval({ pick }),
        sleep(timingWindow.agentTimeouts.CommandCenter).then(() => {
          // Auto-approve on timeout for high-priority picks
          return { pick, status: 'auto-approved', reason: 'timeout' };
        })
      ])
    );

  const approvalResults = await Promise.all(approvalTasks);

  // Phase 4: Alert Distribution (immediate)
  const approvedPicks = approvalResults.filter(r => r.status.includes('approved'));
  await Promise.all(
    approvedPicks.map(result =>
      Promise.race([
        alertActivities.sendDiscordAlert({ pick: result.pick }),
        sleep(timingWindow.agentTimeouts.AlertAgent).then(() => {
          // Queue for retry on timeout
          return queueActivities.scheduleRetry({ pick: result.pick });
        })
      ])
    )
  );

  return {
    totalPicks: picks.length,
    processed: scoringResults.flat().length,
    approved: approvedPicks.length,
    alerts: approvedPicks.length,
    endToEndLatency: Date.now() - params.startTime,
    slaCompliant: (Date.now() - params.startTime) <= timingWindow.maxLatency
  };
}
```

---

## 📊 Monitoring & Observability

### 1. Orchestration Metrics

#### Key Performance Indicators
```typescript
interface OrchestrationMetrics {
  // SLA Compliance
  slaCompliance: {
    critical: number;    // Percentage of critical picks meeting <30s SLA
    high: number;        // Percentage of high picks meeting <60s SLA
    normal: number;      // Percentage of normal picks meeting <120s SLA
  };

  // Throughput Metrics
  throughput: {
    picksPerMinute: number;
    endToEndLatency: {
      p50: number;
      p95: number;
      p99: number;
    };
  };

  // Resource Utilization
  resourceUtilization: {
    databaseConnections: number;
    cacheHitRatio: number;
    apiQuotaUsage: Record<string, number>;
    discordRateLimit: number;
  };

  // Error Rates
  errorRates: {
    agentFailures: Record<string, number>;
    circuitBreakerTrips: number;
    retryAttempts: number;
    fallbackActivations: number;
  };
}
```

#### Real-Time Dashboards
```typescript
class OrchestrationDashboard {
  async getSystemHealth(): Promise<SystemHealthStatus> {
    return {
      overallHealth: await this.calculateOverallHealth(),
      agentStatus: await this.getAgentStatuses(),
      dependencyHealth: await this.getDependencyHealth(),
      resourceStatus: await this.getResourceStatus(),
      alerts: await this.getActiveAlerts()
    };
  }

  async getSLAMetrics(): Promise<SLADashboard> {
    return {
      currentSLACompliance: await this.getCurrentSLACompliance(),
      slaViolations: await this.getRecentSLAViolations(),
      trendAnalysis: await this.getSLATrends(),
      predictedViolations: await this.predictSLAViolations()
    };
  }
}
```

### 2. Alerting & Escalation

#### Alert Hierarchy
```typescript
enum AlertSeverity {
  INFO = 0,
  WARNING = 1,
  ERROR = 2,
  CRITICAL = 3,
  EMERGENCY = 4
}

interface AlertDefinition {
  name: string;
  severity: AlertSeverity;
  condition: string;
  escalationPolicy: EscalationPolicy;
  autoRemediation?: AutoRemediationAction;
}

const ORCHESTRATION_ALERTS: AlertDefinition[] = [
  {
    name: 'SLA_VIOLATION_CRITICAL',
    severity: AlertSeverity.CRITICAL,
    condition: 'slaCompliance.critical < 95%',
    escalationPolicy: 'immediate-ops-team',
    autoRemediation: 'increase-priority-resources'
  },

  {
    name: 'AGENT_CASCADE_FAILURE',
    severity: AlertSeverity.EMERGENCY,
    condition: 'agentFailures.consecutive > 3',
    escalationPolicy: 'escalate-to-engineering',
    autoRemediation: 'activate-emergency-mode'
  },

  {
    name: 'RESOURCE_EXHAUSTION',
    severity: AlertSeverity.ERROR,
    condition: 'resourceUtilization > 90%',
    escalationPolicy: 'ops-team-notification',
    autoRemediation: 'scale-resources'
  }
];
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. **Create OrchestrationAgent base structure**
   - Extend BaseAgent with orchestration capabilities
   - Implement priority queue with basic scheduling
   - Add resource allocation manager skeleton

2. **Database coordination improvements**
   - Add version field to unified_picks table
   - Implement optimistic concurrency control
   - Set up real-time subscriptions for event-driven triggers

3. **Basic Temporal workflow coordination**
   - Create master orchestration workflow
   - Implement simple dependency chain execution
   - Add timeout handling with fallbacks

### Phase 2: Resource Management (Week 3-4)
1. **Distributed locking system**
   - Implement Redis-based cache coordination
   - Add database connection pooling with priority
   - Create API quota reservation system

2. **Enhanced circuit breaker coordination**
   - Extend existing circuit breakers with cross-agent coordination
   - Implement degradation level management
   - Add automatic fallback chain activation

3. **Priority-based execution engine**
   - Implement priority queues with SLA tracking
   - Add resource-aware scheduling
   - Create dynamic priority adjustment based on system load

### Phase 3: Advanced Orchestration (Week 5-6)
1. **Idempotency framework**
   - Implement operation deduplication
   - Add retry coordination across agents
   - Create state recovery mechanisms

2. **Comprehensive monitoring**
   - Build orchestration metrics collection
   - Create real-time dashboards
   - Implement predictive alerting

3. **Performance optimization**
   - Add intelligent caching strategies
   - Implement adaptive scheduling algorithms
   - Create auto-scaling triggers

### Phase 4: Production Hardening (Week 7-8)
1. **Stress testing and validation**
   - Load testing with production-level traffic
   - Chaos engineering for failure scenarios
   - Performance benchmarking

2. **Documentation and training**
   - Create operational runbooks
   - Document troubleshooting procedures
   - Train operations team on new orchestration features

3. **Gradual rollout**
   - Canary deployment with monitoring
   - Gradual traffic migration
   - Performance validation in production

---

## 🎯 Success Metrics

### Performance Targets
- **End-to-End Latency**: <120 seconds for 95% of picks
- **Critical Alert Latency**: <30 seconds for steam alerts and S-tier picks
- **System Uptime**: 99.9% with <5 minutes MTTR
- **SLA Compliance**: >95% for all priority levels

### Operational Metrics
- **Resource Utilization**: <80% average across all shared resources
- **Error Rate**: <1% for orchestrated workflows
- **Fallback Activation**: <5% of all operations
- **Recovery Time**: <60 seconds for automated recovery

### Business Impact
- **Alert Delivery Reliability**: >99% successful Discord posting
- **Enhanced45Factor Processing**: 1000+ props/day through full pipeline
- **Operational Efficiency**: 50% reduction in manual intervention
- **System Reliability**: Zero data loss during failures

---

## 🔗 Integration Points

### External Systems
- **Temporal Cloud**: Workflow orchestration and state management
- **Redis Cluster**: Distributed locking and cache coordination
- **Supabase**: Database with real-time subscriptions
- **Discord API**: Alert delivery with rate limiting
- **Prometheus/Grafana**: Metrics collection and visualization

### Unit Talk Services
- **CacheFirstUnifiedPicksService**: Coordinated cache operations
- **Enhanced45FactorEngine**: Priority-based scoring coordination
- **ProfessionalPropProcessor**: Resource-managed processing
- **CircuitBreakerService**: Cross-agent failure coordination

### Development Tools
- **TypeScript**: Type-safe orchestration interfaces
- **Docker**: Containerized agent deployment
- **Jest**: Comprehensive testing framework
- **ESLint**: Code quality and orchestration patterns

---

## 🔒 Security & Compliance

### Security Considerations
- **Resource Access Control**: Role-based access to orchestration features
- **API Key Management**: Secure credential rotation for external services
- **Audit Logging**: Complete audit trail of orchestration decisions
- **Rate Limiting**: Protection against resource exhaustion attacks

### Compliance Requirements
- **Data Privacy**: GDPR-compliant data handling in orchestration
- **Financial Regulations**: Audit trails for betting intelligence decisions
- **Operational Security**: SOC 2 compliance for system operations
- **Disaster Recovery**: RTO <1 hour, RPO <15 minutes

---

## 📚 Reference Architecture

This orchestration design follows Fortune 100 enterprise patterns:

1. **Microservices Orchestration**: Netflix/Uber patterns for service coordination
2. **Event-Driven Architecture**: Amazon/LinkedIn patterns for scalable event processing
3. **Circuit Breaker Patterns**: Hystrix/resilience4j patterns for fault tolerance
4. **Priority Scheduling**: Google Borg/Kubernetes patterns for resource management
5. **Temporal Workflows**: Uber Cadence/Temporal patterns for reliable orchestration

The architecture ensures the Unit Talk platform operates at syndicate-level performance standards while maintaining enterprise-grade reliability and observability.

---

**Document Version**: 1.0
**Last Updated**: September 2025
**Next Review**: Monthly architecture review