# Event-Driven Architecture - Kafka Backbone

## Diagram Specification

Shows the event streaming architecture with Kafka topics, consumer groups, and event flow patterns.

## Event Flow Architecture

```mermaid
graph TB
    subgraph "Event Producers"
        P1[API Service<br/>User Actions]
        P2[Smart Form<br/>Bet Slips]
        P3[Grading Agent<br/>Results]
        P4[External APIs<br/>Sportsbooks]
    end

    subgraph "Kafka Cluster (3 Brokers)"
        subgraph "Topics"
            T1[picks.created<br/>Partitions: 10<br/>Replication: 3]
            T2[picks.graded<br/>Partitions: 10<br/>Replication: 3]
            T3[injuries.detected<br/>Partitions: 5<br/>Replication: 3]
            T4[hedges.opportunity<br/>Partitions: 5<br/>Replication: 3]
            T5[alerts.triggered<br/>Partitions: 5<br/>Replication: 3]
        end
    end

    subgraph "Consumer Groups"
        CG1[grading-agent-group<br/>Instances: 10<br/>Processes picks.created]
        CG2[alert-agent-group<br/>Instances: 5<br/>Processes injuries/hedges]
        CG3[notification-service-group<br/>Instances: 3<br/>Processes alerts]
        CG4[analytics-service-group<br/>Instances: 2<br/>Processes all events]
    end

    subgraph "Event Consumers"
        C1[GradingAgent<br/>Temporal Workers]
        C2[AlertAgent<br/>Real-time Monitoring]
        C3[NotificationService<br/>Discord/Email]
        C4[AnalyticsService<br/>Data Warehouse]
    end

    P1 -->|Produce| T1
    P2 -->|Produce| T1
    P3 -->|Produce| T2
    P4 -->|Produce| T3

    T1 -->|Subscribe| CG1
    T2 -->|Subscribe| CG2
    T3 -->|Subscribe| CG2
    T3 -->|Subscribe| CG4

    CG1 -->|Consume| C1
    CG2 -->|Consume| C2
    CG3 -->|Consume| C3
    CG4 -->|Consume| C4

    C1 -->|Produce Result| T2
    C2 -->|Produce Alert| T5
    T5 -->|Subscribe| CG3

    style T1 fill:#e3f2fd
    style T2 fill:#e8f5e9
    style T3 fill:#fff3e0
    style T4 fill:#f3e5f5
    style T5 fill:#ffebee
```

## Event Schema (CloudEvents Standard)

```mermaid
classDiagram
    class CloudEvent {
        +String specversion = "1.0"
        +String type
        +String source
        +String id (UUID)
        +DateTime time
        +String datacontenttype
        +Object data
    }

    class PickCreatedEvent {
        +UUID pick_id
        +UUID user_id
        +UUID tenant_id
        +String player_name
        +String stat_type
        +Float line
        +String side (OVER/UNDER)
        +Float stake
        +Float odds
    }

    class PickGradedEvent {
        +UUID pick_id
        +UUID user_id
        +String result (WIN/LOSS/PUSH)
        +Float payout
        +Float actual_stat
        +String grade_reason
        +DateTime graded_at
    }

    class InjuryDetectedEvent {
        +String player_name
        +String team
        +String injury_type
        +String severity
        +DateTime detected_at
        +Array~UUID~ affected_picks
    }

    CloudEvent <|-- PickCreatedEvent
    CloudEvent <|-- PickGradedEvent
    CloudEvent <|-- InjuryDetectedEvent
```

## Event Processing Flow with Idempotency

```mermaid
sequenceDiagram
    participant Kafka as Kafka Topic
    participant Consumer as Consumer Instance
    participant DB as PostgreSQL
    participant DLQ as Dead Letter Queue

    Kafka->>Consumer: Poll Messages (batch of 100)

    loop For each message
        Consumer->>DB: SELECT event_id FROM processed_events

        alt Already Processed
            DB-->>Consumer: Found (event_id exists)
            Note over Consumer: Skip processing<br/>Log as duplicate
            Consumer->>Kafka: Commit offset
        else Not Processed
            DB-->>Consumer: Not found

            Consumer->>Consumer: Process Event

            alt Processing Success
                Consumer->>DB: BEGIN TRANSACTION
                Consumer->>DB: INSERT business data
                Consumer->>DB: INSERT processed_event (event_id)
                Consumer->>DB: COMMIT TRANSACTION
                Consumer->>Kafka: Commit offset
                Note over Consumer: ✅ Success
            else Processing Failure
                Consumer->>Consumer: Check retry count

                alt Retries < 3
                    Note over Consumer: Retry with backoff<br/>1s, 5s, 15s
                    Consumer->>Kafka: Do not commit offset
                else Max retries reached
                    Consumer->>DLQ: Send to DLQ
                    Consumer->>Kafka: Commit offset
                    Note over Consumer: ⚠️ Manual review needed
                end
            end
        end
    end
```

