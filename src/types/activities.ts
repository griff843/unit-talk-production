import { AgentCommand, HealthCheckResult } from './agent';
import { Metrics } from './shared';

// Base interface for all agent activities
export interface BaseAgentActivities {
  // Core operations
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  
  // Health and monitoring
  checkHealth(): Promise<HealthCheckResult>;
  collectMetrics(): Promise<Metrics>;
  
  // Error handling
  handleCommand(command: AgentCommand): Promise<void>;
}

// Analytics Agent Activities
export interface AnalyticsAgentActivities extends BaseAgentActivities {
  runAnalysis(params: ActivityParams): Promise<ActivityResult>;
  generateReport(params: ActivityParams): Promise<ActivityResult>;
  exportData(params: ActivityParams): Promise<ActivityResult>;
}

// Grading Agent Activities
export interface GradingAgentActivities extends BaseAgentActivities {
  gradeSubmission(params: ActivityParams): Promise<ActivityResult>;
  updateGrades(params: ActivityParams): Promise<ActivityResult>;
  generateFeedback(params: ActivityParams): Promise<ActivityResult>;
}

// Contest Agent Activities
export interface ContestAgentActivities extends BaseAgentActivities {
  createContest(params: ActivityParams): Promise<ActivityResult>;
  processEntries(params: ActivityParams): Promise<ActivityResult>;
  determineWinners(params: ActivityParams): Promise<ActivityResult>;
}

// Alert Agent Activities
export interface AlertAgentActivities extends BaseAgentActivities {
  processAlert(params: ActivityParams): Promise<ActivityResult>;
  notifyStakeholders(params: ActivityParams): Promise<ActivityResult>;
  escalateAlert(params: ActivityParams): Promise<ActivityResult>;
}

// Promo Agent Activities
export interface PromoAgentActivities extends BaseAgentActivities {
  createPromotion(params: ActivityParams): Promise<ActivityResult>;
  validatePromoCode(params: ActivityParams): Promise<ActivityResult>;
  trackPromoUsage(params: ActivityParams): Promise<ActivityResult>;
}

// Notification Agent Activities
export interface NotificationAgentActivities extends BaseAgentActivities {
  sendNotification(params: ActivityParams): Promise<ActivityResult>;
  processQueue(params: ActivityParams): Promise<ActivityResult>;
  checkDeliveryStatus(params: ActivityParams): Promise<ActivityResult>;
}

// Feed Agent Activities
export interface FeedAgentActivities extends BaseAgentActivities {
  fetchFeed(params: ActivityParams): Promise<ActivityResult>;
  processFeedItems(params: ActivityParams): Promise<ActivityResult>;
  updateFeedStatus(params: ActivityParams): Promise<ActivityResult>;
}

// Operator Agent Activities
export interface OperatorAgentActivities extends BaseAgentActivities {
  monitorSystem(params: ActivityParams): Promise<ActivityResult>;
  handleIncident(params: ActivityParams): Promise<ActivityResult>;
  generateStatusReport(params: ActivityParams): Promise<ActivityResult>;
}

// Audit Agent Activities
export interface AuditAgentActivities extends BaseAgentActivities {
  runAudit(params: ActivityParams): Promise<ActivityResult>;
  generateAuditReport(params: ActivityParams): Promise<ActivityResult>;
  archiveAuditData(params: ActivityParams): Promise<ActivityResult>;
}

// Activity Parameters Types
export interface ActivityParams {
  agentName: string;
  [key: string]: any;
}

// Activity Result Types
export interface ActivityResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
} 