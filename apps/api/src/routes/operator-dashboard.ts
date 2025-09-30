/**
 * =============================================================================
 * OPERATOR DASHBOARD API ROUTES - Fortune 100 Grade Implementation
 * =============================================================================
 * 
 * Comprehensive API endpoints for operator dashboard functionality:
 * - Real-time SLO monitoring and violation tracking
 * - Incident management with automated creation/escalation
 * - System controls (safe mode, circuit breakers, agent management)
 * - Performance analytics and capacity planning metrics
 * - Emergency controls and rollback capabilities
 * 
 * Security Features:
 * - Role-based access control for operator functions
 * - Audit logging for all critical operations
 * - Rate limiting for system control operations
 * - Input validation and sanitization
 */

import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { Metrics } from '../monitoring/metrics';
import SLOMonitoringService from '../services/monitoring/SLOMonitoringService';
import IncidentManagementService from '../services/monitoring/IncidentManagementService';
import OperatorDashboardService from '../services/monitoring/OperatorDashboardService';
import { requireRole, requireAuth } from '../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const logger = createLogger('OperatorDashboardAPI');
const metrics = Metrics.getInstance();

// Initialize services
const sloService = new SLOMonitoringService();
const incidentService = new IncidentManagementService();
const dashboardService = new OperatorDashboardService(sloService, incidentService);

// Rate limiting for critical operations
const criticalOperationsLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Maximum 10 critical operations per 5 minutes
  message: 'Too many critical operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const systemControlsLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Maximum 5 system control operations per minute
  message: 'System control operations limited to 5 per minute',
  standardHeaders: true,
  legacyHeaders: false
});

// Initialize services on startup
Promise.all([
  sloService.start(),
  incidentService.start(),
  dashboardService.start()
]).then(() => {
  logger.info('All operator dashboard services started successfully');
}).catch(error => {
  logger.error('Failed to start operator dashboard services:', error);
});

/**
 * =============================================================================
 * DASHBOARD OVERVIEW ROUTES
 * =============================================================================
 */

/**
 * GET /api/operator-dashboard/metrics
 * Get comprehensive dashboard metrics
 */
router.get('/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    const metrics = await dashboardService.getDashboardMetrics();
    
    const duration = Date.now() - startTime;
    logger.debug(`Retrieved dashboard metrics in ${duration}ms`);
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
      response_time_ms: duration
    });
  } catch (error) {
    logger.error('Failed to get dashboard metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/operator-dashboard/health
 * Get overall system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      services: {
        slo_monitoring: sloService.isHealthy(),
        incident_management: incidentService.isHealthy(),
        operator_dashboard: dashboardService.isHealthy()
      },
      timestamp: new Date().toISOString()
    };

    const allHealthy = Object.values(health.services).every(status => status);
    health.status = allHealthy ? 'healthy' : 'degraded';

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * =============================================================================
 * SLO MONITORING ROUTES
 * =============================================================================
 */

/**
 * GET /api/operator-dashboard/slo/current
 * Get current SLO metrics
 */
router.get('/slo/current', requireAuth, async (req: Request, res: Response) => {
  try {
    const sloMetrics = await sloService.getCurrentSLOMetrics();
    
    res.json({
      success: true,
      data: sloMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get current SLO metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve SLO metrics'
    });
  }
});

/**
 * GET /api/operator-dashboard/slo/error-budgets
 * Get error budget status for all SLOs
 */
router.get('/slo/error-budgets', requireAuth, async (req: Request, res: Response) => {
  try {
    const errorBudgets = await sloService.getErrorBudgets();
    
    res.json({
      success: true,
      data: errorBudgets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error budgets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error budgets'
    });
  }
});

/**
 * GET /api/operator-dashboard/slo/violations
 * Get SLO violation history
 */
router.get('/slo/violations', requireAuth, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const violations = await sloService.getSLOViolationHistory(hours);
    
    res.json({
      success: true,
      data: violations,
      query: { hours },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get SLO violations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve SLO violations'
    });
  }
});

/**
 * =============================================================================
 * INCIDENT MANAGEMENT ROUTES
 * =============================================================================
 */

/**
 * GET /api/operator-dashboard/incidents/active
 * Get active incidents
 */
router.get('/incidents/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const incidents = await incidentService.getActiveIncidents();
    
    res.json({
      success: true,
      data: incidents,
      count: incidents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get active incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active incidents'
    });
  }
});

/**
 * GET /api/operator-dashboard/incidents/:incidentId
 * Get specific incident details
 */
