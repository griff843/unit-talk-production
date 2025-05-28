import { AuditAgent } from '..';
import { AuditParams } from '../types';

export async function performAudit(params: AuditParams): Promise<void> {
  const agent = new AuditAgent();
  await agent.initialize();
  await agent.performAudit(params);
}

export async function generateReport(params: AuditParams): Promise<void> {
  const agent = new AuditAgent();
  await agent.initialize();
  await agent.generateReport(params);
}

export async function archiveAuditLogs(): Promise<void> {
  const agent = new AuditAgent();
  await agent.initialize();
  await agent.archiveLogs();
}

export async function validateCompliance(): Promise<void> {
  const agent = new AuditAgent();
  await agent.initialize();
  await agent.validateCompliance();
} 