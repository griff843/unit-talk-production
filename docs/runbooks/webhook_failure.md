# Runbook: Webhook Delivery Failure

**Severity:** Medium (Severity 3)
**Response Time:** 1 hour
**Last Updated:** 2025-01-25
**Owner:** Platform SRE Team

---

## Overview

This runbook addresses webhook delivery failures affecting partner integrations, third-party services, and event-driven workflows in the Unit Talk platform.

### Symptoms

- Partner reports not receiving webhooks
- Webhook delivery queue backing up
- Failed webhook delivery attempts in logs
- Prometheus alert: `WebhookDeliveryFailureHigh`
- Increased partner API support tickets
- Event delivery delays

### Impact

- **Medium**: Partner integrations degraded, delayed notifications
- **Business Impact**: Partner satisfaction, integration reliability
- **SLO Impact**: Event delivery SLO violation (target: 99% within 1 minute)

---

## Immediate Response (0-5 minutes)

### Step 1: Assess Webhook Health

```bash
# 1.1 Check webhook delivery metrics
curl -s 'http://prometheus:9090/api/v1/query?query=rate(webhook_delivery_failures_total[5m])' | jq '.'

# 1.2 Check webhook queue depth
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  redis-cli LLEN webhook_delivery_queue

# 1.3 Check failed webhooks in database
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*), status, endpoint_url
    FROM webhook_deliveries
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY status, endpoint_url
    ORDER BY COUNT DESC;
  "

# 1.4 Check BridgeWorker health
kubectl logs -n unit-talk -l app=bridge-worker --since=10m | grep -i "error\|webhook"
```

**Record findings:**
- Time of detection: _____________________
- Failed deliveries (last hour): _____
- Queue depth: _____
- Affected endpoints: _____________________
- Failure rate: _____%

---

## Diagnosis (5-15 minutes)

### Step 2: Identify Root Cause

#### 2.1 Check Webhook Logs

```bash
# View webhook delivery attempts
kubectl logs -n unit-talk -l app=bridge-worker --since=30m | \
  grep -A 10 "webhook_delivery"

# Look for common patterns:
# - HTTP 4xx errors (endpoint validation/auth issues)
# - HTTP 5xx errors (partner service down)
# - Timeout errors (endpoint slow/unreachable)
# - DNS resolution failures
# - SSL/TLS errors
```

#### 2.2 Check Endpoint Health

```bash
# Test webhook endpoint directly
curl -v -X POST https://partner-endpoint.com/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: test" \
  -d '{"event": "ping", "timestamp": "2025-01-25T00:00:00Z"}'

# Check DNS resolution
nslookup partner-endpoint.com

# Check SSL certificate
echo | openssl s_client -connect partner-endpoint.com:443 -servername partner-endpoint.com 2>/dev/null | openssl x509 -noout -dates
```

#### 2.3 Identify Failure Type

| HTTP Status | Root Cause | Scenario |
|------------|-----------|----------|
| 400 | Bad request format | A: Invalid Payload |
| 401/403 | Authentication failure | B: Auth Issue |
| 404 | Endpoint not found | C: Endpoint Change |
| 408/504 | Timeout | D: Slow Endpoint |
| 429 | Rate limited | E: Rate Limiting |
| 500/502/503 | Partner service down | F: Partner Outage |
| DNS/Network | Connection issue | G: Network Failure |

---

## Resolution

### Scenario A: Invalid Webhook Payload

**Root Cause:** Webhook payload doesn't match partner's schema

```bash
# A.1 Review recent payload changes
git log --since="1 week ago" --grep="webhook" --oneline

# A.2 Check payload format
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT id, endpoint_url, payload, status_code, error_message
    FROM webhook_deliveries
    WHERE status = 'failed'
      AND status_code = 400
    ORDER BY created_at DESC
    LIMIT 5;
  "

# A.3 Validate payload against schema
# Retrieve payload and test against partner's schema documentation

# A.4 Fix payload format in code
# Update webhook payload builder
# File: apps/api/src/services/WebhookDeliveryService.ts

# A.5 Restart API pods
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# A.6 Retry failed deliveries
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending', retry_count = 0
    WHERE status = 'failed'
      AND status_code = 400
      AND created_at > NOW() - INTERVAL '1 hour';
  "

# A.7 Trigger BridgeWorker to process
kubectl exec -n unit-talk deployment/bridge-worker -- \
  kill -USR1 1  # Send signal to process pending webhooks
```

