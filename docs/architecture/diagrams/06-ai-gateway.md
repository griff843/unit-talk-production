# AI Gateway and Vector Database Architecture

## Diagram Specification

Shows AI integration layer with LLM routing, vector database for RAG, and AI observability.

## AI Gateway Architecture

```mermaid
graph TB
    subgraph "Application Services"
        App1[API Service<br/>User Queries]
        App2[Grading Agent<br/>Insight Generation]
        App3[Alert Agent<br/>Analysis]
    end

    subgraph "AI Gateway Service"
        Gateway[AI Gateway<br/>Request Router]
        Cache[Semantic Cache<br/>Redis + Embeddings]
        RateLimit[Rate Limiter<br/>Per-tenant quotas]
        Fallback[Fallback Handler<br/>Circuit Breaker]
    end

    subgraph "LLM Providers"
        OpenAI[OpenAI API<br/>GPT-4, GPT-3.5]
        Anthropic[Anthropic API<br/>Claude 3]
        Local[Local Models<br/>Llama 3, Mistral]
    end

    subgraph "Vector Database (Qdrant)"
        Collection1[Props Collection<br/>Historical prop data]
        Collection2[Cappers Collection<br/>Capper profiles]
        Collection3[Games Collection<br/>Game results]
    end

    subgraph "Embedding Service"
        Embed[OpenAI Embeddings<br/>text-embedding-3-large]
    end

    subgraph "AI Observability"
        Metrics[Token Usage Tracking<br/>Cost per tenant]
        Latency[Latency Monitoring<br/>TTFT, TPS]
        Quality[Quality Metrics<br/>User feedback]
    end

    App1 --> Gateway
    App2 --> Gateway
    App3 --> Gateway

    Gateway --> Cache
    Cache -.->|Cache Miss| Gateway
    Gateway --> RateLimit
    RateLimit --> Fallback

    Fallback --> OpenAI
    Fallback --> Anthropic
    Fallback --> Local

    Gateway --> Collection1
    Gateway --> Collection2
    Gateway --> Collection3

    App1 --> Embed
    Embed --> Collection1

    OpenAI --> Metrics
    Anthropic --> Metrics
    Local --> Metrics

    Gateway --> Latency
    Gateway --> Quality

    style Gateway fill:#e3f2fd
    style Cache fill:#fff3e0
    style OpenAI fill:#e8f5e9
    style Anthropic fill:#f3e5f5
    style Collection1 fill:#ffebee
```

## RAG (Retrieval-Augmented Generation) Flow

```mermaid
sequenceDiagram
    participant User as User
    participant API as API Service
    participant Gateway as AI Gateway
    participant Embed as Embedding Service
    participant Qdrant as Vector DB (Qdrant)
    participant LLM as OpenAI GPT-4

    User->>API: "What's the best pick for tonight?"
    API->>Gateway: AI Request

    Note over Gateway: Step 1: Generate Query Embedding

    Gateway->>Embed: embed("best pick tonight")
    Embed-->>Gateway: [0.123, -0.456, ..., 0.789] (1536 dims)

    Note over Gateway: Step 2: Semantic Search

    Gateway->>Qdrant: vector_search(embedding, limit=10)
    Note over Qdrant: Search Props Collection<br/>Cosine similarity
    Qdrant-->>Gateway: Top 10 similar props + metadata

    Note over Gateway: Step 3: Context Construction

    Gateway->>Gateway: Build prompt with context
    Note over Gateway: Prompt Template:<br/>Context: {retrieved_props}<br/>Question: {user_query}<br/>Instructions: {system_prompt}

    Note over Gateway: Step 4: LLM Inference

    Gateway->>LLM: completion(prompt, max_tokens=500)
    Note over LLM: Generate response<br/>with retrieved context

    LLM-->>Gateway: Response + usage stats

    Note over Gateway: Step 5: Track Metrics

    Gateway->>Gateway: Log token usage, cost, latency

    Gateway-->>API: AI Response
    API-->>User: "Based on recent data, consider..."
```

## Semantic Caching

```mermaid
graph LR
    subgraph "Request Flow"
        Q1[Query: "Best NFL pick?"]
        Q2[Query: "Top NFL prop?"]
        Q3[Query: "What is 2+2?"]
    end

    subgraph "Embedding + Similarity Check"
        E1[Embed Query]
        Sim[Cosine Similarity<br/>>0.95 = Cache Hit]
    end

    subgraph "Cache (Redis + Qdrant)"
        Cache1[Cached: "Best NFL pick"<br/>Similarity: 0.97]
        Cache2[Cached: "2+2 answer"<br/>Similarity: 0.42]
    end

    subgraph "Decision"
        Hit[✅ Cache Hit<br/>Return cached response]
        Miss[❌ Cache Miss<br/>Call LLM]
    end

    Q1 --> E1
    Q2 --> E1
    Q3 --> E1

    E1 --> Sim
    Sim --> Cache1
    Sim --> Cache2

    Cache1 -.->|0.97 > 0.95| Hit
    Cache2 -.->|0.42 < 0.95| Miss

    style Hit fill:#e8f5e9
    style Miss fill:#ffebee
```

