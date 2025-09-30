# Operator Dashboard API Reference

## 🚀 Overview

The Operator Dashboard API provides comprehensive endpoints for system monitoring, incident management, and operational control of the Unit Talk syndicate-grade platform. This API enables real-time oversight and control of all system components.

## 🔐 Authentication & Authorization

All endpoints require authentication via Bearer token. Role-based access control is enforced:
- **Public**: Basic health and metrics endpoints
- **Authenticated**: Standard monitoring and analytics
- **Operator**: System controls and incident management
- **Admin**: Emergency controls and critical operations

### Authentication Header
```http
Authorization: Bearer <jwt_token>
```

### Rate Limiting
- **Standard Operations**: 100 requests/minute
- **System Controls**: 5 operations/minute
- **Critical Operations**: 10 operations/5 minutes

## 📊 Dashboard Overview Endpoints

### GET /api/operator-dashboard/metrics
Get comprehensive dashboard metrics including system health, performance indicators, and operational status.

**Authentication**: Required  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": {
    "system_health": {
      "overall_score": 0.95,
      "component_scores": {
        "api": 0.98,
        "database": 0.94,
        "agents": 0.96,
        "monitoring": 0.99
      }
    },
    "performance_metrics": {
      "api_response_time_p95": 87,
      "database_query_time_p95": 34,
      "steam_detection_latency_p95": 3.2,
      "feature_computation_rate": 1247
    },
    "active_alerts": 2,
    "active_incidents": 0,
    "agents_status": {
      "FeedAgent": "healthy",
      "ScoringAgent": "healthy",
      "AlertAgent": "healthy"
    }
  },
  "timestamp": "2025-09-10T14:30:00Z",
  "response_time_ms": 145
}
```

### GET /api/operator-dashboard/health
Get overall system health status for all services and components.

**Authentication**: None  
**Rate Limit**: Standard

#### Response
```json
{
  "status": "healthy",
  "services": {
    "slo_monitoring": true,
    "incident_management": true,
    "operator_dashboard": true
  },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

## 📈 SLO Monitoring Endpoints

### GET /api/operator-dashboard/slo/current
Get current Service Level Objective metrics for all monitored services.

**Authentication**: Required  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": {
    "api_response_time": {
      "current_p95": 87,
      "target_p95": 100,
      "status": "healthy",
      "error_budget_remaining": 0.85
    },
    "database_query_time": {
      "current_p95": 34,
      "target_p95": 50,
      "status": "healthy",
      "error_budget_remaining": 0.92
    },
    "steam_detection_latency": {
      "current_p95": 3.2,
      "target_p95": 5.0,
      "status": "healthy",
      "error_budget_remaining": 0.94
    },
    "system_availability": {
      "current": 99.97,
      "target": 99.9,
      "status": "healthy",
      "error_budget_remaining": 0.88
    }
  },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### GET /api/operator-dashboard/slo/error-budgets
Get error budget status for all SLOs with detailed consumption metrics.

**Authentication**: Required  
**Rate Limit**: Standard

#### Query Parameters
- `period` (string): Time period for error budget calculation (`hour`, `day`, `week`, `month`)

#### Response
```json
{
  "success": true,
  "data": {
    "period": "day",
    "error_budgets": [
      {
        "slo_name": "api_response_time",
        "target": 100,
        "error_budget_total": 864,
        "error_budget_consumed": 129,
        "error_budget_remaining": 735,
        "consumption_rate": 0.149,
        "status": "healthy",
        "burn_rate": "low"
      }
    ]
  },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### GET /api/operator-dashboard/slo/violations
Get SLO violation history with detailed context and impact analysis.

**Authentication**: Required  
**Rate Limit**: Standard

#### Query Parameters
- `hours` (number): Number of hours to look back (default: 24)

#### Response
```json
{
  "success": true,
  "data": [
    {
      "violation_id": "viol_20250910_143015",
      "slo_name": "api_response_time",
      "violation_time": "2025-09-10T14:30:15Z",
      "duration_minutes": 5,
      "severity": "warning",
      "impact": "minor",
      "context": {
        "triggered_by": "database_slow_query",
        "affected_endpoints": ["/api/props", "/api/grading"],
        "recovery_time": "2025-09-10T14:35:42Z"
      }
    }
  ],
  "query": { "hours": 24 },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

## 🚨 Incident Management Endpoints

### GET /api/operator-dashboard/incidents/active
Get all currently active incidents with full context.

**Authentication**: Required  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": [
    {
      "incident_id": "inc_20250910_140032",
      "title": "Database connection spike",
      "severity": "medium",
      "status": "investigating",
      "created_at": "2025-09-10T14:00:32Z",
      "reporter_id": "system",
      "assignee_id": "user_123",
      "description": "Database connection pool exhaustion detected",
      "tags": ["database", "performance"],
      "affected_services": ["api", "grading"],
      "last_updated": "2025-09-10T14:25:18Z"
    }
  ],
  "count": 1,
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### GET /api/operator-dashboard/incidents/:incidentId
Get detailed information for a specific incident.