## Partition Strategy

```mermaid
graph LR
    subgraph "Partition by tenant_id"
        E1[Event: tenant_a] -->|hash tenant_a mod 10| P0[Partition 0]
        E2[Event: tenant_b] -->|hash tenant_b mod 10| P1[Partition 1]
        E3[Event: tenant_c] -->|hash tenant_c mod 10| P2[Partition 2]
        E4[Event: tenant_a] -->|hash tenant_a mod 10| P0
    end

    P0 --> C1[Consumer Instance 1]
    P1 --> C2[Consumer Instance 2]
    P2 --> C3[Consumer Instance 3]

    Note1[All events for tenant_a<br/>go to same partition<br/>= ordering guaranteed]
    Note2[Parallelism = 10 partitions<br/>= 10 concurrent consumers max]
```

**Why partition by tenant_id?**
- ✅ Guarantees ordering within a tenant (critical for picks)
- ✅ Even load distribution (assuming balanced tenant activity)
- ✅ Consumer affinity (same consumer processes same tenant)

## Failure Modes and Mitigation

```mermaid
graph TD
    Start[Event Processing]
    Start --> F1{Consumer Lag<br/>Increasing?}

    F1 -->|Yes| M1[Add Consumer Instances]
    F1 -->|No| F2{Poison Message<br/>Repeated Failures?}

    F2 -->|Yes| M2[Move to DLQ<br/>Manual Investigation]
    F2 -->|No| F3{Broker Outage?}

    F3 -->|Yes| M3[Failover to Replica<br/>ISR Automatic]
    F3 -->|No| F4{Partition Imbalance?}

    F4 -->|Yes| M4[Rebalance Partitions<br/>kafka-reassign-partitions]
    F4 -->|No| Success[✅ Healthy]

    style M1 fill:#e8f5e9
    style M2 fill:#fff3e0
    style M3 fill:#ffebee
    style M4 fill:#f3e5f5
    style Success fill:#c8e6c9
```

| Failure Mode | Detection Method | Mitigation Strategy | MTTR |
|--------------|------------------|---------------------|------|
| **Consumer Lag** | Kafka consumer lag metric >1000 | Add consumer instances (HPA) | 2 min |
| **Poison Message** | Same offset fails 3+ times | Move to DLQ, skip offset | 1 min |
| **Broker Outage** | Broker health check fails | Automatic ISR failover | 30 sec |
| **Partition Imbalance** | Throughput variance >50% | Manual rebalance | 10 min |
| **Schema Incompatibility** | Deserialization error | Schema registry version check | 5 min |

## Kafka Configuration Best Practices

```yaml
# Broker Configuration
num.partitions: 10  # Per topic
default.replication.factor: 3  # HA
min.insync.replicas: 2  # Write durability
log.retention.hours: 168  # 7 days
log.segment.bytes: 1073741824  # 1GB segments

# Producer Configuration
acks: all  # Wait for all replicas
compression.type: lz4  # Fast compression
max.in.flight.requests.per.connection: 5
enable.idempotence: true  # Prevent duplicates

# Consumer Configuration
enable.auto.commit: false  # Manual commit for safety
max.poll.records: 100  # Batch size
session.timeout.ms: 10000  # 10s heartbeat
max.poll.interval.ms: 300000  # 5min processing window
```

## Event Replay Capability

```typescript
// Replay events from specific timestamp
async function replayEvents(topic: string, fromTimestamp: Date) {
  const admin = kafka.admin();
  const consumer = kafka.consumer({ groupId: `replay-${Date.now()}` });

  await admin.connect();
  await consumer.connect();

  // Seek to timestamp
  await consumer.subscribe({ topic, fromBeginning: false });

  const partitions = await admin.fetchTopicOffsets(topic);

  for (const partition of partitions) {
    await consumer.seek({
      topic,
      partition: partition.partition,
      offset: partition.offset, // Or use timestamp: fromTimestamp
    });
  }

  // Process replayed events
  await consumer.run({
    eachMessage: async ({ message }) => {
      await processEvent(message);
    },
  });
}
```

## Monitoring Metrics

Key metrics to track for Kafka health:

```
# Broker Metrics
kafka_server_broker_topic_metrics_messages_in_total
kafka_server_broker_topic_metrics_bytes_in_total
kafka_server_replica_manager_under_replicated_partitions

# Consumer Metrics
kafka_consumer_group_lag
kafka_consumer_fetch_manager_records_consumed_total
kafka_consumer_coordinator_commit_latency_avg

# Producer Metrics
kafka_producer_record_send_total
kafka_producer_record_error_total
kafka_producer_compression_rate_avg
```

## Rendering Instructions

```bash
# Render event backbone diagrams
mmdc -i 04-event-backbone.md -o 04-event-backbone.png -w 2800 -H 2400 -b white
mmdc -i 04-event-backbone.md -o 04-event-backbone.svg -b white
```