**Implementation**:
```typescript
async function semanticCache(query: string): Promise<string | null> {
  // 1. Generate embedding for query
  const embedding = await embedQuery(query);

  // 2. Search for similar cached queries
  const similar = await qdrant.search('cache', {
    vector: embedding,
    limit: 1,
    scoreThreshold: 0.95, // 95% similarity
  });

  if (similar.length > 0) {
    // Cache hit - return cached response
    logger.info('Semantic cache hit', { query, similarity: similar[0].score });
    return similar[0].payload.response;
  }

  // Cache miss
  return null;
}
```

## Multi-Provider Routing Strategy

```mermaid
graph TD
    Request[AI Request]
    Request --> Route{Route Decision}

    Route --> Cost{Cost-Sensitive?}
    Route --> Latency{Latency-Sensitive?}
    Route --> Quality{Quality-Critical?}

    Cost -->|Yes| GPT35[GPT-3.5 Turbo<br/>$0.50/1M tokens<br/>Fast, cheap]
    Latency -->|Yes| Local[Local Llama 3<br/>Free<br/>50ms latency]
    Quality -->|Yes| GPT4[GPT-4 Turbo<br/>$10/1M tokens<br/>Best quality]

    GPT35 --> Execute[Execute Request]
    Local --> Execute
    GPT4 --> Execute

    Execute --> Monitor{Health Check}
    Monitor -->|Fail| Fallback[Fallback Provider]
    Monitor -->|Success| Response[Return Response]

    Fallback --> GPT35
    Fallback --> Response

    style GPT35 fill:#fff3e0
    style Local fill:#e8f5e9
    style GPT4 fill:#e3f2fd
```

**Routing Configuration**:
```typescript
const routingRules = {
  // Low-stakes queries → cheap model
  summaries: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 200,
    temperature: 0.7,
  },

  // Real-time analysis → low latency
  liveAlerts: {
    provider: 'local',
    model: 'llama-3-8b',
    maxTokens: 150,
    temperature: 0.5,
  },

  // Strategic insights → high quality
  recommendations: {
    provider: 'openai',
    model: 'gpt-4-turbo',
    maxTokens: 500,
    temperature: 0.3,
  },
};
```

## Vector Database Schema

```mermaid
erDiagram
    PROPS_COLLECTION {
        uuid id PK
        string player_name
        string stat_type
        float line
        string sport
        date game_date
        vector embedding
    }

    CAPPERS_COLLECTION {
        uuid id PK
        string username
        string tier
        float win_rate
        int total_picks
        vector profile_embedding
    }

    GAMES_COLLECTION {
        uuid id PK
        string home_team
        string away_team
        int home_score
        int away_score
        date game_date
        vector game_embedding
    }

    PROPS_COLLECTION ||--o{ CAPPERS_COLLECTION : "picked_by"
    PROPS_COLLECTION ||--o{ GAMES_COLLECTION : "belongs_to"
```

**Qdrant Collection Configuration**:
```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

client = QdrantClient(url="http://qdrant:6333")

# Create props collection
client.create_collection(
    collection_name="props",
    vectors_config=VectorParams(
        size=1536,  # OpenAI text-embedding-3-large dimension
        distance=Distance.COSINE,
    ),
    optimizers_config={
        "indexing_threshold": 10000,  # Start indexing after 10k vectors
        "memmap_threshold": 50000,    # Use memory mapping for >50k
    },
)

# Create index for fast filtering
client.create_payload_index(
    collection_name="props",
    field_name="sport",
    field_schema="keyword",
)
```

## AI Cost Management Dashboard

```mermaid
pie title Token Usage by Use Case (Monthly)
    "Prop Grading Insights" : 35
    "Natural Language Queries" : 25
    "Injury Analysis" : 20
    "Recap Generation" : 15
    "Hedge Detection" : 5
```

**Cost Tracking Schema**:
```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  use_case VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  latency_ms INT NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_tenant_date ON ai_usage(tenant_id, created_at);
CREATE INDEX idx_ai_usage_model ON ai_usage(model);
```

**Cost Calculation**:
```typescript
const MODEL_PRICING = {
  'gpt-4-turbo': { input: 10.0, output: 30.0 },  // per 1M tokens
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'llama-3-8b': { input: 0.0, output: 0.0 },  // Free (self-hosted)
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
```

## AI Quality Metrics