**Authentication**: Required  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": {
    "incident_id": "inc_20250910_140032",
    "title": "Database connection spike",
    "severity": "medium",
    "status": "investigating",
    "created_at": "2025-09-10T14:00:32Z",
    "resolved_at": null,
    "reporter": {
      "id": "system",
      "name": "Automated System"
    },
    "assignee": {
      "id": "user_123",
      "name": "John Operator",
      "email": "john@unittalk.com"
    },
    "description": "Database connection pool exhaustion detected during peak load",
    "tags": ["database", "performance", "connection-pool"],
    "affected_services": ["api", "grading"],
    "impact_assessment": {
      "users_affected": 0,
      "services_degraded": 2,
      "revenue_impact": "minimal"
    },
    "timeline": [
      {
        "timestamp": "2025-09-10T14:00:32Z",
        "action": "incident_created",
        "user": "system",
        "details": "Automatic incident creation from SLO violation"
      },
      {
        "timestamp": "2025-09-10T14:05:18Z",
        "action": "assigned",
        "user": "user_123",
        "details": "Incident assigned to on-call operator"
      }
    ]
  },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### GET /api/operator-dashboard/incidents/:incidentId/timeline
Get the complete timeline for an incident.

**Authentication**: Required  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-09-10T14:00:32Z",
      "action": "incident_created",
      "user": "system",
      "details": "Automatic incident creation from SLO violation",
      "system_context": {
        "trigger": "slo_violation_api_response_time",
        "metric_value": 157,
        "threshold": 100
      }
    },
    {
      "timestamp": "2025-09-10T14:05:18Z",
      "action": "assigned",
      "user": "user_123",
      "details": "Incident assigned to on-call operator"
    },
    {
      "timestamp": "2025-09-10T14:12:45Z",
      "action": "comment_added",
      "user": "user_123",
      "details": "Investigating database connection pool metrics"
    }
  ],
  "count": 3,
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### POST /api/operator-dashboard/incidents
Create a new incident with full documentation and automatic routing.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: Standard

#### Request Body
```json
{
  "title": "Manual incident report",
  "description": "Detailed description of the issue",
  "severity": "high",
  "tags": ["manual", "investigation"],
  "affected_services": ["api"],
  "impact_assessment": {
    "users_affected": 100,
    "services_degraded": 1,
    "revenue_impact": "moderate"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "incident_id": "inc_20250910_143045",
    "title": "Manual incident report",
    "severity": "high",
    "status": "open",
    "created_at": "2025-09-10T14:30:45Z",
    "reporter_id": "user_123"
  },
  "timestamp": "2025-09-10T14:30:45Z"
}
```

### PUT /api/operator-dashboard/incidents/:incidentId/status
Update the status of an incident with audit logging.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: Standard

#### Request Body
```json
{
  "status": "resolved",
  "resolution_notes": "Database connection pool increased from 20 to 40 connections"
}
```

