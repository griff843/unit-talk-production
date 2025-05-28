import { HealthCheckResult, AgentConfig } from '../../types/agent';

export interface OnboardingFlow {
  id: string;
  userId: string;
  userType: UserType;
  status: OnboardingStatus;
  steps: OnboardingStep[];
  progress: number;
  startDate: Date;
  completionDate?: Date;
  metrics: OnboardingMetrics;
}

export type UserType = 'customer' | 'capper' | 'staff' | 'mod' | 'va' | 'vip';

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'paused'
  | 'blocked'
  | 'failed';

export interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
}

export interface OnboardingPayload {
  userId: string;
  userType: UserType;
  meta?: Record<string, any>;
}

export interface OnboardingResult {
  success: boolean;
  onboardingId: string;
  steps: OnboardingStep[];
}

export interface OnboardingAgentConfig extends AgentConfig {
  agentName: 'OnboardingAgent';
  enabled: boolean;
  metricsConfig: {
    interval: number;
    prefix: string;
  };
}

export type StepType =
  | 'training'
  | 'permission'
  | 'task'
  | 'verification'
  | 'assessment'
  | 'custom';

export type StepStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'blocked'
  | 'skipped'
  | 'failed';

export interface Requirement {
  type: string;
  criteria: Record<string, any>;
  verification: VerificationMethod;
}

export interface VerificationMethod {
  type: 'automatic' | 'manual' | 'hybrid';
  validator: string;
  config: Record<string, any>;
}

export interface Resource {
  type: string;
  url: string;
  format: string;
  required: boolean;
  completionTracking?: boolean;
}

export interface TrainingModule {
  id: string;
  name: string;
  description: string;
  type: TrainingType;
  content: TrainingContent[];
  assessments: Assessment[];
  prerequisites?: string[];
  certification?: Certification;
}

export type TrainingType =
  | 'technical'
  | 'operational'
  | 'compliance'
  | 'security'
  | 'product'
  | 'custom';

export interface TrainingContent {
  id: string;
  title: string;
  type: 'video' | 'document' | 'interactive' | 'quiz';
  content: Record<string, any>;
  duration: number;
  required: boolean;
}

export interface Assessment {
  id: string;
  type: string;
  questions: Question[];
  passingScore: number;
  maxAttempts: number;
  timeLimit?: number;
}

export interface Question {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'open_ended';
  content: string;
  options?: string[];
  correctAnswer: any;
  points: number;
}

export interface Certification {
  name: string;
  validityPeriod: number;
  renewalRequirements: string[];
  badge?: string;
}

export interface PermissionSet {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  roles: string[];
  restrictions: Restriction[];
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
  expiry?: Date;
}

export interface Restriction {
  type: string;
  rules: Record<string, any>;
  enforcement: 'strict' | 'warning' | 'logging';
}

export interface UserProgress {
  userId: string;
  onboardingFlow: string;
  currentStep: string;
  completedSteps: string[];
  trainingProgress: Record<string, ModuleProgress>;
  permissions: PermissionSet[];
  metrics: ProgressMetrics;
}

export interface ModuleProgress {
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  assessmentScores: Record<string, number>;
  timeSpent: number;
  lastActivity: Date;
}

export interface ProgressMetrics {
  completionRate: number;
  timeSpent: number;
  assessmentAverage: number;
  engagementScore: number;
}

export interface OnboardingMetrics {
  completion: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  timing: {
    averageCompletionTime: number;
    fastestCompletion: number;
    slowestCompletion: number;
  };
  success: {
    successRate: number;
    failureRate: number;
    commonBlockers: Record<string, number>;
  };
}

// Event types for logging and monitoring
export type OnboardingEventType =
  | 'flow_started'
  | 'step_completed'
  | 'training_assigned'
  | 'assessment_completed'
  | 'permission_updated'
  | 'certification_issued'
  | 'progress_updated'
  | 'system_error';

export interface OnboardingEvent {
  type: OnboardingEventType;
  timestamp: Date;
  userId: string;
  flowId: string;
  details: Record<string, any>;
  severity: 'info' | 'warn' | 'error';
  correlationId: string;
}

export interface OnboardingAgentMetrics {
  flows: {
    active: number;
    completed: number;
    successRate: number;
    averageCompletionTime: number;
  };
  training: {
    activeModules: number;
    completionRate: number;
    assessmentPassRate: number;
    certificationRate: number;
  };
  permissions: {
    totalSets: number;
    averageGrantTime: number;
    escalationRate: number;
    reviewRate: number;
  };
  healthStatus: HealthCheckResult;
} 