### Scenario B: Authentication/Authorization Issue

**Root Cause:** Webhook signature or API key invalid

```bash
# B.1 Check webhook signing
kubectl logs -n unit-talk -l app=bridge-worker --since=30m | \
  grep -i "signature\|unauthorized\|forbidden"

# B.2 Verify webhook secret
kubectl get secret webhook-secrets -n unit-talk -o yaml

# B.3 Check if secret rotated recently
# Review partner API key rotation logs

# B.4 Update webhook secret
kubectl create secret generic webhook-secrets \
  --from-literal=partner-webhook-secret=$NEW_SECRET \
  --dry-run=client -o yaml | kubectl apply -f - -n unit-talk

# B.5 Restart webhook delivery service
kubectl rollout restart deployment/bridge-worker -n unit-talk

# B.6 Test authentication
curl -X POST https://partner-endpoint.com/webhooks \
  -H "X-Webhook-Signature: $(echo -n '{"test":true}' | openssl dgst -sha256 -hmac $NEW_SECRET -binary | base64)" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# B.7 Retry failed auth deliveries
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending', retry_count = 0
    WHERE status = 'failed'
      AND status_code IN (401, 403)
      AND created_at > NOW() - INTERVAL '1 hour';
  "
```

### Scenario C: Endpoint Not Found / Changed

**Root Cause:** Partner changed webhook URL

```bash
# C.1 Identify affected partner
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT DISTINCT endpoint_url, COUNT(*)
    FROM webhook_deliveries
    WHERE status = 'failed'
      AND status_code = 404
    GROUP BY endpoint_url;
  "

# C.2 Contact partner for correct URL
# Check partner documentation or contact support

# C.3 Update webhook endpoint in database
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE partner_webhooks
    SET endpoint_url = 'https://new-endpoint.com/webhooks'
    WHERE endpoint_url = 'https://old-endpoint.com/webhooks';
  "

# C.4 Test new endpoint
curl -X POST https://new-endpoint.com/webhooks \
  -H "Content-Type: application/json" \
  -d '{"event": "ping"}'

# C.5 Retry with new endpoint
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending',
        endpoint_url = 'https://new-endpoint.com/webhooks',
        retry_count = 0
    WHERE status = 'failed'
      AND endpoint_url = 'https://old-endpoint.com/webhooks';
  "
```

### Scenario D: Webhook Timeout (Slow Endpoint)

**Root Cause:** Partner endpoint too slow to respond

```bash
# D.1 Check timeout duration
kubectl logs -n unit-talk -l app=bridge-worker --since=30m | \
  grep -i "timeout" | head -20

# D.2 Measure endpoint response time
time curl -X POST https://partner-endpoint.com/webhooks \
  -H "Content-Type: application/json" \
  -d '{"event": "ping"}'

# D.3 If endpoint is slow (> 5s), increase timeout
kubectl set env deployment/bridge-worker \
  WEBHOOK_TIMEOUT=30000 \
  -n unit-talk

# D.4 Implement async acknowledgment pattern
# Partner should:
# 1. Accept webhook (return 200 immediately)
# 2. Process asynchronously

# D.5 Contact partner to optimize endpoint
# Provide partner with performance recommendations

# D.6 Retry timed-out deliveries
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending', retry_count = 0
    WHERE status = 'failed'
      AND error_message LIKE '%timeout%'
      AND created_at > NOW() - INTERVAL '1 hour';
  "
```

### Scenario E: Rate Limiting by Partner

**Root Cause:** Too many webhooks sent too quickly

```bash
# E.1 Check delivery rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(webhook_deliveries_total[1m])' | jq '.'

# E.2 Identify rate-limited endpoint
kubectl logs -n unit-talk -l app=bridge-worker --since=30m | \
  grep "429\|rate.limit"

# E.3 Implement rate limiting
kubectl set env deployment/bridge-worker \
  WEBHOOK_RATE_LIMIT_PER_ENDPOINT=100 \
  WEBHOOK_RATE_LIMIT_WINDOW=60000 \
  -n unit-talk

# E.4 Restart BridgeWorker
kubectl rollout restart deployment/bridge-worker -n unit-talk

# E.5 Implement exponential backoff
# Code change in WebhookDeliveryService.ts:
# - First retry: 1 minute
# - Second retry: 5 minutes
# - Third retry: 15 minutes
# - Max: 1 hour

# E.6 Queue rate-limited deliveries for retry
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending',
        next_retry_at = NOW() + INTERVAL '5 minutes'
    WHERE status = 'failed'
      AND status_code = 429;
  "
```

