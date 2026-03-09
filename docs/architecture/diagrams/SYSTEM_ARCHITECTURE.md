# System Architecture

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-LOCK-041C

---

## Runtime Services & Infrastructure

```mermaid
flowchart LR
    subgraph External
        OddsAPI[The Odds API]
        OptimalAPI[Optimal API]
        DiscordAPI[Discord API]
        OpenAI[OpenAI API]
    end

    subgraph Frontends
        SmartForm[Smart Form\nport 3021]
        CommandCenter[Command Center\nport 3004]
        Dashboard[Dashboard\nport 3003]
    end

    subgraph Core["Core Runtime"]
        API[API Service\nport 3010]
        Worker[Temporal Worker]
        DiscordBot[Discord Bot]
    end

    subgraph Infrastructure
        Supabase[(Supabase\nPostgreSQL)]
        Redis[(Redis\nport 6379)]
        Temporal[(Temporal\nport 7233)]
    end

    subgraph Monitoring
        Prometheus[Prometheus\nport 9090]
        Grafana[Grafana\nport 3001]
    end

    SmartForm -- "bridge_outbox\ninserts" --> Supabase
    CommandCenter -- "read-only" --> Supabase
    Dashboard -- "read-only" --> Supabase

    API -- "lifecycle adapters" --> Supabase
    API -- "cache" --> Redis
    API --> Temporal

    Worker -- "activities" --> Supabase
    Worker -- "cache" --> Redis
    Worker -- "orchestration" --> Temporal
    Worker -- "ingestion" --> OddsAPI
    Worker -- "ingestion" --> OptimalAPI
    Worker -- "posting" --> DiscordAPI
    Worker -- "AI advice" --> OpenAI

    DiscordBot -- "slash commands" --> DiscordAPI
    DiscordBot -- "read-only" --> Supabase
    DiscordBot -- "proxy" --> API

    API -- "metrics" --> Prometheus
    Worker -- "metrics" --> Prometheus
    Prometheus --> Grafana
```

### Service Inventory

| Service        | Location                        | Port        | Role                                  | Access                     |
| -------------- | ------------------------------- | ----------- | ------------------------------------- | -------------------------- |
| API            | `apps/api`                      | 3010 → 3000 | Canonical writer, agent orchestration | Read/Write                 |
| Workers        | `apps/api` (separate container) | —           | Temporal activity execution           | Read/Write                 |
| Smart Form     | `apps/smart-form`               | 3021        | Ticket submission UI                  | Write `bridge_outbox` only |
| Command Center | `apps/command-center`           | 3004 → 3015 | Operations dashboard                  | Read-only                  |
| Dashboard      | `apps/dashboard`                | 3003        | Analytics frontend                    | Read-only                  |
| Discord Bot    | `apps/discord-bot`              | —           | Slash commands, onboarding            | Read-only + Discord API    |
| Temporal       | Infrastructure                  | 7233 / 8088 | Workflow orchestration                | Internal                   |
| Redis          | Infrastructure                  | 6379        | Caching, autopilot state              | Internal                   |
| Supabase       | Cloud                           | —           | PostgreSQL database                   | Cloud-hosted               |
| Prometheus     | Infrastructure                  | 9090        | Metrics collection                    | Internal                   |
| Grafana        | Infrastructure                  | 3001        | Dashboards                            | Internal                   |

---

## Related Documents

- [Runtime Component Map](../../system/RUNTIME_COMPONENT_MAP.md)
- [System Overview](../../system/SYSTEM_OVERVIEW.md)