```mermaid
graph LR
    subgraph "Quality Tracking"
        Response[AI Response]
        Feedback[User Feedback<br/>👍 👎]
        Score[Quality Score<br/>0-100]
    end

    subgraph "Metrics"
        Accuracy[Accuracy<br/>% correct]
        Relevance[Relevance<br/>User ratings]
        Latency[Latency<br/>TTFT, TPS]
        Cost[Cost Efficiency<br/>$/1k requests]
    end

    Response --> Feedback
    Feedback --> Score

    Score --> Accuracy
    Score --> Relevance
    Score --> Latency
    Score --> Cost

    style Score fill:#e8f5e9
```

**Quality Monitoring**:
```typescript
// Track user feedback
async function trackAIQuality(
  requestId: string,
  feedback: 'positive' | 'negative',
  reason?: string
) {
  await db.query(
    `INSERT INTO ai_quality_feedback
     (request_id, feedback, reason, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [requestId, feedback, reason]
  );

  // Calculate rolling quality score
  const qualityScore = await db.query(`
    SELECT
      COUNT(CASE WHEN feedback = 'positive' THEN 1 END)::float /
      COUNT(*)::float * 100 AS score
    FROM ai_quality_feedback
    WHERE created_at > NOW() - INTERVAL '7 days'
  `);

  // Alert if quality drops below threshold
  if (qualityScore.rows[0].score < 80) {
    await alerting.send({
      severity: 'warning',
      message: `AI quality score dropped to ${qualityScore.rows[0].score}%`,
    });
  }
}
```

## Prompt Management

```mermaid
graph TB
    subgraph "Prompt Library"
        P1[Prop Analysis Prompt<br/>Version: v2.1]
        P2[Injury Impact Prompt<br/>Version: v1.5]
        P3[Recap Generation Prompt<br/>Version: v3.0]
    end

    subgraph "Prompt Engineering"
        Test[A/B Testing<br/>Compare versions]
        Eval[Evaluation Metrics<br/>Quality, cost, latency]
        Winner[Select Winner]
    end

    subgraph "Deployment"
        Deploy[Deploy to Production]
        Rollback[Rollback if needed]
    end

    P1 --> Test
    P2 --> Test
    P3 --> Test

    Test --> Eval
    Eval --> Winner
    Winner --> Deploy
    Deploy --> Rollback

    style Winner fill:#e8f5e9
    style Rollback fill:#ffebee
```

**Prompt Versioning**:
```typescript
const PROMPTS = {
  propAnalysis: {
    v1: `Analyze this prop: {prop_details}`,
    v2: `As a sports analyst, evaluate this prop bet: {prop_details}. Consider historical data and recent performance.`,
    v2.1: `You are an expert sports betting analyst. Analyze this prop bet in detail:

Player: {player_name}
Stat: {stat_type}
Line: {line}
Odds: {odds}

Historical context: {historical_data}

Provide a concise analysis (100 words) covering:
1. Player's recent performance
2. Matchup factors
3. Value assessment`,
    current: 'v2.1',  // Active version
  },
};
```

## Circuit Breaker for AI Services

```mermaid
stateDiagram-v2
    [*] --> Closed: Healthy State

    Closed --> Open: 50% failures<br/>in 1 minute
    Open --> HalfOpen: 30 seconds<br/>timeout
    HalfOpen --> Closed: 3 consecutive<br/>successes
    HalfOpen --> Open: Any failure

    Closed: Normal Operation<br/>Route to primary LLM
    Open: Circuit Open<br/>Return cached data<br/>or fallback response
    HalfOpen: Testing Recovery<br/>Send limited traffic
```

**Implementation**:
```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 30000,  // 30s timeout for LLM calls
  errorThresholdPercentage: 50,  // Open circuit at 50% errors
  resetTimeout: 30000,  // Try to close after 30s
};

const breaker = new CircuitBreaker(callLLM, options);

breaker.fallback(() => {
  // Return cached response or generic message
  return getCachedAIResponse() || {
    response: "AI service temporarily unavailable. Please try again.",
    cached: true,
  };
});

breaker.on('open', () => {
  logger.error('AI circuit breaker opened - falling back to cache');
  alerting.send({
    severity: 'critical',
    message: 'AI service circuit breaker OPEN',
  });
});
```

## Rendering Instructions

```bash
# Render AI gateway diagrams
mmdc -i 06-ai-gateway.md -o 06-ai-gateway.png -w 2800 -H 2400 -b white
mmdc -i 06-ai-gateway.md -o 06-ai-gateway.svg -b white
```

## AI Service SLOs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.5% | Uptime |
| **Latency (p95)** | <2s | Time to first token |
| **Latency (p99)** | <5s | Full response |
| **Error Rate** | <1% | Failed requests |
| **Cache Hit Rate** | >60% | Semantic cache |
| **Quality Score** | >85% | User feedback |
| **Cost Efficiency** | <$0.10/request | Average cost |
