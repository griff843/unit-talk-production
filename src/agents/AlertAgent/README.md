# AlertsAgent

Production-grade real-time alerting system for Unit Talk.  
Routes events to Discord, Notion, and dashboard; logs every alert for audit.

## Usage

1. Create with Supabase instance  
2. Call `sendAlert(payload)` or `handleEvent(event)`
3. All alerts logged to `alerts_log` for transparency

## Integrations

- Discord: Webhook-based notifications
- Notion: Page/push API
- Retool: Dashboard feed

## Health Monitoring

- Use `healthCheck()` for CI and uptime tracking

## Extension

- Add more alert types, escalation logic, or custom integrations as your system evolves.
