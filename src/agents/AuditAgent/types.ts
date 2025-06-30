import * as z from 'zod';

export const AuditIncidentSchema = z.object({
  id: z.string(),
  table: z.string(),
  tableName: z.string().optional(),
  row_id: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical', 'warning']),
  description: z.string(),
  timestamp: z.date(),
  detectedAt: z.string().optional(),
  type: z.string().optional()
});

export type AuditIncident = z.infer<typeof AuditIncidentSchema>;