### Scenario F: Partner Service Outage

**Root Cause:** Partner's webhook endpoint down

```bash
# F.1 Verify partner service is down
curl -I https://partner-endpoint.com/webhooks

# F.2 Check partner status page
# e.g., https://status.partner.com

# F.3 Implement circuit breaker
kubectl set env deployment/bridge-worker \
  WEBHOOK_CIRCUIT_BREAKER_ENABLED=true \
  WEBHOOK_CIRCUIT_BREAKER_THRESHOLD=5 \
  WEBHOOK_CIRCUIT_BREAKER_TIMEOUT=300000 \
  -n unit-talk

# F.4 Queue webhooks for retry when partner recovers
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending',
        next_retry_at = NOW() + INTERVAL '15 minutes',
        retry_count = LEAST(retry_count, 2)
    WHERE status = 'failed'
      AND endpoint_url LIKE '%partner-endpoint.com%'
      AND status_code IN (500, 502, 503, 504);
  "

# F.5 Notify partner (if SLA exists)
# Contact partner support about outage

# F.6 Monitor partner recovery
watch -n 60 'curl -I https://partner-endpoint.com/webhooks'

# F.7 When recovered, trigger retry wave
kubectl exec -n unit-talk deployment/bridge-worker -- \
  kill -USR1 1
```

### Scenario G: Network/DNS Failure

**Root Cause:** Cannot reach partner endpoint

```bash
# G.1 Test network connectivity
kubectl exec -n unit-talk deployment/bridge-worker -- \
  curl -v https://partner-endpoint.com/webhooks

# G.2 Check DNS resolution
kubectl exec -n unit-talk deployment/bridge-worker -- \
  nslookup partner-endpoint.com

# G.3 Check network policies
kubectl get networkpolicies -n unit-talk
kubectl describe networkpolicy bridge-worker-network-policy -n unit-talk

# G.4 Verify egress rules
# Ensure outbound HTTPS (443) allowed

# G.5 Check for firewall/NAT issues
# Verify cluster egress IP is whitelisted by partner

# G.6 Update network policy if needed
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: bridge-worker-egress
  namespace: unit-talk
spec:
  podSelector:
    matchLabels:
      app: bridge-worker
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
EOF

# G.7 Retry network-failed deliveries
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE webhook_deliveries
    SET status = 'pending', retry_count = 0
    WHERE status = 'failed'
      AND (error_message LIKE '%ECONNREFUSED%'
        OR error_message LIKE '%ENOTFOUND%'
        OR error_message LIKE '%ETIMEDOUT%');
  "
```

---

## Verification (15-20 minutes)

### Step 3: Confirm Resolution

```bash
# 3.1 Check webhook delivery success rate
curl -s 'http://prometheus:9090/api/v1/query?query=(sum(rate(webhook_deliveries_success_total[5m]))/sum(rate(webhook_deliveries_total[5m])))*100' | jq '.'
# Expected: > 99%

# 3.2 Check queue depth
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  redis-cli LLEN webhook_delivery_queue
# Expected: < 100

# 3.3 Verify recent deliveries
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*), status
    FROM webhook_deliveries
    WHERE created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY status;
  "
# Expect majority 'delivered'

# 3.4 Test end-to-end webhook delivery
curl -X POST https://api.unit-talk.com/api/v1/admin/webhooks/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint_id": "test-endpoint"}'

# 3.5 Check BridgeWorker logs for errors
kubectl logs -n unit-talk -l app=bridge-worker --since=5m | \
  grep -i error | wc -l
# Expected: 0 or very low

# 3.6 Verify partner received webhooks
# Contact partner or check their dashboard
```

### Step 4: Monitor Stability

```bash
# Monitor webhook metrics for 15 minutes
watch -n 30 '
  echo "=== Delivery Success Rate ===" && \
  curl -s "http://prometheus:9090/api/v1/query?query=(sum(rate(webhook_deliveries_success_total[5m]))/sum(rate(webhook_deliveries_total[5m])))*100" | jq ".data.result[0].value[1]" && \
  echo "=== Queue Depth ===" && \
  kubectl exec -n unit-talk deployment/unit-talk-api-green -- redis-cli LLEN webhook_delivery_queue
'

# Monitor Grafana Webhook Dashboard
# http://grafana.unit-talk.com/d/webhook-delivery
```