router.get('/incidents/:incidentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const incident = await incidentService.getIncident(incidentId);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }
    
    res.json({
      success: true,
      data: incident,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get incident ${req.params.incidentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve incident'
    });
  }
});

/**
 * GET /api/operator-dashboard/incidents/:incidentId/timeline
 * Get incident timeline
 */
router.get('/incidents/:incidentId/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const timeline = await incidentService.getIncidentTimeline(incidentId);
    
    res.json({
      success: true,
      data: timeline,
      count: timeline.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get incident timeline ${req.params.incidentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve incident timeline'
    });
  }
});

/**
 * POST /api/operator-dashboard/incidents
 * Create new incident
 */
router.post('/incidents', requireAuth, requireRole(['operator', 'admin']), async (req: Request, res: Response) => {
  try {
    const incidentData = req.body;
    const incident = await incidentService.createIncident({
      ...incidentData,
      reporter_id: req.user?.id
    });
    
    logger.info(`Incident ${incident.incident_id} created by ${req.user?.username}`);
    
    res.status(201).json({
      success: true,
      data: incident,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create incident'
    });
  }
});

/**
 * PUT /api/operator-dashboard/incidents/:incidentId/status
 * Update incident status
 */
router.put('/incidents/:incidentId/status', requireAuth, requireRole(['operator', 'admin']), async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { status } = req.body;
    
    await incidentService.updateIncidentStatus(incidentId, status, req.user?.id);
    
    logger.info(`Incident ${incidentId} status updated to ${status} by ${req.user?.username}`);
    
    res.json({
      success: true,
      message: 'Incident status updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to update incident ${req.params.incidentId} status:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update incident status'
    });
  }
});

/**
 * PUT /api/operator-dashboard/incidents/:incidentId/assign
 * Assign incident to user
 */
router.put('/incidents/:incidentId/assign', requireAuth, requireRole(['operator', 'admin']), async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { assigneeId } = req.body;
    
    await incidentService.assignIncident(incidentId, assigneeId, req.user?.id);
    
    logger.info(`Incident ${incidentId} assigned to ${assigneeId} by ${req.user?.username}`);
    
    res.json({
      success: true,
      message: 'Incident assigned successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to assign incident ${req.params.incidentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign incident'
    });
  }
});

/**
 * POST /api/operator-dashboard/incidents/:incidentId/comments
 * Add comment to incident
 */
router.post('/incidents/:incidentId/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { comment } = req.body;
    
    await incidentService.addIncidentComment(incidentId, comment, req.user?.id);
    
    res.json({
      success: true,
      message: 'Comment added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to add comment to incident ${req.params.incidentId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
});

/**
 * =============================================================================
 * SYSTEM CONTROL ROUTES
 * =============================================================================
 */

/**
 * GET /api/operator-dashboard/controls
 * Get system controls state
 */
router.get('/controls', requireAuth, requireRole(['operator', 'admin']), async (req: Request, res: Response) => {
  try {
    const controls = dashboardService.getSystemControls();
    
    res.json({
      success: true,
      data: controls,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system controls'
    });
  }
});

/**
 * POST /api/operator-dashboard/controls/safe-mode
 * Toggle safe mode
 */
router.post('/controls/safe-mode', requireAuth, requireRole(['operator', 'admin']), systemControlsLimit, async (req: Request, res: Response) => {
  try {
    const { enabled, reason } = req.body;
    
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Reason must be at least 10 characters long'
      });
    }
    
    await dashboardService.toggleSafeMode(enabled, reason.trim(), req.user?.id || 'unknown');
    
    logger.warn(`Safe mode ${enabled ? 'ENABLED' : 'DISABLED'} by ${req.user?.username}: ${reason}`);
    
    res.json({
      success: true,
      message: `Safe mode ${enabled ? 'enabled' : 'disabled'} successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to toggle safe mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle safe mode'
    });
  }
});

/**
 * POST /api/operator-dashboard/controls/agents/:agentName
 * Control agent (start/stop/pause/restart)
 */
router.post('/controls/agents/:agentName', requireAuth, requireRole(['operator', 'admin']), systemControlsLimit, async (req: Request, res: Response) => {
  try {
    const { agentName } = req.params;
    const { action, reason } = req.body;
    
    if (!['start', 'stop', 'pause', 'restart'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be one of: start, stop, pause, restart'
      });
    }
    
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Reason must be at least 5 characters long'
      });
    }
    
    await dashboardService.controlAgent(agentName, action, req.user?.id || 'unknown', reason.trim());
    
    logger.info(`Agent ${agentName} ${action} by ${req.user?.username}: ${reason}`);
    
    res.json({
      success: true,
      message: `Agent ${agentName} ${action} command executed successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to control agent ${req.params.agentName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to control agent'
    });
  }
});

