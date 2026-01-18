# Runbook: Stripe Payment Errors

**Severity:** High (Severity 2)
**Response Time:** 15 minutes
**Last Updated:** 2025-01-25
**Owner:** Platform SRE + Finance Team

---

## Overview

This runbook addresses Stripe payment processing failures, webhook delivery issues, and subscription management errors in the Unit Talk platform.

### Symptoms

- Payment processing failures
- Webhook delivery failures or timeouts
- Subscription creation/cancellation errors
- Payout failures
- Customer complaints about failed charges
- Prometheus alert: `StripeWebhookFailure` or `StripePaymentError`

### Impact

- **High**: Revenue loss, customer dissatisfaction
- **Business Impact**: Failed subscriptions, churn risk, trust issues
- **Compliance**: Potential PCI compliance issues if not resolved

---

## Immediate Response (0-5 minutes)

### Step 1: Verify Stripe Status

```bash
# 1.1 Check Stripe API status
curl https://status.stripe.com/api/v2/status.json | jq '.'

# 1.2 Check application logs for Stripe errors
kubectl logs -n unit-talk -l app=unit-talk-api --since=15m | grep -i "stripe\|payment"

# 1.3 Test Stripe API connectivity
curl -u $STRIPE_SECRET_KEY: https://api.stripe.com/v1/charges
# Expected: 200 OK with charges list

# 1.4 Check webhook deliveries in Stripe Dashboard
# https://dashboard.stripe.com/webhooks
# Look for: Failed attempts, 4xx/5xx errors
```

**Record findings:**
- Time of detection: _____________________
- Error type: [ ] API Error [ ] Webhook [ ] Subscription [ ] Payment
- Affected customers: _____
- Failed amount: $_____
- Error code: _____________________

### Step 2: Assess Impact

```bash
# 2.1 Count failed payments in last hour
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*), status
    FROM billing_transactions
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY status;
  "

# 2.2 Check webhook delivery rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(stripe_webhook_failures_total[5m])'

# 2.3 Identify affected subscriptions
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*)
    FROM subscriptions
    WHERE status = 'incomplete'
      AND updated_at > NOW() - INTERVAL '1 hour';
  "
```

---

## Diagnosis (5-15 minutes)

### Step 3: Identify Root Cause

#### 3.1 Check Stripe Logs

```bash
# View application Stripe integration logs
kubectl logs -n unit-talk -l app=unit-talk-api --since=30m | grep -A 5 "StripeError\|stripe_error"

# Look for common error codes:
# - card_declined
# - insufficient_funds
# - authentication_required
# - rate_limit
# - api_connection_error
# - api_error
```

#### 3.2 Check Webhook Events

```bash
# Check recent webhook events
# Stripe Dashboard → Developers → Webhooks → [Your endpoint]

# Common webhook issues:
# - 4xx: Application validation error
# - 5xx: Application server error
# - Timeout: Webhook processing > 30s
```

#### 3.3 Identify Failure Type

| Error Code | Root Cause | Scenario |
|-----------|-----------|----------|
| `card_declined` | Customer card issue | A: Card Declined |
| `rate_limit` | Too many API requests | B: Rate Limiting |
| `authentication_required` | 3D Secure required | C: SCA/3DS Issue |
| `webhook_timeout` | Slow webhook processing | D: Webhook Timeout |
| `api_connection_error` | Network/Stripe outage | E: Connectivity Issue |
| `subscription_incomplete` | Payment method missing | F: Subscription Error |

---

## Resolution

### Scenario A: Card Declined

**Root Cause:** Customer's payment method declined

```bash
# A.1 Identify affected customers
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT u.email, bt.amount, bt.stripe_error_code, bt.stripe_error_message
    FROM billing_transactions bt
    JOIN users u ON u.id = bt.user_id
    WHERE bt.status = 'failed'
      AND bt.stripe_error_code = 'card_declined'
      AND bt.created_at > NOW() - INTERVAL '1 hour';
  "

# A.2 Notify customers to update payment method
# This should be automated via BillingAgent
npm run agent:billing:notify-failed-payments

# A.3 Check if retry logic is working
kubectl logs -n unit-talk -l app=billing-worker --since=30m | grep -i "retry"

# A.4 Manual retry for specific customer (if needed)
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  node -e "
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    stripe.paymentIntents.retrieve('pi_xxxxx').then(intent => {
      stripe.paymentIntents.confirm(intent.id);
    });
  "

# A.5 Enable Smart Retries in Stripe
# Dashboard → Settings → Billing → Smart retries: ON
```

### Scenario B: Rate Limiting

**Root Cause:** Exceeded Stripe API rate limits