#### Response
```json
{
  "success": true,
  "message": "Incident status updated successfully",
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### PUT /api/operator-dashboard/incidents/:incidentId/assign
Assign an incident to a specific user with notification.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: Standard

#### Request Body
```json
{
  "assigneeId": "user_456",
  "notes": "Escalating to database specialist"
}
```

### POST /api/operator-dashboard/incidents/:incidentId/comments
Add a comment to an incident with automatic notifications.

**Authentication**: Required  
**Rate Limit**: Standard

#### Request Body
```json
{
  "comment": "Database connection pool metrics show sustained high usage since 13:45. Investigating connection leaks."
}
```

## 🎛️ System Control Endpoints

### GET /api/operator-dashboard/controls
Get the current state of all system controls and safeguards.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": {
    "safe_mode": {
      "enabled": false,
      "last_changed": "2025-09-09T08:15:30Z",
      "changed_by": "user_123",
      "reason": "Post-deployment validation complete"
    },
    "circuit_breakers": {
      "external_apis": {
        "enabled": false,
        "trip_count": 0,
        "last_trip": null
      },
      "database": {
        "enabled": false,
        "trip_count": 2,
        "last_trip": "2025-09-10T12:15:30Z"
      }
    },
    "agents": {
      "FeedAgent": {
        "status": "running",
        "last_restart": "2025-09-10T06:00:00Z",
        "health_score": 0.98
      },
      "ScoringAgent": {
        "status": "running",
        "last_restart": "2025-09-10T06:00:00Z",
        "health_score": 0.96
      },
      "AlertAgent": {
        "status": "running",
        "last_restart": "2025-09-10T06:00:00Z",
        "health_score": 0.99
      }
    }
  },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### POST /api/operator-dashboard/controls/safe-mode
Toggle safe mode with comprehensive logging and impact assessment.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: System Controls (5/min)

#### Request Body
```json
{
  "enabled": true,
  "reason": "Deploying critical database changes, enabling safe mode for extra validation"
}
```

#### Response
```json
{
  "success": true,
  "message": "Safe mode enabled successfully",
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### POST /api/operator-dashboard/controls/agents/:agentName
Control individual agents with comprehensive state management.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: System Controls (5/min)

#### Path Parameters
- `agentName`: Name of the agent (FeedAgent, ScoringAgent, AlertAgent)

#### Request Body
```json
{
  "action": "restart",
  "reason": "Applying configuration updates"
}
```

#### Valid Actions
- `start`: Start the agent
- `stop`: Stop the agent gracefully
- `pause`: Pause processing without stopping
- `restart`: Restart the agent

#### Response
```json
{
  "success": true,
  "message": "Agent FeedAgent restart command executed successfully",
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### POST /api/operator-dashboard/controls/circuit-breakers/:serviceName
Toggle circuit breakers for specific services.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: System Controls (5/min)

#### Path Parameters
- `serviceName`: Name of the service (external_apis, database, cache)

#### Request Body
```json
{
  "enabled": true,
  "reason": "External API showing high error rates, enabling circuit breaker"
}
```

### POST /api/operator-dashboard/controls/emergency-stop
Execute emergency stop procedures for all systems.

**Authentication**: Required  
**Role**: Admin only  
**Rate Limit**: Critical Operations (10/5min)

#### Request Body
```json
{
  "reason": "Critical security incident detected, initiating emergency stop to prevent data compromise"
}
```

#### Response
```json
{
  "success": true,
  "message": "Emergency stop executed successfully",
  "timestamp": "2025-09-10T14:30:00Z"
}
```

## 📊 Analytics and Reporting Endpoints

### GET /api/operator-dashboard/analytics/performance
Get performance trends and capacity planning metrics.

**Authentication**: Required  
**Rate Limit**: Standard

#### Query Parameters
- `hours` (number): Number of hours to analyze (default: 24)

#### Response
```json
{
  "success": true,
  "data": {
    "time_series": [
      {
        "timestamp": "2025-09-10T13:00:00Z",
        "api_response_time_p95": 89,
        "database_query_time_p95": 32,
        "steam_detection_latency_p95": 3.1,
        "feature_computation_rate": 1205,
        "active_connections": 45,
        "cpu_utilization": 0.62,
        "memory_utilization": 0.58
      }
    ],
    "trends": {
      "api_response_time": {
        "direction": "improving",
        "change_percent": -12.5
      },
      "database_performance": {
        "direction": "stable",
        "change_percent": 2.1
      }
    },
    "capacity_analysis": {
      "current_utilization": 0.67,
      "projected_peak": 0.85,
      "time_to_capacity": "45 days",
      "scaling_recommendation": "Add 1 additional replica"
    }
  },
  "query": { "hours": 24 },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### GET /api/operator-dashboard/analytics/incidents
Get incident metrics, trends, and root cause analysis.

**Authentication**: Required  
**Rate Limit**: Standard

#### Response
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_incidents_30d": 8,
      "mean_time_to_resolution": 23.5,
      "incidents_by_severity": {
        "low": 4,
        "medium": 3,
        "high": 1,
        "critical": 0
      }
    },
    "trends": {
      "incident_frequency": {
        "direction": "decreasing",
        "change_percent": -25.0
      },
      "resolution_time": {
        "direction": "improving",
        "change_percent": -18.2
      }
    },
    "root_causes": [
      {
        "category": "database",
        "count": 3,
        "percentage": 37.5,
        "trend": "increasing"
      },
      {
        "category": "external_api",
        "count": 2,
        "percentage": 25.0,
        "trend": "stable"
      }
    ]
  },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

### GET /api/operator-dashboard/audit/actions
Get operator action history with comprehensive audit trail.

**Authentication**: Required  
**Role**: Operator, Admin  
**Rate Limit**: Standard

