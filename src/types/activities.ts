import { AgentStatus, HealthStatus } from './shared';

// Base interface for all agent activities
export interface BaseAgentActivities {
  // Core operations
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Health and monitoring
  checkHealth(): Promise<HealthStatus>;
  reportStatus(): Promise<AgentStatus>;
  
  // Error handling
  handleError(error: Error, context: string): Promise<void>;
}

// Analytics Agent Activities
export interface AnalyticsAgentActivities extends BaseAgentActivities {
  runAnalysis(params: any): Promise<void>;
  generateReport(params: any): Promise<any>;
}

// Grading Agent Activities
export interface GradingAgentActivities extends BaseAgentActivities {
  processGrades(params: any): Promise<void>;
  validateGrade(params: any): Promise<boolean>;
}

// Contest Agent Activities
export interface ContestAgentActivities extends BaseAgentActivities {
  manageContest(params: any): Promise<void>;
  validateEntry(params: any): Promise<boolean>;
}

// Alert Agent Activities
export interface AlertAgentActivities extends BaseAgentActivities {
  processAlerts(params: any): Promise<void>;
  sendAlert(params: any): Promise<void>;
}

// Promo Agent Activities
export interface PromoAgentActivities extends BaseAgentActivities {
  executePromotion(params: any): Promise<void>;
  validatePromo(params: any): Promise<boolean>;
}

// Notification Agent Activities
export interface NotificationAgentActivities extends BaseAgentActivities {
  sendNotifications(params: any): Promise<void>;
  validateNotification(params: any): Promise<boolean>;
}

// Feed Agent Activities
export interface FeedAgentActivities extends BaseAgentActivities {
  processFeed(params: any): Promise<void>;
  validateFeedItem(params: any): Promise<boolean>;
}

// Operator Agent Activities
export interface OperatorAgentActivities extends BaseAgentActivities {
  executeOperations(params: any): Promise<void>;
  validateOperation(params: any): Promise<boolean>;
}

// Audit Agent Activities
export interface AuditAgentActivities extends BaseAgentActivities {
  performAudit(params: any): Promise<void>;
  generateAuditReport(params: any): Promise<any>;
}

// Activity Parameters Types
export interface ActivityParams {
  agentId: string;
  timestamp: string;
  metadata: Record<string, any>;
  [key: string]: any;
}

// Activity Result Types
export interface ActivityResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
  timestamp: string;
} 