```bash
# B.1 Check rate limit headers in logs
kubectl logs -n unit-talk -l app=unit-talk-api | grep "Stripe-RateLimit"

# B.2 Identify source of excessive requests
kubectl logs -n unit-talk -l app=unit-talk-api --since=15m | \
  grep "stripe.customers\|stripe.charges" | \
  awk '{print $1}' | sort | uniq -c | sort -rn

# B.3 Implement exponential backoff
# Ensure application has retry logic:
# - First retry: 1 second
# - Second retry: 2 seconds
# - Third retry: 4 seconds
# - Max: 30 seconds

# B.4 Enable request idempotency keys
# Verify application uses idempotency keys
kubectl logs -n unit-talk -l app=unit-talk-api | grep "Idempotency-Key"

# B.5 Upgrade Stripe account tier if needed
# Contact Stripe support for rate limit increase

# B.6 Implement request queuing
kubectl set env deployment/unit-talk-api-green \
  STRIPE_REQUEST_QUEUE_ENABLED=true \
  STRIPE_MAX_CONCURRENT_REQUESTS=10 \
  -n unit-talk
```

### Scenario C: SCA/3D Secure Authentication

**Root Cause:** Strong Customer Authentication required

```bash
# C.1 Check for authentication_required errors
kubectl logs -n unit-talk -l app=unit-talk-api --since=30m | \
  grep "authentication_required"

# C.2 Verify 3DS flow is implemented
# Check if application handles PaymentIntent status: requires_action

# C.3 Send customers to confirm payment
# Application should redirect to PaymentIntent.next_action.redirect_to_url

# C.4 Check webhook for payment_intent.succeeded
kubectl logs -n unit-talk -l app=unit-talk-api | \
  grep "payment_intent.succeeded"

# C.5 Enable automatic payment methods
# Ensure customers are set up for future off-session payments
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  node -e "
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    stripe.subscriptions.update('sub_xxxxx', {
      default_payment_method: 'pm_xxxxx',
      collection_method: 'charge_automatically'
    });
  "
```

### Scenario D: Webhook Timeout

**Root Cause:** Webhook processing takes > 30 seconds

```bash
# D.1 Check webhook processing time
kubectl logs -n unit-talk -l app=unit-talk-api | \
  grep "webhook_processing_time" | \
  awk '{print $NF}' | sort -rn | head -10

# D.2 Identify slow webhook handlers
kubectl logs -n unit-talk -l app=unit-talk-api --since=30m | \
  grep -A 10 "webhook_handler_start"

# D.3 Move slow processing to background job
# Webhook should:
# 1. Acknowledge immediately (return 200)
# 2. Queue processing job
# 3. Process asynchronously

# D.4 Verify webhook signature quickly
# Signature verification should happen first and fast

# D.5 Optimize webhook handlers
kubectl set env deployment/unit-talk-api-green \
  STRIPE_WEBHOOK_ASYNC=true \
  STRIPE_WEBHOOK_TIMEOUT=25000 \
  -n unit-talk

# D.6 Restart API pods
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# D.7 Manually retry failed webhooks
# Stripe Dashboard → Webhooks → [endpoint] → Failed events → Retry
```

### Scenario E: API Connectivity Issue

**Root Cause:** Cannot reach Stripe API

```bash
# E.1 Test Stripe API connectivity
curl -v https://api.stripe.com/v1/charges \
  -u $STRIPE_SECRET_KEY:

# E.2 Check DNS resolution
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  nslookup api.stripe.com

# E.3 Check network policies
kubectl get networkpolicies -n unit-talk
kubectl describe networkpolicy api-network-policy -n unit-talk

# E.4 Verify egress rules allow Stripe
# Ensure 443 outbound to api.stripe.com is allowed

# E.5 Check Stripe API status
curl https://status.stripe.com/api/v2/status.json

# E.6 If Stripe outage, enable maintenance mode for billing
kubectl set env deployment/unit-talk-api-green \
  BILLING_MAINTENANCE_MODE=true \
  -n unit-talk

# E.7 Queue pending transactions for retry
# BillingWorker should automatically retry when Stripe recovers
```

### Scenario F: Subscription Management Error

**Root Cause:** Subscription creation/update failed

```bash
# F.1 Check failed subscription attempts
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT s.id, u.email, s.status, s.stripe_error, s.updated_at
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status IN ('incomplete', 'incomplete_expired', 'past_due')
      AND s.updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY s.updated_at DESC;
  "

# F.2 Retry subscription creation
# For specific subscription
curl -X POST https://api.stripe.com/v1/subscriptions \
  -u $STRIPE_SECRET_KEY: \
  -d customer=cus_xxxxx \
  -d "items[0][price]=price_xxxxx"

# F.3 Update payment method for incomplete subscriptions
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  node -e "
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    stripe.subscriptions.update('sub_xxxxx', {
      default_payment_method: 'pm_xxxxx'
    });
  "

# F.4 Cancel and recreate failed subscriptions
# Only if retry logic failed multiple times
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    UPDATE subscriptions
    SET status = 'canceled', canceled_at = NOW()
    WHERE status = 'incomplete_expired';
  "

# F.5 Notify customers to re-subscribe
npm run agent:billing:notify-subscription-failures
```