---

## Communication

### Partner Notification

```bash
# Notify affected partners
curl -X POST https://api.unit-talk.com/api/v1/admin/partners/notify \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_ids": ["partner-1", "partner-2"],
    "message": "We experienced webhook delivery issues from [START_TIME] to [END_TIME]. All pending webhooks have been redelivered. Please contact support if you notice any missing events."
  }'
```

### Internal Update

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ Webhook Delivery RESOLVED",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* RESOLVED\n*Duration:* [MINUTES] minutes\n*Root Cause:* [SUMMARY]\n*Affected Partners:* [X]\n*Redelivered Webhooks:* [X]"}
      }
    ]
  }'
```

---

## Prevention

### Webhook Delivery Metrics

```yaml
# Add Prometheus alerts
- alert: WebhookDeliveryFailureHigh
  expr: (sum(rate(webhook_deliveries_failed_total[5m])) / sum(rate(webhook_deliveries_total[5m]))) * 100 > 5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Webhook delivery failure rate > 5%"
    runbook_url: "https://docs.unit-talk.com/runbooks/webhook-failure"

- alert: WebhookQueueBackup
  expr: webhook_delivery_queue_depth > 1000
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Webhook delivery queue backing up"

- alert: WebhookCircuitBreakerOpen
  expr: webhook_circuit_breaker_open == 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Webhook circuit breaker opened for endpoint"
```

### Retry Strategy Implementation

```typescript
// WebhookDeliveryService.ts - Optimal retry configuration
const retryConfig = {
  attempts: 10,
  backoff: {
    type: 'exponential',
    delay: 60000, // Start at 1 minute
    maxDelay: 3600000 // Max 1 hour
  },
  retryIf: (error) => {
    // Retry on network errors and 5xx
    return error.code === 'ECONNREFUSED'
      || error.code === 'ETIMEDOUT'
      || (error.status >= 500 && error.status < 600);
  },
  onRetry: (attempt, error) => {
    logger.warn('Webhook retry attempt', {
      attempt,
      error: error.message,
      nextRetryIn: calculateBackoff(attempt)
    });
  }
};
```

### Partner Health Monitoring

```bash
# Daily partner endpoint health check
# Cron: 0 */6 * * * (Every 6 hours)
#!/bin/bash
# scripts/webhooks/check-partner-health.sh

for endpoint in $(kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -t -c "SELECT DISTINCT endpoint_url FROM partner_webhooks WHERE active = true;"); do

  echo "Checking $endpoint..."

  if ! curl -f -s -o /dev/null -w "%{http_code}" -X POST "$endpoint" \
    -H "Content-Type: application/json" \
    -d '{"event":"ping"}'; then

    echo "⚠️ Endpoint unhealthy: $endpoint"

    # Alert via Slack
    curl -X POST $SLACK_WEBHOOK \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"⚠️ Partner webhook endpoint unhealthy: $endpoint\"}"
  fi
done
```

---

## Related Runbooks

- [Stripe Errors](STRIPE_ERROR.md) - For Stripe webhook issues
- [API Outage](API_OUTAGE.md) - For general API failures

---

**Runbook Version:** 1.0
**Last Tested:** [DATE]
**Test Frequency:** Monthly
**Next Test:** [DATE]

---

## Appendix: Webhook Delivery States

| State | Description | Next Action |
|-------|-------------|-------------|
| `pending` | Queued for delivery | BridgeWorker will attempt delivery |
| `delivering` | Delivery in progress | Wait for response |
| `delivered` | Successfully delivered | None - final state |
| `failed` | Delivery failed | Retry based on retry config |
| `failed_permanent` | Max retries exceeded | Manual intervention or archive |

## Webhook Payload Structure

```json
{
  "event": "pick.graded",
  "timestamp": "2025-01-25T12:00:00Z",
  "data": {
    "pick_id": "pick_123",
    "result": "win",
    "odds": 1.91
  },
  "signature": "sha256=..."
}
```

### Signature Verification

```typescript
// Partner should verify webhook signature
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}
```
