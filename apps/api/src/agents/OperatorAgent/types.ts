import { BaseAgentConfig } from '../BaseAgent/types';

export interface OperatorAgentConfig extends BaseAgentConfig {
  operator?: {
    monitoringInterval?: number; // minutes
    escalationThreshold?: number; // number of failures before escalation
    summarySchedule?: {
      daily?: boolean;
      weekly?: boolean;
      monthly?: boolean;
    };
    learningCycleInterval?: number; // days
  };
}

export interface AgentTask {
  type: string;
  agent: string;
  details: string;
  priority: string;
  status?: string;
  created_at?: string;
  retries?: number;
  due_date?: string;
  urgency?: number;
  [key: string]: any;
}

export interface SystemEvent {
  event_type: string;
  agent: string;
  message: string;
  status: string;
  escalation: boolean;
  action_required: boolean;
  meta: any;
  timestamp?: string;
}

export interface OperatorCommand {
  command: string;
  user?: string;
  timestamp?: string;
}

export interface OperatorSummary {
  period: 'daily' | 'weekly' | 'monthly';
  content: string;
  insights?: string[];
  recommendations?: string[];
} 