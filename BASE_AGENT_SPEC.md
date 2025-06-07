# 🧩 BaseAgent Contract (v2)

## Config schema (Zod)

```ts
export const BaseAgentConfigSchema = z.object({
  name: z.string(),
  version: z.string(),             // semver
  enabled: z.boolean(),
  logLevel: z.enum(['debug','info','warn','error']).default('info'),

  metrics: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(5).default(60)          // seconds
  }),

  health: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(5).default(30)          // seconds
  }),

  retry: z.object({
    maxRetries:   z.number().min(0).default(3),
    backoffMs:    z.number().min(100).default(200),
    maxBackoffMs: z.number().min(500).default(5000)
  })
});
Mandatory hooks
Method	Called when…	Must do / return
initialize()	once inside start()	validate deps, warm connections
process()	on timer/command loop	main work
cleanup()	on shutdown	release resources
checkHealth()	every health.interval	HealthStatus object
collectMetrics()	every metrics.interval	merged metric record

Never override the public start() or stop() methods; only implement hooks.

Standard metrics keys
successCount, errorCount, warningCount

processingTimeMs, memoryUsageMb

Agent-specific metrics belong under metrics.custom.*.