---

## Verification (10-15 minutes)

### Step 4: Confirm Resolution

```bash
# 4.1 Test Stripe API connectivity
curl -u $STRIPE_SECRET_KEY: https://api.stripe.com/v1/balance

# 4.2 Test payment creation
curl -X POST https://api.stripe.com/v1/payment_intents \
  -u $STRIPE_SECRET_KEY: \
  -d amount=100 \
  -d currency=usd \
  -d "payment_method_types[]"=card

# 4.3 Check webhook delivery success rate
# Stripe Dashboard → Webhooks → [endpoint]
# Should show recent successful deliveries

# 4.4 Verify billing transactions
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*), status
    FROM billing_transactions
    WHERE created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY status;
  "
# Expect: Mostly 'succeeded'

# 4.5 Check subscription health
curl https://api.unit-talk.com/api/v1/admin/billing/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4.6 Monitor error rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(stripe_errors_total[5m])'
```

### Step 5: Financial Reconciliation

```bash
# 5.1 Compare Stripe and database records
# Export last hour of transactions
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as db_count, SUM(amount) as db_total
    FROM billing_transactions
    WHERE created_at > NOW() - INTERVAL '1 hour'
      AND status = 'succeeded';
  "

# 5.2 Check Stripe dashboard
# Compare totals with database

# 5.3 Identify discrepancies
# Run reconciliation script
npm run billing:reconcile -- --since "1 hour ago"

# 5.4 Generate incident financial report
npm run billing:incident-report -- --incident-id INC-xxxxx
```

---

## Communication

### Customer Communication

```bash
# For card declined errors
curl -X POST https://api.unit-talk.com/api/v1/admin/notifications/send \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["user1", "user2"],
    "template": "payment_failed",
    "data": {
      "reason": "card_declined",
      "action_url": "https://unit-talk.com/settings/billing"
    }
  }'
```

### Internal Communication

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "⚠️ Stripe Payment Issue - [TIME]",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* MITIGATING\n*Affected Customers:* [X]\n*Failed Amount:* $[X]\n*Root Cause:* [DESCRIPTION]"}
      }
    ]
  }'
```

---

## Prevention

### Monitoring Alerts

```yaml
# Prometheus alerts for Stripe issues
- alert: StripeWebhookFailureHigh
  expr: rate(stripe_webhook_failures_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High Stripe webhook failure rate"
    runbook_url: "https://docs.unit-talk.com/runbooks/stripe-error"

- alert: StripePaymentFailureSpike
  expr: rate(stripe_payment_failures_total[5m]) > 5
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Spike in Stripe payment failures"

- alert: StripeRateLimitApproaching
  expr: stripe_rate_limit_remaining < 100
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "Approaching Stripe API rate limit"
```

### Webhook Resilience

```typescript
// Implement webhook queue with retry
import Queue from 'bull';

const webhookQueue = new Queue('stripe-webhooks', {
  redis: REDIS_URL
});

webhookQueue.process(async (job) => {
  const { event } = job.data;
  // Process webhook event
  await handleStripeWebhook(event);
});

// Webhook endpoint acknowledges immediately
app.post('/webhooks/stripe', (req, res) => {
  const event = req.body;

  // Verify signature first
  const signature = req.headers['stripe-signature'];
  stripe.webhooks.constructEvent(req.rawBody, signature, WEBHOOK_SECRET);

  // Queue for processing
  webhookQueue.add({ event }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });

  // Acknowledge immediately
  res.status(200).send({ received: true });
});
```

### Daily Reconciliation

```bash
# Automated daily reconciliation
# Cron: 0 1 * * * (Daily at 1 AM)
#!/bin/bash
# scripts/billing/daily-reconciliation.sh

npm run billing:reconcile -- --since "24 hours ago" --send-report

# If discrepancies found, alert finance team
if [ $? -ne 0 ]; then
  curl -X POST $SLACK_WEBHOOK_FINANCE \
    -H 'Content-Type: application/json' \
    -d '{"text":"⚠️ Billing reconciliation found discrepancies - Check report"}'
fi
```

---

## Related Runbooks

- [Webhook Failure](WEBHOOK_FAILURE.md) - For webhook-specific issues
- [API Outage](API_OUTAGE.md) - For general API failures

---

**Runbook Version:** 1.0
**Last Tested:** [DATE]
**Test Frequency:** Monthly
**Next Test:** [DATE]

---

## Appendix: Common Stripe Error Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `card_declined` | Card declined | Update payment method |
| `insufficient_funds` | Insufficient funds | Update payment method |
| `authentication_required` | 3DS required | Complete authentication |
| `rate_limit` | Too many requests | System will retry |
| `api_error` | Stripe issue | Try again later |
| `invalid_request_error` | Bad request | Contact support |