/**
 * POST /api/operator-dashboard/controls/circuit-breakers/:serviceName
 * Toggle circuit breaker
 */
router.post('/controls/circuit-breakers/:serviceName', requireAuth, requireRole(['operator', 'admin']), systemControlsLimit, async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { enabled, reason } = req.body;
    
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Reason must be at least 5 characters long'
      });
    }
    
    await dashboardService.toggleCircuitBreaker(serviceName, enabled, req.user?.id || 'unknown', reason.trim());
    
    logger.warn(`Circuit breaker for ${serviceName} ${enabled ? 'ENABLED' : 'DISABLED'} by ${req.user?.username}: ${reason}`);
    
    res.json({
      success: true,
      message: `Circuit breaker for ${serviceName} ${enabled ? 'enabled' : 'disabled'} successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to toggle circuit breaker for ${req.params.serviceName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle circuit breaker'
    });
  }
});

/**
 * POST /api/operator-dashboard/controls/emergency-stop
 * Emergency stop all systems
 */
router.post('/controls/emergency-stop', requireAuth, requireRole(['admin']), criticalOperationsLimit, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    
    if (!reason || typeof reason !== 'string' || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Emergency stop reason must be at least 20 characters long'
      });
    }
    
    await dashboardService.emergencyStop(req.user?.id || 'unknown', reason.trim());
    
    logger.error(`EMERGENCY STOP initiated by ${req.user?.username}: ${reason}`);
    
    res.json({
      success: true,
      message: 'Emergency stop executed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to execute emergency stop:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute emergency stop'
    });
  }
});

/**
 * =============================================================================
 * ANALYTICS AND REPORTING ROUTES
 * =============================================================================
 */

/**
 * GET /api/operator-dashboard/analytics/performance
 * Get performance trends
 */
router.get('/analytics/performance', requireAuth, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const trends = await dashboardService.getPerformanceTrends(hours);
    
    res.json({
      success: true,
      data: trends,
      query: { hours },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get performance trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance trends'
    });
  }
});

/**
 * GET /api/operator-dashboard/analytics/incidents
 * Get incident metrics and trends
 */
router.get('/analytics/incidents', requireAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await incidentService.getIncidentMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get incident analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve incident analytics'
    });
  }
});

/**
 * GET /api/operator-dashboard/audit/actions
 * Get operator action history
 */
router.get('/audit/actions', requireAuth, requireRole(['operator', 'admin']), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const actions = await dashboardService.getOperatorActionHistory(limit);
    
    res.json({
      success: true,
      data: actions,
      query: { limit },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get operator action history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve action history'
    });
  }
});

/**
 * =============================================================================
 * REAL-TIME DATA ROUTES
 * =============================================================================
 */

/**
 * GET /api/operator-dashboard/stream/events
 * Server-Sent Events endpoint for real-time updates
 */
router.get('/stream/events', requireAuth, (req: Request, res: Response) => {
  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const clientId = Date.now();
  logger.info(`SSE client ${clientId} connected`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    timestamp: new Date().toISOString(),
    client_id: clientId
  })}\n\n`);

  // Set up event listeners
  const onIncidentCreated = (incident: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'incident_created',
      data: incident,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  const onSLOViolation = (violation: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'slo_violation',
      data: violation,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  const onSystemControlChanged = (change: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'system_control_changed',
      data: change,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  // Register event listeners
  incidentService.on('incident:created', onIncidentCreated);
  sloService.on('slo:violation', onSLOViolation);
  dashboardService.on('safe_mode:changed', onSystemControlChanged);
  dashboardService.on('circuit_breaker:toggled', onSystemControlChanged);
  dashboardService.on('agent:controlled', onSystemControlChanged);

  // Clean up on client disconnect
  req.on('close', () => {
    logger.info(`SSE client ${clientId} disconnected`);
    incidentService.off('incident:created', onIncidentCreated);
    sloService.off('slo:violation', onSLOViolation);
    dashboardService.off('safe_mode:changed', onSystemControlChanged);
    dashboardService.off('circuit_breaker:toggled', onSystemControlChanged);
    dashboardService.off('agent:controlled', onSystemControlChanged);
  });

  // Send periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

/**
 * =============================================================================
 * ERROR HANDLING
 * =============================================================================
 */

// Error handling middleware
router.use((err: any, req: Request, res: Response, next: any) => {
  logger.error('Operator dashboard API error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

export default router;