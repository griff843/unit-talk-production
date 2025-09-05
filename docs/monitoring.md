# Monitoring & Observability

This document describes how to run and verify Prometheus, Alertmanager, Grafana, and OpenTelemetry for the Unit Talk platform.

## Components

- Prometheus: scrapes metrics
- Alertmanager: routes alerts (Discord webhook via DISCORD_WEBHOOK_URL)
- Grafana: dashboards (optional)
- OpenTelemetry: traces & metrics exporters

## Ports & Endpoints

- API metrics: http://localhost:9464/metrics (enabled when PROMETHEUS_ENABLED=true)
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Grafana: http://localhost:3000 (if enabled)

## Docker Compose

Prometheus mounts:
- ./monitoring/prometheus.yml → /etc/prometheus/prometheus.yml
- ./monitoring/alert_rules.yml → /etc/prometheus/alert_rules.yml

Alertmanager mounts:
- ./monitoring/alertmanager.yml → /etc/alertmanager/alertmanager.yml

## Environment Variables

- PROMETHEUS_ENABLED=true
- PROMETHEUS_PORT=9464
- DISCORD_WEBHOOK_URL=...
- OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces (if using an OTLP collector)

## Verify

1) API metrics
- Start API and curl http://localhost:9464/metrics

2) Prometheus targets
- docker compose up -d prometheus alertmanager api
- Visit http://localhost:9090/targets → unit-talk-api should be UP

3) Alerts
- See monitoring/alert_rules.yml (ApiDown, ApiHighErrorRate, ApiLatencyP95High)
- Configure DISCORD_WEBHOOK_URL and monitor Alertmanager at http://localhost:9093

## OTEL Quick Start

- Set OTEL_EXPORTER_OTLP_ENDPOINT to your collector (e.g., http://localhost:4318/v1/traces)
- Start API; generate traffic; view traces in your backend (Tempo/Jaeger/etc.)

## Notes

- Temporal metrics are listed in prometheus.yml but can be disabled if Temporal is not running.
- Keep scrape intervals small (5s) for API and workers during development; adjust for production.