#### Query Parameters
- `limit` (number): Maximum number of actions to return (default: 50)

#### Response
```json
{
  "success": true,
  "data": [
    {
      "action_id": "act_20250910_143022",
      "timestamp": "2025-09-10T14:30:22Z",
      "user_id": "user_123",
      "username": "john.operator",
      "action_type": "safe_mode_toggle",
      "details": {
        "safe_mode_enabled": true,
        "reason": "Pre-deployment safety check"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Operator Dashboard)",
      "impact": "system_wide"
    }
  ],
  "query": { "limit": 50 },
  "timestamp": "2025-09-10T14:30:00Z"
}
```

## 🔄 Real-time Data Endpoints

### GET /api/operator-dashboard/stream/events
Server-Sent Events endpoint for real-time dashboard updates.

**Authentication**: Required  
**Rate Limit**: Special (Long-lived connection)

#### Connection
```javascript
const eventSource = new EventSource('/api/operator-dashboard/stream/events', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};
```

#### Event Types

**Connection Event**
```json
{
  "type": "connection",
  "timestamp": "2025-09-10T14:30:00Z",
  "client_id": 1725984600000
}
```

**Incident Created**
```json
{
  "type": "incident_created",
  "data": {
    "incident_id": "inc_20250910_143045",
    "title": "Database connection spike",
    "severity": "medium"
  },
  "timestamp": "2025-09-10T14:30:45Z"
}
```

**SLO Violation**
```json
{
  "type": "slo_violation",
  "data": {
    "slo_name": "api_response_time",
    "current_value": 157,
    "threshold": 100,
    "severity": "warning"
  },
  "timestamp": "2025-09-10T14:30:15Z"
}
```

**System Control Changed**
```json
{
  "type": "system_control_changed",
  "data": {
    "control_type": "safe_mode",
    "enabled": true,
    "changed_by": "user_123",
    "reason": "Pre-deployment safety check"
  },
  "timestamp": "2025-09-10T14:30:22Z"
}
```

**Heartbeat**
```json
{
  "type": "heartbeat",
  "timestamp": "2025-09-10T14:30:00Z"
}
```

## 🚨 Error Handling

All endpoints return consistent error responses:

### Error Response Format
```json
{
  "success": false,
  "error": "Detailed error message",
  "error_code": "SPECIFIC_ERROR_CODE",
  "timestamp": "2025-09-10T14:30:00Z",
  "request_id": "req_1725984600000"
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED`: Missing or invalid authentication token
- `INSUFFICIENT_PERMISSIONS`: User lacks required role/permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests within time window
- `VALIDATION_ERROR`: Invalid request parameters or body
- `RESOURCE_NOT_FOUND`: Requested resource does not exist
- `INTERNAL_ERROR`: Unexpected server error
- `SERVICE_UNAVAILABLE`: Required service is temporarily unavailable

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error
- `503`: Service Unavailable

## 📝 Usage Examples

### JavaScript/TypeScript Client
```typescript
class OperatorDashboardClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async getDashboardMetrics() {
    return this.request('/api/operator-dashboard/metrics');
  }

  async enableSafeMode(reason: string) {
    return this.request('/api/operator-dashboard/controls/safe-mode', {
      method: 'POST',
      body: JSON.stringify({ enabled: true, reason })
    });
  }

  async getActiveIncidents() {
    return this.request('/api/operator-dashboard/incidents/active');
  }

  connectEventStream(onEvent: (event: any) => void) {
    const eventSource = new EventSource(
      `${this.baseUrl}/api/operator-dashboard/stream/events`,
      {
        headers: { 'Authorization': `Bearer ${this.token}` }
      }
    );

    eventSource.onmessage = (event) => {
      onEvent(JSON.parse(event.data));
    };

    return eventSource;
  }
}
```

### cURL Examples

**Get Dashboard Metrics**
```bash
curl -H "Authorization: Bearer <token>" \
     https://api.unittalk.com/api/operator-dashboard/metrics
```

**Enable Safe Mode**
```bash
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "reason": "Maintenance window starting"}' \
     https://api.unittalk.com/api/operator-dashboard/controls/safe-mode
```

**Create Incident**
```bash
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Performance degradation",
       "description": "API response times elevated",
       "severity": "medium",
       "tags": ["performance", "api"]
     }' \
     https://api.unittalk.com/api/operator-dashboard/incidents
```

---

**API Version**: 2.0  
**Last Updated**: September 10, 2025  
**Base URL**: `https://api.unittalk.com`  
**Contact**: Engineering Team