import { ActivityResult } from '../shared/activity-results';

export interface AuditAgentActivities {
  runAudit(params: { agentId: string; timestamp?: string }): Promise<ActivityResult>;
}
